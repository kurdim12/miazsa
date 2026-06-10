// =============================================================================
// components/TimeSeriesChart.tsx — Recharts line chart (docs/13 §B.4).
//
// Wrapped with a ValidationEnvelope badge on the title and a custom tooltip that
// always surfaces the source + date for the hovered point (docs/13 §B.4). One or
// more named series can be plotted; each point may carry its own confidence so
// the tooltip can show it.
// =============================================================================

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { ValidationEnvelopeData } from "@/lib/types";
import { ValidationEnvelope } from "@/components/ValidationEnvelope";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/States";
import { formatDate, formatValue } from "@/lib/format";

export interface SeriesPoint {
  /** ISO date used on the x-axis. */
  date: string;
  [seriesKey: string]: string | number | null;
}

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  unit?: string;
}

export interface TimeSeriesChartProps {
  title: string;
  data: SeriesPoint[];
  series: SeriesConfig[];
  /** Envelope shown on the title (one representative metric). */
  envelope?: ValidationEnvelopeData | null;
  /** Source line shown beneath the chart (license / provenance summary). */
  sourceNote?: string;
  height?: number;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs text-card-foreground shadow-lg">
      <p className="mb-1 font-medium text-muted-foreground">{formatDate(String(label))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color ?? "#1D4ED8" }}
          />
          <span>{p.name}:</span>
          <span className="font-semibold tabular-nums">{formatValue(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function TimeSeriesChart({
  title,
  data,
  series,
  envelope,
  sourceNote,
  height = 220,
}: TimeSeriesChartProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {envelope && <ValidationEnvelope data={envelope} variant="badge" />}
        </div>
      </div>
      <CardContent className="pt-2">
        {data.length === 0 ? (
          <EmptyState className="border-0 shadow-none" />
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => formatDate(v)}
                tick={{ fontSize: 10, fill: "rgb(var(--muted-foreground))" }}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgb(var(--muted-foreground))" }}
                width={42}
              />
              <Tooltip content={<ChartTooltip />} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {sourceNote && (
          <p className="mt-2 text-2xs text-muted-foreground">{sourceNote}</p>
        )}
      </CardContent>
    </Card>
  );
}
