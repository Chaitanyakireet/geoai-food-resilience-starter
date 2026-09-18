import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { FoodNetworkGraph } from "@/components/network/FoodNetworkGraph";
import { getGraphEdges, getGraphNodes, getGraphOverview } from "@/lib/api";
import styles from "../page.module.css";

const STAGES: { label: string; note: string }[] = [
  { label: "Production", note: "District-level agricultural output. Derived from administrative geography, not a measured facility or yield figure." },
  { label: "Aggregation", note: "Where production is pooled before onward movement. A modeled stage — no aggregation-point census exists for this sprint." },
  { label: "Storage", note: "Buffer capacity that absorbs shocks before they reach markets. Its capacity is not independently measured." },
  { label: "Transport", note: "Represented as district-adjacency edges (shared borders), not real roads, distances, or capacities." },
  { label: "Market", note: "The only OBSERVED layer: real OpenStreetMap marketplace locations, 29 of 33 districts." },
  { label: "Demand", note: "Consumption point per district. Hyderabad is modeled as the principal demand hub for the region." },
];

export default async function FoodNetworkPage() {
  const [graph, nodes, edges] = await Promise.all([getGraphOverview(), getGraphNodes(), getGraphEdges()]);

  if (!graph || !nodes || !edges) {
    return (
      <div>
        <PageHeader eyebrow="Food Network" title="Food Network" />
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>Backend unavailable</p>
          <p className="secondary">The Food Network needs live graph data. Start the backend and reload this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Food Network"
        title="Food-System Network"
        subtitle="A directed graph modeling how food moves through Telangana's districts — production through consumption — plus a real cross-district transport backbone. Structure is real; capacity and flow volumes are not measured and are never invented."
      />

      <div className={styles.statRow}>
        <StatTile label="Active Nodes" value={String(graph.summary.node_count)} helpText={graph.summary.layers.join(", ")} />
        <StatTile label="Active Edges" value={String(graph.summary.edge_count)} />
        <StatTile
          label="Graph-Theoretic Bottlenecks"
          value={String(graph.bottlenecks.length)}
          helpText="Articulation points / high betweenness — structural, not confirmed operational failures"
        />
        <StatTile
          label="Connectivity"
          value={graph.summary.connectivity.is_weakly_connected ? "Fully Connected" : `${graph.summary.connectivity.weakly_connected_component_count} components`}
          helpText={`${graph.summary.connectivity.isolated_node_count} isolated nodes`}
        />
      </div>

      <details className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <summary style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Network structure — what each stage represents</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
          {STAGES.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{s.label}</div>
              <p className="secondary" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                {s.note}
              </p>
            </div>
          ))}
        </div>
      </details>

      <FoodNetworkGraph nodes={nodes} edges={edges} bottlenecks={graph.bottlenecks} />

      <p className="muted" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
        Node color denotes truth status (observed / derived / simulated); an orange ring marks a graph-theoretic
        bottleneck candidate, not a confirmed real-world dependency. Clicking a node runs an actual{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>POST /graph/propagate</code> call and visualizes its real
        result — the propagation itself is always labeled SIMULATED.
      </p>
    </div>
  );
}
