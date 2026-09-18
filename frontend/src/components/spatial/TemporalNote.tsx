import styles from "./TemporalNote.module.css";

export function TemporalNote({ requestedDays, availableDays, date }: { requestedDays?: number; availableDays?: number; date?: string }) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.track}>
        <div className={styles.trackLine} />
        <div className={styles.point} />
      </div>
      <div className={styles.text}>
        <strong>Current conditions only</strong>
        {date ? ` — snapshot dated ${date}` : ""}
        {requestedDays != null && availableDays != null
          ? ` (rolling ${availableDays}/${requestedDays}-day climate window).`
          : "."}{" "}
        No validated historical risk time series exists yet; this control is structured so one can be added
        later without a redesign.
      </div>
    </div>
  );
}
