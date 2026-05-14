import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { csmApprove } from "@/lib/services/enrollment";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/enrollments/[id]/approve">
) {
  const { error, session } = await requireAuth(["csm", "coordinator", "admin"]);
  if (error) return error;

  const { id } = await ctx.params;

  const result = await csmApprove({
    enrollmentId: id,
    approverId: session!.user.id!,
  });

  if ("error" in result) return err(result.error as string, (result as { status: number }).status);
  return ok(result.enrollment);
}
