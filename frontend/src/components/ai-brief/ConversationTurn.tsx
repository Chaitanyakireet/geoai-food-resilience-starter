import { StatusBadge } from "@/components/StatusBadge";
import type { AiQueryOutput, TruthStatus } from "@/lib/api";
import styles from "./ConversationTurn.module.css";

export function ConversationTurn({ question, output }: { question: string; output: AiQueryOutput | { error: string } }) {
  return (
    <div className={styles.turn}>
      <div className={styles.question}>{question}</div>

      {"error" in output ? (
        <div className={`${styles.answer} ${styles.answerError}`}>{output.error}</div>
      ) : (
        <div className={styles.answer}>
          <div className={styles.answerHeader}>
            <span className={output.mode === "llm" ? styles.modeLlm : styles.modeFallback}>
              {output.mode === "llm" ? "AI-narrated" : "Structured (AI unavailable)"}
            </span>
            {output.truth_statuses_referenced.map((ts) => (
              <StatusBadge key={ts} status={ts as TruthStatus} compact />
            ))}
          </div>
          <p className={styles.answerText}>{output.answer}</p>
        </div>
      )}
    </div>
  );
}
