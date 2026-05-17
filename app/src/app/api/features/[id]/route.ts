import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/features/[id]">
) {
  await requireAuth();

  const { id } = await ctx.params;

  const feature = await prisma.betaFeature.findUnique({
    where: { id },
    include: {
      ownerPm: { select: { id: true, name: true, email: true } },
      ownerPmm: { select: { id: true, name: true, email: true } },
      enrollments: {
        include: {
          client: { select: { id: true, name: true, tier: true, accountHealth: true } },
          assignedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!feature) return err("Feature not found.", 404);
  return ok(feature);
}

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/features/[id]">
) {
  await requireAuth();

  const { id } = await ctx.params;
  const body = await req.json();

  const feature = await prisma.betaFeature.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.idealClientCriteria !== undefined && { idealClientCriteria: body.idealClientCriteria }),
      ...(body.outreachDeadline !== undefined && { outreachDeadline: new Date(body.outreachDeadline) }),
      ...(body.targetTesterCount !== undefined && { targetTesterCount: body.targetTesterCount }),
    },
  });

  return ok(feature);
}
