import type { TruthStatus } from "@/lib/api";
import styles from "./StatusBadge.module.css";

// Truth-status is a provenance label, not a quality judgment -- it never
// borrows the risk status palette (good/warning/serious/critical). Each
// label gets a fixed, distinct categorical color used only as an identity
// marker; the text label is always the primary carrier of meaning.
const DOT_CLASS: Record<TruthStatus, string> = {
  OBSERVED: styles.dotBlue,
  DERIVED: styles.dotAqua,
  ESTIMATED: styles.dotYellow,
  COUNTERFACTUAL: styles.dotViolet,
  SIMULATED: styles.dotGreen,
};

const DESCRIPTIONS: Record<TruthStatus, string> = {
  OBSERVED: "Directly measured from a source dataset.",
  DERIVED: "Computed deterministically from observed data.",
  ESTIMATED: "A disclosed assumption, not measured or fitted to data.",
  COUNTERFACTUAL: "A deterministic recompute under a hypothetical (shock) condition.",
  SIMULATED: "Output of a scenario/decision-support simulation, not a real-world measurement or forecast.",
};

export function StatusBadge({ status, compact = false }: { status: TruthStatus; compact?: boolean }) {
  return (
    <span className={styles.badge} title={DESCRIPTIONS[status]}>
      <span className={`${styles.dot} ${DOT_CLASS[status]}`} aria-hidden />
      {compact ? status.slice(0, 4) : status}
    </span>
  );
}
