import type { HealthStatus } from "@/generated/prisma/client";

const CONFIG: Record<HealthStatus, { className: string; label: string }> = {
  green:  { className: "bg-green-500",  label: "Healthy" },
  yellow: { className: "bg-amber-400",  label: "At Risk" },
  red:    { className: "bg-red-500",    label: "Blocked" },
};

export function HealthDot({ health, showLabel = false }: { health: HealthStatus; showLabel?: boolean }) {
  const { className, label } = CONFIG[health];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${className}`} title={label} />
      {showLabel && <span className="text-sm text-gray-600">{label}</span>}
    </span>
  );
}
