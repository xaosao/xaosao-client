/**
 * Credentials-only account deactivation.
 *
 * Called from /deactivate, which lets a user delete their account
 * WITHOUT logging in first. Verifies phone + password with bcrypt
 * against the appropriate collection, then delegates to the existing
 * delete helpers (which handle soft-vs-hard delete, audit logging,
 * wallet refunds, etc.).
 *
 * Lives in a .server.ts file so prisma + bcryptjs never ship to the
 * client bundle.
 */

import bcrypt from "bcryptjs";
import { prisma } from "./database.server";
import { deleteAccount } from "./profile.server";
import { deleteModelAccount } from "./model.server";

export type DeactivateInput = {
  userType: "customer" | "model";
  /** Raw phone string from the form (any non-digit chars get stripped). */
  phone: string;
  password: string;
  /** Optional UX reason ("privacy", "not_useful", etc.). */
  reason?: string;
};

export type DeactivateResult =
  | { ok: true }
  | { ok: false; error: DeactivateErrorCode };

export type DeactivateErrorCode =
  | "deactivate.errors.missingFields"
  | "deactivate.errors.invalidUserType"
  | "deactivate.errors.invalidPhone"
  | "deactivate.errors.invalidCredentials"
  | "deactivate.errors.unknown";

export async function deactivateByCredentials(
  input: DeactivateInput,
): Promise<DeactivateResult> {
  const { userType, phone, password, reason } = input;

  if (!userType || !phone || !password) {
    return { ok: false, error: "deactivate.errors.missingFields" };
  }
  if (userType !== "customer" && userType !== "model") {
    return { ok: false, error: "deactivate.errors.invalidUserType" };
  }

  const digits = phone.replace(/\D/g, "");
  const whatsapp = Number(digits);
  if (!whatsapp || Number.isNaN(whatsapp)) {
    return { ok: false, error: "deactivate.errors.invalidPhone" };
  }

  try {
    if (userType === "customer") {
      const customer = await prisma.customer.findFirst({
        where: { whatsapp },
        select: { id: true, password: true },
      });
      if (!customer?.password) {
        return { ok: false, error: "deactivate.errors.invalidCredentials" };
      }
      const ok = await bcrypt.compare(password, customer.password);
      if (!ok) {
        return { ok: false, error: "deactivate.errors.invalidCredentials" };
      }
      await deleteAccount(customer.id);
      return { ok: true };
    }

    const model = await prisma.model.findFirst({
      where: { whatsapp },
      select: { id: true, password: true },
    });
    if (!model?.password) {
      return { ok: false, error: "deactivate.errors.invalidCredentials" };
    }
    const ok = await bcrypt.compare(password, model.password);
    if (!ok) {
      return { ok: false, error: "deactivate.errors.invalidCredentials" };
    }
    await deleteModelAccount(model.id, password, reason);
    return { ok: true };
  } catch (err) {
    console.error("[deactivate] unexpected error:", err);
    return { ok: false, error: "deactivate.errors.unknown" };
  }
}
