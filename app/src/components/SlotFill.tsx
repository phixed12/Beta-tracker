export function SlotFill({ confirmed, target }: { confirmed: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((confirmed / target) * 100)) : 0;
  const barColor = pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-400";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 w-24 rounded-full bg-gray-200 flex-shrink-0">
        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm tabular-nums text-gray-700 whitespace-nowrap">
        {confirmed}/{target}
      </span>
    </div>
  );
}
