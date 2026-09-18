import { PageHeader } from "@/components/PageHeader";
import { AiDecisionBriefWorkspace } from "@/components/ai-brief/AiDecisionBriefWorkspace";
import { getDistricts } from "@/lib/api";

export default async function AiDecisionBriefPage() {
  const districts = await getDistricts();

  if (!districts) {
    return (
      <div>
        <PageHeader eyebrow="AI Decision Brief" title="AI Decision Brief" />
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Backend unavailable</p>
          <p className="secondary">The AI Decision Brief needs GIS data for its scenario picker. Start the backend and reload this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="AI Decision Brief"
        title="AI Decision Brief"
        subtitle="The single visible AI Copilot surface: it explains and orchestrates across the deterministic engines below — it never invents or overrides a numeric result."
      />
      <AiDecisionBriefWorkspace districts={districts} />
    </div>
  );
}
