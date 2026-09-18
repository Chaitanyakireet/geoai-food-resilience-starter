"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { BottleneckEntry, GraphEdgeItem, GraphNodeItem, GraphPropagationResult } from "@/lib/api";
import styles from "./FoodNetworkGraph.module.css";

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  );
}

export function NetworkIntelligencePanel({
  selectedNode,
  selectedEdge,
  selectedGeoId,
  nodeById,
  edges,
  bottlenecks,
  propagation,
  categoryDisclosureActive,
  foodCategoryNote,
}: {
  selectedNode: GraphNodeItem | null;
  selectedEdge: GraphEdgeItem | null;
  selectedGeoId: string | null;
  nodeById: Map<string, GraphNodeItem>;
  edges: GraphEdgeItem[];
  bottlenecks: BottleneckEntry[];
  propagation: GraphPropagationResult | null;
  categoryDisclosureActive: boolean;
  foodCategoryNote: string;
}) {
  if (selectedEdge) {
    const source = nodeById.get(selectedEdge.source);
    const target = nodeById.get(selectedEdge.target);
    return (
      <div className={`${styles.controlCard} card`}>
        <div className={styles.controlTitle}>Edge Intelligence</div>
        <Field label="From">{source ? `${source.name} (${titleCase(source.node_type)})` : selectedEdge.source}</Field>
        <Field label="To">{target ? `${target.name} (${titleCase(target.node_type)})` : selectedEdge.target}</Field>
        <Field label="Relationship">{titleCase(selectedEdge.edge_type)}</Field>
        <Field label="Geography">{titleCase(source?.geo_id ?? selectedEdge.source)}</Field>
        <Field label="Food scope">
          {categoryDisclosureActive ? foodCategoryNote : `${selectedEdge.food_categories.length} categories tagged.`}
        </Field>
        <Field label="Flow / capacity">Not available — no observed flow volume or transport capacity exists for this link.</Field>
        <Field label="Truth status">
          <StatusBadge status={selectedEdge.truth_status} />
        </Field>
        <Field label="Provenance">{selectedEdge.provenance}</Field>
      </div>
    );
  }

  if (selectedNode) {
    const inEdges = edges.filter((e) => e.target === selectedNode.node_id);
    const outEdges = edges.filter((e) => e.source === selectedNode.node_id);
    const bottleneck = bottlenecks.find((b) => b.node_id === selectedNode.node_id);
    const impact = propagation?.steps.find((s) => s.node_id === selectedNode.node_id);
    return (
      <div className={`${styles.controlCard} card`}>
        <div className={styles.controlTitle}>Node Intelligence</div>
        <Field label="Node ID">
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{selectedNode.node_id}</code>
        </Field>
        <Field label="Node type">{titleCase(selectedNode.node_type)}</Field>
        <Field label="Geography">{titleCase(selectedNode.geo_id)}</Field>
        <Field label="Food scope">
          {categoryDisclosureActive ? foodCategoryNote : `${selectedNode.food_categories.length} categories tagged.`}
        </Field>
        <Field label="Dependencies (upstream)">
          {inEdges.length > 0 ? inEdges.map((e) => nodeById.get(e.source)?.name ?? e.source).join(", ") : "None — source node"}
        </Field>
        <Field label="Connected nodes (downstream)">
          {outEdges.length > 0 ? outEdges.map((e) => nodeById.get(e.target)?.name ?? e.target).join(", ") : "None — terminal node"}
        </Field>
        <Field label="Bottleneck status">
          {bottleneck ? (
            <>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>Graph-theoretic bottleneck.</span> {bottleneck.note}
            </>
          ) : (
            "Not flagged as a structural bottleneck."
          )}
        </Field>
        <Field label="Scenario impact">
          {impact
            ? `${Math.round(impact.impact_fraction * 100)}% modeled impact fraction at hop ${impact.hop_distance} — SIMULATED.`
            : "No active simulation currently touches this node."}
        </Field>
        <Field label="Truth status">
          <StatusBadge status={selectedNode.truth_status} />
        </Field>
        <Field label="Data coverage">Not available — this graph does not publish a per-node coverage metric.</Field>
        <Field label="Provenance">{selectedNode.provenance}</Field>
        <Field label="Limitations">
          Structure is modeled; capacity, flow volume and specific facility identity are not independently measured for this
          node.
        </Field>
      </div>
    );
  }

  if (selectedGeoId) {
    return (
      <div className={`${styles.controlCard} card`}>
        <div className={styles.controlTitle}>Geography Selected</div>
        <p className="secondary" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <strong>{titleCase(selectedGeoId)}</strong> — click any highlighted node in this row for full node
          intelligence, or an edge between two nodes for relationship detail.
        </p>
      </div>
    );
  }

  return (
    <div className={`${styles.controlCard} card`}>
      <div className={styles.controlTitle}>Node / Edge Intelligence</div>
      <p className="secondary" style={{ fontSize: 12.5 }}>
        Click a node, an edge, or a district on the map to inspect it here.
      </p>
    </div>
  );
}
