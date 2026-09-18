import type { Driver, RiskResult } from "@/lib/api";

// Deterministic, template-based explanation built only from fields the
// backend actually returns (major_drivers, contribution_to_score). No LLM
// involvement -- the AI Decision Brief/Copilot (which may phrase this more
// naturally) is a later task.
export function buildWhyHereExplanation(risk: RiskResult): { used: string[]; excluded: string[] } {
  const used = [...risk.major_drivers]
    .filter((d) => d.used_in_score && d.contribution_to_score !== null)
    .sort((a, b) => (b.contribution_to_score ?? 0) - (a.contribution_to_score ?? 0));

  const excluded = risk.major_drivers.filter((d) => !d.used_in_score);

  const usedSentences = used.map((d, i) => describeDriver(d, i === 0));
  const excludedSentences = excluded.map(
    (d) => `${formatFeatureName(d.feature)} was reported for context only, not used in the score${d.note ? `: ${d.note}` : "."}`,
  );

  return { used: usedSentences, excluded: excludedSentences };
}

function describeDriver(d: Driver, isPrimary: boolean): string {
  const direction = d.anomaly_pct !== null && d.anomaly_pct >= 0 ? "above" : "below";
  const magnitude = d.anomaly_pct !== null ? `${Math.abs(d.anomaly_pct).toFixed(1)}% ${direction} the 20-year normal` : "anomaly not available";
  const contribution = d.contribution_to_score !== null ? ` (contributes ${d.contribution_to_score.toFixed(3)} to the risk score)` : "";
  const lead = isPrimary ? "Primary driver: " : "Also contributing: ";
  return `${lead}${formatFeatureName(d.feature)} — ${magnitude}${contribution}.`;
}

function formatFeatureName(feature: string): string {
  return feature
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
