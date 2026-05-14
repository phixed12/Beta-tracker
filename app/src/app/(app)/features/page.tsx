import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BetaStatusBadge } from "@/components/StatusBadge";
import { SlotFill } from "@/components/SlotFill";
import type { BetaStatus } from "@/generated/prisma/client";

export const metadata = { title: "Features — Beta Tracker" };

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; owner?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status as BetaStatus | undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const take = 20;
  const skip = (page - 1) * take;

  const where = {
    ...(status ? { status } : {}),
  };

  const [features, total] = await Promise.all([
    prisma.betaFeature.findMany({
      where,
      include: {
        ownerPm: { select: { id: true, name: true } },
        ownerPmm: { select: { id: true, name: true } },
        enrollments: {
          select: { testerStatus: true, csmApprovalStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.betaFeature.count({ where }),
  ]);

  const ALL_STATUSES: BetaStatus[] = ["draft","recruiting","outreach_sent","full","in_progress","closing","closed"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Features</h1>
        <Link
          href="/features/new"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          New Beta
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/features"
          className={`rounded-full px-3 py-1 text-xs font-medium border ${
            !status ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          All
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/features?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              status === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Feature</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden md:table-cell">Slots</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden lg:table-cell">CSM Pending</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden lg:table-cell">Confirmed</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden xl:table-cell">Owner PM</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {features.map((f) => {
              const confirmed = f.enrollments.filter((e) =>
                ["confirmed", "active", "completed"].includes(e.testerStatus)
              ).length;
              const csmPending = f.enrollments.filter((e) => e.csmApprovalStatus === "pending").length;
              const outreachSent = f.enrollments.filter((e) => e.testerStatus === "outreach_sent").length;
              const durationDays = f.closedAt
                ? Math.round((f.closedAt.getTime() - f.startDate.getTime()) / 86400000)
                : Math.round((Date.now() - f.startDate.getTime()) / 86400000);
              const completionRate = f.status === "closed"
                ? (() => {
                    const done = f.enrollments.filter((e) => e.testerStatus === "completed").length;
                    const dropped = f.enrollments.filter((e) => e.testerStatus === "dropped").length;
                    return done + dropped > 0 ? Math.round((done / (done + dropped)) * 100) : null;
                  })()
                : null;

              return (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/features/${f.id}`} className="block">
                      <p className="text-sm font-medium text-gray-900 hover:text-blue-600">{f.name}</p>
                      <p className="text-xs text-gray-400">
                        {f.status === "closed"
                          ? `${durationDays}d · ${completionRate != null ? `${completionRate}% completion` : ""}`
                          : `${durationDays}d elapsed`}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <BetaStatusBadge status={f.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <SlotFill confirmed={confirmed} target={f.targetTesterCount} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {csmPending > 0
                      ? <span className="text-sm font-medium text-amber-700">{csmPending}</span>
                      : <span className="text-sm text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-700">{outreachSent}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-sm text-gray-600">{f.ownerPm.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/features/${f.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {features.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            No features found.{status && " Try clearing the filter."}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > take && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Showing {skip + 1}–{Math.min(skip + take, total)} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/features?page=${page - 1}${status ? `&status=${status}` : ""}`}
                className="rounded border px-3 py-1 hover:bg-gray-50">← Prev</Link>
            )}
            {skip + take < total && (
              <Link href={`/features?page=${page + 1}${status ? `&status=${status}` : ""}`}
                className="rounded border px-3 py-1 hover:bg-gray-50">Next →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
