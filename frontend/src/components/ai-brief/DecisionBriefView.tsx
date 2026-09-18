import { StatusBadge } from "@/components/StatusBadge";
import type { ApiError, DecisionBriefOutput } from "@/lib/api";
import styles from "./DecisionBriefView.module.css";

export function DecisionBriefView({ brief, error, loading }: { brief: DecisionBriefOutput | null; error: ApiError | null; loading: boolean }) {
  if (loading) {
    return (
      <div className={`${styles.wrap} card state-block`}>
        <div className="pulse state-block-title">Assembling Decision Brief…</div>
        <p className="secondary" style={{ fontSize: 12 }}>
          Running deterministic tools (risk, graph, shock, optimization, twin, evidence) before any narration.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${styles.wrap} card state-block state-block-error`}>
        <div className="state-block-title">Decision Brief failed ({error.status || "network"})</div>
        <p className="secondary">{error.detail}</p>
      </div>
    );
  }
  if (!brief) {
    return (
      <div className={`${styles.wrap} card state-block`}>
        <p className="secondary">Set a geography above and generate a Decision Brief, or ask the Copilot a question below.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div className={styles.title}>AI Decision Brief</div>
        <span className={brief.mode === "llm" ? styles.modeLlm : styles.modeFallback}>
          {brief.mode === "llm" ? "AI-narrated" : "Structured system brief (AI generation unavailable)"}
        </span>
      </div>

      <div className={styles.sections}>
        {brief.sections.map((s) => (
          <div key={s.title} className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>{s.title}</div>
              {s.truth_status ? <StatusBadge status={s.truth_status} compact /> : null}
            </div>
            <p className={styles.sectionContent}>{s.content}</p>
          </div>
        ))}
      </div>

      {brief.limitations.length > 0 ? (
        <details className={styles.details}>
          <summary>Limitations ({brief.limitations.length})</summary>
          <ul className={styles.list}>
            {brief.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
