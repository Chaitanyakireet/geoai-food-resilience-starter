import { PageHeader } from "@/components/PageHeader";
import { DigitalTwinWorkspace } from "@/components/twin/DigitalTwinWorkspace";
import { getDistricts, getRiskState } from "@/lib/api";

export default async function DigitalTwinPage() {
  const [districts, riskState] = await Promise.all([getDistricts(), getRiskState()]);

  if (!districts) {
    return (
      <div>
        <PageHeader eyebrow="Digital Twin" title="Digital Twin" />
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Backend unavailable</p>
          <p className="secondary">The Digital Twin needs GIS data to place scenarios spatially. Start the backend and reload this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Digital Twin"
        title="Digital Twin"
        subtitle="A deterministic scenario/decision-support simulation — not a live operational twin, and its recovery trajectories are not validated real-world forecasts."
      />
      <DigitalTwinWorkspace districts={districts} riskState={riskState} />
    </div>
  );
}
