"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ApproveRejectButtons({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function approve() {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/enrollments/${enrollmentId}/approve`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed");
      } else {
        router.refresh();
      }
    });
  }

  async function reject() {
    if (!reason.trim()) { setError("Rejection reason is required."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/enrollments/${enrollmentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed");
      } else {
        setShowReject(false);
        router.refresh();
      }
    });
  }

  if (showReject) {
    return (
      <div className="space-y-1">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason…"
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-red-300"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-1">
          <button
            onClick={reject}
            disabled={pending}
            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => { setShowReject(false); setError(""); }}
            className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      {error && <p className="text-xs text-red-600 mr-1">{error}</p>}
      <button
        onClick={approve}
        disabled={pending}
        className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={() => setShowReject(true)}
        disabled={pending}
        className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}

export function RemoveEnrollmentButton({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function remove() {
    if (!confirm("Remove this nomination?")) return;
    startTransition(async () => {
      await fetch(`/api/enrollments/${enrollmentId}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <button
      onClick={remove}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
