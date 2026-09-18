import type { TwinResult } from "@/lib/api";
import { WORLD_LABELS, type WorldKey } from "./types";
import styles from "./WorldControls.module.css";

const ORDER: WorldKey[] = ["baseline", "shock", "intervention", "optimized"];

export function WorldControls({ result, active, onChange }: { result: TwinResult; active: WorldKey; onChange: (w: WorldKey) => void }) {
  const available: Record<WorldKey, boolean> = {
    baseline: true,
    shock: result.shocked_state !== null,
    intervention: result.intervention_state !== null,
    optimized: result.optimized_state !== null,
  };

  return (
    <div className={styles.controls}>
      {ORDER.filter((w) => available[w]).map((w) => (
        <button
          key={w}
          type="button"
          className={active === w ? styles.itemActive : styles.item}
          onClick={() => onChange(w)}
        >
          {WORLD_LABELS[w]}
        </button>
      ))}
    </div>
  );
}
