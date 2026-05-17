import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, parsePagination } from "@/lib/api-helpers";
import type { HealthStatus } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  await requireAuth();

  const url = req.nextUrl;
  const { skip, take } = parsePagination(url);
  const tier = url.searchParams.get("tier") ? parseInt(url.searchParams.get("tier")!, 10) : undefined;
  const health = url.searchParams.get("health") as HealthStatus | null;
  const csmId = url.searchParams.get("csm");

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...(tier !== undefined && { tier }),
        ...(health ? { accountHealth: health } : {}),
        ...(csmId ? { csmOwnerId: csmId } : {}),
      },
      include: {
        csmOwner: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { tier: "asc" },
      skip,
      take,
    }),
    prisma.client.count({
      where: {
        ...(tier !== undefined && { tier }),
        ...(health ? { accountHealth: health } : {}),
        ...(csmId ? { csmOwnerId: csmId } : {}),
      },
    }),
  ]);

  return ok({ clients, total, skip, take });
}
