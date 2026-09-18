import styles from "./ActionBar.module.css";

export function ActionBar({
  canSimulate,
  simulating,
  onSimulate,
  canOptimize,
  optimizing,
  onOptimize,
  canSendToTwin,
  onSendToTwin,
}: {
  canSimulate: boolean;
  simulating: boolean;
  onSimulate: () => void;
  canOptimize: boolean;
  optimizing: boolean;
  onOptimize: () => void;
  canSendToTwin: boolean;
  onSendToTwin: () => void;
}) {
  return (
    <div className={`${styles.bar} card`}>
      <button type="button" className={styles.primary} disabled={!canSimulate || simulating} onClick={onSimulate}>
        {simulating ? "Simulating…" : "SIMULATE"}
      </button>
      <button type="button" className={styles.primary} disabled={!canOptimize || optimizing} onClick={onOptimize}>
        {optimizing ? "Optimizing…" : "OPTIMIZE"}
      </button>
      <button type="button" className={styles.secondary} disabled={!canSendToTwin} onClick={onSendToTwin}>
        Simulate in Digital Twin →
      </button>
      {!canSimulate ? <span className={styles.hint}>Compose a shock and add at least one intervention first.</span> : null}
    </div>
  );
}
