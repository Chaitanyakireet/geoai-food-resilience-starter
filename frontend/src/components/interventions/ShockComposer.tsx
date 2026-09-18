import { StatusBadge } from "@/components/StatusBadge";
import { GRAPH_SHOCK_FIELD_MAP, type GraphShockField } from "@/lib/shockMapping";
import styles from "./ShockComposer.module.css";

const FIELD_ORDER = Object.keys(GRAPH_SHOCK_FIELD_MAP) as GraphShockField[];

export function ShockComposer({
  shockField,
  onShockFieldChange,
  severity,
  onSeverityChange,
  maxHops,
  onMaxHopsChange,
  heatChangeC,
  onHeatChangeChange,
  rainfallChangePct,
  onRainfallChangeChange,
  onRun,
  loading,
}: {
  shockField: GraphShockField;
  onShockFieldChange: (f: GraphShockField) => void;
  severity: number;
  onSeverityChange: (v: number) => void;
  maxHops: number;
  onMaxHopsChange: (v: number) => void;
  heatChangeC: number | undefined;
  onHeatChangeChange: (v: number | undefined) => void;
  rainfallChangePct: number | undefined;
  onRainfallChangeChange: (v: number | undefined) => void;
  onRun: () => void;
  loading: boolean;
}) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div className={styles.title}>Shock Composer</div>
        <StatusBadge status="COUNTERFACTUAL" compact />
        <StatusBadge status="SIMULATED" compact />
      </div>
      <p className={styles.subnote}>
        These are user-defined scenario inputs, not observed events. Climate fields recompute risk
        (COUNTERFACTUAL); the graph field drives propagation, interventions, and optimization below
        (SIMULATED).
      </p>

      <div className={styles.groupTitle}>Graph shock (drives interventions &amp; optimization)</div>
      <div className={styles.radioGroup}>
        {FIELD_ORDER.map((f) => (
          <label key={f} className={styles.radio}>
            <input type="radio" name="shockField" checked={shockField === f} onChange={() => onShockFieldChange(f)} />
            {GRAPH_SHOCK_FIELD_MAP[f].label}
          </label>
        ))}
      </div>

      <div className={styles.row}>
        <label className={styles.fieldLabel}>
          Severity: {(severity * 100).toFixed(0)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={severity}
            onChange={(e) => onSeverityChange(parseFloat(e.target.value))}
          />
        </label>
        <label className={styles.fieldLabel}>
          Max hops
          <input
            type="number"
            min={1}
            max={10}
            value={maxHops}
            onChange={(e) => onMaxHopsChange(parseInt(e.target.value, 10) || 1)}
            className={styles.numberInput}
          />
        </label>
      </div>

      <details className={styles.advanced}>
        <summary>Climate fields (optional, risk preview only)</summary>
        <div className={styles.row}>
          <label className={styles.fieldLabel}>
            Heat change (°C)
            <input
              type="number"
              step={0.5}
              value={heatChangeC ?? ""}
              placeholder="none"
              onChange={(e) => onHeatChangeChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
              className={styles.numberInput}
            />
          </label>
          <label className={styles.fieldLabel}>
            Rainfall change (%)
            <input
              type="number"
              step={5}
              value={rainfallChangePct !== undefined ? rainfallChangePct * 100 : ""}
              placeholder="none"
              onChange={(e) => onRainfallChangeChange(e.target.value === "" ? undefined : parseFloat(e.target.value) / 100)}
              className={styles.numberInput}
            />
          </label>
        </div>
        <p className={styles.subnote}>
          Climate fields only affect the risk preview here — graph-based interventions below do not modify
          climate risk in this model.
        </p>
      </details>

      <button type="button" className={styles.runButton} onClick={onRun} disabled={loading}>
        {loading ? "Simulating…" : "Run Scenario Simulation"}
      </button>
    </div>
  );
}
