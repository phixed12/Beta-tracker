import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, parsePagination } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { skip, take } = parsePagination(req.nextUrl);

  const [batches, total] = await Promise.all([
    prisma.outreachBatch.findMany({
      include: {
        client: { select: { id: true, name: true, tier: true } },
        sentBy: { select: { id: true, name: true } },
        enrollments: {
          include: {
            enrollment: {
              include: {
                feature: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.outreachBatch.count(),
  ]);

  return ok({ batches, total, skip, take });
}
