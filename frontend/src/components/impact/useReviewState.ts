"use client";

import { useCallback, useSyncExternalStore } from "react";

// Human review is a UI state only -- stored in this browser's localStorage,
// keyed by a fingerprint of the scenario being reviewed. It does NOT
// constitute institutional or regulatory approval; no backend persistence
// mechanism exists for review records in this sprint, so localStorage is
// the documented, honest choice (per the task's own instruction: "store
// review state locally... unless a backend persistence mechanism already
// exists").
const STORAGE_PREFIX = "impact.humanReview.";

export type ReviewRecord = { reviewedAt: string } | null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function scenarioFingerprint(input: unknown): string {
  try {
    const json = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      hash = (hash * 31 + json.charCodeAt(i)) | 0;
    }
    return `s${hash}`;
  } catch {
    return "unknown";
  }
}

export function useReviewState(fingerprint: string): {
  record: ReviewRecord;
  markReviewed: () => void;
  clearReview: () => void;
} {
  const key = `${STORAGE_PREFIX}${fingerprint}`;

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const getServerSnapshot = useCallback(() => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const record: ReviewRecord = raw ? JSON.parse(raw) : null;

  const markReviewed = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ reviewedAt: new Date().toISOString() }));
      window.dispatchEvent(new StorageEvent("storage"));
    } catch {
      /* localStorage unavailable -- review marking simply won't persist */
    }
  }, [key]);

  const clearReview = useCallback(() => {
    try {
      localStorage.removeItem(key);
      window.dispatchEvent(new StorageEvent("storage"));
    } catch {
      /* ignore */
    }
  }, [key]);

  return { record, markReviewed, clearReview };
}
