"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { DistrictsFeatureCollection } from "@/lib/api";
import type { ScenarioHandoff } from "@/components/interventions/types";
import styles from "./ScenarioContextHeader.module.css";

export function ScenarioContextHeader({
  handoff,
  districts,
  onRun,
  running,
  onPickBaseline,
}: {
  handoff: ScenarioHandoff | null;
  districts: DistrictsFeatureCollection;
  onRun: () => void;
  running: boolean;
  onPickBaseline: (geoId: string, foodCategory: string) => void;
}) {
  const [quickGeoId, setQuickGeoId] = useState("hyderabad");

  if (!handoff) {
    return (
      <div className={`${styles.wrap} card-floating`}>
        <div className={styles.emptyHeader}>
          <div className={styles.emptyTitle}>No scenario received yet</div>
          <p className={styles.emptyText}>
            Compose a shock and portfolio in the Intervention Lab and choose &quot;Simulate in Digital Twin&quot;
            — or explore a real baseline (no shock) for a district right here.
          </p>
        </div>
        <div className={styles.emptyActions}>
          <select className={styles.select} value={quickGeoId} onChange={(e) => setQuickGeoId(e.target.value)}>
            {[...districts.features]
              .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
              .map((f) => (
                <option key={f.properties.district_id} value={f.properties.district_id}>
                  {f.properties.name}
                </option>
              ))}
          </select>
          <button type="button" className="btn btn-secondary" onClick={() => onPickBaseline(quickGeoId, "all_food")}>
            View baseline (no shock)
          </button>
          <Link href="/interventions" className="btn btn-primary">
            Compose a scenario →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} card-floating`}>
      <div className={styles.summary}>
        <Field label="Geography" value={handoff.geo_id.replace(/_/g, " ")} />
        <Field label="Food scope" value={handoff.food_category.replace(/_/g, " ")} />
        <Field label="Shock" value={`${handoff.shock_field.replace(/_/g, " ")} @ ${Math.round(handoff.severity * 100)}%`} />
        <Field
          label="Portfolio"
          value={handoff.draft_interventions.length > 0 ? `${handoff.draft_interventions.length} intervention(s)` : "none"}
        />
        <Field
          label="Optimization"
          value={handoff.optimization_result_summary ? `${handoff.optimization_result_summary.feasible_candidate_count} feasible candidates` : "not run"}
        />
        <div className={styles.truthBadges}>
          <StatusBadge status="COUNTERFACTUAL" compact />
          <StatusBadge status="SIMULATED" compact />
        </div>
      </div>
      <div className={styles.actions}>
        <Link href="/interventions" className="btn btn-ghost">
          ← Edit in Intervention Lab
        </Link>
        <button type="button" className="btn btn-primary" onClick={onRun} disabled={running}>
          {running ? "Running…" : "RUN SIMULATION"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}
