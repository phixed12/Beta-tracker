import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, parseDateRange, parsePagination } from "@/lib/api-helpers";
import type { Client, BetaEnrollment } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  await requireAuth();

  const { from, to } = parseDateRange(req.nextUrl);
  const { skip, take } = parsePagination(req.nextUrl);

  const clients = await prisma.client.findMany({
    include: {
      csmOwner: { select: { id: true, name: true } },
      enrollments: {
        where: from || to
          ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
          : {},
        select: { testerStatus: true },
      },
    },
    orderBy: { tier: "asc" },
    skip,
    take,
  });

  type ClientRow = Client & { csmOwner: { id: string; name: string }; enrollments: Pick<BetaEnrollment, "testerStatus">[] };

  const rows = (clients as ClientRow[]).map((c) => {
    const total = c.enrollments.length;
    const completed = c.enrollments.filter((e) => e.testerStatus === "completed").length;
    const dropped = c.enrollments.filter((e) => e.testerStatus === "dropped").length;

    return {
      id: c.id,
      name: c.name,
      tier: c.tier,
      accountHealth: c.accountHealth,
      csmOwner: c.csmOwner,
      lastOutreachDate: c.lastOutreachDate,
      totalEnrollments: total,
      completed,
      dropped,
      completionRate: completed + dropped > 0 ? completed / (completed + dropped) : null,
    };
  });

  return ok({ clients: rows });
}
