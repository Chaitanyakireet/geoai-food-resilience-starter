import { PageHeader } from "@/components/PageHeader";
import { InterventionLabWorkspace } from "@/components/interventions/InterventionLabWorkspace";
import { getDistricts, getInterventionCatalog, getRiskConfig } from "@/lib/api";

export default async function InterventionLabPage() {
  const [districts, catalog, riskConfig] = await Promise.all([getDistricts(), getInterventionCatalog(), getRiskConfig()]);

  if (!districts || !catalog || !riskConfig) {
    return (
      <div>
        <PageHeader eyebrow="Intervention Lab" title="Intervention Lab" />
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Backend unavailable</p>
          <p className="secondary">
            The Intervention Lab needs GIS, intervention catalog, and risk config data to build its controls.
            Start the backend and reload this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intervention Lab"
        title="Intervention Lab"
        subtitle="Compose a shock, test interventions and portfolios, and let the optimizer search the combination space — every number here is SIMULATED/COUNTERFACTUAL scenario output, not an observed event."
      />
      <InterventionLabWorkspace districts={districts} foodCategories={riskConfig.food_categories} catalog={catalog} />
    </div>
  );
}
