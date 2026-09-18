import Link from "next/link";
import styles from "./TwinActionBar.module.css";

export function TwinActionBar({
  canCompare,
  comparing,
  onCompare,
  onSendToBrief,
  onOpenAssumptions,
}: {
  canCompare: boolean;
  comparing: boolean;
  onCompare: () => void;
  onSendToBrief: () => void;
  onOpenAssumptions: () => void;
}) {
  return (
    <div className={`${styles.bar} card-floating`}>
      <button type="button" className="btn btn-primary" disabled={!canCompare || comparing} onClick={onCompare}>
        {comparing ? "Comparing…" : "COMPARE WORLDS"}
      </button>
      <Link href="/interventions" className="btn btn-secondary">
        ← Return to Intervention Lab
      </Link>
      <button type="button" className="btn btn-secondary" onClick={onSendToBrief}>
        Send to AI Decision Brief →
      </button>
      <button type="button" className="btn btn-ghost" onClick={onOpenAssumptions} style={{ marginLeft: "auto" }}>
        Assumptions &amp; provenance
      </button>
    </div>
  );
}
