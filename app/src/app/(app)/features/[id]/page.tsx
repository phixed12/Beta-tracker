import { prisma } from "@/lib/prisma";

import { notFound } from "next/navigation";
import Link from "next/link";
import { BetaStatusBadge, TesterStatusBadge, ApprovalStatusBadge } from "@/components/StatusBadge";
import { HealthDot } from "@/components/HealthDot";
import { SlotFill } from "@/components/SlotFill";
import { ApproveRejectButtons, RemoveEnrollmentButton } from "@/components/EnrollmentActions";
import { CloseFeatureButton, CloneFeatureButton } from "@/components/FeatureActions";
import { NominatePanel } from "@/components/NominatePanel";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  

  const [feature, allClients] = await Promise.all([
    prisma.betaFeature.findUnique({
      where: { id },
      include: {
        ownerPm: { select: { id: true, name: true, email: true } },
        ownerPmm: { select: { id: true, name: true, email: true } },
        enrollments: {
          include: {
            client: {
              include: { csmOwner: { select: { id: true, name: true } } },
            },
            assignedBy: { select: { name: true } },
            csmApprovedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.client.findMany({
      include: {
        csmOwner: { select: { name: true } },
        _count: {
          select: {
            enrollments: {
              where: {
                testerStatus: { in: ["nominated","csm_pending","csm_approved","outreach_sent","confirmed","active"] },
              },
            },
          },
        },
      },
      orderBy: { tier: "asc" },
    }),
  ]);

  if (!feature) notFound();

  const enrolledClientIds = new Set(feature.enrollments.map((e) => e.clientId));
  const candidates = allClients
    .filter((c) => !enrolledClientIds.has(c.id))
    .map((c) => ({ ...c, _enrollmentCount: c._count.enrollments }));

  const confirmed = feature.enrollments.filter((e) =>
    ["confirmed","active","completed"].includes(e.testerStatus)
  ).length;
  const csmPending = feature.enrollments.filter((e) => e.csmApprovalStatus === "pending").length;

  const canNominate = true;
  const isClosed = feature.status === "closed" || feature.status === "closing";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/features" className="text-sm text-gray-400 hover:text-gray-600">← Features</Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{feature.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <BetaStatusBadge status={feature.status} />
            <span>PM: {feature.ownerPm.name}</span>
            <span>PMM: {feature.ownerPmm.name}</span>
            <span>Start: {feature.startDate.toLocaleDateString()}</span>
            {feature.closedAt && <span>Closed: {feature.closedAt.toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <CloneFeatureButton featureId={feature.id} />
          {!isClosed && <CloseFeatureButton featureId={feature.id} />}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Slots",        value: <SlotFill confirmed={confirmed} target={feature.targetTesterCount} /> },
          { label: "CSM Pending",  value: <span className={`text-2xl font-bold ${csmPending > 0 ? "text-amber-600" : "text-gray-900"}`}>{csmPending}</span> },
          { label: "Total Nominated", value: <span className="text-2xl font-bold text-gray-900">{feature.enrollments.length}</span> },
          { label: "Outreach Sent",value: <span className="text-2xl font-bold text-gray-900">{feature.enrollments.filter(e=>e.testerStatus==="outreach_sent").length}</span> },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
            <div className="mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* Enrollment list + nominate panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Enrollment list */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Enrollments</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Client</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Tester Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 hidden md:table-cell">CSM Approval</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {feature.enrollments.map((e) => {
                const preOutreach = ["nominated","csm_pending","csm_approved"].includes(e.testerStatus);
                const isCsmForClient = true;
                const isApprovalPending = e.csmApprovalStatus === "pending";

                return (
                  <tr key={e.id} className={`hover:bg-gray-50 ${e.isOverflow ? "bg-indigo-50/30" : ""}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <HealthDot health={e.client.accountHealth} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {e.client.name}
                            {e.isOverflow && (
                              <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                overflow
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">CSM: {e.client.csmOwner.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <TesterStatusBadge status={e.testerStatus} />
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <ApprovalStatusBadge status={e.csmApprovalStatus} />
                      {e.csmRejectionReason && (
                        <p className="mt-0.5 text-xs text-gray-400 truncate max-w-[160px]" title={e.csmRejectionReason}>
                          {e.csmRejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isApprovalPending && (isCsmForClient || true) ? (
                        <ApproveRejectButtons enrollmentId={e.id} />
                      ) : preOutreach && canNominate ? (
                        <RemoveEnrollmentButton enrollmentId={e.id} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {feature.enrollments.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No enrollments yet.</p>
          )}
        </div>

        {/* Nominate panel */}
        {canNominate && !isClosed && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 h-fit">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Testers</h2>
            {feature.idealClientCriteria && (
              <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <strong>Ideal criteria:</strong> {feature.idealClientCriteria}
              </p>
            )}
            <NominatePanel
              featureId={feature.id}
              candidates={candidates}
              onNominated={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
