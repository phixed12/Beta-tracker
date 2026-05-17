import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { cloneBeta } from "@/lib/services/beta";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/features/[id]/clone">
) {
  const { session } = await requireAuth();

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await cloneBeta({
    featureId: id,
    createdById: session!.user.id!,
    overrides: {
      name: body.name,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      outreachDeadline: body.outreachDeadline ? new Date(body.outreachDeadline) : undefined,
      ownerPmId: body.ownerPmId,
      ownerPmmId: body.ownerPmmId,
    },
  });

  if ("error" in result) return err(String(result.error), 400);
  return ok(result.feature, 201);
}
