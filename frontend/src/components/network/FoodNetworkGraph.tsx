"use client";

import { useMemo, useState } from "react";
import { postGraphPropagate, type BottleneckEntry, type GraphEdgeItem, type GraphNodeItem, type GraphPropagationResult } from "@/lib/api";
import styles from "./FoodNetworkGraph.module.css";

const COLUMNS: { type: GraphNodeItem["node_type"]; label: string }[] = [
  { type: "production", label: "Production" },
  { type: "aggregation", label: "Aggregation" },
  { type: "storage", label: "Storage" },
  { type: "market", label: "Market" },
  { type: "demand", label: "Demand" },
];

const SHOCK_TYPE_FOR_NODE_TYPE: Record<GraphNodeItem["node_type"], string> = {
  production: "production_reduction",
  aggregation: "production_reduction",
  storage: "storage_capacity_reduction",
  market: "market_disruption",
  demand: "market_disruption",
};

const TRUTH_COLOR: Record<string, string> = {
  OBSERVED: "var(--cat-blue)",
  DERIVED: "var(--cat-aqua)",
  SIMULATED: "var(--cat-green)",
  ESTIMATED: "var(--cat-yellow)",
  COUNTERFACTUAL: "var(--cat-violet)",
};

const COL_WIDTH = 168;
const ROW_HEIGHT = 15.5;
const MARGIN = { top: 30, right: 24, bottom: 8, left: 24 };
const NODE_R = 3.4;

