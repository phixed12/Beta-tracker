import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, requireAuth, parsePagination } from "@/lib/api-helpers";
import { nominateClient } from "@/lib/services/enrollment";
import type { TesterStatus, ApprovalStatus } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const url = req.nextUrl;
  const { skip, take } = parsePagination(url);
  const featureId = url.searchParams.get("feature");
  const clientId = url.searchParams.get("client");
  const status = url.searchParams.get("status") as TesterStatus | null;
  const approvalStatus = url.searchParams.get("approvalStatus") as ApprovalStatus | null;

  const [enrollments, total] = await Promise.all([
    prisma.betaEnrollment.findMany({
      where: {
        ...(featureId ? { featureId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(status ? { testerStatus: status } : {}),
        ...(approvalStatus ? { csmApprovalStatus: approvalStatus } : {}),
      },
      include: {
        client: { select: { id: true, name: true, tier: true, accountHealth: true } },
        feature: { select: { id: true, name: true, status: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.betaEnrollment.count({
      where: {
        ...(featureId ? { featureId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(status ? { testerStatus: status } : {}),
        ...(approvalStatus ? { csmApprovalStatus: approvalStatus } : {}),
      },
    }),
  ]);

  return ok({ enrollments, total, skip, take });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth(["pm", "pmm", "coordinator", "admin"]);
  if (error) return error;

  const body = await req.json();
  const { clientId, featureId, force } = body;

  if (!clientId || !featureId) {
    return err("clientId and featureId are required.");
  }

  const result = await nominateClient({
    clientId,
    featureId,
    assignedById: session!.user.id!,
    force: !!force,
  });

  if ("error" in result && result.error) {
    return Response.json(
      { error: result.error, conflict: (result as { conflict?: boolean }).conflict },
      { status: result.status ?? 400 }
    );
  }

  return Response.json(
    { enrollment: result.enrollment, warning: result.warning },
    { status: 201 }
  );
}
