import { prisma } from "@/lib/prisma";

import Link from "next/link";
import { BetaStatusBadge } from "@/components/StatusBadge";
import { SlotFill } from "@/components/SlotFill";

export const metadata = { title: "Dashboard — Beta Tracker" };

async function getDashboardData() {
  const [
    featureCounts,
    totalConfirmed,
    totalOutreach,
    closedFeatures,
    underFilled,
    staleApprovals,
  ] = await Promise.all([
    prisma.betaFeature.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.betaEnrollment.count({ where: { testerStatus: "confirmed" } }),
    prisma.betaEnrollment.count({ where: { outreachSentAt: { not: null } } }),
    prisma.betaFeature.findMany({
      where: { status: "closed", closedAt: { not: null } },
      select: { startDate: true, closedAt: true },
    }),
    prisma.betaFeature.findMany({
      where: {
        status: { in: ["recruiting", "outreach_sent"] },
        startDate: { lte: new Date(Date.now() + 5 * 86400000) },
      },
      include: {
        ownerPm: { select: { name: true } },
        _count: { select: { enrollments: { where: { testerStatus: { in: ["confirmed", "active"] } } } } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.betaEnrollment.findMany({
      where: {
        csmApprovalStatus: "pending",
        createdAt: { lte: new Date(Date.now() - 48 * 3600000) },
      },
      include: {
        client: { include: { csmOwner: { select: { name: true } } } },
        feature: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
  ]);

  const counts = Object.fromEntries(featureCounts.map((r) => [r.status, r._count.id]));
  const totalFeatures = featureCounts.reduce((s, r) => s + r._count.id, 0);

  const durations = closedFeatures
    .filter((f): f is typeof f & { closedAt: Date } => f.closedAt != null)
    .map((f) => (f.closedAt.getTime() - f.startDate.getTime()) / 86400000);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return { counts, totalFeatures, totalConfirmed, totalOutreach, avgDuration, underFilled, staleApprovals };
}

export default async function DashboardPage() {
  const { counts, totalFeatures, totalConfirmed, totalOutreach, avgDuration, underFilled, staleApprovals } =
    await getDashboardData();

  const statCards = [
    { label: "Total Features",    value: totalFeatures },
    { label: "Confirmed Testers", value: totalConfirmed },
    { label: "Outreach Sent",     value: totalOutreach },
    { label: "Avg Beta Duration", value: avgDuration != null ? `${avgDuration}d` : "—" },
  ];

  const activeStatuses = ["recruiting", "outreach_sent", "full", "in_progress", "closing"] as const;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Active betas by status</h2>
        <div className="flex flex-wrap gap-3">
          {activeStatuses.map((s) => (
            <Link key={s} href={`/features?status=${s}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              <BetaStatusBadge status={s} />
              <span className="font-semibold text-gray-900">{counts[s] ?? 0}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* At-risk sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Under-filled */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Under-filled within 5 days of start
            {underFilled.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                {underFilled.length}
              </span>
            )}
          </h2>
          {underFilled.length === 0 ? (
            <p className="text-sm text-gray-400">None — all betas on track.</p>
          ) : (
            <div className="space-y-2">
              {underFilled.map((f) => (
                <Link
                  key={f.id}
                  href={`/features/${f.id}`}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-500">PM: {f.ownerPm.name} · starts {f.startDate.toLocaleDateString()}</p>
                  </div>
                  <SlotFill confirmed={f._count.enrollments} target={f.targetTesterCount} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Stale approvals */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Approvals pending 48h+
            {staleApprovals.length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                {staleApprovals.length}
              </span>
            )}
          </h2>
          {staleApprovals.length === 0 ? (
            <p className="text-sm text-gray-400">No stale approvals.</p>
          ) : (
            <div className="space-y-2">
              {staleApprovals.map((e) => {
                const hours = Math.round((Date.now() - e.createdAt.getTime()) / 3600000);
                return (
                  <Link
                    key={e.id}
                    href="/approvals"
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.client.name}</p>
                      <p className="text-xs text-gray-500">
                        {e.feature.name} · CSM: {e.client.csmOwner.name}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-red-700 whitespace-nowrap">{hours}h pending</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
