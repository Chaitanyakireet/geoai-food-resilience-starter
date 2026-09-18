"use client";

import { useState, useSyncExternalStore } from "react";
import type { ScenarioHandoff } from "./types";
import styles from "./TwinHandoffBanner.module.css";

const STORAGE_KEY = "interventionLab.scenarioHandoff";

// useSyncExternalStore (not useEffect+setState) reads sessionStorage safely
// across SSR/hydration: the server snapshot is always null (no sessionStorage
// there), so there is no hydration mismatch once the client snapshot differs.
function subscribe() {
  return () => {};
}

function getSnapshot(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function TwinHandoffBanner() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  let handoff: ScenarioHandoff | null = null;
  if (raw && !dismissed) {
    try {
      handoff = JSON.parse(raw);
    } catch {
      handoff = null;
    }
  }

  if (!handoff) return null;

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div className={styles.title}>Scenario received from Intervention Lab</div>
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => {
            try {
              sessionStorage.removeItem(STORAGE_KEY);
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
      <p className={styles.note}>
        The interactive Digital Twin workspace that runs this scenario directly is a later build phase — for now
        this is a read-only carry-through of what you configured, so you don&apos;t have to re-enter it once that
        workspace exists.
      </p>
      <dl className={styles.grid}>
        <Row label="Geography" value={handoff.geo_id.replace(/_/g, " ")} />
        <Row label="Food category" value={handoff.food_category.replace(/_/g, " ")} />
        <Row label="Shock" value={`${handoff.shock_field.replace(/_/g, " ")} @ ${Math.round(handoff.severity * 100)}%`} />
        <Row label="Interventions" value={handoff.draft_interventions.map((d) => d.intervention_type).join(", ") || "none"} />
        {handoff.optimization_result_summary?.selected_intervention_types ? (
          <Row label="Optimizer selected" value={handoff.optimization_result_summary.selected_intervention_types.join(", ")} />
        ) : null}
        {handoff.shock_result_summary?.risk_class ? <Row label="Shocked risk class" value={handoff.shock_result_summary.risk_class} /> : null}
        <Row label="Composed at" value={new Date(handoff.created_at).toLocaleString()} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
