import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/clients/[id]">
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await ctx.params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      csmOwner: { select: { id: true, name: true, email: true } },
      enrollments: {
        include: {
          feature: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) return err("Client not found.", 404);
  return ok(client);
}
