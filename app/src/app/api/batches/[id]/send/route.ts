import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { sendBatch } from "@/lib/services/batch";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/batches/[id]/send">
) {
  const { error, session } = await requireAuth(["coordinator", "admin"]);
  if (error) return error;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await sendBatch({
    batchId: id,
    sentById: session!.user.id!,
    overrideCooldown: !!body.overrideCooldown,
  });

  if ("error" in result) {
    return Response.json(
      { error: result.error, cooldown: (result as { cooldown?: boolean }).cooldown },
      { status: result.status ?? 400 }
    );
  }

  return ok({ success: true });
}