export function FoodNetworkGraph({ nodes, edges, bottlenecks }: { nodes: GraphNodeItem[]; edges: GraphEdgeItem[]; bottlenecks: BottleneckEntry[] }) {
  const [hoverNode, setHoverNode] = useState<GraphNodeItem | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeItem | null>(null);
  const [severity, setSeverity] = useState(0.5);
  const [propagation, setPropagation] = useState<GraphPropagationResult | null>(null);
  const [propagating, setPropagating] = useState(false);

  const bottleneckIds = useMemo(() => new Set(bottlenecks.map((b) => b.node_id)), [bottlenecks]);

  const districts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of nodes) if (!seen.has(n.geo_id)) seen.set(n.geo_id, n.geo_id);
    return [...seen.keys()].sort();
  }, [nodes]);

  const districtRow = useMemo(() => new Map(districts.map((d, i) => [d, i])), [districts]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.node_id, n])), [nodes]);

  const position = (n: GraphNodeItem): [number, number] => {
    const colIndex = COLUMNS.findIndex((c) => c.type === n.node_type);
    const row = districtRow.get(n.geo_id) ?? 0;
    return [MARGIN.left + colIndex * COL_WIDTH + COL_WIDTH / 2, MARGIN.top + row * ROW_HEIGHT];
  };

  const impactByNode = useMemo(() => {
    const m = new Map<string, number>();
    propagation?.steps.forEach((s) => m.set(s.node_id, s.impact_fraction));
    return m;
  }, [propagation]);

  const width = MARGIN.left + COLUMNS.length * COL_WIDTH + MARGIN.right;
  const height = MARGIN.top + districts.length * ROW_HEIGHT + MARGIN.bottom;

  const runPropagation = async (node: GraphNodeItem) => {
    setSelectedNode(node);
    setPropagating(true);
    const { data } = await postGraphPropagate({
      target_node_id: node.node_id,
      shock_type: SHOCK_TYPE_FOR_NODE_TYPE[node.node_type],
      severity,
      max_hops: 6,
    });
    setPropagation(data);
    setPropagating(false);
  };

  return (
    <div className={styles.layout}>
      <div className={`${styles.diagramCard} card`}>
        <div className={styles.diagramHeader}>
          <div>
            <div className={styles.diagramTitle}>Food-System Network</div>
            <p className={styles.diagramSubnote}>
              {nodes.length} nodes · {edges.length} edges across {districts.length} districts. Click a node to run a
              real, backend-computed shock-propagation simulation from it.
            </p>
          </div>
          <div className={styles.legend}>
            <LegendDot color="var(--cat-blue)" label="Observed" />
            <LegendDot color="var(--cat-aqua)" label="Derived" />
            <LegendDot color="var(--cat-green)" label="Simulated" />
            <span className={styles.legendBottleneck}>◎ Structural bottleneck</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-label="Food-system network diagram">
          {COLUMNS.map((c, i) => (
            <text key={c.type} x={MARGIN.left + i * COL_WIDTH + COL_WIDTH / 2} y={MARGIN.top - 12} textAnchor="middle" className={styles.colLabel}>
              {c.label}
            </text>
          ))}

          {edges.map((e) => {
            const s = nodeById.get(e.source);
            const t = nodeById.get(e.target);
            if (!s || !t) return null;
            const [x1, y1] = position(s);
            const [x2, y2] = position(t);
            const involved = propagation && (impactByNode.has(e.source) || impactByNode.has(e.target));
            return <line key={e.edge_id} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.edge} opacity={involved ? 0.55 : 0.12} />;
          })}

          {nodes.map((n) => {
            const [x, y] = position(n);
            const isBottleneck = bottleneckIds.has(n.node_id);
            const impact = impactByNode.get(n.node_id);
            const isHover = hoverNode?.node_id === n.node_id;
            const isSelected = selectedNode?.node_id === n.node_id;
            return (
              <g key={n.node_id}>
                {impact !== undefined ? (
                  <circle cx={x} cy={y} r={NODE_R + 3 + impact * 6} fill="var(--status-critical)" opacity={0.12 + impact * 0.35} />
                ) : null}
                {isBottleneck ? <circle cx={x} cy={y} r={NODE_R + 2.5} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.85} /> : null}
                <circle
                  cx={x}
                  cy={y}
                  r={isHover || isSelected ? NODE_R + 1.3 : NODE_R}
                  fill={TRUTH_COLOR[n.truth_status] ?? "var(--text-muted)"}
                  stroke={isSelected ? "var(--accent)" : "var(--surface-1)"}
                  strokeWidth={isSelected ? 1.5 : 0.6}
                  className={styles.node}
                  onMouseEnter={() => setHoverNode(n)}
                  onMouseLeave={() => setHoverNode(null)}
                  onClick={() => runPropagation(n)}
                />
              </g>
            );
          })}

          {districts.map((d, i) => (
            <text key={d} x={MARGIN.left - 6} y={MARGIN.top + i * ROW_HEIGHT + 3} textAnchor="end" className={styles.rowLabel}>
              {i % 4 === 0 ? d.replace(/_/g, " ") : ""}
            </text>
          ))}
        </svg>

        {hoverNode ? (
          <div className={styles.tooltip}>
            <strong>{hoverNode.name}</strong> — {hoverNode.node_type} · {hoverNode.geo_id.replace(/_/g, " ")} ·{" "}
            <span style={{ color: TRUTH_COLOR[hoverNode.truth_status] }}>{hoverNode.truth_status}</span>
            {bottleneckIds.has(hoverNode.node_id) ? " · structural bottleneck" : ""}
          </div>
        ) : (
          <div className={styles.tooltipPlaceholder}>Hover a node for details, or click it to simulate a shock originating there.</div>
        )}
      </div>

      <div className={styles.sidePanel}>
        <div className={`${styles.controlCard} card`}>
          <div className={styles.controlTitle}>Shock Severity</div>
          <input type="range" min={0.1} max={1} step={0.05} value={severity} onChange={(e) => setSeverity(parseFloat(e.target.value))} />
          <div className={styles.severityValue}>{Math.round(severity * 100)}%</div>
          <p className={styles.controlNote}>Applied to whichever node you click next. Adjustable, illustrative — a scenario input, not an observed event.</p>
        </div>

        <div className={`${styles.controlCard} card`}>
          <div className={styles.controlTitle}>Propagation Result</div>
          {propagating ? (
            <p className="secondary" style={{ fontSize: 12.5 }}>
              Simulating…
            </p>
          ) : propagation && selectedNode ? (
            <>
              <p className={styles.resultLine}>
                <strong>{selectedNode.name}</strong> ({SHOCK_TYPE_FOR_NODE_TYPE[selectedNode.node_type].replace(/_/g, " ")}, {Math.round(severity * 100)}%)
              </p>
              <p className={styles.resultLine}>
                {propagation.steps.length} nodes affected across {propagation.impacted_geographies.length} districts and{" "}
                {propagation.impacted_food_categories.length} food categories.
              </p>
              <p className={styles.resultMuted}>
                SIMULATED breadth-first cascade over modeled dependency edges — not a measured or forecast real-world
                effect.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "6px 0", marginTop: 4 }}
                onClick={() => {
                  setPropagation(null);
                  setSelectedNode(null);
                }}
              >
                Clear simulation
              </button>
            </>
          ) : (
            <p className="secondary" style={{ fontSize: 12.5 }}>
              No simulation run yet. Click any node in the diagram.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className={styles.legendItem}>
      <span className={styles.legendDotMark} style={{ background: color }} />
      {label}
    </span>
  );
}
