import styles from "./ComingNext.module.css";

export function ComingNext({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.wrap} card`}>
      <div className={styles.title}>Coming in the next build phase</div>
      <div className={styles.text}>{children}</div>
    </div>
  );
}
