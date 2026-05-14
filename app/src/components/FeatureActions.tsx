"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CloseFeatureButton({ featureId }: { featureId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("completed");
  const [notes, setNotes] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState("");

  async function close() {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/features/${featureId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closeReason: reason, closeNotes: notes, force }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setOpen(false);
      router.push("/features");
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        Close Beta
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Close Beta</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="merged">Merged</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Force close (drops active testers immediately)
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={close}
            disabled={pending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Closing…" : "Close Beta"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CloneFeatureButton({ featureId }: { featureId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function clone() {
    startTransition(async () => {
      const res = await fetch(`/api/features/${featureId}/clone`, { method: "POST" });
      const data = await res.json();
      if (res.ok) router.push(`/features/${data.id}`);
    });
  }

  return (
    <button
      onClick={clone}
      disabled={pending}
      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? "Cloning…" : "Clone as Template"}
    </button>
  );
}
