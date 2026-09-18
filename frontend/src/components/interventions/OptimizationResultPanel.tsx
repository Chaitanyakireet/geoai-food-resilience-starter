import { StatusBadge } from "@/components/StatusBadge";
import type { ApiError, OptimizationResult, PortfolioCandidate } from "@/lib/api";
import styles from "./OptimizationResultPanel.module.css";

const FEASIBILITY_LABEL: Record<string, string> = {
  feasible: "Feasible",
  infeasible: "Infeasible",
  unconstrained: "Unconstrained (no limits set)",
};

export function OptimizationResultPanel({ result, error, loading }: { result: OptimizationResult | null; error: ApiError | null; loading: boolean }) {
  if (loading) return <div className={`${styles.wrap} card`}>Running optimizer…</div>;
  if (error) {
    return (
      <div className={`${styles.wrap} card ${styles.errorWrap}`}>
        <div className={styles.errorTitle}>Optimization failed ({error.status || "network"})</div>
        <div className="secondary">{error.detail}</div>
      </div>
    );
  }
  if (!result) return <div className={`${styles.wrap} card ${styles.empty}`}>Run Optimize to search the candidate portfolio space.</div>;

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>
        Optimization result <StatusBadge status="SIMULATED" compact />
      </div>
      <p className={styles.subnote}>
        {result.feasible_candidate_count} feasible / {result.infeasible_candidate_count} infeasible candidates
        evaluated across the powerset of added interventions.
      </p>

      {result.selected_candidate ? (
        <div className={styles.selectedBox}>
          <div className={styles.selectedLabel}>Modeled best under configured objectives and constraints</div>
          <div className={styles.selectedTypes}>{result.selected_candidate.intervention_types.join(" + ").replace(/_/g, " ")}</div>
          <div className={styles.selectedScore}>score {result.selected_candidate.normalized_score?.toFixed(3) ?? "n/a"}</div>
        </div>
      ) : (
        <div className={styles.noSelection}>
          No candidate was selected — {result.feasible_candidate_count === 0 ? "none of the evaluated portfolios were feasible under the given constraints." : "see candidates below."}
        </div>
      )}

      {result.explanation ? (
        <div className={styles.explanation}>
          <div className={styles.groupTitle}>Why this portfolio?</div>
          <p className={styles.explanationText}>{result.explanation.why_feasible}</p>
          <ExplanationList label="Binding constraints" items={result.explanation.binding_constraints} emptyText="none" />
          <ExplanationList label="Objectives improved" items={result.explanation.objectives_improved} emptyText="none reported" />
          <ExplanationList label="Objectives worsened" items={result.explanation.objectives_worsened} emptyText="none reported" />
          <ExplanationList label="Assumptions that matter here" items={result.explanation.assumptions_influencing_result} emptyText="none" />
        </div>
      ) : null}

      <div className={styles.groupTitle} style={{ marginTop: 16 }}>
        All candidates ({result.candidates.length})
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Portfolio</th>
            <th>Feasibility</th>
            <th>Score</th>
            <th>Pareto</th>
          </tr>
        </thead>
        <tbody>
          {result.candidates.map((c) => {
            const key = candidateKey(c.intervention_types);
            const selectedKey = result.selected_candidate ? candidateKey(result.selected_candidate.intervention_types) : null;
            return <CandidateRow key={key} candidate={c} isSelected={key === selectedKey} />;
          })}
        </tbody>
      </table>

      <details className={styles.details}>
        <summary>Assumptions &amp; limitations ({result.limitations.length})</summary>
        <ul className={styles.list}>
          {result.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function candidateKey(interventionTypes: string[]): string {
  return [...interventionTypes].sort().join("+");
}

function CandidateRow({ candidate, isSelected }: { candidate: PortfolioCandidate; isSelected: boolean }) {
  return (
    <tr className={isSelected ? styles.selectedRow : undefined}>
      <td style={{ textTransform: "capitalize" }}>{candidate.intervention_types.join(" + ").replace(/_/g, " ") || "(empty)"}</td>
      <td className="secondary">{FEASIBILITY_LABEL[candidate.feasibility_status] ?? candidate.feasibility_status}</td>
      <td className="secondary">{candidate.normalized_score?.toFixed(3) ?? "—"}</td>
      <td className="secondary">{candidate.is_pareto_optimal ? "yes" : "no"}</td>
    </tr>
  );
}

function ExplanationList({ label, items, emptyText }: { label: string; items: string[]; emptyText: string }) {
  return (
    <div className={styles.explanationRow}>
      <span className={styles.explanationLabel}>{label}:</span>{" "}
      <span className="secondary">{items.length > 0 ? items.join("; ") : emptyText}</span>
    </div>
  );
}
