import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { updateEnrollmentStatus } from "@/lib/services/enrollment";
import type { TesterStatus } from "@/generated/prisma/client";

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/enrollments/[id]/status">
) {
  const { error, session } = await requireAuth(["pm", "pmm", "coordinator", "admin"]);
  if (error) return error;

  const { id } = await ctx.params;
  const body = await req.json();

  if (!body.testerStatus) return err("testerStatus is required.");

  const updated = await updateEnrollmentStatus({
    enrollmentId: id,
    testerStatus: body.testerStatus as TesterStatus,
    changedById: session!.user.id!,
    dropReason: body.dropReason,
  });

  return ok(updated);
}
