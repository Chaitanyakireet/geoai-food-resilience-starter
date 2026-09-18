import Link from "next/link";
import type { AiScenarioContext } from "@/lib/api";
import styles from "./ScenarioContextStrip.module.css";

export function ScenarioContextStrip({ context }: { context: AiScenarioContext | null }) {
  if (!context?.geo_id) {
    return (
      <div className={`${styles.wrap} card-floating`}>
        <p className="secondary" style={{ fontSize: 12.5 }}>
          No active scenario — impact metrics below need a geography and, ideally, a composed shock and
          portfolio. Nothing is invented in its absence.
        </p>
        <Link href="/interventions" className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 12 }}>
          Compose a scenario →
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} card-floating`}>
      <Field label="Geography" value={context.geo_id.replace(/_/g, " ")} />
      <Field label="Food scope" value={(context.food_category ?? "all_food").replace(/_/g, " ")} />
      {context.shock_field ? <Field label="Shock" value={`${context.shock_field.replace(/_/g, " ")} @ ${Math.round((context.severity ?? 0) * 100)}%`} /> : <Field label="Shock" value="none composed" muted />}
      {context.intervention_types && context.intervention_types.length > 0 ? (
        <Field label="Portfolio" value={context.intervention_types.map((t) => t.replace(/_/g, " ")).join(", ")} />
      ) : (
        <Field label="Portfolio" value="none composed" muted />
      )}
      <Field label="Optimizer" value={context.optimization_selected_types ? "ran" : "not run"} muted={!context.optimization_selected_types} />
      <Link href="/interventions" className={styles.editLink}>
        Edit in Intervention Lab →
      </Link>
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={muted ? styles.fieldValueMuted : styles.fieldValue}>{value}</div>
    </div>
  );
}
