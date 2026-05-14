import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, requireAuth, parseDateRange } from "@/lib/api-helpers";
import type { BetaFeature, BetaEnrollment } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { from, to } = parseDateRange(req.nextUrl);

  const features = await prisma.betaFeature.findMany({
    where: from || to
      ? { startDate: { ...(from && { gte: from }), ...(to && { lte: to }) } }
      : {},
    include: {
      ownerPm: { select: { id: true, name: true } },
      enrollments: {
        select: {
          testerStatus: true,
          confirmedAt: true,
          outreachSentAt: true,
          isOverflow: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  type EnrollmentRow = Pick<BetaEnrollment, "testerStatus" | "confirmedAt" | "outreachSentAt" | "isOverflow">;

  const rows = features.map((f) => {
    const confirmed = f.enrollments.filter((e: EnrollmentRow) =>
      ["confirmed", "active", "completed"].includes(e.testerStatus)
    );
    const completed = f.enrollments.filter((e: EnrollmentRow) => e.testerStatus === "completed").length;
    const dropped = f.enrollments.filter((e: EnrollmentRow) => e.testerStatus === "dropped").length;
    const outreachSent = f.enrollments.filter((e: EnrollmentRow) => e.outreachSentAt).length;

    // Time to fill: date of 15th confirmedAt - startDate
    const confirmedDates = confirmed
      .map((e: EnrollmentRow) => e.confirmedAt)
      .filter((d): d is Date => d != null)
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    const fifteenthConfirmed: Date | null = confirmedDates[14] ?? null;
    const timeToFillDays =
      fifteenthConfirmed
        ? Math.round((fifteenthConfirmed.getTime() - f.startDate.getTime()) / 86400000)
        : null;

    const durationDays =
      f.closedAt
        ? Math.round((f.closedAt.getTime() - f.startDate.getTime()) / 86400000)
        : null;

    return {
      id: f.id,
      name: f.name,
      status: f.status,
      ownerPm: f.ownerPm,
      startDate: f.startDate,
      closedAt: f.closedAt,
      durationDays,
      timeToFillDays,
      confirmed: confirmed.length,
      target: f.targetTesterCount,
      fillRate: f.targetTesterCount > 0 ? confirmed.length / f.targetTesterCount : null,
      completionRate:
        completed + dropped > 0 ? completed / (completed + dropped) : null,
      outreachConversionRate:
        outreachSent > 0 ? confirmed.length / outreachSent : null,
    };
  });

  return ok({ features: rows });
}
