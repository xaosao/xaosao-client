/**
 * Thin fetch wrapper around the xs_backend REST API (the same API the iOS /
 * Android app talks to).
 *
 * Every call is made server-side from a loader / action so the minted JWT
 * never reaches the browser. The one exception is the socket handshake token,
 * which is issued separately by `/api/chat/token`.
 *
 * Response shapes are NOT uniform on the backend — only a date-serialization
 * interceptor is global, there is no envelope interceptor:
 *   - chat endpoints return raw `{ data, pagination }` / `{ unread_count }`
 *   - notification endpoints return the `handleSuccessOne` envelope
 *     `{ is_error, code, message, la_message, data, error, status_code }`
 * `unwrapEnvelope()` below normalises the second shape; chat callers read the
 * raw body directly.
 */

import { mintXsToken, type XsUserType } from "./xs-jwt.server";

export class XsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "XsApiError";
  }
}

/** Base URL for the REST API, e.g. `https://api.xaosao.com/api/v1/`. */
export function xsApiUrl(): string {
  const raw = process.env.XS_API_URL;
  if (!raw) {
    throw new Error(
      "[xs-api] XS_API_URL is not set. Add it to .env — " +
        'local: "http://localhost:3033/api/v1/", production: "https://api.xaosao.com/api/v1/"'
    );
  }
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** Origin the browser opens the socket.io `/chat` namespace against. */
export function xsSocketUrl(): string {
  const explicit = process.env.XS_SOCKET_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Derive it from the REST URL — the gateway is served on the same port as
  // HTTP, just without the /api/v1 prefix.
  const url = new URL(xsApiUrl());
  return `${url.protocol}//${url.host}`;
}

interface XsRequestOptions {
  userId: string;
  userType: XsUserType;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body. Ignored when `formData` is given. */
  body?: unknown;
  /** Multipart body — used for image messages. */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Fail the request instead of hanging if the backend is down. */
  timeoutMs?: number;
}

/**
 * Perform an authenticated request against xs_backend.
 *
 * Throws `XsApiError` on any non-2xx response, carrying the backend's own
 * message so callers can surface e.g. "Your subscription has expired."
 */
export async function xsRequest<T = unknown>(
  path: string,
  options: XsRequestOptions
): Promise<T> {
  const {
    userId,
    userType,
    method = "GET",
    body,
    formData,
    query,
    timeoutMs = 15_000,
  } = options;

  const url = new URL(path.replace(/^\/+/, ""), xsApiUrl());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const { token } = mintXsToken(userId, userType);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  let payload: BodyInit | undefined;
  if (formData) {
    // Let fetch set the multipart boundary itself.
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timer);
    const reason =
      error?.name === "AbortError"
        ? `Request to ${url.pathname} timed out after ${timeoutMs}ms`
        : error?.message || "Network error";
    throw new XsApiError(0, `[xs-api] ${reason}`, "NETWORK_ERROR");
  }
  clearTimeout(timer);

  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      (typeof parsed === "object" && parsed !== null
        ? parsed.message || parsed.error?.message
        : null) || `xs_backend responded ${response.status}`;
    throw new XsApiError(
      response.status,
      Array.isArray(message) ? message.join(", ") : String(message),
      typeof parsed === "object" && parsed !== null ? parsed.code : undefined,
      parsed
    );
  }

  return parsed as T;
}

/**
 * Pull the payload out of an xs_backend response.
 *
 * Two layers can be present, and which ones you get depends on the endpoint:
 *
 *   1. The `handleSuccessOne` / global transform envelope
 *      `{ is_error, code, message, la_message, data, ... }`.
 *   2. A controller that itself returns `{ data: ... }` — several chat
 *      endpoints do. When the interceptor wraps one of those, the payload
 *      ends up DOUBLE-wrapped as `data.data`.
 *
 * The interceptor flattens arrays (so list endpoints come back single-wrapped)
 * but not objects, which is why `GET /chat/conversations/:id` nests and
 * `GET /chat/conversations` does not.
 *
 * So: strip the envelope, then keep peeling while what's left is a plain
 * object whose ONLY key is `data`. That test is deliberately narrow — a real
 * payload that merely happens to contain a `data` field alongside anything
 * else is left alone.
 */
export function unwrapEnvelope<T>(response: any): T {
  let value: any = response;

  if (
    value &&
    typeof value === "object" &&
    "is_error" in value &&
    "data" in value
  ) {
    if (value.is_error) {
      throw new XsApiError(
        value.status_code ?? 400,
        value.message || "Request failed",
        value.code,
        value
      );
    }
    value = value.data;
  }

  // Bounded so a pathological payload can't spin here.
  for (let depth = 0; depth < 3; depth++) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      "data" in value
    ) {
      value = value.data;
      continue;
    }
    break;
  }

  return value as T;
}
