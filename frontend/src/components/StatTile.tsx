import styles from "./StatTile.module.css";

export function StatTile({
  label,
  value,
  unit,
  helpText,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  helpText?: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <div className={`${styles.tile} card`}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${tone === "accent" ? styles.valueAccent : ""}`}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
      {helpText ? <div className={styles.help}>{helpText}</div> : null}
    </div>
  );
}
