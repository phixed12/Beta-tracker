import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/batches/[id]">
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await ctx.params;

  const batch = await prisma.outreachBatch.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, tier: true, lastOutreachDate: true } },
      sentBy: { select: { id: true, name: true } },
      enrollments: {
        include: {
          enrollment: {
            include: {
              feature: { select: { id: true, name: true } },
              client: { select: { id: true, name: true } },
              csmApprovedBy: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!batch) return err("Batch not found.", 404);
  return ok(batch);
}
