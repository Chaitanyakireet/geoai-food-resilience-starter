import { PageHeader } from "@/components/PageHeader";
import { ComingNext } from "@/components/ComingNext";
import { getInterventionCatalog } from "@/lib/api";

export default async function InterventionLabPage() {
  const catalog = await getInterventionCatalog();
  const types = catalog ? Object.entries(catalog.intervention_types) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Intervention Lab"
        title="Intervention Lab"
        subtitle="The catalog of intervention types the shock composer, portfolio engine, and multi-objective optimizer can compose — extensible via config, not hardcoded."
      />

      {types.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {types.map(([key, t]) => (
            <div key={key} className="card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
              <p className="secondary" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 10 }}>
                {t.mechanism}
              </p>
              <p className="muted" style={{ fontSize: 11.5 }}>
                Applies to: {t.applicable_shock_types.join(", ")}
              </p>
              <p className="muted" style={{ fontSize: 11.5 }}>
                Default effectiveness (ESTIMATED): {Math.round(t.default_effectiveness * 100)}%
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          Intervention service unavailable.
        </div>
      )}

      <ComingNext>
        The interactive workbench: compose a shock, test individual interventions or a manual portfolio against
        it, and run the multi-objective optimizer with adjustable weights/constraints and a Pareto view.
      </ComingNext>
    </div>
  );
}
