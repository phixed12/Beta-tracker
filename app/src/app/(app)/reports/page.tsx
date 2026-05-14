import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DurationChart, ConversionFunnel, CompletionBarChart } from "@/components/ReportCharts";

export const metadata = { title: "Reports — Beta Tracker" };

async function getReportData() {
  const [closedFeatures, allFeatures, clients, csmApprovals] = await Promise.all([
    prisma.betaFeature.findMany({
      where: { status: "closed", closedAt: { not: null } },
      include: {
        enrollments: { select: { testerStatus: true, confirmedAt: true, outreachSentAt: true } },
      },
      orderBy: { closedAt: "desc" },
      take: 20,
    }),
    prisma.betaFeature.findMany({
      include: {
        enrollments: { select: { testerStatus: true, outreachSentAt: true, confirmedAt: true } },
      },
    }),
    prisma.client.findMany({
      include: { enrollments: { select: { testerStatus: true } } },
      orderBy: { tier: "asc" },
      take: 15,
    }),
    prisma.betaEnrollment.findMany({
      where: { csmApprovalStatus: "approved", csmApprovedAt: { not: null } },
      select: {
        csmApprovedById: true,
        csmApprovedAt: true,
        createdAt: true,
        csmApprovedBy: { select: { name: true } },
      },
    }),
  ]);

  // Duration chart data
  const durationData = closedFeatures
    .filter((f): f is typeof f & { closedAt: Date } => f.closedAt != null)
    .map((f) => ({
      name: f.name.replace(/^Project /, ""),
      days: Math.round((f.closedAt.getTime() - f.startDate.getTime()) / 86400000),
    }));

  // Outreach conversion funnel (aggregate across all features)
  const nominated = allFeatures.reduce((s, f) => s + f.enrollments.length, 0);
  const outreachSent = allFeatures.reduce((s, f) => s + f.enrollments.filter((e) => e.outreachSentAt).length, 0);
  const confirmed = allFeatures.reduce((s, f) => s + f.enrollments.filter((e) =>
    ["confirmed","active","completed"].includes(e.testerStatus)
  ).length, 0);
  const completed = allFeatures.reduce((s, f) => s + f.enrollments.filter((e) => e.testerStatus === "completed").length, 0);
  const funnelData = [
    { name: "Nominated",     value: nominated },
    { name: "Outreach Sent", value: outreachSent },
    { name: "Confirmed",     value: confirmed },
    { name: "Completed",     value: completed },
  ].filter((d) => d.value > 0);

  // Client completion leaderboard
  const clientCompletion = clients
    .map((c) => {
      const done = c.enrollments.filter((e) => e.testerStatus === "completed").length;
      const dropped = c.enrollments.filter((e) => e.testerStatus === "dropped").length;
      return {
        name: c.name,
        rate: done + dropped > 0 ? Math.round((done / (done + dropped)) * 100) : 0,
        total: c.enrollments.length,
        done,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  // CSM responsiveness
  const byCsm = new Map<string, { name: string; totalMs: number; count: number }>();
  for (const e of csmApprovals) {
    if (!e.csmApprovedById || !e.csmApprovedAt) continue;
    const ms = e.csmApprovedAt.getTime() - e.createdAt.getTime();
    const entry = byCsm.get(e.csmApprovedById) ?? { name: e.csmApprovedBy?.name ?? "?", totalMs: 0, count: 0 };
    entry.totalMs += ms;
    entry.count += 1;
    byCsm.set(e.csmApprovedById, entry);
  }
  const csmRows = Array.from(byCsm.values())
    .map((r) => ({ name: r.name, avgHours: Math.round((r.totalMs / r.count / 3600000) * 10) / 10, count: r.count }))
    .sort((a, b) => a.avgHours - b.avgHours);

  return { durationData, funnelData, clientCompletion, csmRows };
}

export default async function ReportsPage() {
  const session = await auth();
  const isCoordinator = ["coordinator","admin"].includes(session?.user.role ?? "");
  const { durationData, funnelData, clientCompletion, csmRows } = await getReportData();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Beta duration */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Beta duration (closed betas, days)</h2>
          {durationData.length > 0
            ? <DurationChart data={durationData} />
            : <p className="text-sm text-gray-400 py-8 text-center">No closed betas yet.</p>}
        </div>

        {/* Outreach conversion funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Outreach conversion funnel</h2>
          {funnelData.length > 0
            ? <ConversionFunnel data={funnelData} />
            : <p className="text-sm text-gray-400 py-8 text-center">No data yet.</p>}
        </div>

        {/* Client completion */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Client completion rate (top 10)</h2>
          {clientCompletion.length > 0
            ? <CompletionBarChart data={clientCompletion} />
            : <p className="text-sm text-gray-400 py-8 text-center">No data yet.</p>}
        </div>

        {/* CSM responsiveness — coordinator/admin only */}
        {isCoordinator && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">CSM avg approval time</h2>
            {csmRows.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr>
                    <th className="py-2 text-left text-xs font-medium text-gray-500">CSM</th>
                    <th className="py-2 text-right text-xs font-medium text-gray-500">Approvals</th>
                    <th className="py-2 text-right text-xs font-medium text-gray-500">Avg time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {csmRows.map((r) => (
                    <tr key={r.name}>
                      <td className="py-2 text-sm text-gray-900">{r.name}</td>
                      <td className="py-2 text-right text-sm text-gray-600">{r.count}</td>
                      <td className="py-2 text-right text-sm font-medium text-gray-900">{r.avgHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">No approvals yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Client participation leaderboard table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Client participation leaderboard</h2>
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th className="py-2 text-left text-xs font-medium text-gray-500">Client</th>
              <th className="py-2 text-right text-xs font-medium text-gray-500">Total betas</th>
              <th className="py-2 text-right text-xs font-medium text-gray-500">Completed</th>
              <th className="py-2 text-right text-xs font-medium text-gray-500">Completion rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clientCompletion.map((c) => (
              <tr key={c.name}>
                <td className="py-2 text-sm text-gray-900">{c.name}</td>
                <td className="py-2 text-right text-sm text-gray-600">{c.total}</td>
                <td className="py-2 text-right text-sm text-gray-600">{c.done}</td>
                <td className="py-2 text-right text-sm font-medium text-gray-900">{c.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
