import Link from "next/link";
import type { DistrictsFeatureCollection, RiskResult } from "@/lib/api";
import { projectDistricts } from "@/lib/geo";
import { riskClassColorVar } from "./RiskBadge";
import styles from "./ChoroplethPreview.module.css";

// A static preview built from real district geometry (/gis/districts) and
// real risk classification (/risk/state) -- not the interactive Spatial
// Intelligence workspace (no pan/zoom/basemap/drill-down; that arrives in
// the next build phase). Approximate equirectangular projection only.
export function ChoroplethPreview({
  districts,
  riskByDistrict,
}: {
  districts: DistrictsFeatureCollection;
  riskByDistrict: Map<string, RiskResult>;
}) {
  const { districts: projected, viewBoxWidth, viewBoxHeight } = projectDistricts(districts);

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Risk choropleth preview</div>
          <div className={styles.subtitle}>
            33 districts, current climate-stress risk class. Real data, approximate projection.
          </div>
        </div>
        <Link href="/spatial" className={styles.link}>
          Open Spatial Intelligence →
        </Link>
      </div>

      <svg
        viewBox={`0 0 ${viewBoxWidth.toFixed(2)} ${viewBoxHeight.toFixed(2)}`}
        className={styles.svg}
        role="img"
        aria-label="Telangana district risk choropleth preview"
      >
        {projected.map((d) => {
          const risk = riskByDistrict.get(d.districtId);
          const fill = risk ? riskClassColorVar(risk.risk_class) : "var(--status-neutral)";
          return (
            <path
              key={d.districtId}
              d={d.path}
              fill={fill}
              fillOpacity={0.55}
              stroke="var(--surface-1)"
              strokeWidth={0.6}
              className={styles.district}
            >
              <title>
                {d.name}
                {risk ? ` — ${risk.risk_class} (score ${risk.risk_score?.toFixed(2) ?? "n/a"})` : " — no data"}
              </title>
            </path>
          );
        })}
      </svg>

      <div className={styles.legend}>
        <LegendItem colorVar="var(--status-good)" label="Low" />
        <LegendItem colorVar="var(--status-warning)" label="Moderate" />
        <LegendItem colorVar="var(--status-serious)" label="High" />
        <LegendItem colorVar="var(--status-critical)" label="Severe" />
        <LegendItem colorVar="var(--status-neutral)" label="Insufficient data" />
      </div>
    </div>
  );
}

function LegendItem({ colorVar, label }: { colorVar: string; label: string }) {
  return (
    <span className={styles.legendItem}>
      <span className={styles.legendDot} style={{ background: colorVar }} aria-hidden />
      {label}
    </span>
  );
}
