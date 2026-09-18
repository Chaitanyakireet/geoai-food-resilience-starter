import { PageHeader } from "@/components/PageHeader";
import { SpatialWorkspace } from "@/components/spatial/SpatialWorkspace";
import { getDistricts, getRiskState, getTelangana } from "@/lib/api";

export default async function SpatialIntelligencePage() {
  const [districts, boundary, riskState] = await Promise.all([getDistricts(), getTelangana(), getRiskState()]);

  return (
    <div>
      <PageHeader
        eyebrow="Spatial Intelligence"
        title="Spatial Intelligence"
        subtitle="Interactive GIS workspace: 33 districts, mandals on demand, real climate-stress risk classification. District-centroid resolution — mandal results inherit their parent district's value."
      />

      {districts ? (
        <SpatialWorkspace districts={districts} boundary={boundary} riskState={riskState} />
      ) : (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>GIS service unavailable</p>
          <p className="secondary">
            No district boundary data could be loaded — the Spatial Intelligence workspace needs{" "}
            <code>/gis/districts</code> to render anything. Start the backend and reload this page.
          </p>
        </div>
      )}
    </div>
  );
}
