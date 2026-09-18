"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { AiToolCallRecord, EvidenceItem } from "@/lib/api";
import styles from "./ToolTraceSidebar.module.css";

export function ToolTraceSidebar({ toolTrace, citations, label }: { toolTrace: AiToolCallRecord[]; citations: EvidenceItem[]; label: string }) {
  return (
    <div className={styles.stack}>
      <div className={`${styles.panel} card`}>
        <div className={styles.panelTitle}>Tool Activity</div>
        <p className={styles.panelSubnote}>{label}</p>
        {toolTrace.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
            No tools called yet.
          </p>
        ) : (
          <div className={styles.traceList}>
            {toolTrace.map((t, i) => (
              <TraceRow key={`${t.tool_name}-${i}`} record={t} index={i} isLast={i === toolTrace.length - 1} />
            ))}
          </div>
        )}
      </div>

      <div className={`${styles.panel} card`}>
        <div className={styles.panelTitle}>Evidence ({citations.length})</div>
        {citations.length === 0 ? (
          <p className="muted" style={{ fontSize: 12 }}>
            No supporting evidence retrieved for this answer.
          </p>
        ) : (
          <div className={styles.citationList}>
            {citations.map((c) => (
              <CitationCard key={c.provenance_id} item={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TraceRow({ record, index, isLast }: { record: AiToolCallRecord; index: number; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={styles.traceRow}>
      <div className={styles.traceConnector}>
        <span className={record.status === "ok" ? styles.traceDotOk : styles.traceDotError} />
        {!isLast ? <span className={styles.traceLine} /> : null}
      </div>
      <div className={styles.traceBody}>
        <button type="button" className={styles.traceHeader} onClick={() => setExpanded((v) => !v)}>
          <span className={styles.traceStep}>{index + 1}.</span>
          <span className={styles.traceName}>{record.tool_name}</span>
          <span className={record.status === "ok" ? styles.traceStatusOk : styles.traceStatusError}>{record.status}</span>
        </button>
        <p className={styles.tracePurpose}>{record.purpose}</p>
        {expanded ? (
          <div className={styles.traceDetails}>
            {record.status === "error" ? (
              <p className={styles.traceError}>{record.error}</p>
            ) : (
              <dl className={styles.traceResult}>
                {Object.entries(record.result_summary).map(([k, v]) => (
                  <div key={k} className={styles.traceResultRow}>
                    <dt>{k.replace(/_/g, " ")}</dt>
                    <dd>{formatValue(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CitationCard({ item }: { item: EvidenceItem }) {
  return (
    <div className={styles.citation}>
      <div className={styles.citationHeader}>
        <span className={styles.citationName}>{item.source_name}</span>
        <StatusBadge status={item.truth_status} compact />
      </div>
      <p className={styles.citationExcerpt}>{item.excerpt}</p>
      <div className={styles.citationFooter}>
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noreferrer" className={styles.citationLink}>
            Source ↗
          </a>
        ) : (
          <span className="muted" style={{ fontSize: 10.5 }}>
            {item.provenance_id}
          </span>
        )}
        <span className="muted" style={{ fontSize: 10.5 }}>
          relevance {item.relevance_score}
        </span>
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(", ") || "none";
  return String(v);
}
