import { prisma } from "@/lib/prisma";
import { writeAudit } from "./audit";
import type { CloseReason, TesterStatus } from "@/generated/prisma/client";

const PRE_OUTREACH_STATUSES: TesterStatus[] = [
  "nominated",
  "csm_pending",
  "csm_approved",
  "outreach_sent",
];

export async function closeBeta({
  featureId,
  closedById,
  closeReason,
  closeNotes,
  force = false,
}: {
  featureId: string;
  closedById: string;
  closeReason: CloseReason;
  closeNotes?: string;
  force?: boolean;
}) {
  const feature = await prisma.betaFeature.findUniqueOrThrow({
    where: { id: featureId },
  });

  if (feature.status === "closed") {
    return { error: "Beta is already closed.", status: 400 };
  }

  const prior = { ...feature };

  // Cancel all pre-outreach enrollments
  const cancelledEnrollments = await prisma.betaEnrollment.findMany({
    where: { featureId, testerStatus: { in: PRE_OUTREACH_STATUSES } },
  });
  await prisma.betaEnrollment.updateMany({
    where: { featureId, testerStatus: { in: PRE_OUTREACH_STATUSES } },
    data: { testerStatus: "cancelled" },
  });
  for (const e of cancelledEnrollments) {
    await writeAudit({
      entityType: "BetaEnrollment",
      entityId: e.id,
      action: "cancelled_on_beta_close",
      changedById: closedById,
      priorState: e,
      nextState: { ...e, testerStatus: "cancelled" },
    });
  }

  const activeCount = await prisma.betaEnrollment.count({
    where: { featureId, testerStatus: "active" },
  });

  let newStatus: "closed" | "closing";
  let closedAt: Date | undefined;

  if (force || activeCount === 0) {
    // Force-close: drop all active enrollments too
    if (force && activeCount > 0) {
      const activeEnrollments = await prisma.betaEnrollment.findMany({
        where: { featureId, testerStatus: "active" },
      });
      await prisma.betaEnrollment.updateMany({
        where: { featureId, testerStatus: "active" },
        data: { testerStatus: "dropped", droppedAt: new Date() },
      });
      for (const e of activeEnrollments) {
        await writeAudit({
          entityType: "BetaEnrollment",
          entityId: e.id,
          action: "dropped_on_force_close",
          changedById: closedById,
          priorState: e,
          nextState: { ...e, testerStatus: "dropped", droppedAt: new Date() },
        });
      }
    }
    newStatus = "closed";
    closedAt = new Date();
  } else {
    newStatus = "closing";
  }

  const updated = await prisma.betaFeature.update({
    where: { id: featureId },
    data: { status: newStatus, closedAt, closeReason, closeNotes },
  });

  await writeAudit({
    entityType: "BetaFeature",
    entityId: featureId,
    action: "closed",
    changedById: closedById,
    priorState: prior,
    nextState: updated,
  });

  return { feature: updated };
}

export async function cloneBeta({
  featureId,
  createdById,
  overrides,
}: {
  featureId: string;
  createdById: string;
  overrides?: Partial<{
    name: string;
    startDate: Date;
    outreachDeadline: Date;
    ownerPmId: string;
    ownerPmmId: string;
  }>;
}) {
  const source = await prisma.betaFeature.findUniqueOrThrow({
    where: { id: featureId },
  });

  const clone = await prisma.betaFeature.create({
    data: {
      name: overrides?.name ?? `${source.name} (clone)`,
      ownerPmId: overrides?.ownerPmId ?? source.ownerPmId,
      ownerPmmId: overrides?.ownerPmmId ?? source.ownerPmmId,
      targetTesterCount: source.targetTesterCount,
      status: "draft",
      startDate: overrides?.startDate ?? source.startDate,
      outreachDeadline: overrides?.outreachDeadline ?? source.outreachDeadline,
      idealClientCriteria: source.idealClientCriteria,
      clonedFromId: source.id,
    },
  });

  await writeAudit({
    entityType: "BetaFeature",
    entityId: clone.id,
    action: "cloned",
    changedById: createdById,
    nextState: clone,
  });

  return { feature: clone };
}
