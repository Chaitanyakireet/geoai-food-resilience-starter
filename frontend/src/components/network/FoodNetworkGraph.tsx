"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MiniRiskMap } from "@/components/MiniRiskMap";
import { NetworkIntelligencePanel } from "./NetworkIntelligencePanel";
import { NetworkProvenanceDrawer } from "./NetworkProvenanceDrawer";
import {
  getGraphEdges,
  getGraphNodes,
  postGraphPropagate,
  type BottleneckEntry,
  type DistrictsFeatureCollection,
  type GraphEdgeItem,
  type GraphNodeItem,
  type GraphPropagationResult,
  type RiskResult,
  type RiskStateResponse,
} from "@/lib/api";
import { GRAPH_SHOCK_FIELD_MAP, buildGraphShockInput, defaultShockFieldForNodeType, type GraphShockField } from "@/lib/shockMapping";
import { buildNetworkScenarioContext, buildNetworkTwinHandoff, writeNetworkInterventionHandoff } from "@/lib/networkHandoff";
import { persistAiScenarioContext, scenarioHandoffToAiContext } from "@/lib/aiScenarioContext";
import styles from "./FoodNetworkGraph.module.css";

const COLUMNS: { type: GraphNodeItem["node_type"]; label: string }[] = [
  { type: "production", label: "Production" },
  { type: "aggregation", label: "Aggregation" },
  { type: "storage", label: "Storage" },
  { type: "market", label: "Market" },
  { type: "demand", label: "Demand" },
];

