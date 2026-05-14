"use client";

import { useState, useTransition } from "react";
import { HealthDot } from "./HealthDot";
import type { Client, HealthStatus } from "@/generated/prisma/client";

type ClientRow = Pick<Client, "id" | "name" | "tier" | "accountHealth"> & {
  csmOwner: { name: string };
  _enrollmentCount: number;
};

export function NominatePanel({
  featureId,
  candidates,
  onNominated,
}: {
  featureId: string;
  candidates: ClientRow[];
  onNominated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ warning?: string; error?: string } | null>(null);

  const filtered = candidates.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  async function nominate(clientId: string, force = false) {
    setResult(null);
    startTransition(async () => {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, featureId, force }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.conflict) {
          const confirmed = window.confirm(`${data.error}\n\nNominate anyway?`);
          if (confirmed) nominate(clientId, true);
        } else {
          setResult({ error: data.error });
        }
        return;
      }
      if (data.warning) setResult({ warning: data.warning });
      onNominated();
    });
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search clients…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
      />

      {result?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
      )}
      {result?.warning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{result.warning}</p>
      )}

      <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">No clients match.</li>
        )}
        {filtered.map((c) => {
          const blocked = c.accountHealth === "red";
          return (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${blocked ? "text-gray-400" : "text-gray-900"}`}>
                  {c.name}
                </p>
                <p className="text-xs text-gray-400">
                  Tier {c.tier} · {c.csmOwner.name} · {c._enrollmentCount} active betas
                </p>
              </div>
              <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                <HealthDot health={c.accountHealth as HealthStatus} />
                <button
                  disabled={blocked || pending}
                  onClick={() => nominate(c.id)}
                  className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Nominate
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
