interface StatCardProps {
  label: string;
  value: number | string | null;
  detail?: string;
  trend?: string;
}

export function StatCard({ label, value, detail, trend }: StatCardProps) {
  return (
    <div className="bg-surface border border-white/[0.08] p-3.5 rounded transition-colors hover:border-white/[0.14]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        {trend && <span className="text-[10px] font-mono text-accent">{trend}</span>}
      </div>
      <p className="mt-2 text-2xl font-mono font-semibold tracking-tight text-ink">
        {value === null || value === undefined
          ? "—"
          : typeof value === "number"
          ? value.toLocaleString()
          : value}
      </p>
      {detail && <p className="mt-1 text-[11px] text-muted truncate">{detail}</p>}
    </div>
  );
}
