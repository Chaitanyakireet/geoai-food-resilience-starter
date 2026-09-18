import { PageHeader } from "@/components/PageHeader";
import { ComingNext } from "@/components/ComingNext";
import { TwinHandoffBanner } from "@/components/interventions/TwinHandoffBanner";
import { getTwinScenarios } from "@/lib/api";

export default async function DigitalTwinPage() {
  const catalog = await getTwinScenarios();
  const scenarios = catalog ? Object.entries(catalog.scenario_types) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Digital Twin"
        title="Digital Twin"
        subtitle="A deterministic scenario/decision-support simulation — not a live operational twin, and its recovery trajectories are not validated real-world forecasts."
      />

      <TwinHandoffBanner />

      {scenarios.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scenarios.map(([key, s]) => (
            <div key={key} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <p className="secondary" style={{ fontSize: 12.5, marginBottom: 6 }}>
                {s.description}
              </p>
              <p className="muted" style={{ fontSize: 11.5 }}>
                {s.how_to_construct}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          Digital Twin service unavailable.
        </div>
      )}

      <ComingNext>
        The Compare Worlds view: run a scenario, chart baseline/shock/intervention/optimized recovery
        trajectories side by side, and inspect recovery metrics and residual resilience gap on the map.
      </ComingNext>
    </div>
  );
}
