import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { closeBeta } from "@/lib/services/beta";
import type { CloseReason } from "@/generated/prisma/client";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/features/[id]/close">
) {
  const { session } = await requireAuth();

  const { id } = await ctx.params;
  const body = await req.json();

  if (!body.closeReason) {
    return err("closeReason is required.");
  }

  const result = await closeBeta({
    featureId: id,
    closedById: session!.user.id!,
    closeReason: body.closeReason as CloseReason,
    closeNotes: body.closeNotes,
    force: !!body.force,
  });

  if ("error" in result) return err(result.error as string, (result as { status: number }).status);
  return ok(result.feature);
}
