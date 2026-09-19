import type { RiskResult } from "@/lib/api";

// NASA POWER's native grid is ~0.5° x 0.625° (~50-60km) -- coarser than
// many Telangana districts, so genuinely distinct district centroids can
// legitimately return byte-identical climate values from NASA's own API
// (confirmed directly against the live NASA POWER endpoint, not a bug in
// this codebase). This is already disclosed in the backend's provenance
// text, but wasn't visible enough in the UI to read as anything other
// than a bug. This computes, from data already on the page, which other
// districts share the current one's rainfall figure -- a real, derived
// fact, not an invented explanation.
export function findClimateGridSiblings(current: RiskResult, allDistrictRisks: RiskResult[]): string[] {
  const rainfall = current.major_drivers.find((d) => d.feature === "rainfall_deficit");
  if (!rainfall || rainfall.observed_value === null || rainfall.baseline_value === null) return [];

  const siblings: string[] = [];
  for (const other of allDistrictRisks) {
    if (other.region_id === current.region_id) continue;
    const otherRainfall = other.major_drivers.find((d) => d.feature === "rainfall_deficit");
    if (!otherRainfall || otherRainfall.observed_value === null || otherRainfall.baseline_value === null) continue;
    if (otherRainfall.observed_value === rainfall.observed_value && otherRainfall.baseline_value === rainfall.baseline_value) {
      siblings.push(other.region_id);
    }
  }
  return siblings;
}
