"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { InterventionCatalog } from "@/lib/api";
import type { GraphShockField } from "@/lib/shockMapping";
import { GRAPH_SHOCK_FIELD_MAP } from "@/lib/shockMapping";
import type { DraftIntervention } from "./types";
import styles from "./InterventionCatalogPanel.module.css";

export function InterventionCatalogPanel({
  catalog,
  shockField,
  draft,
  onAdd,
}: {
  catalog: InterventionCatalog;
  shockField: GraphShockField;
  draft: DraftIntervention[];
  onAdd: (item: DraftIntervention) => void;
}) {
  const currentShockType = GRAPH_SHOCK_FIELD_MAP[shockField].shockType;
  const alreadyAdded = new Set(draft.map((d) => d.intervention_type));

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Intervention Catalog</div>
      <div className={styles.grid}>
        {Object.entries(catalog.intervention_types).map(([key, t]) => (
          <CatalogCard
            key={key}
            interventionType={key}
            label={t.label}
            mechanism={t.mechanism}
            defaultEffectiveness={t.default_effectiveness}
            applicable={t.applicable_shock_types.includes(currentShockType)}
            added={alreadyAdded.has(key)}
            onAdd={onAdd}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogCard({
  interventionType,
  label,
  mechanism,
  defaultEffectiveness,
  applicable,
  added,
  onAdd,
}: {
  interventionType: string;
  label: string;
  mechanism: string;
  defaultEffectiveness: number;
  applicable: boolean;
  added: boolean;
  onAdd: (item: DraftIntervention) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [effectivenessOverride, setEffectivenessOverride] = useState("");
  const [cost, setCost] = useState("");
  const [water, setWater] = useState("");
  const [carbon, setCarbon] = useState("");
  const [lossReduction, setLossReduction] = useState("");

  const handleAdd = () => {
    onAdd({
      intervention_type: interventionType,
      effectiveness_override: effectivenessOverride === "" ? undefined : parseFloat(effectivenessOverride) / 100,
      cost_estimate: cost === "" ? undefined : parseFloat(cost),
      water_impact_m3: water === "" ? undefined : parseFloat(water),
      carbon_impact_tco2e: carbon === "" ? undefined : parseFloat(carbon),
      loss_reduction_pct: lossReduction === "" ? undefined : parseFloat(lossReduction) / 100,
    });
    setExpanded(false);
  };

  return (
    <div className={`${styles.card} ${added ? styles.cardAdded : ""}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>{label}</div>
        <StatusBadge status="ESTIMATED" compact />
      </div>
      <p className={styles.mechanism}>{mechanism}</p>
      <div className={styles.metaRow}>
        <span className="muted">Default effectiveness (illustrative): {Math.round(defaultEffectiveness * 100)}%</span>
      </div>
      {!applicable ? <div className={styles.mismatch}>Not typically applicable to the selected shock type — can still be added.</div> : null}

      {added ? (
        <div className={styles.addedNote}>Added to portfolio</div>
      ) : expanded ? (
        <div className={styles.form}>
          <label>
            Effectiveness override (%)
            <input value={effectivenessOverride} onChange={(e) => setEffectivenessOverride(e.target.value)} placeholder="use default" />
          </label>
          <label>
            Cost estimate
            <input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="unknown" />
          </label>
          <label>
            Water impact (m³)
            <input value={water} onChange={(e) => setWater(e.target.value)} placeholder="unknown" />
          </label>
          <label>
            Carbon impact (tCO2e)
            <input value={carbon} onChange={(e) => setCarbon(e.target.value)} placeholder="unknown" />
          </label>
          <label>
            Loss reduction (%)
            <input value={lossReduction} onChange={(e) => setLossReduction(e.target.value)} placeholder="unknown" />
          </label>
          <div className={styles.formActions}>
            <button type="button" onClick={handleAdd} className={styles.confirmBtn}>
              Add to portfolio
            </button>
            <button type="button" onClick={() => setExpanded(false)} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.addBtn} onClick={() => setExpanded(true)}>
          + Add to portfolio
        </button>
      )}
    </div>
  );
}
