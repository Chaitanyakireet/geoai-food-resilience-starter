"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { AiScenarioContext, DistrictsFeatureCollection } from "@/lib/api";
import styles from "./ScenarioContextBar.module.css";

export function ScenarioContextBar({
  context,
  districts,
  providerConfigured,
  providerName,
  onGenerateBrief,
  generating,
  onPickGeo,
}: {
  context: AiScenarioContext | null;
  districts: DistrictsFeatureCollection;
  providerConfigured: boolean | null;
  providerName: string | null;
  onGenerateBrief: () => void;
  generating: boolean;
  onPickGeo: (geoId: string) => void;
}) {
  const [quickGeoId, setQuickGeoId] = useState("hyderabad");

  return (
    <div className={`${styles.wrap} card-floating`}>
      <div className={styles.left}>
        {context?.geo_id ? (
          <>
            <Pill label="Geography" value={context.geo_id.replace(/_/g, " ")} />
            <Pill label="Food scope" value={(context.food_category ?? "all_food").replace(/_/g, " ")} />
            {context.shock_field ? <Pill label="Shock" value={`${context.shock_field.replace(/_/g, " ")} @ ${Math.round((context.severity ?? 0) * 100)}%`} /> : null}
            {context.intervention_types && context.intervention_types.length > 0 ? <Pill label="Portfolio" value={`${context.intervention_types.length} intervention(s)`} /> : null}
            {context.optimization_selected_types ? <Pill label="Optimizer" value={context.optimization_selected_types.join(", ").replace(/_/g, " ")} /> : null}
            <StatusBadge status="ESTIMATED" compact />
          </>
        ) : (
          <div className={styles.noContext}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              No scenario received —{" "}
            </span>
            <select className={styles.select} value={quickGeoId} onChange={(e) => setQuickGeoId(e.target.value)}>
              {[...districts.features]
                .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
                .map((f) => (
                  <option key={f.properties.district_id} value={f.properties.district_id}>
                    {f.properties.name}
                  </option>
                ))}
            </select>
            <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onPickGeo(quickGeoId)}>
              Use this geography
            </button>
            <Link href="/interventions" className={styles.editLink}>
              or compose a full scenario →
            </Link>
          </div>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.providerStatus}>
          {providerConfigured === null ? "Checking AI provider…" : providerConfigured ? `AI: ${providerName}` : "AI provider not configured — deterministic mode"}
        </span>
        <button type="button" className="btn btn-primary" disabled={!context?.geo_id || generating} onClick={onGenerateBrief}>
          {generating ? "Generating…" : "Generate Decision Brief"}
        </button>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.pill}>
      <span className={styles.pillLabel}>{label}</span>
      {value}
    </span>
  );
}
