"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { getGraphProvenance, type ProvenanceDataset } from "@/lib/api";
import styles from "@/components/spatial/ProvenanceDrawer.module.css";

// Reuses the same drawer chrome as the Spatial Intelligence provenance
// panel (spatial/ProvenanceDrawer.tsx) so provenance disclosure looks
// identical everywhere in the product, but sources the food-graph's own
// dataset registry (/graph/provenance) instead of the GIS/risk one.
export function NetworkProvenanceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [datasets, setDatasets] = useState<ProvenanceDataset[] | null>(null);
  const loading = open && datasets === null;

  useEffect(() => {
    if (!open || datasets !== null) return;
    let cancelled = false;
    getGraphProvenance().then((result) => {
      if (cancelled) return;
      setDatasets(result?.datasets ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, datasets]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Food-network provenance & limitations</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? <p className="secondary">Loading…</p> : null}

        {datasets ? (
          <div className={styles.list}>
            {datasets.map((d) => (
              <div key={d.dataset_name} className={styles.entry}>
                <div className={styles.entryHeader}>
                  <div className={styles.entryName}>{d.dataset_name}</div>
                  <StatusBadge status={d.truth_status} compact />
                </div>
                <div className={styles.entryRow}>
                  <span className="muted">Publisher</span>
                  <span className="secondary">{d.publisher}</span>
                </div>
                {d.source_url && d.source_url !== "n/a -- computed" ? (
                  <div className={styles.entryRow}>
                    <span className="muted">Source</span>
                    <a className={styles.link} href={d.source_url} target="_blank" rel="noreferrer">
                      {d.source_url}
                    </a>
                  </div>
                ) : null}
                <div className={styles.entryRow}>
                  <span className="muted">Accessed</span>
                  <span className="secondary">{d.access_date}</span>
                </div>
                <div className={styles.entryRow}>
                  <span className="muted">Processing</span>
                  <span className="secondary">{d.processing}</span>
                </div>
                <div className={styles.limitations}>{d.limitations}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
