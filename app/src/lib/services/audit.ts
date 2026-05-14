import { prisma } from "@/lib/prisma";

export async function writeAudit({
  entityType,
  entityId,
  action,
  changedById,
  priorState,
  nextState,
}: {
  entityType: string;
  entityId: string;
  action: string;
  changedById: string;
  priorState?: object | null;
  nextState?: object | null;
}) {
  await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      changedById,
      priorState: priorState ?? undefined,
      nextState: nextState ?? undefined,
    },
  });
}
