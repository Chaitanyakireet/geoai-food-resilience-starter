import type { ReviewRecord } from "./useReviewState";
import styles from "./HumanReviewPanel.module.css";

const NOT_AUTOMATED = [
  "Committing real budget, water, or carbon resources to an intervention",
  "Deploying an intervention in the field without local operational validation",
  "Treating a SIMULATED recovery trajectory as a guaranteed timeline",
  "Treating an ESTIMATED effectiveness default as a field-proven result",
];

export function HumanReviewPanel({
  limitations,
  record,
  markReviewed,
  clearReview,
}: {
  limitations: string[];
  record: ReviewRecord;
  markReviewed: () => void;
  clearReview: () => void;
}) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Human Review Required</div>
      <p className={styles.note}>
        This platform produces modeled decision support, not an automated recommendation to act. A person with
        domain context should review the items below before any real-world decision is made.
      </p>

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.columnTitle}>Scenario assumptions</div>
          <ul className={styles.list}>
            <li>Shock parameters (type, severity) were user-composed, not observed.</li>
            <li>Intervention effectiveness used ESTIMATED defaults unless explicitly overridden.</li>
            <li>Recovery trajectory uses an assumed daily closure fraction (config/twin.yaml), not a calibrated rate.</li>
          </ul>
        </div>

        <div className={styles.column}>
          <div className={styles.columnTitle}>Evidence limitations {limitations.length > 0 ? `(${limitations.length})` : ""}</div>
          {limitations.length > 0 ? (
            <ul className={styles.list}>
              {limitations.slice(0, 6).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>
              No scenario run yet — generate an impact result above to see its specific limitations here.
            </p>
          )}
        </div>

        <div className={styles.column}>
          <div className={styles.columnTitle}>Should not be automated</div>
          <ul className={styles.list}>
            {NOT_AUTOMATED.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.reviewControl}>
        {record ? (
          <>
            <div className={styles.reviewedBadge}>
              <span className={styles.reviewedDot} />
              Marked reviewed at {new Date(record.reviewedAt).toLocaleString()}
            </div>
            <button type="button" className="btn btn-ghost" onClick={clearReview}>
              Unmark
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={markReviewed}>
            Mark as Reviewed
          </button>
        )}
      </div>
      <p className={styles.disclaimer}>
        This is a local browser UI state only — it does not constitute institutional, regulatory, or real-world
        approval of this scenario.
      </p>
    </div>
  );
}
