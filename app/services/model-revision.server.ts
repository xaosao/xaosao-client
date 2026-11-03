/**
 * Model revision — the recoverable alternative to rejection.
 *
 * When an admin asks a new model to fix something, the account moves to
 * `revision_required` and a one-off token is issued. The model cannot log
 * in (no unapproved account can), so this token is their only way back in:
 * it opens a single page where they correct their profile and resubmit,
 * which returns them to `pending` for another review.
 *
 * The token is the whole security boundary, so it is checked on every
 * request, expires, and is destroyed the moment it is used.
 */

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

export type RevisionModel = {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date | null;
  gender: string | null;
  whatsapp: number | null;
  address: string | null;
  bio: string | null;
  career: string | null;
  education: string | null;
  relationshipStatus: string | null;
  profile: string | null;
  available_status: string | null;
  revisionReason: string | null;
};

/**
 * Resolve a revision token to the model it belongs to.
 *
 * Returns null for anything that shouldn't open the page: unknown token,
 * expired token, or an account that has since moved on (approved,
 * rejected, already resubmitted). Deliberately one undifferentiated null —
 * the page says "this link is no longer valid" rather than confirming
 * which token strings exist.
 */
export async function getModelByRevisionToken(
  token: string
): Promise<RevisionModel | null> {
  if (!token || token.length < 32) return null;

  const model = await prisma.model.findFirst({
    where: {
      revisionToken: token,
      status: "revision_required",
      revisionTokenExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      whatsapp: true,
      address: true,
      bio: true,
      career: true,
      education: true,
      relationshipStatus: true,
      profile: true,
      available_status: true,
      revisionReason: true,
    },
  });

  return model as RevisionModel | null;
}

/**
 * Save the model's corrections and put them back in the approval queue.
 *
 * The token is cleared here, so the link works exactly once. If the admin
 * wants more changes afterwards, they send a fresh request with a new one.
 */
export async function submitModelRevision(
  token: string,
  data: Record<string, unknown>
) {
  const model = await getModelByRevisionToken(token);
  if (!model) {
    throw new Error("This link is no longer valid.");
  }

  const updated = await prisma.model.update({
    where: { id: model.id },
    data: {
      ...data,
      status: "pending",
      // Burn the token and clear the request — the model has answered it.
      revisionToken: null,
      revisionTokenExpiresAt: null,
      revisionReason: null,
      updatedAt: new Date(),
    },
  });

  await createAuditLogs({
    action: "MODEL_REVISION_SUBMITTED",
    model: model.id,
    description: `Model ${model.id} corrected their profile after a change request and resubmitted for approval.`,
    status: "success",
    onSuccess: { id: updated.id, status: updated.status },
  });

  return updated;
}
