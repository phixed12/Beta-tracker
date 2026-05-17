import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// Returns the first admin user as the acting user for all operations.
// No authentication — anyone with the link can use this tool.
let cachedActorId: string | null = null;
async function getActorId(): Promise<string> {
  if (cachedActorId) return cachedActorId;
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (!admin) throw new Error("No admin user found. Run npm run db:seed first.");
  cachedActorId = admin.id;
  return cachedActorId;
}

export async function requireAuth(_allowedRoles?: UserRole[]) {
  const actorId = await getActorId();
  return {
    session: {
      user: { id: actorId, role: "admin" as UserRole },
    },
  };
}

export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  return { skip: (page - 1) * limit, take: limit };
}

export function parseDateRange(url: URL) {
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined;
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined;
  return { from, to };
}
