import { prisma } from "@/lib/prisma";

import { HealthDot } from "@/components/HealthDot";
import { ApproveRejectButtons } from "@/components/EnrollmentActions";
import Link from "next/link";

export const metadata = { title: "Approvals — Beta Tracker" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string; page?: string }>;
}) {
  const params = await searchParams;
  
  const showAll = true;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const take = 30;
  const skip = (page - 1) * take;

  const where = {
    csmApprovalStatus: "pending" as const,
    // open access — show all
  };

  const [enrollments, total] = await Promise.all([
    prisma.betaEnrollment.findMany({
      where,
      include: {
        client: {
          include: { csmOwner: { select: { name: true } } },
        },
        feature: {
          select: {
            id: true,
            name: true,
            idealClientCriteria: true,
            ownerPm: { select: { name: true } },
          },
        },
        assignedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
    prisma.betaEnrollment.count({ where }),
  ]);

  const staleThreshold = new Date(Date.now() - 48 * 3600000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} pending nomination{total !== 1 ? "s" : ""}
            {!showAll && " for your clients"}
          </p>
        </div>
        {(
          <Link
            href={showAll ? "/approvals" : "/approvals?all=1"}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {showAll ? "My clients only" : "Show all"}
          </Link>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <p className="text-lg text-gray-400">No pending approvals.</p>
          <p className="text-sm text-gray-300 mt-1">You're all caught up.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden md:table-cell">Feature</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden lg:table-cell">Criteria</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden sm:table-cell">Nominated</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((e) => {
                const isStale = e.createdAt < staleThreshold;
                return (
                  <tr key={e.id} className={`hover:bg-gray-50 ${isStale ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <HealthDot health={e.client.accountHealth} showLabel />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{e.client.name}</p>
                          {showAll && (
                            <p className="text-xs text-gray-400">CSM: {e.client.csmOwner.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link href={`/features/${e.feature.id}`} className="text-sm text-blue-600 hover:underline">
                        {e.feature.name}
                      </Link>
                      <p className="text-xs text-gray-400">PM: {e.feature.ownerPm.name}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                      <p className="text-xs text-gray-500 truncate">{e.feature.idealClientCriteria ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm text-gray-600">{e.createdAt.toLocaleDateString()}</p>
                      {isStale && (
                        <span className="text-xs font-medium text-red-600">Stale (48h+)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ApproveRejectButtons enrollmentId={e.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > take && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Showing {skip + 1}–{Math.min(skip + take, total)} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/approvals?page=${page - 1}${showAll ? "&all=1" : ""}`}
                className="rounded border px-3 py-1 hover:bg-gray-50">← Prev</Link>
            )}
            {skip + take < total && (
              <Link href={`/approvals?page=${page + 1}${showAll ? "&all=1" : ""}`}
                className="rounded border px-3 py-1 hover:bg-gray-50">Next →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
