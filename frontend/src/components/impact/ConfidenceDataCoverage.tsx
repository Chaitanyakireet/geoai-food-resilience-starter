import type { RiskResult } from "@/lib/api";
import styles from "./ConfidenceDataCoverage.module.css";

export function ConfidenceDataCoverage({ risk }: { risk: RiskResult | null }) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Confidence &amp; data coverage</div>
      <p className={styles.note}>
        Three different kinds of uncertainty are kept separate below — collapsing them into one number would
        misrepresent what is actually known.
      </p>

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.columnTitle}>Data confidence</div>
          {risk ? (
            <>
              <Row label="Confidence" value={risk.confidence} />
              <Row label="Data coverage" value={`${risk.data_coverage.available_days}/${risk.data_coverage.requested_days} days (${Math.round(risk.data_coverage.coverage_ratio * 100)}%)`} />
              <Row label="Spatial resolution" value={risk.data_coverage.spatial_resolution.replace(/_/g, " ")} />
              {risk.uncertainty_interval ? (
                <Row label="Uncertainty interval" value={`[${risk.uncertainty_interval[0].toFixed(2)}, ${risk.uncertainty_interval[1].toFixed(2)}]`} />
              ) : null}
              <p className={styles.columnFootnote}>
                This interval reflects the risk baseline&apos;s own documented margin, not a statistical
                confidence interval fit to observed outcomes — no such outcome data exists to fit one against.
              </p>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>
              No active geography — data confidence unavailable.
            </p>
          )}
        </div>

        <div className={styles.column}>
          <div className={styles.columnTitle}>Model / assumption uncertainty</div>
          <ul className={styles.list}>
            <li>Risk model weights and stress thresholds (config/features.yaml) are assumed calibration choices, not fit to labeled outcome data.</li>
            <li>Intervention effectiveness defaults are ESTIMATED, illustrative assumptions, not field-validated.</li>
            <li>The Digital Twin&apos;s recovery_rate is an assumed daily closure fraction, not fit to any observed Telangana recovery event.</li>
            <li>Optimizer objective weights are disclosed, assumed illustrative weights, not derived from policy or empirical sources.</li>
          </ul>
        </div>

        <div className={styles.column}>
          <div className={styles.columnTitle}>Scenario uncertainty</div>
          <ul className={styles.list}>
            <li>Shock type/severity are user-composed hypotheticals — inputs to a what-if scenario, not observed or forecast events.</li>
            <li>Cost/water/carbon figures (where present) are caller-supplied, not independently verified.</li>
            <li>&quot;Selected&quot; portfolio means modeled best under the configured objectives and constraints for this run — not a claim of real-world optimality.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className="muted">{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}
