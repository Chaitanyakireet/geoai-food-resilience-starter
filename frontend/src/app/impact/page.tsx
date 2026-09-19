import { PageHeader } from "@/components/PageHeader";
import { ImpactWorkspace } from "@/components/impact/ImpactWorkspace";
import {
  getAiProvenance,
  getDistricts,
  getGisProvenance,
  getGraphProvenance,
  getInterventionProvenance,
  getOptimizationProvenance,
  getRiskProvenance,
  getTwinProvenance,
} from "@/lib/api";

export default async function ImpactResponsibleAiPage() {
  const [gis, risk, graph, intervention, optimization, twin, ai, districts] = await Promise.all([
    getGisProvenance(),
    getRiskProvenance(),
    getGraphProvenance(),
    getInterventionProvenance(),
    getOptimizationProvenance(),
    getTwinProvenance(),
    getAiProvenance(),
    getDistricts(),
  ]);

  if (!gis) {
    return (
      <div>
        <PageHeader eyebrow="Impact & Responsible AI" title="Impact & Responsible AI" />
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Backend unavailable</p>
          <p className="secondary">
            This page needs the backend&apos;s provenance endpoints to build an auditable trail. Start the backend
            and reload this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Impact & Responsible AI"
        title="Impact & Responsible AI"
        subtitle="An auditable decision-support summary: modeled impact, SDG coverage, confidence, provenance, Responsible-AI discipline, and the human-review boundary — not a generic ESG dashboard."
      />
      <ImpactWorkspace provenance={{ gis, risk, graph, intervention, optimization, twin, ai }} districts={districts} />
    </div>
  );
}
