"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import styles from "./MiniRiskMap.module.css";

const MiniRiskMapCanvas = dynamic(() => import("./MiniRiskMapCanvas").then((m) => m.MiniRiskMapCanvas), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

import type { DistrictsFeatureCollection, RiskResult } from "@/lib/api";

// Real Leaflet rendering of the actual /gis/districts GeoJSON -- replaces
// the earlier static-SVG ChoroplethPreview so every map surface in the
// product (not just the main Spatial Intelligence workspace) uses the same
// accurate Web Mercator projection over real district geometry, not an
// approximated 2D projection.
export function MiniRiskMap({
  districts,
  riskByDistrict,
  highlightDistrictId,
  highlightDistrictIds,
  onSelectDistrict,
  title = "Risk map",
  subtitle = "33 districts, current climate-stress risk class. Live GeoJSON from /gis/districts.",
  showLink = true,
  showLegend = true,
  height = 320,
}: {
  districts: DistrictsFeatureCollection;
  riskByDistrict: Map<string, RiskResult>;
  highlightDistrictId?: string;
  highlightDistrictIds?: Set<string>;
  onSelectDistrict?: (districtId: string) => void;
  title?: string;
  subtitle?: string;
  showLink?: boolean;
  showLegend?: boolean;
  height?: number;
}) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        {showLink ? (
          <Link href="/spatial" className={styles.link}>
            Open Spatial Intelligence →
          </Link>
        ) : null}
      </div>

      <div style={{ height }} className={styles.mapBox}>
        <MiniRiskMapCanvas
          districts={districts}
          riskByDistrict={riskByDistrict}
          highlightDistrictId={highlightDistrictId}
          highlightDistrictIds={highlightDistrictIds}
          onSelectDistrict={onSelectDistrict}
        />
      </div>

      {showLegend ? (
        <div className={styles.legend}>
          <LegendItem colorVar="var(--status-good)" label="Low" />
          <LegendItem colorVar="var(--status-warning)" label="Moderate" />
          <LegendItem colorVar="var(--status-serious)" label="High" />
          <LegendItem colorVar="var(--status-critical)" label="Severe" />
          <LegendItem colorVar="var(--status-neutral)" label="Insufficient data" />
        </div>
      ) : null}
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
