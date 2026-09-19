"use client";

import { useState } from "react";
import Image from "next/image";
import type { ScenarioState } from "@/lib/api";
import { SDG_STATUS_LABEL, buildSdgFramework, type SdgEntry } from "@/lib/sdgFramework";
import { SdgDetailDrawer } from "./SdgDetailDrawer";
import styles from "./SdgFramework.module.css";

function iconPath(n: number): string {
  return `/sdg-icons/E-WEB-Goal-${String(n).padStart(2, "0")}.png`;
}

const STATUS_CLASS: Record<SdgEntry["status"], string> = {
  directly_modeled: styles.direct,
  co_benefit: styles.coBenefit,
  not_modeled: styles.notModeled,
};

export function SdgFramework({ headline }: { headline: ScenarioState | null }) {
  const entries = buildSdgFramework(headline);
  const primary = entries.find((e) => e.role === "primary")!;
  const secondary = entries.filter((e) => e.role === "secondary");
  const [selected, setSelected] = useState<SdgEntry | null>(null);

  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>Project Alignment</div>
        <h2 className={styles.title}>SDG Impact Framework</h2>
        <p className={styles.note}>
          SDG 2 (Zero Hunger) is this project&apos;s primary goal; the nine below are secondary. This is a project
          alignment map, not proof of achievement -- each goal is classified by whether a real output actually
          touches it, never scored numerically.
        </p>
      </div>

      <button type="button" className={styles.heroCard} onClick={() => setSelected(primary)}>
        <Image src={iconPath(primary.number)} alt="" width={104} height={104} className={styles.heroIcon} unoptimized />
        <div className={styles.heroBody}>
          <div className={styles.heroHeadRow}>
            <span className={styles.heroBadge}>Primary Goal</span>
            <span className={`${styles.statusTag} ${STATUS_CLASS[primary.status]}`}>{SDG_STATUS_LABEL[primary.status]}</span>
          </div>
          <div className={styles.heroName}>
            SDG {primary.number} — {primary.name}
          </div>
          <p className={styles.heroRelationship}>{primary.relationship}</p>
          <span className={styles.viewDetail}>View full detail →</span>
        </div>
      </button>

      <div className={styles.diagram}>
        <DiagramNode label="Project" />
        <DiagramArrow />
        <DiagramNode label="Food Resilience" />
        <DiagramArrow />
        <DiagramNode label={`SDG ${primary.number}`} accent />
        <DiagramArrow />
        <DiagramNode label="Secondary Co-Benefits / Trade-Offs" wide />
      </div>

      <div className={styles.secondaryHeader}>Secondary SDGs</div>
      <div className={styles.grid}>
        {secondary.map((e) => (
          <button key={e.number} type="button" className={styles.card} onClick={() => setSelected(e)}>
            <Image src={iconPath(e.number)} alt="" width={56} height={56} className={styles.cardIcon} unoptimized />
            <div className={styles.cardBody}>
              <div className={styles.cardName}>
                SDG {e.number} — {e.name}
              </div>
              <span className={`${styles.statusTag} ${STATUS_CLASS[e.status]}`}>{SDG_STATUS_LABEL[e.status]}</span>
              <p className={styles.cardTeaser}>{e.relationship}</p>
            </div>
          </button>
        ))}
      </div>

      <SdgDetailDrawer entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function DiagramNode({ label, accent, wide }: { label: string; accent?: boolean; wide?: boolean }) {
  return <div className={`${styles.diagramNode} ${accent ? styles.diagramNodeAccent : ""} ${wide ? styles.diagramNodeWide : ""}`}>{label}</div>;
}

function DiagramArrow() {
  return (
    <span className={styles.diagramArrow} aria-hidden>
      →
    </span>
  );
}
