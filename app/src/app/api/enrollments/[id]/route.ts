import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { writeAudit } from "@/lib/services/audit";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/enrollments/[id]">
) {
  const { session } = await requireAuth();

  const { id } = await ctx.params;
  const enrollment = await prisma.betaEnrollment.findUnique({ where: { id } });

  if (!enrollment) return err("Enrollment not found.", 404);

  const preOutreach: string[] = ["nominated", "csm_pending", "csm_approved"];
  if (!preOutreach.includes(enrollment.testerStatus)) {
    return err("Cannot remove an enrollment after outreach has been sent.", 400);
  }

  await prisma.betaEnrollment.delete({ where: { id } });
  await writeAudit({
    entityType: "BetaEnrollment",
    entityId: id,
    action: "removed",
    changedById: session!.user.id!,
    priorState: enrollment,
  });

  return ok({ success: true });
}
