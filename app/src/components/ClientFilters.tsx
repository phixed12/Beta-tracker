"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ClientFilters({
  csms,
  currentHealth,
  currentCsm,
}: {
  csms: { id: string; name: string }[];
  currentHealth: string;
  currentCsm: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/clients?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <select
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
        value={currentHealth}
        onChange={(e) => update("health", e.target.value)}
      >
        <option value="">All health</option>
        <option value="green">Green</option>
        <option value="yellow">Yellow</option>
        <option value="red">Red</option>
      </select>

      <select
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white"
        value={currentCsm}
        onChange={(e) => update("csm", e.target.value)}
      >
        <option value="">All CSMs</option>
        {csms.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
