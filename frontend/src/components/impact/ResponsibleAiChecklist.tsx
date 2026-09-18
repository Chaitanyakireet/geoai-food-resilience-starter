import styles from "./ResponsibleAiChecklist.module.css";

const ITEMS: { title: string; detail: string }[] = [
  {
    title: "Transparency",
    detail: "Every numeric output traces to a named deterministic engine (risk, graph, intervention, optimization, Digital Twin) via a documented provenance endpoint — nothing is a black box.",
  },
  {
    title: "Uncertainty",
    detail: "Confidence, data coverage, and three separate uncertainty categories (data, model/assumption, scenario) are surfaced above rather than collapsed into one score.",
  },
  {
    title: "Source integrity",
    detail: "RAG evidence is retrieved only from this project's own provenance/methodology documents (backend/ai/corpus.py) — never an external or unverified source, and a no-match query returns \"no evidence found\" rather than a fabricated citation.",
  },
  {
    title: "Hallucination control",
    detail: "The AI Copilot cannot override deterministic numerical engines: tool calls always execute real Python code against real engines first, and the LLM (when configured) only narrates over already-computed results — see the AI Decision Brief's tool trace.",
  },
  {
    title: "Privacy",
    detail: "No individual-level or personally identifiable data is collected, stored, or processed anywhere in this platform — all inputs are administrative-geography and climate/food-system aggregates.",
  },
  {
    title: "Fairness / geographic coverage",
    detail: "Coverage is uneven and disclosed: OSM markets exist for 29/33 districts (4 use a labeled SIMULATED placeholder), and 593 mandal boundaries are best-effort community-mapped, not confirmed complete against an official gazette.",
  },
  {
    title: "Human oversight",
    detail: "Every scenario output requires human review before action (see below) — the platform models decision support, it does not execute or recommend automated real-world action.",
  },
  {
    title: "Reproducibility",
    detail: "All calculations are deterministic given the same inputs (risk baseline, graph propagation, optimizer, recovery model) — re-running the same scenario reproduces the same numbers, unlike stochastic or LLM-generated figures.",
  },
  {
    title: "Data limitations",
    detail: "OSM administrative boundaries are community-mapped, not official cadastral data. District-level climate signal (NASA POWER, ~50km grid) is not presented as precise mandal-level measurement — mandal risk results explicitly inherit their parent district's value.",
  },
];

export function ResponsibleAiChecklist() {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Responsible AI checklist</div>
      <p className={styles.note}>Each item below is tied to an actual mechanism in this codebase, not a general policy statement.</p>
      <div className={styles.list}>
        {ITEMS.map((item) => (
          <div key={item.title} className={styles.item}>
            <div className={styles.itemHeader}>
              <span className={styles.check}>✓</span>
              <span className={styles.itemTitle}>{item.title}</span>
            </div>
            <p className={styles.itemDetail}>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
