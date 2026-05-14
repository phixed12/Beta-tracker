import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, parseDateRange } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["coordinator", "admin"]);
  if (error) return error;

  const { from, to } = parseDateRange(req.nextUrl);

  const approved = await prisma.betaEnrollment.findMany({
    where: {
      csmApprovalStatus: "approved",
      csmApprovedAt: { not: null },
      ...(from || to
        ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
    },
    select: {
      csmApprovedById: true,
      csmApprovedAt: true,
      createdAt: true,
      csmApprovedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const byCsm = new Map<
    string,
    { user: { id: string; name: string; email: string }; totalMs: number; count: number }
  >();

  for (const e of approved) {
    if (!e.csmApprovedById || !e.csmApprovedAt) continue;
    const ms = e.csmApprovedAt.getTime() - e.createdAt.getTime();
    const entry = byCsm.get(e.csmApprovedById) ?? {
      user: e.csmApprovedBy!,
      totalMs: 0,
      count: 0,
    };
    entry.totalMs += ms;
    entry.count += 1;
    byCsm.set(e.csmApprovedById, entry);
  }

  const rows = Array.from(byCsm.values()).map(({ user, totalMs, count }) => ({
    csm: user,
    approvalCount: count,
    avgApprovalTimeHours: Math.round((totalMs / count / 3600000) * 10) / 10,
  }));

  rows.sort((a, b) => a.avgApprovalTimeHours - b.avgApprovalTimeHours);

  return ok({ csms: rows });
}
