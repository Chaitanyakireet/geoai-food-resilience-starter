"use client";

import Image from "next/image";
import { SDG_STATUS_LABEL, type SdgEntry } from "@/lib/sdgFramework";
import drawerStyles from "@/components/spatial/ProvenanceDrawer.module.css";
import styles from "./SdgDetailDrawer.module.css";

// Reuses the same drawer chrome as every other provenance/detail drawer in
// the product (spatial/ProvenanceDrawer.tsx, network/NetworkProvenanceDrawer.tsx)
// so this reads as one more disclosure surface, not a new UI pattern.
export function SdgDetailDrawer({ entry, onClose }: { entry: SdgEntry | null; onClose: () => void }) {
  if (!entry) return null;

  return (
    <div className={drawerStyles.overlay} onClick={onClose}>
      <div className={drawerStyles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={drawerStyles.header}>
          <div className={styles.headerIdentity}>
            <Image src={`/sdg-icons/E-WEB-Goal-${String(entry.number).padStart(2, "0")}.png`} alt="" width={56} height={56} className={styles.headerIcon} unoptimized />
            <div>
              <h2 className={drawerStyles.title}>
                SDG {entry.number} — {entry.name}
              </h2>
              <span className={`${styles.statusPill} ${styles[`status_${entry.status}`]}`}>{SDG_STATUS_LABEL[entry.status]}</span>
            </div>
          </div>
          <button type="button" className={drawerStyles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <Section title="Project Relationship">
            <p className={styles.text}>{entry.relationship}</p>
          </Section>
          <Section title="Relevant Outputs">
            <p className={styles.text}>{entry.relevantOutputs}</p>
          </Section>
          <Section title="Relevant Data">
            <p className={styles.text}>{entry.relevantData}</p>
          </Section>
          <Section title="Relevant Method">
            <p className={styles.text}>{entry.relevantMethod}</p>
          </Section>
          <Section title="Evidence & Provenance">
            <p className={styles.text}>{entry.evidenceProvenance}</p>
          </Section>
          <Section title="Limitations">
            <p className={styles.limitations}>{entry.limitations}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
