import type { IAuditLogsCreate } from "~/interfaces/logs";
import { prisma } from "./database.server";

export async function createAuditLogs(data: IAuditLogsCreate) {
  try {
    return await prisma.audit_logs.create({
      data: {
        action: data.action,
        description: data.description,
        status: data.status,
        onSuccess: data.onSuccess,
        onError: data.onError,
        ...(data.model && { model: { connect: { id: data.model } } }),
        ...(data.customer && { customer: { connect: { id: data.customer } } }),
        ...(data.user && { user: { connect: { id: data.user } } }),
      },
    });
  } catch (error) {
    console.error("CREATE_AUDIT_LOGS_FAILED", error);
    // Don't throw - just log the error to avoid breaking the main flow
    return null;
  }
}
