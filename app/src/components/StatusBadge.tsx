import type { BetaStatus, TesterStatus, ApprovalStatus, BatchStatus } from "@/generated/prisma/client";

const BETA_STATUS: Record<BetaStatus, { label: string; className: string }> = {
  draft:         { label: "Draft",         className: "bg-gray-100 text-gray-600" },
  recruiting:    { label: "Recruiting",    className: "bg-blue-100 text-blue-700" },
  outreach_sent: { label: "Outreach Sent", className: "bg-violet-100 text-violet-700" },
  full:          { label: "Full",          className: "bg-indigo-100 text-indigo-700" },
  in_progress:   { label: "In Progress",   className: "bg-green-100 text-green-700" },
  closing:       { label: "Closing",       className: "bg-amber-100 text-amber-700" },
  closed:        { label: "Closed",        className: "bg-gray-200 text-gray-500" },
};

const TESTER_STATUS: Record<TesterStatus, { label: string; className: string }> = {
  nominated:    { label: "Nominated",    className: "bg-gray-100 text-gray-600" },
  csm_pending:  { label: "CSM Pending",  className: "bg-amber-100 text-amber-700" },
  csm_approved: { label: "CSM Approved", className: "bg-blue-100 text-blue-700" },
  outreach_sent:{ label: "Outreach Sent",className: "bg-violet-100 text-violet-700" },
  confirmed:    { label: "Confirmed",    className: "bg-teal-100 text-teal-700" },
  active:       { label: "Active",       className: "bg-green-100 text-green-700" },
  completed:    { label: "Completed",    className: "bg-emerald-100 text-emerald-700" },
  dropped:      { label: "Dropped",      className: "bg-red-100 text-red-700" },
  cancelled:    { label: "Cancelled",    className: "bg-gray-200 text-gray-500" },
};

const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; className: string }> = {
  pending:  { label: "Pending",  className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

const BATCH_STATUS: Record<BatchStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  ready:   { label: "Ready",   className: "bg-blue-100 text-blue-700" },
  sent:    { label: "Sent",    className: "bg-green-100 text-green-700" },
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function BetaStatusBadge({ status }: { status: BetaStatus }) {
  const config = BETA_STATUS[status];
  return <Badge {...config} />;
}

export function TesterStatusBadge({ status }: { status: TesterStatus }) {
  const config = TESTER_STATUS[status];
  return <Badge {...config} />;
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const config = APPROVAL_STATUS[status];
  return <Badge {...config} />;
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const config = BATCH_STATUS[status];
  return <Badge {...config} />;
}
