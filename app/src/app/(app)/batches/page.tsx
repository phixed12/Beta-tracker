import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BatchStatusBadge } from "@/components/StatusBadge";
import { HealthDot } from "@/components/HealthDot";
import { SendBatchButton, TriggerBatchGroupButton } from "@/components/BatchActions";
import Link from "next/link";

export const metadata = { title: "Batches — Beta Tracker" };

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const isCoordinator = ["coordinator","admin"].includes(session?.user.role ?? "");
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const take = 20;
  const skip = (page - 1) * take;

  const [batches, total] = await Promise.all([
    prisma.outreachBatch.findMany({
      include: {
        client: { select: { id: true, name: true, tier: true, accountHealth: true, lastOutreachDate: true } },
        sentBy: { select: { name: true } },
        enrollments: {
          include: {
            enrollment: {
              include: {
                feature: { select: { id: true, name: true } },
                csmApprovedBy: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.outreachBatch.count(),
  ]);

  const staleThreshold = new Date(Date.now() - 48 * 3600000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Outreach Batches</h1>
        {isCoordinator && <TriggerBatchGroupButton />}
      </div>

      <div className="space-y-4">
        {batches.map((b) => {
          const pendingApprovals = b.enrollments.filter(
            (be) => be.enrollment.csmApprovedBy === null
          ).length;
          const isStale = b.batchStatus !== "sent" && b.createdAt < staleThreshold;
          const featureNames = [...new Set(b.enrollments.map((be) => be.enrollment.feature.name))];

          return (
            <div
              key={b.id}
              className={`rounded-xl border bg-white p-5 space-y-3 ${
                isStale ? "border-red-200" : "border-gray-200"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <HealthDot health={b.client.accountHealth} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{b.client.name}</p>
                    <p className="text-xs text-gray-400">Tier {b.client.tier}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <BatchStatusBadge status={b.batchStatus} />
                  {isStale && (
                    <span className="text-xs font-medium text-red-600">Pending 48h+</span>
                  )}
                  {isCoordinator && b.batchStatus !== "sent" && (
                    <SendBatchButton batchId={b.id} />
                  )}
                </div>
              </div>

              {/* Features included */}
              <div className="flex flex-wrap gap-1.5">
                {featureNames.map((name) => (
                  <span key={name} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {name}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-500">
                <span>{b.enrollments.length} enrollment{b.enrollments.length !== 1 ? "s" : ""}</span>
                {pendingApprovals > 0 && (
                  <span className="text-amber-600">{pendingApprovals} CSM approval{pendingApprovals !== 1 ? "s" : ""} pending</span>
                )}
                <span>Created {b.createdAt.toLocaleDateString()}</span>
                {b.sentAt && <span>Sent {b.sentAt.toLocaleDateString()} by {b.sentBy?.name}</span>}
                {b.client.lastOutreachDate && (
                  <span>Last outreach: {b.client.lastOutreachDate.toLocaleDateString()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {batches.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <p className="text-lg text-gray-400">No batches yet.</p>
          {isCoordinator && (
            <p className="text-sm text-gray-300 mt-1">Trigger batch grouping to create batches from approved enrollments.</p>
          )}
        </div>
      )}

      {total > take && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Showing {skip + 1}–{Math.min(skip + take, total)} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/batches?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">← Prev</Link>}
            {skip + take < total && <Link href={`/batches?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
