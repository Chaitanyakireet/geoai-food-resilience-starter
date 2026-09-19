"use client";

import { useState } from "react";
import { postCarbonCompare, type CandidateIntervention, type CarbonComparisonResult, type DistrictsFeatureCollection } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./CarbonImpactPanel.module.css";

const TRANSPORT_RELEVANT_TYPES = new Set(["route_diversification", "alternative_sourcing"]);

export function CarbonImpactPanel({
  districts,
  geoId,
  draft = [],
}: {
  districts: DistrictsFeatureCollection;
  geoId: string;
  draft?: CandidateIntervention[];
}) {
  const [alternateGeoId, setAlternateGeoId] = useState("");
  const [activityTonnes, setActivityTonnes] = useState("");
  const [result, setResult] = useState<CarbonComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTransportIntervention = draft.some((d) => TRANSPORT_RELEVANT_TYPES.has(d.intervention_type));
  const sorted = [...districts.features].sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  const runCompare = async () => {
    if (!alternateGeoId) return;
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await postCarbonCompare({
      geo_id: geoId,
      alternate_geo_id: alternateGeoId,
      activity_tonnes: activityTonnes === "" ? undefined : parseFloat(activityTonnes),
    });
    setResult(data);
    setError(apiError?.detail ?? null);
    setLoading(false);
  };

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Carbon &amp; Resource Impact</div>
      <p className={styles.note}>
        Deterministic transport-carbon estimate for rerouting/alternative-sourcing between two geographies — real
        great-circle distance × a cited emissions factor. Not computed by the AI.
        {draft.length > 0 && !hasTransportIntervention
          ? " Add a route diversification or alternative sourcing intervention above for this to reflect your portfolio."
          : null}
      </p>

      <div className={styles.form}>
        <label>
          Reroute / source to
          <select value={alternateGeoId} onChange={(e) => setAlternateGeoId(e.target.value)}>
            <option value="">Select a district…</option>
            {sorted
              .filter((f) => f.properties.district_id !== geoId)
              .map((f) => (
                <option key={f.properties.district_id} value={f.properties.district_id}>
                  {f.properties.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Activity (tonnes, optional)
          <input
            type="number"
            min="0"
            value={activityTonnes}
            placeholder="intensity only"
            onChange={(e) => setActivityTonnes(e.target.value)}
          />
        </label>
        <button type="button" className={styles.runBtn} onClick={runCompare} disabled={!alternateGeoId || loading}>
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {result ? <CarbonResultDisplay result={result} /> : null}
    </div>
  );
}

function CarbonResultDisplay({ result }: { result: CarbonComparisonResult }) {
  const { world_a, world_b, delta_carbon_kg, pct_change, detail } = result;

  if (!world_b.available) {
    return (
      <div className={styles.unavailable}>
        <strong>Not available.</strong> {world_b.unavailable_reason}
      </div>
    );
  }

  return (
    <div className={styles.result}>
      <div className={styles.grid}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Baseline (World A)</div>
          <div className={styles.metricValue}>{world_a.total_carbon_kg?.toLocaleString()} kg CO2e</div>
          <StatusBadge status={world_a.truth_status} compact />
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Scenario (World B)</div>
          <div className={styles.metricValue}>{world_b.total_carbon_kg?.toLocaleString()} kg CO2e</div>
          <StatusBadge status={world_b.truth_status} compact />
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Difference</div>
          <div className={styles.metricValue}>
            {delta_carbon_kg != null ? `+${delta_carbon_kg.toLocaleString()} kg` : "—"}
          </div>
          <div className={styles.metricSub}>{pct_change != null ? `${pct_change > 0 ? "+" : ""}${pct_change}%` : "% change not defined from a zero baseline"}</div>
        </div>
      </div>

      {detail ? (
        <div className={styles.detailRow}>
          <span>
            {detail.distance_km?.toLocaleString()} km × {detail.factor.factor_value} {detail.factor.unit}
            {detail.activity_tonnes != null ? ` × ${detail.activity_tonnes} t` : " (intensity only — no tonnage supplied)"}
          </span>
          <span className={styles.intensity}>{detail.carbon_intensity_kg_per_tonne} kg/tonne</span>
        </div>
      ) : null}

      {detail ? (
        <a className={styles.source} href={detail.factor.source_url ?? undefined} target="_blank" rel="noreferrer">
          Source: {detail.factor.source_name} ({detail.factor.year})
        </a>
      ) : null}

      <details className={styles.limitations}>
        <summary>Limitations &amp; assumptions</summary>
        <ul>
          {result.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
