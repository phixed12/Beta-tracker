import { auth } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function err(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await auth();
  if (!session?.user?.id) return { error: err("Unauthorized", 401) };
  if (allowedRoles && !allowedRoles.includes(session.user.role as UserRole)) {
    return { error: err("Forbidden", 403) };
  }
  return { session: session as typeof session & { user: { id: string; role: UserRole } } };
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
