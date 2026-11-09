import React from "react";

interface StatRowProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  badge?: string;
  mono?: boolean;
}

export function StatRow({
  label,
  value,
  detail,
  badge,
  mono = true,
}: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 text-xs border-b border-white/[0.06] last:border-b-0">
      <div className="min-w-0 pr-3">
        <span className="text-muted block truncate">{label}</span>
        {detail && <span className="text-[11px] text-muted-dark block mt-0.5">{detail}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono rounded bg-white/[0.06] text-muted border border-white/[0.08]">
            {badge}
          </span>
        )}
        <span
          className={`text-ink text-right font-medium ${
            mono ? "font-mono" : ""
          }`}
        >
          {value === null || value === undefined ? "—" : value}
        </span>
      </div>
    </div>
  );
}
