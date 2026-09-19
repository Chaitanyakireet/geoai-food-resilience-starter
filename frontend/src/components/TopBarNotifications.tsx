"use client";

import { useState } from "react";
import styles from "./TopBarNotifications.module.css";

type Notice = { text: string; tone: "critical" | "warning" };

// Every notice here is a real, currently-true system-state signal (never
// an invented alert) -- backend reachability and whether an LLM provider
// is configured (in which case the AI Copilot runs on its deterministic
// fallback instead). No fabricated notification stream.
export function TopBarNotifications({ backendReachable, aiConfigured }: { backendReachable: boolean; aiConfigured: boolean | null }) {
  const [open, setOpen] = useState(false);

  const notices: Notice[] = [];
  if (!backendReachable) notices.push({ text: "Backend unreachable — no page can load live data right now.", tone: "critical" });
  if (aiConfigured === false) notices.push({ text: "No LLM provider configured — AI Decision Brief runs on its deterministic, tool-grounded fallback.", tone: "warning" });

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.bellBtn} onClick={() => setOpen((v) => !v)} aria-label="System notices">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notices.length > 0 ? <span className={`${styles.badge} ${notices.some((n) => n.tone === "critical") ? styles.badgeCritical : styles.badgeWarning}`}>{notices.length}</span> : null}
      </button>

      {open ? (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>System Notices</div>
          {notices.length > 0 ? (
            <ul className={styles.list}>
              {notices.map((n) => (
                <li key={n.text} className={n.tone === "critical" ? styles.critical : styles.warning}>
                  {n.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No active notices.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
