import { StatusBadge } from "@/components/StatusBadge";
import styles from "./LayerControl.module.css";

const RISK_LEGEND: { label: string; colorVar: string }[] = [
  { label: "Low", colorVar: "var(--status-good)" },
  { label: "Moderate", colorVar: "var(--status-warning)" },
  { label: "High", colorVar: "var(--status-serious)" },
  { label: "Severe", colorVar: "var(--status-critical)" },
  { label: "Insufficient data", colorVar: "var(--status-neutral)" },
];

export function LayerControl({
  showRisk,
  onToggleRisk,
  showMarkets,
  onToggleMarkets,
  marketsAvailable,
}: {
  showRisk: boolean;
  onToggleRisk: (v: boolean) => void;
  showMarkets: boolean;
  onToggleMarkets: (v: boolean) => void;
  marketsAvailable: boolean;
}) {
  return (
    <div className={`${styles.panel} card`}>
      <div className={styles.title}>Layers</div>

      <label className={styles.row}>
        <input type="checkbox" checked disabled />
        <span>Administrative boundaries</span>
        <StatusBadge status="OBSERVED" compact />
      </label>

      <label className={styles.row}>
        <input type="checkbox" checked={showRisk} onChange={(e) => onToggleRisk(e.target.checked)} />
        <span>Climate-stress risk</span>
        <StatusBadge status="ESTIMATED" compact />
      </label>

      <label className={styles.row}>
        <input
          type="checkbox"
          checked={showMarkets}
          disabled={!marketsAvailable}
          onChange={(e) => onToggleMarkets(e.target.checked)}
        />
        <span>Food-network markets</span>
        <StatusBadge status="OBSERVED" compact />
      </label>

      {showRisk ? (
        <div className={styles.legend}>
          <div className={styles.legendTitle}>Risk class</div>
          {RISK_LEGEND.map((item) => (
            <div key={item.label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: item.colorVar }} aria-hidden />
              {item.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
