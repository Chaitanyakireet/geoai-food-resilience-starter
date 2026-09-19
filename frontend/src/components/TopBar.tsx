import type { DistrictsFeatureCollection } from "@/lib/api";
import { TopBarSearch } from "./TopBarSearch";
import { TopBarNotifications } from "./TopBarNotifications";
import styles from "./TopBar.module.css";

export function TopBar({
  backendReachable,
  districts,
  aiConfigured,
}: {
  backendReachable: boolean;
  districts: DistrictsFeatureCollection | null;
  aiConfigured: boolean | null;
}) {
  return (
    <header className={styles.topbar}>
      <div className={styles.identityRow}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>GeoAI Food-Resilience</div>
          <div className={styles.brandSubtitle}>Hyderabad — Telangana</div>
        </div>
        <div className={styles.taglineBlock}>
          <div className={styles.tagline}>People · Food · Planet</div>
          <div className={styles.tagline}>Data-Driven · Resilient Tomorrow</div>
        </div>
      </div>

      <div className={styles.utilityRow}>
        <TopBarSearch districts={districts} />

        <div className={styles.utilityRight}>
          <div className={styles.contextChip}>
            <span className={styles.contextDot} aria-hidden />
            Multi-food · SDG 2
          </div>
          <div className={styles.status}>
            <span className={`${styles.statusDot} ${backendReachable ? styles.statusDotOk : styles.statusDotDown}`} aria-hidden />
            <span className={backendReachable ? styles.secondaryText : styles.downText}>
              {backendReachable ? "Backend Connected" : "Backend Unreachable"}
            </span>
          </div>
          <TopBarNotifications backendReachable={backendReachable} aiConfigured={aiConfigured} />
        </div>
      </div>
    </header>
  );
}
