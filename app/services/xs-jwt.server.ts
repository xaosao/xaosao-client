/**
 * xs_backend JWT minting.
 *
 * The website authenticates users itself (Prisma + bcrypt) and keeps an
 * httpOnly session cookie — it never receives a token from xs_backend. But
 * xs_backend's chat / notification APIs are guarded by `JwtAuthGuard`, which
 * expects a bearer token signed with the per-role secret.
 *
 * Both services are first-party and back onto the same MongoDB, so instead of
 * replaying the user's password against `/client/auth/login` (impossible for
 * OTP / Google logins, and for sessions that already exist) we sign the token
 * here with the same secret. The payload matches `NewJwtPayload` in
 * xs_backend/src/modules/auth/strategies/new-jwt.strategy.ts:
 *
 *     { sub: <user id>, userType: 'customer' | 'model' }
 *
 * The backend still re-loads the user from Mongo on every request and rejects
 * suspended/deleted accounts, so a minted token grants nothing the session
 * itself didn't already grant.
 *
 * Implemented with node:crypto rather than a JWT library — HS256 is a single
 * HMAC and this keeps the dependency surface unchanged.
 */

import crypto from "crypto";

export type XsUserType = "customer" | "model";

/** Tokens handed to server-side fetches. Short — they live for one request. */
const SERVER_TOKEN_TTL_SECONDS = 5 * 60;

/**
 * Tokens handed to the browser for the socket.io handshake. Longer, because
 * the socket must survive a reconnect loop, but still short enough that a
 * leaked token expires on its own. The client refetches from
 * `/api/chat/token` when it expires.
 */
export const BROWSER_TOKEN_TTL_SECONDS = 60 * 60;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function secretFor(userType: XsUserType): string {
  const secret =
    userType === "model"
      ? process.env.JWT_SECRET_MODEL
      : process.env.JWT_SECRET_CLIENT;

  if (!secret) {
    throw new Error(
      `[xs-jwt] Missing ${
        userType === "model" ? "JWT_SECRET_MODEL" : "JWT_SECRET_CLIENT"
      } in .env — copy the value from xs_backend/.env so the website can talk ` +
        `to the chat / notification APIs.`
    );
  }

  return secret;
}

/**
 * Sign an xs_backend-compatible access token for the given user.
 *
 * `ttlSeconds` defaults to a short server-side lifetime; pass
 * `BROWSER_TOKEN_TTL_SECONDS` when the token is going to the browser.
 */
export function mintXsToken(
  userId: string,
  userType: XsUserType,
  ttlSeconds: number = SERVER_TOKEN_TTL_SECONDS
): { token: string; expiresAt: number } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      userType,
      // `_kid` is what ChatGateway.getSecretForToken() reads first when
      // picking the verification secret for the socket handshake.
      _kid: userType,
      iat: issuedAt,
      exp: expiresAt,
    })
  );

  const signature = base64url(
    crypto
      .createHmac("sha256", secretFor(userType))
      .update(`${header}.${payload}`)
      .digest()
  );

  return { token: `${header}.${payload}.${signature}`, expiresAt };
}
