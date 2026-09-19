import type { Driver, RiskResult } from "@/lib/api";
import { findClimateGridSiblings } from "@/lib/climateGridSiblings";
import styles from "./DriverBars.module.css";

const DRIVER_LABELS: Record<string, string> = {
  rainfall_deficit: "Rainfall Anomaly",
  heat_stress: "Heat Stress",
  heat_stress_t2m_max_context: "Heat Stress (Context, Excluded)",
};

function DriverIcon({ feature }: { feature: string }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (feature.startsWith("rainfall")) {
    return (
      <svg {...common}>
        <path d="M7 15a5 5 0 0 1 1-9.9A6 6 0 0 1 19 9a4.5 4.5 0 0 1-1 8.9H7z" />
        <path d="M9 19v2M13 19v2M17 17v2" />
      </svg>
    );
  }
  if (feature.startsWith("heat")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

// contribution_to_score values sum to risk_score for used_in_score drivers,
// so this percentage is a real, deterministic share of the actual score --
// not an invented weighting. Shared by Spatial Intelligence's Location
// Panel and the Command Center's Current Situation panel.
export function DriverBars({ risk, compact = false, allDistrictRisks }: { risk: RiskResult; compact?: boolean; allDistrictRisks?: RiskResult[] }) {
  const used = [...risk.major_drivers]
    .filter((d): d is Driver & { contribution_to_score: number } => d.used_in_score && d.contribution_to_score !== null)
    .sort((a, b) => b.contribution_to_score - a.contribution_to_score);
  const excluded = risk.major_drivers.filter((d) => !d.used_in_score);

  if (used.length === 0) {
    return <span className="muted">No driver data available.</span>;
  }

  const gridSiblings = allDistrictRisks ? findClimateGridSiblings(risk, allDistrictRisks) : [];

  return (
    <div className={styles.driverBars}>
      {gridSiblings.length > 0 ? (
        <div className={styles.gridSiblingNote}>
          Rainfall/heat figures here are identical to {gridSiblings.length} other district{gridSiblings.length > 1 ? "s" : ""} (
          {gridSiblings.map((id) => id.replace(/_/g, " ")).join(", ")}) — NASA POWER&apos;s climate grid (~50km) is coarser than
          these districts, so nearby ones legitimately share a value. This is a real data-resolution limit, not a
          computation error.
        </div>
      ) : null}
      {used.map((d) => {
        const share = risk.risk_score ? Math.max(0, Math.min(100, (d.contribution_to_score / risk.risk_score) * 100)) : 0;
        return (
          <div key={d.feature} className={styles.driverRow}>
            <span className={styles.driverIcon}>
              <DriverIcon feature={d.feature} />
            </span>
            <div className={styles.driverBody}>
              <div className={styles.driverHeadline}>
                <span className={styles.driverName}>{DRIVER_LABELS[d.feature] ?? d.feature.replace(/_/g, " ")}</span>
                <span className={styles.driverPct}>{share.toFixed(0)}%</span>
              </div>
              <div className={styles.driverTrack}>
                <div className={styles.driverFill} style={{ width: `${share}%` }} />
              </div>
              {compact ? null : (
                <div className={styles.driverMeta}>
                  {d.anomaly_pct !== null ? `${d.anomaly_pct >= 0 ? "+" : ""}${d.anomaly_pct.toFixed(1)}% vs. normal` : "anomaly n/a"} ·
                  contributes {d.contribution_to_score.toFixed(3)} of risk score
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!compact && excluded.length > 0 ? (
        <div className={styles.driverExcludedNote}>
          {excluded.length} additional factor{excluded.length > 1 ? "s" : ""} reported for context only, excluded
          from the score.
        </div>
      ) : null}
    </div>
  );
}
