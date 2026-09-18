import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { ComingNext } from "@/components/ComingNext";
import { getGraphOverview } from "@/lib/api";
import styles from "../page.module.css";

export default async function FoodNetworkPage() {
  const graph = await getGraphOverview();

  return (
    <div>
      <PageHeader
        eyebrow="Food Network"
        title="Food Network"
        subtitle="Production → aggregation → storage → market → demand, modeled as a directed graph per district plus a real cross-district transport backbone."
      />

      {graph ? (
        <>
          <div className={styles.statRow}>
            <StatTile label="Nodes" value={String(graph.summary.node_count)} helpText={graph.summary.layers.join(", ")} />
            <StatTile label="Edges" value={String(graph.summary.edge_count)} />
            <StatTile
              label="Bottleneck candidates"
              value={String(graph.bottlenecks.length)}
              helpText="Articulation points / high betweenness / high in-degree"
            />
            <StatTile
              label="Weakly connected"
              value={graph.summary.connectivity.is_weakly_connected ? "Yes" : "No"}
              helpText={`${graph.summary.connectivity.isolated_node_count} isolated nodes`}
            />
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top bottleneck candidates</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Type</th>
                  <th>District</th>
                  <th>Betweenness</th>
                  <th>Articulation point</th>
                </tr>
              </thead>
              <tbody>
                {graph.bottlenecks.slice(0, 8).map((b) => (
                  <tr key={b.node_id}>
                    <td>{b.node_id}</td>
                    <td className="secondary">{b.node_type}</td>
                    <td className="secondary">{b.geo_id.replace(/_/g, " ")}</td>
                    <td className="secondary">{b.betweenness_centrality.toFixed(3)}</td>
                    <td className="secondary">{b.is_articulation_point ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
              Structural graph properties, not confirmed real-world importance.
            </p>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          Food network service unavailable.
        </div>
      )}

      <ComingNext>
        Full network workspace: interactive graph view synced to the map, shock-propagation animation
        (production/storage/transport/market shocks), and per-node/edge provenance inspection.
      </ComingNext>
    </div>
  );
}
