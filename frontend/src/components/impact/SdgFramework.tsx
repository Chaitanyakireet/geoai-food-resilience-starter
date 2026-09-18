import type { ScenarioState } from "@/lib/api";
import { SDG_NAMES } from "@/lib/sdg";
import styles from "./SdgFramework.module.css";

type SdgStatus = "directly_modeled" | "co_benefit" | "not_modeled";

const STATUS_LABEL: Record<SdgStatus, string> = {
  directly_modeled: "Directly modeled",
  co_benefit: "Indirect / co-benefit",
  not_modeled: "Not modeled / insufficient evidence",
};

const STATUS_CLASS: Record<SdgStatus, string> = {
  directly_modeled: styles.direct,
  co_benefit: styles.coBenefit,
  not_modeled: styles.notModeled,
};

type SdgEntry = { number: number; name: string; role: "primary" | "secondary"; status: SdgStatus; rationale: string };

function buildFramework(headline: ScenarioState | null): SdgEntry[] {
  return [
    {
      number: 2,
      name: SDG_NAMES[2],
      role: "primary",
      status: "directly_modeled",
      rationale: "Risk, resilience, resilience gap, and food-availability/loss effect proxies are direct outputs of this platform's risk, graph, and Digital Twin engines for any valid geography.",
    },
    {
      number: 6,
      name: SDG_NAMES[6],
      role: "secondary",
      status: headline?.water_impact_m3 != null ? "directly_modeled" : "not_modeled",
      rationale: headline?.water_impact_m3 != null
        ? "Water impact is present as a caller-supplied accounting figure for this scenario's interventions — an echo of user input, not an independently computed hydrological estimate."
        : "No water_impact_m3 value was supplied for this scenario's interventions — the platform never estimates water use independently.",
    },
    {
      number: 7,
      name: SDG_NAMES[7],
      role: "secondary",
      status: "not_modeled",
      rationale: "No energy-system data or model exists anywhere in this platform.",
    },
    {
      number: 8,
      name: SDG_NAMES[8],
      role: "secondary",
      status: "not_modeled",
      rationale: "No labor-market, employment, or livelihood data is ingested.",
    },
    {
      number: 9,
      name: SDG_NAMES[9],
      role: "secondary",
      status: "co_benefit",
      rationale: "Food-network transport/storage bottleneck diagnostics (backend/graph) are a structural proxy for infrastructure robustness, not a direct, validated SDG 9 indicator.",
    },
    {
      number: 11,
      name: SDG_NAMES[11],
      role: "secondary",
      status: "co_benefit",
      rationale: "Hyderabad is modeled as the principal demand hub — resilience improvements there plausibly support urban food-system stability, but no urban-livability metric is computed.",
    },
    {
      number: 12,
      name: SDG_NAMES[12],
      role: "secondary",
      status: headline?.food_loss_effect != null ? "co_benefit" : "not_modeled",
      rationale: headline?.food_loss_effect != null
        ? "Food loss effect (from a supplied loss_reduction_pct) is a proxy for reduced food waste, not a validated end-to-end waste-stream measurement."
        : "No loss_reduction_pct was supplied for this scenario's interventions.",
    },
    {
      number: 13,
      name: SDG_NAMES[13],
      role: "secondary",
      status: headline?.carbon_impact_tco2e != null ? "directly_modeled" : "not_modeled",
      rationale: headline?.carbon_impact_tco2e != null
        ? "Carbon impact is present as a caller-supplied accounting figure — an echo of user input, not an independently estimated emissions calculation."
        : "No carbon_impact_tco2e value was supplied for this scenario's interventions — the platform never estimates emissions independently.",
    },
    {
      number: 15,
      name: SDG_NAMES[15],
      role: "secondary",
      status: "not_modeled",
      rationale: "No land-use, biodiversity, or ecosystem data exists anywhere in this platform.",
    },
    {
      number: 17,
      name: SDG_NAMES[17],
      role: "secondary",
      status: "not_modeled",
      rationale: "A cross-sector partnership indicator is a process-level goal, not something a per-scenario simulation can output.",
    },
  ];
}

export function SdgFramework({ headline }: { headline: ScenarioState | null }) {
  const entries = buildFramework(headline);
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>SDG impact framework</div>
      <p className={styles.note}>
        SDG 2 (Zero Hunger) is this project&apos;s primary goal; the rest are secondary. No scenario has measured
        impact on every SDG — each is classified honestly below rather than scored.
      </p>
      <div className={styles.grid}>
        {entries.map((e) => (
          <div key={e.number} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.sdgBadge}>SDG {e.number}</span>
              {e.role === "primary" ? <span className={styles.primaryTag}>Primary</span> : null}
            </div>
            <div className={styles.sdgName}>{e.name}</div>
            <span className={`${styles.statusTag} ${STATUS_CLASS[e.status]}`}>{STATUS_LABEL[e.status]}</span>
            <p className={styles.rationale}>{e.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
