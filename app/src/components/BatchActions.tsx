"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function SendBatchButton({
  batchId,
  overrideCooldown = false,
}: {
  batchId: string;
  overrideCooldown?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function send() {
    if (!confirm("Send this outreach batch?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/batches/${batchId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideCooldown }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.cooldown) {
          const override = confirm(`${data.error}\n\nOverride cooldown and send?`);
          if (override) {
            await fetch(`/api/batches/${batchId}/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ overrideCooldown: true }),
            });
          }
        } else {
          alert(data.error);
        }
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={send}
      disabled={pending}
      className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function TriggerBatchGroupButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function trigger() {
    startTransition(async () => {
      await fetch("/api/batches/trigger", { method: "POST" });
      router.refresh();
    });
  }

  return (
    <button
      onClick={trigger}
      disabled={pending}
      className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? "Grouping…" : "Trigger Batch Grouping"}
    </button>
  );
}