const TRUTH_COLOR: Record<string, string> = {
  OBSERVED: "var(--cat-blue)",
  DERIVED: "var(--cat-aqua)",
  SIMULATED: "var(--cat-green)",
  ESTIMATED: "var(--cat-yellow)",
  COUNTERFACTUAL: "var(--cat-violet)",
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const COL_WIDTH = 168;
const ROW_HEIGHT = 15.5;
const MARGIN = { top: 30, right: 24, bottom: 8, left: 24 };
const NODE_R = 3.4;

export function FoodNetworkGraph({
  nodes,
  edges,
  bottlenecks,
  graphLimitations,
  districts,
  riskState,
  foodCategories,
  foodCategoryNote,
}: {
  nodes: GraphNodeItem[];
  edges: GraphEdgeItem[];
  bottlenecks: BottleneckEntry[];
  graphLimitations: string[];
  districts: DistrictsFeatureCollection;
  riskState: RiskStateResponse | null;
  foodCategories: string[];
  foodCategoryNote: string;
}) {
  const router = useRouter();

  const [liveNodes, setLiveNodes] = useState(nodes);
  const [liveEdges, setLiveEdges] = useState(edges);
  const [foodCategory, setFoodCategory] = useState("all_food");
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [hoverNode, setHoverNode] = useState<GraphNodeItem | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeItem | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgeItem | null>(null);
  const [selectedGeoId, setSelectedGeoId] = useState<string | null>(null);

  const [shockField, setShockField] = useState<GraphShockField>("production_disruption");
  const [severity, setSeverity] = useState(0.5);
  const [maxHops, setMaxHops] = useState(6);

  const [propagation, setPropagation] = useState<GraphPropagationResult | null>(null);
  const [propagating, setPropagating] = useState(false);
  const [propagationError, setPropagationError] = useState(false);

  const [currentHopIndex, setCurrentHopIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const [showBottlenecks, setShowBottlenecks] = useState(true);
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  const bottleneckIds = useMemo(() => new Set(bottlenecks.map((b) => b.node_id)), [bottlenecks]);

  const districtsInGraph = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of liveNodes) if (!seen.has(n.geo_id)) seen.set(n.geo_id, n.geo_id);
    return [...seen.keys()].sort();
  }, [liveNodes]);

  const districtRow = useMemo(() => new Map(districtsInGraph.map((d, i) => [d, i])), [districtsInGraph]);
  const nodeById = useMemo(() => new Map(liveNodes.map((n) => [n.node_id, n])), [liveNodes]);

  const riskByDistrict = useMemo(() => {
    const m = new Map<string, RiskResult>();
    riskState?.districts.forEach((d) => m.set(d.region_id, d));
    return m;
  }, [riskState]);

  const position = (n: GraphNodeItem): [number, number] => {
    const colIndex = COLUMNS.findIndex((c) => c.type === n.node_type);
    const row = districtRow.get(n.geo_id) ?? 0;
    return [MARGIN.left + colIndex * COL_WIDTH + COL_WIDTH / 2, MARGIN.top + row * ROW_HEIGHT];
  };

  const width = MARGIN.left + COLUMNS.length * COL_WIDTH + MARGIN.right;
  const height = MARGIN.top + districtsInGraph.length * ROW_HEIGHT + MARGIN.bottom;

  const hopValues = useMemo(() => {
    if (!propagation) return [];
    return [...new Set(propagation.steps.map((s) => s.hop_distance))].sort((a, b) => a - b);
  }, [propagation]);

  const revealedHop = currentHopIndex >= 0 && hopValues.length > 0 ? hopValues[currentHopIndex] : null;

  const impactByNode = useMemo(() => {
    const m = new Map<string, number>();
    if (!propagation || revealedHop === null) return m;
    propagation.steps.forEach((s) => {
      if (s.hop_distance <= revealedHop) m.set(s.node_id, s.impact_fraction);
    });
    return m;
  }, [propagation, revealedHop]);

  // Drives Play: advances one hop per tick until the last hop, then stops
  // itself. The state update lives inside the interval callback, not the
  // effect body, so it synchronizes with an external timer rather than
  // firing a setState synchronously on mount/update.
  useEffect(() => {
    if (!playing || hopValues.length === 0) return;
    const id = setInterval(() => {
      setCurrentHopIndex((idx) => {
        const next = idx + 1;
        if (next >= hopValues.length - 1) {
          clearInterval(id);
          setPlaying(false);
          return hopValues.length - 1;
        }
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, hopValues.length]);

  const handleCategoryChange = async (cat: string) => {
    setFoodCategory(cat);
    setCategoryLoading(true);
    const [n, e] = await Promise.all([getGraphNodes(cat), getGraphEdges(cat)]);
    if (n) setLiveNodes(n);
    if (e) setLiveEdges(e);
    setCategoryLoading(false);
  };

  const selectNode = (n: GraphNodeItem) => {
    setSelectedNode(n);
    setSelectedEdge(null);
    setSelectedGeoId(n.geo_id);
    setShockField(defaultShockFieldForNodeType(n.node_type));
  };

  const selectEdge = (e: GraphEdgeItem) => {
    setSelectedEdge(e);
    setSelectedNode(null);
    const s = nodeById.get(e.source);
    if (s) setSelectedGeoId(s.geo_id);
  };

  const selectDistrictFromMap = (districtId: string) => {
    setSelectedGeoId(districtId);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const runPropagation = async () => {
    if (!selectedGeoId) return;
    setPropagating(true);
    setPropagationError(false);
    const shockInput = buildGraphShockInput(selectedGeoId, shockField, severity, maxHops);
    const { data } = await postGraphPropagate(shockInput);
    if (data) {
      setPropagation(data);
      const hops = [...new Set(data.steps.map((s) => s.hop_distance))].sort((a, b) => a - b);
      setCurrentHopIndex(hops.length - 1);
      setPlaying(false);
    } else {
      setPropagationError(true);
    }
    setPropagating(false);
  };

  const handlePlay = () => {
    if (hopValues.length === 0) return;
    const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setCurrentHopIndex(hopValues.length - 1);
      return;
    }
    if (currentHopIndex >= hopValues.length - 1) setCurrentHopIndex(-1);
    setPlaying(true);
  };
  const handlePause = () => setPlaying(false);
  const handleStep = () => {
    setPlaying(false);
    setCurrentHopIndex((idx) => Math.min(idx + 1, hopValues.length - 1));
  };
  const handleReset = () => {
    setPlaying(false);
    setCurrentHopIndex(-1);
  };

  const handleCreateIntervention = () => {
    if (!selectedGeoId) return;
    const context = buildNetworkScenarioContext({ geoId: selectedGeoId, foodCategory, shockField, severity, maxHops });
    writeNetworkInterventionHandoff(context);
    persistAiScenarioContext(context);
    router.push("/interventions");
  };

  const handleSimulateInTwin = () => {
    if (!selectedGeoId) return;
    const handoff = buildNetworkTwinHandoff({ geoId: selectedGeoId, foodCategory, shockField, severity, maxHops });
    try {
      sessionStorage.setItem("interventionLab.scenarioHandoff", JSON.stringify(handoff));
    } catch {
      // sessionStorage unavailable -- navigate anyway, twin page just won't show the banner
    }
    persistAiScenarioContext(scenarioHandoffToAiContext(handoff));
    router.push("/twin");
  };

  const categoryDisclosureActive = foodCategory !== "all_food";

  return (
    <div className={styles.layout}>
      <div className={styles.mainColumn}>
        <div className={`${styles.diagramCard} card`}>
          <div className={styles.diagramHeader}>
            <div>
              <div className={styles.diagramTitle}>Food-System Network — Control Room</div>
              <p className={styles.diagramSubnote}>
                {liveNodes.length} nodes · {liveEdges.length} edges across {districtsInGraph.length} districts. Click
                a node, an edge, or a district on the map to inspect it and drive a real backend simulation.
              </p>
            </div>
            <div className={styles.legend}>
              <LegendDot color="var(--cat-blue)" label="Observed" />
              <LegendDot color="var(--cat-aqua)" label="Derived" />
              <LegendDot color="var(--cat-green)" label="Simulated" />
              <label className={styles.bottleneckToggle}>
                <input type="checkbox" checked={showBottlenecks} onChange={(e) => setShowBottlenecks(e.target.checked)} />
                Show bottlenecks ({bottlenecks.length})
              </label>
            </div>
          </div>

          <div className={styles.filterRow}>
            <label className={styles.fieldLabel} htmlFor="network-food-category">
              Food category
            </label>
            <select
              id="network-food-category"
              value={foodCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={styles.select}
              disabled={categoryLoading}
            >
              {foodCategories.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </select>
            {categoryDisclosureActive ? <span className={styles.disclosureNote}>Limitation: {foodCategoryNote}</span> : null}
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-label="Food-system network diagram">
            {selectedGeoId && districtRow.has(selectedGeoId) ? (
              <rect
                x={0}
                y={MARGIN.top + districtRow.get(selectedGeoId)! * ROW_HEIGHT - ROW_HEIGHT / 2}
                width={width}
                height={ROW_HEIGHT}
                fill="var(--accent)"
                opacity={0.08}
              />
            ) : null}

            {COLUMNS.map((c, i) => (
              <text key={c.type} x={MARGIN.left + i * COL_WIDTH + COL_WIDTH / 2} y={MARGIN.top - 12} textAnchor="middle" className={styles.colLabel}>
                {c.label}
              </text>
            ))}

            {liveEdges.map((e) => {
              const s = nodeById.get(e.source);
              const t = nodeById.get(e.target);
              if (!s || !t) return null;
              const [x1, y1] = position(s);
              const [x2, y2] = position(t);
              const involved = propagation && (impactByNode.has(e.source) || impactByNode.has(e.target));
              const isSelected = selectedEdge?.edge_id === e.edge_id;
              return (
                <g key={e.edge_id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={7} style={{ cursor: "pointer" }} onClick={() => selectEdge(e)} />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className={styles.edge}
                    style={isSelected ? { stroke: "var(--accent)", strokeWidth: 1.8 } : undefined}
                    opacity={isSelected ? 0.9 : involved ? 0.55 : 0.12}
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {liveNodes.map((n) => {
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
                  {showBottlenecks && isBottleneck ? (
                    <circle cx={x} cy={y} r={NODE_R + 2.5} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.85} />
                  ) : null}
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
                    onClick={() => selectNode(n)}
                  />
                </g>
              );
            })}

            {districtsInGraph.map((d, i) => (
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
            <div className={styles.tooltipPlaceholder}>
              Hover a node for a quick summary, or click a node / edge / map district to open full intelligence.
            </div>
          )}

          <p className={styles.limitationsNote}>{graphLimitations.join(" ")}</p>
        </div>

        <MiniRiskMap
          districts={districts}
          riskByDistrict={riskByDistrict}
          highlightDistrictId={selectedGeoId ?? undefined}
          onSelectDistrict={selectDistrictFromMap}
          title="Synchronized Geography"
          subtitle="Click a district to sync the network diagram, node intelligence, and shock composer to it."
          showLink={false}
          height={260}
        />
      </div>

      <div className={styles.sidePanel}>
        <div className={`${styles.controlCard} card`}>
          <div className={styles.controlTitle}>Shock Composer</div>
          <p className={styles.controlNote}>
            {selectedGeoId ? (
              <>
                Geography: <strong>{titleCase(selectedGeoId)}</strong>
              </>
            ) : (
              "Select a node, edge, or district first to set the shock's geography."
            )}
          </p>

          <label className={styles.fieldLabel} htmlFor="network-shock-field">
            Shock type
          </label>
          <select
            id="network-shock-field"
            value={shockField}
            onChange={(e) => setShockField(e.target.value as GraphShockField)}
            className={styles.select}
          >
            {(Object.keys(GRAPH_SHOCK_FIELD_MAP) as GraphShockField[]).map((f) => (
              <option key={f} value={f}>
                {GRAPH_SHOCK_FIELD_MAP[f].label}
              </option>
            ))}
          </select>

          <div className={styles.controlTitle} style={{ marginTop: 12 }}>
            Severity
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={severity} onChange={(e) => setSeverity(parseFloat(e.target.value))} />
          <div className={styles.severityValue}>{Math.round(severity * 100)}%</div>

          <div className={styles.controlTitle} style={{ marginTop: 12 }}>
            Max hops
          </div>
          <input type="range" min={1} max={10} step={1} value={maxHops} onChange={(e) => setMaxHops(parseInt(e.target.value, 10))} />
          <div className={styles.severityValue}>{maxHops}</div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12, width: "100%" }}
            disabled={!selectedGeoId || propagating}
            onClick={runPropagation}
          >
            {propagating ? "Simulating…" : "Run Shock Propagation"}
          </button>
          {propagationError ? (
            <p className={styles.controlNote} style={{ color: "var(--status-critical)" }}>
              Backend unavailable — propagation could not run.
            </p>
          ) : null}
        </div>

        <div className={`${styles.controlCard} card`}>
          <div className={styles.controlTitle}>Propagation Animation</div>
          {!propagation ? (
            <p className="secondary" style={{ fontSize: 12.5 }}>
              Run a shock above to enable playback.
            </p>
          ) : (
            <>
              <div className={styles.animRow}>
                <button type="button" className="btn btn-ghost" onClick={handleReset} disabled={currentHopIndex === -1 && !playing}>
                  ⏮ Reset
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleStep} disabled={currentHopIndex >= hopValues.length - 1}>
                  Step ⏭
                </button>
                <button type="button" className="btn btn-primary" onClick={playing ? handlePause : handlePlay}>
                  {playing ? "⏸ Pause" : "▶ Play"}
                </button>
              </div>
              <p className={styles.controlNote}>
                {revealedHop === null
                  ? "Nothing revealed yet — press Play or Step."
                  : `Showing hop ${revealedHop} of ${hopValues[hopValues.length - 1]}.`}
              </p>
              <p className={styles.resultLine}>
                {propagation.steps.filter((s) => revealedHop !== null && s.hop_distance <= revealedHop).length} of{" "}
                {propagation.steps.length} affected nodes revealed across {propagation.impacted_geographies.length}{" "}
                districts.
              </p>
              <p className={styles.resultMuted}>
                SIMULATED breadth-first cascade over modeled dependency edges — not a measured or forecast real-world
                effect.
              </p>
            </>
          )}
        </div>

        <NetworkIntelligencePanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          selectedGeoId={selectedGeoId}
          nodeById={nodeById}
          edges={liveEdges}
          bottlenecks={bottlenecks}
          propagation={propagation}
          categoryDisclosureActive={categoryDisclosureActive}
          foodCategoryNote={foodCategoryNote}
        />

        <div className={`${styles.controlCard} card`}>
          <div className={styles.controlTitle}>Act On This Scenario</div>
          <button type="button" className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }} disabled={!selectedGeoId} onClick={handleCreateIntervention}>
            Create Intervention From This Shock →
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: "100%" }} disabled={!selectedGeoId} onClick={handleSimulateInTwin}>
            Simulate In Digital Twin →
          </button>
          {!selectedGeoId ? <p className={styles.controlNote}>Select a node, edge, or district to enable handoff.</p> : null}
        </div>

        <button type="button" className="btn btn-ghost" onClick={() => setProvenanceOpen(true)}>
          View network provenance & limitations →
        </button>
      </div>

      <NetworkProvenanceDrawer open={provenanceOpen} onClose={() => setProvenanceOpen(false)} />
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
