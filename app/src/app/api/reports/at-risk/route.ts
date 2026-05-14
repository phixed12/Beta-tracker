import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth } from "@/lib/api-helpers";

const STALE_APPROVAL_HOURS = 48;
const UNDERFILL_WARNING_DAYS = 5;

export async function GET(_req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const now = new Date();

  // Features with startDate within 5 days that aren't yet full/in_progress
  const soonStartDate = new Date(now.getTime() + UNDERFILL_WARNING_DAYS * 86400000);
  const underFilledFeatures = await prisma.betaFeature.findMany({
    where: {
      status: { in: ["recruiting", "outreach_sent"] },
      startDate: { lte: soonStartDate },
    },
    include: {
      ownerPm: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          enrollments: {
            where: { testerStatus: { in: ["confirmed", "active"] } },
          },
        },
      },
    },
  });

  // Enrollments pending CSM approval for 48h+
  const staleThreshold = new Date(now.getTime() - STALE_APPROVAL_HOURS * 3600000);
  const staleApprovals = await prisma.betaEnrollment.findMany({
    where: {
      csmApprovalStatus: "pending",
      createdAt: { lte: staleThreshold },
    },
    include: {
      client: {
        include: { csmOwner: { select: { id: true, name: true, email: true } } },
      },
      feature: { select: { id: true, name: true } },
    },
  });

  return ok({
    underFilledFeatures: underFilledFeatures.map((f: typeof underFilledFeatures[number]) => ({
      id: f.id,
      name: f.name,
      status: f.status,
      startDate: f.startDate,
      confirmedCount: f._count.enrollments,
      target: f.targetTesterCount,
      ownerPm: f.ownerPm,
    })),
    staleApprovals: staleApprovals.map((e: typeof staleApprovals[number]) => ({
      enrollmentId: e.id,
      feature: e.feature,
      client: { id: e.client.id, name: e.client.name },
      csmOwner: e.client.csmOwner,
      pendingSinceHours: Math.round(
        (now.getTime() - e.createdAt.getTime()) / 3600000
      ),
    })),
  });
}
