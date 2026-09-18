"use client";

import { useMemo, useRef, useState } from "react";
import type { RecoveryPoint } from "@/lib/api";
import styles from "./RecoveryChart.module.css";

export type ChartSeries = {
  key: string;
  label: string;
  points: RecoveryPoint[];
  colorVar: string;
  emphasize?: boolean;
};

const WIDTH = 720;
const HEIGHT = 320;
const MARGIN = { top: 20, right: 20, bottom: 32, left: 44 };

export function RecoveryChart({ series, thresholdFraction }: { series: ChartSeries[]; thresholdFraction?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const allPoints = series.flatMap((s) => s.points);
  const maxDay = Math.max(1, ...allPoints.map((p) => p.day));
  const maxImpact = Math.max(0.05, ...allPoints.map((p) => p.demand_impact_fraction), thresholdFraction ?? 0);

  const xScale = (day: number) => (day / maxDay) * plotW;
  const yScale = (v: number) => plotH - (v / maxImpact) * plotH;

  const yTicks = useMemo(() => {
    const step = maxImpact / 4;
    return Array.from({ length: 5 }, (_, i) => step * i);
  }, [maxImpact]);

  const xTicks = useMemo(() => {
    const step = Math.max(1, Math.round(maxDay / 5));
    const ticks: number[] = [];
    for (let d = 0; d <= maxDay; d += step) ticks.push(d);
    if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay);
    return ticks;
  }, [maxDay]);

  const nearestDay = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH - MARGIN.left;
    const day = Math.round((x / plotW) * maxDay);
    return Math.min(Math.max(day, 0), maxDay);
  };

  const hoverEntries = hoverDay === null ? [] : series.map((s) => ({ s, point: closestPoint(s.points, hoverDay) }));

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        {series.map((s) => (
          <div key={s.key} className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: s.colorVar, opacity: s.emphasize ? 1 : 0.55 }} />
            {s.label}
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.svg}
        role="img"
        aria-label="Recovery trajectory over simulated days"
        onPointerMove={(e) => setHoverDay(nearestDay(e.clientX))}
        onPointerLeave={() => setHoverDay(null)}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={yScale(t)} y2={yScale(t)} className={styles.gridline} />
              <text x={-8} y={yScale(t)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={xScale(t)} y={plotH + 20} className={styles.axisLabel} textAnchor="middle">
              d{t}
            </text>
          ))}

          {thresholdFraction != null ? (
            <line
              x1={0}
              x2={plotW}
              y1={yScale(thresholdFraction)}
              y2={yScale(thresholdFraction)}
              className={styles.thresholdLine}
            />
          ) : null}

          {series.map((s) => {
            const path = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.day).toFixed(1)},${yScale(p.demand_impact_fraction).toFixed(1)}`).join(" ");
            const areaPath = s.emphasize
              ? `${path} L${xScale(s.points[s.points.length - 1]?.day ?? 0).toFixed(1)},${plotH} L${xScale(0).toFixed(1)},${plotH} Z`
              : null;
            return (
              <g key={s.key}>
                {areaPath ? <path d={areaPath} fill={s.colorVar} fillOpacity={0.1} stroke="none" /> : null}
                <path d={path} fill="none" stroke={s.colorVar} strokeWidth={2} strokeOpacity={s.emphasize ? 1 : 0.55} strokeLinecap="round" strokeLinejoin="round" />
                {[s.points[0], s.points[s.points.length - 1]].filter(Boolean).map((p, i) => (
                  <circle
                    key={i}
                    cx={xScale(p!.day)}
                    cy={yScale(p!.demand_impact_fraction)}
                    r={4.5}
                    fill={s.colorVar}
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                    opacity={s.emphasize ? 1 : 0.55}
                  />
                ))}
              </g>
            );
          })}

          {hoverDay !== null ? <line x1={xScale(hoverDay)} x2={xScale(hoverDay)} y1={0} y2={plotH} className={styles.crosshair} /> : null}
        </g>
      </svg>

      {hoverDay !== null && hoverEntries.length > 0 ? (
        <div
          className={styles.tooltip}
          style={{
            left: `${(MARGIN.left + xScale(hoverDay)) / WIDTH * 100}%`,
          }}
        >
          <div className={styles.tooltipDay}>Day {hoverDay}</div>
          {hoverEntries.map(({ s, point }) =>
            point ? (
              <div key={s.key} className={styles.tooltipRow}>
                <span className={styles.tooltipKey} style={{ background: s.colorVar }} />
                <span className={styles.tooltipValue}>{(point.demand_impact_fraction * 100).toFixed(1)}%</span>
                <span className={styles.tooltipLabel}>{s.label}</span>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function closestPoint(points: RecoveryPoint[], day: number): RecoveryPoint | null {
  if (points.length === 0) return null;
  return points.reduce((best, p) => (Math.abs(p.day - day) < Math.abs(best.day - day) ? p : best), points[0]);
}
