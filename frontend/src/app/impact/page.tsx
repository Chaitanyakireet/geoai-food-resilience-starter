import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ComingNext } from "@/components/ComingNext";
import { getHealth, type TruthStatus } from "@/lib/api";

export default async function ImpactResponsibleAiPage() {
  const health = await getHealth();

  return (
    <div>
      <PageHeader
        eyebrow="Impact & Responsible AI"
        title="Impact & Responsible AI"
        subtitle="The governance layer: truth-status framework, provenance, and the human-review boundary every numeric output in this platform is subject to."
      />

      <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Truth-status framework</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(health?.truth_status_labels ?? (["OBSERVED", "DERIVED", "ESTIMATED", "COUNTERFACTUAL", "SIMULATED"] as TruthStatus[])).map(
            (s) => (
              <StatusBadge key={s} status={s} />
            ),
          )}
        </div>
        <p className="secondary" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.7 }}>
          Every number surfaced anywhere in this product carries one of these five labels, tracing back to a
          specific provenance reference. Numeric calculations are deterministic; the AI layer explains and
          orchestrates, and never invents or overrides a number.
        </p>
      </div>

      {health ? (
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Project locks</div>
          <table className="data-table">
            <tbody>
              <tr>
                <td className="muted">Region</td>
                <td>{health.project.region}</td>
              </tr>
              <tr>
                <td className="muted">Food scope</td>
                <td>{health.project.food_scope.replace(/_/g, " ")}</td>
              </tr>
              <tr>
                <td className="muted">Primary SDG</td>
                <td>{health.project.primary_sdg}</td>
              </tr>
              <tr>
                <td className="muted">Secondary SDGs</td>
                <td>{health.project.secondary_sdgs.join(", ")}</td>
              </tr>
              <tr>
                <td className="muted">Core loop</td>
                <td>{health.loop_stages.join(" → ")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <ComingNext>
        Per-recommendation impact accounting (food availability, water, carbon, cost) aggregated across accepted
        interventions, a human-review/approval log, and a Responsible-AI audit trail linking every AI Copilot
        statement to its source data and truth status.
      </ComingNext>
    </div>
  );
}
