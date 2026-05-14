import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HealthDot } from "@/components/HealthDot";
import { BetaStatusBadge } from "@/components/StatusBadge";
import type { HealthStatus } from "@/generated/prisma/client";

export const metadata = { title: "Clients — Beta Tracker" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string; csm?: string; page?: string; expand?: string }>;
}) {
  const params = await searchParams;
  const health = params.health as HealthStatus | undefined;
  const csmId = params.csm;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const expandId = params.expand;
  const take = 25;
  const skip = (page - 1) * take;

  const where = {
    ...(health ? { accountHealth: health } : {}),
    ...(csmId ? { csmOwnerId: csmId } : {}),
  };

  const [clients, total, csms] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        csmOwner: { select: { id: true, name: true } },
        enrollments: {
          where: { testerStatus: { in: ["nominated","csm_pending","csm_approved","outreach_sent","confirmed","active"] } },
          include: { feature: { select: { id: true, name: true, status: true } } },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { tier: "asc" },
      skip,
      take,
    }),
    prisma.client.count({ where }),
    prisma.user.findMany({ where: { role: "csm" }, select: { id: true, name: true } }),
  ]);

  // Expanded client history
  const expandedClient = expandId
    ? await prisma.client.findUnique({
        where: { id: expandId },
        include: {
          enrollments: {
            include: { feature: { select: { id: true, name: true, status: true, startDate: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 text-sm">
        <select
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          defaultValue={health ?? ""}
          onChange={(e) => {
            const url = new URL(window.location.href);
            if (e.target.value) url.searchParams.set("health", e.target.value);
            else url.searchParams.delete("health");
            window.location.href = url.toString();
          }}
        >
          <option value="">All health</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>

        <select
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
          defaultValue={csmId ?? ""}
          onChange={(e) => {
            const url = new URL(window.location.href);
            if (e.target.value) url.searchParams.set("csm", e.target.value);
            else url.searchParams.delete("csm");
            window.location.href = url.toString();
          }}
        >
          <option value="">All CSMs</option>
          {csms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden sm:table-cell">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden md:table-cell">CSM</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Active Betas</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 hidden lg:table-cell">Last Outreach</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((c) => (
              <>
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <HealthDot health={c.accountHealth} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        {c.outreachLock && (
                          <span className="text-xs text-red-500">Locked</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-600">{c.tier}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600">{c.csmOwner.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.enrollments.slice(0, 3).map((e) => (
                        <Link
                          key={e.id}
                          href={`/features/${e.feature.id}`}
                          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200 truncate max-w-[120px]"
                          title={e.feature.name}
                        >
                          {e.feature.name}
                        </Link>
                      ))}
                      {c.enrollments.length > 3 && (
                        <span className="text-xs text-gray-400">+{c.enrollments.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-500">
                      {c.lastOutreachDate ? c.lastOutreachDate.toLocaleDateString() : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={expandId === c.id ? "/clients" : `/clients?expand=${c.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      {expandId === c.id ? "▲ Hide" : "▼ Show"}
                    </Link>
                  </td>
                </tr>

                {/* Expanded history panel */}
                {expandId === c.id && expandedClient && (
                  <tr key={`${c.id}-expanded`}>
                    <td colSpan={6} className="bg-gray-50 px-6 py-4">
                      <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Participation history · {expandedClient.enrollments.length} total
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {expandedClient.enrollments.map((e) => (
                          <Link
                            key={e.id}
                            href={`/features/${e.feature.id}`}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-blue-50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-gray-900">{e.feature.name}</p>
                              <p className="text-xs text-gray-400">{e.feature.startDate.toLocaleDateString()}</p>
                            </div>
                            <BetaStatusBadge status={e.feature.status} />
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {clients.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">No clients found.</div>
        )}
      </div>

      {total > take && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Showing {skip + 1}–{Math.min(skip + take, total)} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/clients?page=${page - 1}${health ? `&health=${health}` : ""}`}
                className="rounded border px-3 py-1 hover:bg-gray-50">← Prev</Link>
            )}
            {skip + take < total && (
              <Link href={`/clients?page=${page + 1}${health ? `&health=${health}` : ""}`}
                className="rounded border px-3 py-1 hover:bg-gray-50">Next →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
