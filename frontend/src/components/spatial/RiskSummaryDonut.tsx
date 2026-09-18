import styles from "./RiskSummaryDonut.module.css";

export type DonutSegment = { key: string; label: string; count: number; colorVar: string };

// Hand-rolled SVG donut (stacked stroke-dasharray arcs) -- no charting
// library dependency, consistent with the rest of the product's inline-SVG
// visualizations (Food Network graph, etc).
export function RiskSummaryDonut({ segments, centerValue, centerLabel }: { segments: DonutSegment[]; centerValue: string; centerLabel: string }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  let cursor = 0;

  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 100 100" className={styles.svg} role="img" aria-label="Statewide risk-class distribution">
        <circle cx={50} cy={50} r={R} fill="none" stroke="var(--gridline)" strokeWidth={13} />
        {total > 0
          ? segments
              .filter((s) => s.count > 0)
              .map((s) => {
                const frac = s.count / total;
                const dash = frac * C;
                const el = (
                  <circle
                    key={s.key}
                    cx={50}
                    cy={50}
                    r={R}
                    fill="none"
                    stroke={s.colorVar}
                    strokeWidth={13}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-cursor}
                    transform="rotate(-90 50 50)"
                  />
                );
                cursor += dash;
                return el;
              })
          : null}
      </svg>
      <div className={styles.center}>
        <div className={styles.centerValue}>{centerValue}</div>
        <div className={styles.centerLabel}>{centerLabel}</div>
      </div>
    </div>
  );
}
