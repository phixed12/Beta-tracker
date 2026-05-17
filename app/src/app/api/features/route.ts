import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth, parsePagination } from "@/lib/api-helpers";
import type { BetaStatus } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  await requireAuth();

  const url = req.nextUrl;
  const { skip, take } = parsePagination(url);
  const status = url.searchParams.get("status") as BetaStatus | null;
  const ownerId = url.searchParams.get("owner");

  const [features, total] = await Promise.all([
    prisma.betaFeature.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(ownerId ? { OR: [{ ownerPmId: ownerId }, { ownerPmmId: ownerId }] } : {}),
      },
      include: {
        ownerPm: { select: { id: true, name: true, email: true } },
        ownerPmm: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.betaFeature.count({
      where: {
        ...(status ? { status } : {}),
        ...(ownerId ? { OR: [{ ownerPmId: ownerId }, { ownerPmmId: ownerId }] } : {}),
      },
    }),
  ]);

  return ok({ features, total, skip, take });
}

export async function POST(req: NextRequest) {
  const { session } = await requireAuth();

  const body = await req.json();
  const { name, ownerPmId, ownerPmmId, startDate, outreachDeadline, idealClientCriteria, targetTesterCount } = body;

  if (!name || !ownerPmId || !ownerPmmId || !startDate || !outreachDeadline) {
    return err("name, ownerPmId, ownerPmmId, startDate, and outreachDeadline are required.");
  }

  const feature = await prisma.betaFeature.create({
    data: {
      name,
      ownerPmId,
      ownerPmmId,
      startDate: new Date(startDate),
      outreachDeadline: new Date(outreachDeadline),
      idealClientCriteria,
      targetTesterCount: targetTesterCount ?? 15,
    },
  });

  return ok(feature, 201);
}
