import styles from "./TopBar.module.css";

export function TopBar({ backendReachable }: { backendReachable: boolean }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.contextChip}>
        <span className={styles.contextDot} aria-hidden />
        Hyderabad–Telangana · multi-food
      </div>

      <div className={styles.status}>
        <span
          className={`${styles.statusDot} ${backendReachable ? styles.statusDotOk : styles.statusDotDown}`}
          aria-hidden
        />
        <span className={backendReachable ? styles.secondaryText : styles.downText}>
          {backendReachable ? "Backend reachable" : "Backend unreachable"}
        </span>
      </div>
    </header>
  );
}
