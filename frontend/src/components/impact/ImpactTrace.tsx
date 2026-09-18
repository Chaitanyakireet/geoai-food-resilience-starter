import Link from "next/link";
import type { AiScenarioContext } from "@/lib/api";
import styles from "./ImpactTrace.module.css";

export function ImpactTrace({ context, hasImpactResult, reviewed }: { context: AiScenarioContext | null; hasImpactResult: boolean; reviewed: boolean }) {
  const hasGeo = !!context?.geo_id;
  const hasShock = !!context?.shock_field;
  const hasPortfolio = !!(context?.intervention_types && context.intervention_types.length > 0);
  const hasOptimization = !!context?.optimization_selected_types;

  const steps: { label: string; active: boolean; note?: string }[] = [
    { label: "Observed / Derived Inputs", active: hasGeo, note: "NASA POWER, OSM boundaries" },
    { label: "Risk / Graph Analysis", active: hasGeo },
    { label: "Shock", active: hasShock, note: hasShock ? undefined : "not composed" },
    { label: "Intervention Portfolio", active: hasPortfolio, note: hasPortfolio ? undefined : "none" },
    { label: "Optimization", active: hasOptimization, note: hasOptimization ? undefined : "not run" },
    { label: "Digital Twin", active: hasImpactResult },
    { label: "Impact Metrics", active: hasImpactResult },
    { label: "AI Explanation", active: false, note: "see AI Decision Brief" },
    { label: "Human Review", active: reviewed, note: reviewed ? "marked" : "pending" },
  ];

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Decision Trace</div>
      <p className={styles.note}>The end-to-end provenance chain behind this scenario, stage by stage.</p>
      <div className={styles.track}>
        {steps.map((s, i) => (
          <div key={s.label} className={styles.stepWrap}>
            <div className={styles.step}>
              <span className={s.active ? styles.dotActive : styles.dotInactive} />
              <span className={s.active ? styles.labelActive : styles.labelInactive}>{s.label}</span>
              {s.note ? <span className={styles.stepNote}>{s.note}</span> : null}
            </div>
            {i < steps.length - 1 ? <span className={styles.arrow}>→</span> : null}
          </div>
        ))}
      </div>
      <Link href="/ai-brief" className={styles.link}>
        Generate the AI Explanation step in the AI Decision Brief →
      </Link>
    </div>
  );
}
