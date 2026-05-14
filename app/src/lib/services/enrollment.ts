import { prisma } from "@/lib/prisma";
import { writeAudit } from "./audit";
import type { TesterStatus, ApprovalStatus } from "@/generated/prisma/client";

const OUTREACH_WINDOW_DAYS = 14;
const ACTIVE_STATUSES: TesterStatus[] = [
  "nominated",
  "csm_pending",
  "csm_approved",
  "outreach_sent",
];

export async function nominateClient({
  clientId,
  featureId,
  assignedById,
  force = false,
}: {
  clientId: string;
  featureId: string;
  assignedById: string;
  force?: boolean;
}) {
  const [client, feature, existing] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    prisma.betaFeature.findUniqueOrThrow({ where: { id: featureId } }),
    prisma.betaEnrollment.findUnique({
      where: { clientId_featureId: { clientId, featureId } },
    }),
  ]);

  if (client.accountHealth === "red") {
    return { error: "Client account health is red — nomination blocked.", status: 400 };
  }

  if (feature.status === "closing" || feature.status === "closed") {
    return { error: "Beta is no longer accepting nominations.", status: 400 };
  }

  if (existing) {
    return { error: "Client is already nominated for this beta.", status: 409 };
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - OUTREACH_WINDOW_DAYS);
  const activeCount = await prisma.betaEnrollment.count({
    where: {
      clientId,
      testerStatus: { in: ACTIVE_STATUSES },
      createdAt: { gte: windowStart },
    },
  });

  const warning = client.accountHealth === "yellow"
    ? "Client account health is yellow — proceed with CSM discretion."
    : undefined;

  const conflictWarning = activeCount >= 3 && !force
    ? `Client has ${activeCount} active enrollments in the last ${OUTREACH_WINDOW_DAYS} days. Pass force: true to override.`
    : undefined;

  if (conflictWarning) {
    return { error: conflictWarning, status: 409, conflict: true };
  }

  const confirmedCount = await prisma.betaEnrollment.count({
    where: { featureId, testerStatus: { in: ["confirmed", "active", "completed"] } },
  });
  const isOverflow = confirmedCount >= feature.targetTesterCount;

  const enrollment = await prisma.betaEnrollment.create({
    data: {
      clientId,
      featureId,
      assignedById,
      isOverflow,
      testerStatus: "nominated",
      csmApprovalStatus: "pending",
    },
  });

  await writeAudit({
    entityType: "BetaEnrollment",
    entityId: enrollment.id,
    action: "nominated",
    changedById: assignedById,
    nextState: enrollment,
  });

  return { enrollment, warning };
}

export async function updateEnrollmentStatus({
  enrollmentId,
  testerStatus,
  changedById,
  dropReason,
}: {
  enrollmentId: string;
  testerStatus: TesterStatus;
  changedById: string;
  dropReason?: string;
}) {
  const prior = await prisma.betaEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
  });

  const timestamps: Partial<{
    confirmedAt: Date;
    completedAt: Date;
    droppedAt: Date;
  }> = {};
  if (testerStatus === "confirmed") timestamps.confirmedAt = new Date();
  if (testerStatus === "completed") timestamps.completedAt = new Date();
  if (testerStatus === "dropped") timestamps.droppedAt = new Date();

  const updated = await prisma.betaEnrollment.update({
    where: { id: enrollmentId },
    data: { testerStatus, dropReason, ...timestamps },
  });

  await writeAudit({
    entityType: "BetaEnrollment",
    entityId: enrollmentId,
    action: "status_change",
    changedById,
    priorState: prior,
    nextState: updated,
  });

  await maybeAutoCloseBeta(prior.featureId, changedById);

  return updated;
}

export async function csmApprove({
  enrollmentId,
  approverId,
}: {
  enrollmentId: string;
  approverId: string;
}) {
  const enrollment = await prisma.betaEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { client: true },
  });

  if (enrollment.client.csmOwnerId !== approverId) {
    return { error: "Only the CSM owner of this client may approve.", status: 403 };
  }

  const prior = { ...enrollment };
  const updated = await prisma.betaEnrollment.update({
    where: { id: enrollmentId },
    data: {
      csmApprovalStatus: "approved" as ApprovalStatus,
      csmApprovedById: approverId,
      csmApprovedAt: new Date(),
      testerStatus: "csm_approved" as TesterStatus,
    },
  });

  await writeAudit({
    entityType: "BetaEnrollment",
    entityId: enrollmentId,
    action: "csm_approved",
    changedById: approverId,
    priorState: prior,
    nextState: updated,
  });

  return { enrollment: updated };
}

export async function csmReject({
  enrollmentId,
  approverId,
  reason,
}: {
  enrollmentId: string;
  approverId: string;
  reason: string;
}) {
  const enrollment = await prisma.betaEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { client: true },
  });

  if (enrollment.client.csmOwnerId !== approverId) {
    return { error: "Only the CSM owner of this client may reject.", status: 403 };
  }

  if (!reason?.trim()) {
    return { error: "Rejection reason is required.", status: 400 };
  }

  const prior = { ...enrollment };
  const updated = await prisma.betaEnrollment.update({
    where: { id: enrollmentId },
    data: {
      csmApprovalStatus: "rejected" as ApprovalStatus,
      csmRejectionReason: reason,
      testerStatus: "dropped" as TesterStatus,
      droppedAt: new Date(),
    },
  });

  await writeAudit({
    entityType: "BetaEnrollment",
    entityId: enrollmentId,
    action: "csm_rejected",
    changedById: approverId,
    priorState: prior,
    nextState: updated,
  });

  return { enrollment: updated };
}

// Auto-advance a beta from `closing` → `closed` once all active enrollments resolve
async function maybeAutoCloseBeta(featureId: string, changedById: string) {
  const feature = await prisma.betaFeature.findUnique({ where: { id: featureId } });
  if (feature?.status !== "closing") return;

  const activeCount = await prisma.betaEnrollment.count({
    where: { featureId, testerStatus: "active" },
  });
  if (activeCount > 0) return;

  const prior = { ...feature };
  const updated = await prisma.betaFeature.update({
    where: { id: featureId },
    data: { status: "closed", closedAt: new Date() },
  });

  await writeAudit({
    entityType: "BetaFeature",
    entityId: featureId,
    action: "auto_closed",
    changedById,
    priorState: prior,
    nextState: updated,
  });
}
