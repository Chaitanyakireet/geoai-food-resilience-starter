"use client";

import { useState } from "react";
import styles from "./Composer.module.css";

const SUGGESTED_PROMPTS = [
  "Why is this location vulnerable?",
  "What are the main drivers?",
  "What happens under this shock?",
  "Why was this portfolio selected?",
  "Compare World A and World B.",
  "What evidence supports this?",
  "What assumptions should I be cautious about?",
];

export function Composer({ onAsk, asking, hasContext }: { onAsk: (question: string) => void; asking: boolean; hasContext: boolean }) {
  const [value, setValue] = useState("");

  const submit = (q: string) => {
    if (!q.trim() || asking) return;
    onAsk(q.trim());
    setValue("");
  };

  return (
    <div className={`${styles.wrap} card-floating`}>
      <div className={styles.suggestions}>
        {SUGGESTED_PROMPTS.map((p) => (
          <button key={p} type="button" className={styles.suggestion} onClick={() => submit(p)} disabled={asking}>
            {p}
          </button>
        ))}
      </div>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <input
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasContext ? "Ask the Copilot about this scenario…" : "Ask the Copilot a general question…"}
          disabled={asking}
        />
        <button type="submit" className="btn btn-primary" disabled={asking || !value.trim()}>
          {asking ? "Asking…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
