import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, parseDateRange } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { from, to } = parseDateRange(req.nextUrl);
  const dateFilter = from || to
    ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
    : {};

  const [
    featureCountsByStatus,
    totalConfirmed,
    totalOutreachSent,
    closedFeatures,
  ] = await Promise.all([
    prisma.betaFeature.groupBy({ by: ["status"], _count: { id: true }, where: dateFilter }),
    prisma.betaEnrollment.count({ where: { testerStatus: "confirmed" } }),
    prisma.betaEnrollment.count({ where: { outreachSentAt: { not: null } } }),
    prisma.betaFeature.findMany({
      where: { status: "closed", closedAt: { not: null }, ...dateFilter },
      select: { startDate: true, closedAt: true },
    }),
  ]);

  const durations = closedFeatures
    .filter((f): f is typeof f & { closedAt: Date } => f.closedAt != null)
    .map((f) => (f.closedAt.getTime() - f.startDate.getTime()) / 86400000);

  const avgDuration = durations.length
    ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length
    : null;

  return ok({
    featureCountsByStatus: Object.fromEntries(
      featureCountsByStatus.map((r) => [r.status, r._count.id])
    ),
    totalConfirmed,
    totalOutreachSent,
    avgBetaDurationDays: avgDuration ? Math.round(avgDuration) : null,
  });
}
