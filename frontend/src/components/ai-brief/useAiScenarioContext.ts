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

// Every field but geo_id is optional in AiScenarioContext, and consumers
// already gate on context?.geo_id before reading anything else -- but
// geo_id itself must actually be a string (not, say, a stale number or
// object from a corrupted/future schema) or `.replace(...)` calls on it
// would throw deep in a consumer.
function isValidContext(value: unknown): value is AiScenarioContext {
  if (!value || typeof value !== "object") return false;
  const geoId = (value as Record<string, unknown>).geo_id;
  return geoId === undefined || typeof geoId === "string";
}

export function useAiScenarioContext(): AiScenarioContext | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidContext(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
