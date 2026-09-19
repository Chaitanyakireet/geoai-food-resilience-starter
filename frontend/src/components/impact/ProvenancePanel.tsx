import { StatusBadge } from "@/components/StatusBadge";
import type { ProvenanceDataset, ProvenanceResponse } from "@/lib/api";
import styles from "./ProvenancePanel.module.css";

type DisclosureProvenance = { nature?: string; assumption_disclosure?: string[]; [key: string]: unknown };
type AiProvenance = {
  provider: { name: string; configured: boolean };
  approved_tools: string[];
  evidence_corpus: { document_count: number };
  truth_status_discipline: string[];
  limitations: string[];
};

export function ProvenancePanel({
  gis,
  risk,
  graph,
  intervention,
  optimization,
  twin,
  ai,
}: {
  gis: ProvenanceResponse | null;
  risk: ProvenanceResponse | null;
  graph: ProvenanceResponse | null;
  intervention: DisclosureProvenance | null;
  optimization: DisclosureProvenance | null;
  twin: DisclosureProvenance | null;
  ai: AiProvenance | null;
}) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Provenance &amp; evidence</div>
      <p className={styles.note}>
        Every module in this platform publishes its own provenance. Expand a source below to see exactly why a
        value is present, or absent.
      </p>

      <DatasetSection title="GIS / spatial layer" provenance={gis} />
      <DatasetSection title="Risk baseline (NASA POWER)" provenance={risk} />
      <DatasetSection title="Food network graph" provenance={graph} />
      <DisclosureSection title="Intervention engine" provenance={intervention} />
      <DisclosureSection title="Multi-objective optimizer" provenance={optimization} />
      <DisclosureSection title="Digital Twin + recovery" provenance={twin} />

      {ai ? (
        <details className={styles.module}>
          <summary className={styles.moduleSummary}>
            AI Decision Brief / Copilot <span className="muted">({ai.provider.configured ? `${ai.provider.name}, configured` : "no provider configured"})</span>
          </summary>
          <div className={styles.moduleBody}>
            <Row label="Approved tools" value={ai.approved_tools.join(", ")} />
            <Row label="Evidence corpus" value={`${ai.evidence_corpus.document_count} documents (this project's own provenance/methodology, not an external search)`} />
            <ul className={styles.list}>
              {ai.truth_status_discipline.map((l) => (
                <li key={l}>{l}</li>
              ))}
              {ai.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      <div className={styles.assetAttribution}>
        SDG icons: United Nations Sustainable Development Goals —{" "}
        <a href="https://www.un.org/sustainabledevelopment" target="_blank" rel="noreferrer" className={styles.link}>
          un.org/sustainabledevelopment
        </a>
        . The content of this publication has not been approved by the United Nations and does not reflect the
        views of the United Nations or its officials or Member States. Their use here is illustrative of project
        alignment only and does not imply United Nations endorsement of this platform.
      </div>
    </div>
  );
}

function DatasetSection({ title, provenance }: { title: string; provenance: ProvenanceResponse | null }) {
  if (!provenance) {
    return (
      <details className={styles.module}>
        <summary className={styles.moduleSummary}>{title} <span className="muted">(unavailable)</span></summary>
      </details>
    );
  }
  return (
    <details className={styles.module}>
      <summary className={styles.moduleSummary}>
        {title} <span className="muted">({provenance.datasets.length} dataset{provenance.datasets.length === 1 ? "" : "s"})</span>
      </summary>
      <div className={styles.moduleBody}>
        {provenance.datasets.map((d: ProvenanceDataset) => (
          <div key={d.dataset_name} className={styles.dataset}>
            <div className={styles.datasetHeader}>
              <span className={styles.datasetName}>{d.dataset_name}</span>
              <StatusBadge status={d.truth_status} compact />
            </div>
            <Row label="Publisher" value={d.publisher} />
            {d.source_url && !d.source_url.startsWith("n/a") ? (
              <Row label="Source" value={d.source_url} link />
            ) : null}
            {d.access_date ? <Row label="Accessed" value={d.access_date} /> : null}
            <p className={styles.limitations}>{d.limitations}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function DisclosureSection({ title, provenance }: { title: string; provenance: DisclosureProvenance | null }) {
  if (!provenance) {
    return (
      <details className={styles.module}>
        <summary className={styles.moduleSummary}>{title} <span className="muted">(unavailable)</span></summary>
      </details>
    );
  }
  return (
    <details className={styles.module}>
      <summary className={styles.moduleSummary}>{title}</summary>
      <div className={styles.moduleBody}>
        {provenance.nature ? <p className={styles.limitations}>{String(provenance.nature)}</p> : null}
        {Array.isArray(provenance.assumption_disclosure) ? (
          <ul className={styles.list}>
            {provenance.assumption_disclosure.map((l: string) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className={styles.row}>
      <span className="muted">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noreferrer" className={styles.link}>
          {value}
        </a>
      ) : (
        <span className={styles.rowValue}>{value}</span>
      )}
    </div>
  );
}
