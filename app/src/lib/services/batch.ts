import { prisma } from "@/lib/prisma";
import { writeAudit } from "./audit";

const BATCH_WINDOW_HOURS = 48;
const COOLDOWN_DAYS = 30;

// Groups all csm_approved enrollments (not yet in a pending/ready batch) by client.
// Idempotent: safe to run multiple times.
export async function groupApprovedEnrollments() {
  const unbatched = await prisma.betaEnrollment.findMany({
    where: {
      csmApprovalStatus: "approved",
      testerStatus: "csm_approved",
      batchEntries: { none: {} },
    },
    include: { client: true },
  });

  const byClient = new Map<string, typeof unbatched>();
  for (const e of unbatched) {
    const list = byClient.get(e.clientId) ?? [];
    list.push(e);
    byClient.set(e.clientId, list);
  }

  const batches = [];
  for (const [clientId, enrollments] of byClient) {
    // Find or create an open (pending/ready) batch for this client
    let batch = await prisma.outreachBatch.findFirst({
      where: { clientId, batchStatus: { in: ["pending", "ready"] } },
    });

    if (!batch) {
      batch = await prisma.outreachBatch.create({
        data: { clientId, batchStatus: "pending" },
      });
    }

    await prisma.outreachBatchEnrollment.createMany({
      data: enrollments.map((e: { id: string }) => ({ batchId: batch!.id, enrollmentId: e.id })),
      skipDuplicates: true,
    });

    // Check if all CSMs have approved → advance to ready
    const pendingCount = await prisma.betaEnrollment.count({
      where: {
        batchEntries: { some: { batchId: batch.id } },
        csmApprovalStatus: "pending",
      },
    });

    if (pendingCount === 0 && batch.batchStatus === "pending") {
      await prisma.outreachBatch.update({
        where: { id: batch.id },
        data: { batchStatus: "ready" },
      });
    }

    batches.push(batch);
  }

  return batches;
}

export async function sendBatch({
  batchId,
  sentById,
  overrideCooldown = false,
}: {
  batchId: string;
  sentById: string;
  overrideCooldown?: boolean;
}) {
  const batch = await prisma.outreachBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { client: true, enrollments: { include: { enrollment: true } } },
  });

  if (batch.batchStatus === "sent") {
    return { error: "Batch already sent.", status: 400 };
  }

  // Cooldown check
  const { client } = batch;
  if (client.lastOutreachDate && !overrideCooldown) {
    const daysSince =
      (Date.now() - client.lastOutreachDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < COOLDOWN_DAYS) {
      return {
        error: `Client is within ${COOLDOWN_DAYS}-day cooldown (last outreach ${Math.floor(daysSince)} days ago). Pass overrideCooldown: true to proceed.`,
        status: 409,
        cooldown: true,
      };
    }
  }

  const now = new Date();
  const enrollmentIds = batch.enrollments.map((be: { enrollmentId: string }) => be.enrollmentId);

  await prisma.$transaction([
    prisma.outreachBatch.update({
      where: { id: batchId },
      data: { batchStatus: "sent", sentAt: now, sentById },
    }),
    prisma.betaEnrollment.updateMany({
      where: { id: { in: enrollmentIds } },
      data: { testerStatus: "outreach_sent", outreachSentAt: now },
    }),
    prisma.client.update({
      where: { id: batch.clientId },
      data: { lastOutreachDate: now },
    }),
  ]);

  for (const { enrollment } of batch.enrollments) {
    await writeAudit({
      entityType: "BetaEnrollment",
      entityId: enrollment.id,
      action: "outreach_sent",
      changedById: sentById,
      priorState: enrollment,
      nextState: { ...enrollment, testerStatus: "outreach_sent", outreachSentAt: now },
    });
  }

  return { success: true };
}

export function isBatchWindowExpired(batch: { createdAt: Date }) {
  const ageHours = (Date.now() - batch.createdAt.getTime()) / (1000 * 60 * 60);
  return ageHours >= BATCH_WINDOW_HOURS;
}
