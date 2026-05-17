import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { csmReject } from "@/lib/services/enrollment";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/enrollments/[id]/reject">
) {
  const { session } = await requireAuth();

  const { id } = await ctx.params;
  const body = await req.json();

  if (!body.reason?.trim()) return err("reason is required.");

  const result = await csmReject({
    enrollmentId: id,
    approverId: session!.user.id!,
    reason: body.reason,
  });

  if ("error" in result) return err(result.error as string, (result as { status: number }).status);
  return ok(result.enrollment);
}
