"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  FunnelChart, Funnel, LabelList, Cell,
} from "recharts";

export function DurationChart({ data }: { data: { name: string; days: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
        <YAxis tick={{ fontSize: 10 }} unit="d" />
        <Tooltip formatter={(v) => [`${v} days`, "Duration"]} />
        <Bar dataKey="days" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConversionFunnel({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const COLORS = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe"];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <FunnelChart>
        <Tooltip />
        <Funnel dataKey="value" data={data} isAnimationActive>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          <LabelList position="right" dataKey="name" fill="#374151" style={{ fontSize: 11 }} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

export function CompletionBarChart({
  data,
}: {
  data: { name: string; rate: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 60, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
        <Tooltip formatter={(v) => [`${v}%`, "Completion rate"]} />
        <Bar dataKey="rate" fill="#10b981" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
