import { PageHeader } from "@/components/PageHeader";
import { ChoroplethPreview } from "@/components/ChoroplethPreview";
import { ComingNext } from "@/components/ComingNext";
import { getDistricts, getRiskState } from "@/lib/api";

export default async function SpatialIntelligencePage() {
  const [districts, riskState] = await Promise.all([getDistricts(), getRiskState()]);
  const riskByDistrict = new Map(riskState?.districts.map((d) => [d.region_id, d]) ?? []);

  return (
    <div>
      <PageHeader
        eyebrow="Spatial Intelligence"
        title="Spatial Intelligence"
        subtitle="GIS workspace for Telangana's 33 districts and 593 mandals — the shell below carries the real boundary and risk data this workspace will render interactively."
      />

      {districts ? (
        <ChoroplethPreview districts={districts} riskByDistrict={riskByDistrict} />
      ) : (
        <div className="card" style={{ padding: 24 }}>
          GIS service unavailable — no boundary data to preview.
        </div>
      )}

      <ComingNext>
        Full interactive map: pan/zoom basemap, district/mandal drill-down, layer toggles (risk, food-network
        nodes, bottlenecks, shock propagation), and click-to-inspect &quot;Why here?&quot; risk-driver panels.
      </ComingNext>
    </div>
  );
}
