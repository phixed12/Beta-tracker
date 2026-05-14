import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth, parsePagination } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/clients/[id]/betas">
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await ctx.params;
  const { skip, take } = parsePagination(req.nextUrl);

  const [enrollments, total] = await Promise.all([
    prisma.betaEnrollment.findMany({
      where: { clientId: id },
      include: {
        feature: { select: { id: true, name: true, status: true, startDate: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.betaEnrollment.count({ where: { clientId: id } }),
  ]);

  if (total === 0) {
    const exists = await prisma.client.count({ where: { id } });
    if (!exists) return err("Client not found.", 404);
  }

  return ok({ enrollments, total, skip, take });
}
