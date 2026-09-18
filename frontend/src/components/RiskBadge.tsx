import type { RiskClass } from "@/lib/api";
import styles from "./RiskBadge.module.css";

// Risk class uses the reserved status palette (good/warning/serious/critical)
// -- this is the one axis in the product that IS a status judgment. Color is
// never the sole carrier: the label text always renders alongside the dot.
const CLASS_STYLE: Record<RiskClass, string> = {
  low: styles.good,
  moderate: styles.warning,
  high: styles.serious,
  severe: styles.critical,
  insufficient_data: styles.neutral,
};

const LABEL: Record<RiskClass, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  insufficient_data: "Insufficient data",
};

export function RiskBadge({ riskClass }: { riskClass: RiskClass }) {
  return (
    <span className={`${styles.badge} ${CLASS_STYLE[riskClass]}`}>
      <span className={styles.dot} aria-hidden />
      {LABEL[riskClass]}
    </span>
  );
}

export function riskClassColorVar(riskClass: RiskClass): string {
  switch (riskClass) {
    case "low":
      return "var(--status-good)";
    case "moderate":
      return "var(--status-warning)";
    case "high":
      return "var(--status-serious)";
    case "severe":
      return "var(--status-critical)";
    default:
      return "var(--status-neutral)";
  }
}
