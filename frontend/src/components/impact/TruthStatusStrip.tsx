import { StatusBadge } from "@/components/StatusBadge";
import type { TruthStatus } from "@/lib/api";
import styles from "./TruthStatusStrip.module.css";

const ORDER: TruthStatus[] = ["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"];

const DESCRIPTIONS: Record<TruthStatus, string> = {
  OBSERVED: "Directly measured from a source dataset (e.g. NASA POWER climate readings, OSM boundaries/markets).",
  DERIVED: "Computed deterministically from observed data (e.g. district adjacency, state boundary union).",
  ESTIMATED: "A disclosed, documented assumption — not measured or fit to outcome data (e.g. risk model weights, intervention effectiveness defaults).",
  COUNTERFACTUAL: "A deterministic recompute under a hypothetical climate condition (e.g. \"what if heat rose 2°C\").",
  SIMULATED: "Output of a scenario/decision-support simulation — shock propagation, intervention effects, optimization, Digital Twin recovery. Not a real-world measurement or forecast.",
};

export function TruthStatusStrip() {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Truth-status framework</div>
      <p className={styles.note}>
        Truth status is a <strong>provenance label</strong>, not a quality score — it does not use the same
        red/amber/green language as risk severity below. A SIMULATED figure isn&apos;t &quot;worse&quot; than an
        OBSERVED one; it answers a different question (&quot;what does the model project?&quot; vs. &quot;what was measured?&quot;).
      </p>
      <div className={styles.grid}>
        {ORDER.map((ts) => (
          <div key={ts} className={styles.item}>
            <StatusBadge status={ts} />
            <p className={styles.itemDesc}>{DESCRIPTIONS[ts]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
