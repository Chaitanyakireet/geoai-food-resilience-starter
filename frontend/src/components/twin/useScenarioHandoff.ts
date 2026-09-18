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

export function useScenarioHandoff(): ScenarioHandoff | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScenarioHandoff;
  } catch {
    return null;
  }
}
