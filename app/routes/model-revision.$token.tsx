/**
 * "Fix your profile and resubmit" — reached only by the tokenised link an
 * admin sends when they ask for changes rather than rejecting.
 *
 * Deliberately outside the authenticated model area: an account in
 * `revision_required` cannot log in, so there is no session to hang this
 * off. The token in the URL is the entire credential, which is why the
 * loader and the action both re-check it and why it is destroyed on use.
 */

import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import {
  getModelByRevisionToken,
  submitModelRevision,
} from "~/services/model-revision.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const model = await getModelByRevisionToken(params.token as string);
  return { model };
}

export async function action({ params, request }: ActionFunctionArgs) {
  const token = params.token as string;
  const formData = await request.formData();

  const text = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  };

  const firstName = text("firstName");
  if (!firstName) {
    return { error: "First name is required." };
  }

  const dobRaw = text("dob");
  const whatsappRaw = text("whatsapp");

  try {
    await submitModelRevision(token, {
      firstName,
      lastName: text("lastName"),
      gender: text("gender"),
      bio: text("bio"),
      address: text("address"),
      career: text("career"),
      education: text("education"),
      relationshipStatus: text("relationshipStatus"),
      ...(dobRaw ? { dob: new Date(dobRaw) } : {}),
      ...(whatsappRaw && Number.isFinite(Number(whatsappRaw))
        ? { whatsapp: Number(whatsappRaw) }
        : {}),
    });
    return { submitted: true };
  } catch (error) {
    console.error("[model-revision] submit failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save your changes. Please try again.",
    };
  }
}

export default function ModelRevision() {
  const { model } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const [showAll, setShowAll] = useState(false);

  // Expired, already used, or never existed — all look the same from here,
  // so the page can't be used to probe which tokens are real.
  if (!model) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-gray-900">
          This link is no longer valid
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          It may have expired, or you may have already submitted your changes.
          Please contact XaoSao support and ask for a new link.
        </p>
      </Shell>
    );
  }

  if (actionData && "submitted" in actionData && actionData.submitted) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-gray-900">Thank you</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your profile has been sent back for review. We will contact you once
          it has been checked. You can close this page.
        </p>
      </Shell>
    );
  }

  const dobValue = model.dob
    ? new Date(model.dob).toISOString().slice(0, 10)
    : "";

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-gray-900">
        Please update your profile
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Hello {model.firstName}, your account has not been approved yet.
      </p>

      {model.revisionReason && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">
            What needs to change
          </p>
          <p className="mt-1 text-sm text-amber-900">{model.revisionReason}</p>
        </div>
      )}

      {actionData && "error" in actionData && actionData.error && (
        <p className="mt-4 text-sm text-red-600">{actionData.error}</p>
      )}

      <Form method="post" className="mt-5 space-y-4">
        <Field label="First name *" name="firstName" defaultValue={model.firstName} required />
        <Field label="Last name" name="lastName" defaultValue={model.lastName ?? ""} />

        <div>
          <Label htmlFor="bio">About you</Label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={500}
            defaultValue={model.bio ?? ""}
            className={inputClass}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-rose-600 underline"
        >
          {showAll ? "Hide other details" : "Edit other details"}
        </button>

        {showAll && (
          <div className="space-y-4 border-t pt-4">
            <Field label="Date of birth" name="dob" type="date" defaultValue={dobValue} />
            <div>
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                name="gender"
                defaultValue={model.gender ?? ""}
                className={inputClass}
              >
                <option value="">Not set</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Field label="Phone (WhatsApp)" name="whatsapp" type="number" defaultValue={model.whatsapp ? String(model.whatsapp) : ""} />
            <Field label="Address" name="address" defaultValue={model.address ?? ""} />
            <Field label="Career" name="career" defaultValue={model.career ?? ""} />
            <Field label="Education" name="education" defaultValue={model.education ?? ""} />
            <Field label="Relationship status" name="relationshipStatus" defaultValue={model.relationshipStatus ?? ""} />
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-600">
            To change your profile photo, please send the new photo to XaoSao
            support. Photo uploads are not available on this page.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {isSubmitting ? "Sending..." : "Submit for review"}
        </button>
        <p className="text-center text-[11px] text-gray-400">
          This link works once. After you submit, your account goes back into
          the approval queue.
        </p>
      </Form>
    </Shell>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-gray-600">
      {children}
    </label>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </div>
  );
}
