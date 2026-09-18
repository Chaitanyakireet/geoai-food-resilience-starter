import { PageHeader } from "@/components/PageHeader";
import { ComingNext } from "@/components/ComingNext";

export default function AiDecisionBriefPage() {
  return (
    <div>
      <PageHeader
        eyebrow="AI Decision Brief"
        title="AI Decision Brief"
        subtitle="The single visible AI Copilot surface: it will explain and orchestrate across the deterministic engines, never invent or override a numeric result."
      />

      <ComingNext>
        RAG-grounded evidence retrieval and the AI Copilot itself are not built yet by design — this sprint&apos;s
        priority is the deterministic intelligence core and the workspace shell around it. When built, every
        number the brief cites will trace back to a specific backend endpoint and truth-status label, and every
        recommendation will require human review before action.
      </ComingNext>
    </div>
  );
}
