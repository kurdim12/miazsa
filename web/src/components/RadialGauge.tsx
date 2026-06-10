// =============================================================================
// components/RadialGauge.tsx — 0..100 radial gauge for gw_stress_index.
//
// A lightweight SVG semicircular gauge (docs/13 §B.4 RadialGauge). Colored by
// stress class (docs/08 §4). No chart dependency needed for this primitive.
// =============================================================================

import { classFromIndex, STRESS_COLORS, formatValue } from "@/lib/format";

export interface RadialGaugeProps {
  /** 0..100 value; null renders an honest "no data" dash. */
  value: number | null;
  size?: number;
  label?: string;
}

export function RadialGauge({ value, size = 160, label }: RadialGaugeProps) {
  const radius = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius; // semicircle
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value)) / 100;
  const dash = circumference * pct;
  const cls = value === null ? null : classFromIndex(value);
  const color = cls ? STRESS_COLORS[cls] : "#9CA3AF";

  // Semicircle path from left to right (180° arc above center).
  const arc = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 16} role="img" aria-label={`${label ?? "Gauge"}: ${value === null ? "no data" : formatValue(value)}`}>
        <path d={arc} fill="none" stroke="rgb(var(--muted))" strokeWidth={12} strokeLinecap="round" />
        {value !== null && (
          <path
            d={arc}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        )}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: size * 0.2, fontWeight: 700 }}
        >
          {value === null ? "—" : formatValue(value)}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: size * 0.08 }}
        >
          / 100
        </text>
      </svg>
      {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
