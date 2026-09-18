import type { Constraints } from "@/lib/api";
import type { DraftIntervention } from "./types";
import styles from "./PortfolioPanel.module.css";

export function PortfolioPanel({
  draft,
  onRemove,
  constraints,
  onConstraintsChange,
}: {
  draft: DraftIntervention[];
  onRemove: (interventionType: string) => void;
  constraints: Constraints;
  onConstraintsChange: (c: Constraints) => void;
}) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Portfolio ({draft.length})</div>
      {draft.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>
          No interventions added yet — add some from the catalog above.
        </p>
      ) : (
        <ul className={styles.list}>
          {draft.map((d) => (
            <li key={d.intervention_type} className={styles.item}>
              <div>
                <div className={styles.itemName}>{d.intervention_type.replace(/_/g, " ")}</div>
                <div className={styles.itemMeta}>
                  {d.effectiveness_override != null ? `${Math.round(d.effectiveness_override * 100)}% override` : "default effectiveness"} ·{" "}
                  {d.cost_estimate != null ? `cost ${d.cost_estimate}` : "cost unknown"} ·{" "}
                  {d.water_impact_m3 != null ? `${d.water_impact_m3} m³` : "water unknown"} ·{" "}
                  {d.carbon_impact_tco2e != null ? `${d.carbon_impact_tco2e} tCO2e` : "carbon unknown"}
                </div>
              </div>
              <button type="button" className={styles.removeBtn} onClick={() => onRemove(d.intervention_type)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.constraintsTitle}>Constraints (optional — leave blank for none)</div>
      <div className={styles.constraintsGrid}>
        <label>
          Budget
          <input
            type="number"
            value={constraints.budget ?? ""}
            placeholder="none"
            onChange={(e) => onConstraintsChange({ ...constraints, budget: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          />
        </label>
        <label>
          Water limit (m³)
          <input
            type="number"
            value={constraints.water_limit_m3 ?? ""}
            placeholder="none"
            onChange={(e) => onConstraintsChange({ ...constraints, water_limit_m3: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          />
        </label>
        <label>
          Carbon target (tCO2e)
          <input
            type="number"
            value={constraints.carbon_target_tco2e ?? ""}
            placeholder="none"
            onChange={(e) => onConstraintsChange({ ...constraints, carbon_target_tco2e: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
