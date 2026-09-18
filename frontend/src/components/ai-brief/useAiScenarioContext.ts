"use client";

import { useSyncExternalStore } from "react";
import type { AiScenarioContext } from "@/lib/api";
import { AI_SCENARIO_CONTEXT_KEY } from "@/lib/aiScenarioContext";

// Same SSR-safe external-store pattern used by the Intervention Lab / Twin
// handoffs -- avoids a hydration mismatch from reading sessionStorage
// during render.
function subscribe() {
  return () => {};
}

function getSnapshot(): string | null {
  try {
    return sessionStorage.getItem(AI_SCENARIO_CONTEXT_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useAiScenarioContext(): AiScenarioContext | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiScenarioContext;
  } catch {
    return null;
  }
}
