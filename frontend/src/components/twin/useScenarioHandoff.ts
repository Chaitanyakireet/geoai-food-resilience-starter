"use client";

import { useSyncExternalStore } from "react";
import type { ScenarioHandoff } from "@/components/interventions/types";

const STORAGE_KEY = "interventionLab.scenarioHandoff";

// Same SSR-safe external-store pattern as TwinHandoffBanner -- avoids a
// hydration mismatch from reading sessionStorage in an effect.
function subscribe() {
  return () => {};
}

function getSnapshot(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

// Validated once at the boundary rather than defensively re-guarded at
// every consumer: a stale/incomplete object from a prior schema version
// (or manually edited sessionStorage) is treated as "no handoff" instead
// of a partially-valid one that could throw deep in a consumer (e.g.
// ScenarioContextHeader reads geo_id/food_category/shock_field/severity/
// draft_interventions unguarded, matching the contract this validates).
function isValidHandoff(value: unknown): value is ScenarioHandoff {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.geo_id === "string" &&
    typeof v.food_category === "string" &&
    typeof v.shock_field === "string" &&
    typeof v.severity === "number" &&
    Array.isArray(v.draft_interventions)
  );
}

export function useScenarioHandoff(): ScenarioHandoff | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidHandoff(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
