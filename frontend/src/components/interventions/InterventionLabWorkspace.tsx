"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  postOptimizationRun,
  postPortfolio,
  postShock,
  type ApiError,
  type Constraints,
  type DistrictsFeatureCollection,
  type InterventionCatalog,
  type OptimizationResult,
  type PortfolioResult,
  type ShockResult,
} from "@/lib/api";
import { buildGraphShockInput, withGraphShockField, type GraphShockField } from "@/lib/shockMapping";
import { persistAiScenarioContext, scenarioHandoffToAiContext } from "@/lib/aiScenarioContext";
import { readAndClearNetworkInterventionHandoff } from "@/lib/networkHandoff";
import { ScenarioControls } from "./ScenarioControls";
import { ShockComposer } from "./ShockComposer";
import { ShockResultPanel } from "./ShockResultPanel";
import { InterventionCatalogPanel } from "./InterventionCatalogPanel";
import { PortfolioPanel } from "./PortfolioPanel";
import { CarbonImpactPanel } from "@/components/CarbonImpactPanel";
import { SimulationResultPanel } from "./SimulationResultPanel";
import { OptimizationResultPanel } from "./OptimizationResultPanel";
import { ActionBar } from "./ActionBar";
import type { DraftIntervention, ScenarioHandoff } from "./types";
import styles from "./InterventionLabWorkspace.module.css";

export function InterventionLabWorkspace({
  districts,
  foodCategories,
  catalog,
}: {
  districts: DistrictsFeatureCollection;
  foodCategories: string[];
  catalog: InterventionCatalog;
}) {
  const router = useRouter();

  const [geoId, setGeoId] = useState("hyderabad");
  const [foodCategory, setFoodCategory] = useState("all_food");

  const [shockField, setShockField] = useState<GraphShockField>("production_disruption");
  const [severity, setSeverity] = useState(0.4);
  const [maxHops, setMaxHops] = useState(5);
  const [heatChangeC, setHeatChangeC] = useState<number | undefined>(undefined);
  const [rainfallChangePct, setRainfallChangePct] = useState<number | undefined>(undefined);

  const [shockResult, setShockResult] = useState<ShockResult | null>(null);
  const [shockError, setShockError] = useState<ApiError | null>(null);
  const [shockLoading, setShockLoading] = useState(false);

  const [draft, setDraft] = useState<DraftIntervention[]>([]);
  const [constraints, setConstraints] = useState<Constraints>({});

  const [portfolioResult, setPortfolioResult] = useState<PortfolioResult | null>(null);
  const [portfolioError, setPortfolioError] = useState<ApiError | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [optimizationError, setOptimizationError] = useState<ApiError | null>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);

  const [resultTab, setResultTab] = useState<"simulate" | "optimize">("simulate");
  const [prefilledFromNetwork, setPrefilledFromNetwork] = useState(false);

  useEffect(() => {
    // Reading and clearing a one-shot sessionStorage handoff is a genuine
    // external-system sync, but the resulting setState calls are deferred
    // to a microtask so they aren't direct statements in the effect body
    // (matches the pattern already used for other session-storage reads).
    queueMicrotask(() => {
      const handoff = readAndClearNetworkInterventionHandoff();
      if (!handoff || !handoff.geo_id) return;
      setGeoId(handoff.geo_id);
      if (handoff.food_category) setFoodCategory(handoff.food_category);
      if (handoff.shock_field) setShockField(handoff.shock_field as GraphShockField);
      if (handoff.severity !== undefined) setSeverity(handoff.severity);
      if (handoff.max_hops !== undefined) setMaxHops(handoff.max_hops);
      setPrefilledFromNetwork(true);
    });
  }, []);

  const invalidateDownstream = () => {
    setPortfolioResult(null);
    setPortfolioError(null);
    setOptimizationResult(null);
    setOptimizationError(null);
  };

  const runShock = async () => {
    setShockLoading(true);
    setShockError(null);
    invalidateDownstream();
    const request = withGraphShockField(
      {
        geo_id: geoId,
        food_category: foodCategory,
        heat_change_c: heatChangeC,
        rainfall_change_pct: rainfallChangePct,
        max_hops: maxHops,
      },
      shockField,
      severity,
    );
    const { data, error } = await postShock(request);
    setShockResult(data);
    setShockError(error);
    setShockLoading(false);
  };

  const addDraft = (item: DraftIntervention) => {
    setDraft((prev) => [...prev.filter((d) => d.intervention_type !== item.intervention_type), item]);
  };

  const removeDraft = (interventionType: string) => {
    setDraft((prev) => prev.filter((d) => d.intervention_type !== interventionType));
  };

  const canSimulate = shockResult !== null && draft.length > 0;
  const canOptimize = shockResult !== null && draft.length > 0;

  const runSimulate = async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    setResultTab("simulate");
    const shock = buildGraphShockInput(geoId, shockField, severity, maxHops);
    const { data, error } = await postPortfolio({
      interventions: draft.map((d) => ({ ...d, shock })),
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    });
    setPortfolioResult(data);
    setPortfolioError(error);
    setPortfolioLoading(false);
  };

  const runOptimize = async () => {
    setOptimizationLoading(true);
    setOptimizationError(null);
    setResultTab("optimize");
    const shock = buildGraphShockInput(geoId, shockField, severity, maxHops);
    const { data, error } = await postOptimizationRun({
      shock,
      candidate_interventions: draft,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    });
    setOptimizationResult(data);
    setOptimizationError(error);
    setOptimizationLoading(false);
  };

  const canSendToTwin = portfolioResult !== null || optimizationResult !== null;

  const sendToTwin = () => {
    const handoff: ScenarioHandoff = {
      source: "intervention-lab",
      geo_id: geoId,
      food_category: foodCategory,
      shock_field: shockField,
      severity,
      max_hops: maxHops,
      heat_change_c: heatChangeC,
      rainfall_change_pct: rainfallChangePct,
      draft_interventions: draft,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      shock_result_summary: shockResult
        ? { risk_class: shockResult.shocked_risk?.risk_class, resilience_gap: shockResult.shocked_resilience.resilience_gap }
        : null,
      portfolio_result_summary: portfolioResult
        ? { food_availability_effect_proxy: portfolioResult.combined_food_availability_effect_proxy, total_cost_estimate: portfolioResult.total_cost_estimate }
        : null,
      optimization_result_summary: optimizationResult
        ? { selected_intervention_types: optimizationResult.selected_candidate?.intervention_types ?? null, feasible_candidate_count: optimizationResult.feasible_candidate_count }
        : null,
      created_at: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem("interventionLab.scenarioHandoff", JSON.stringify(handoff));
    } catch {
      // sessionStorage unavailable (private browsing etc.) -- navigate anyway, twin page just won't show the banner
    }
    persistAiScenarioContext(scenarioHandoffToAiContext(handoff));
    router.push("/twin");
  };

  return (
    <div className={styles.workspace}>
      {prefilledFromNetwork ? (
        <div className="card" style={{ padding: "10px 16px", marginBottom: 12, fontSize: 12.5, color: "var(--text-secondary)" }}>
          Geography, food scope, shock type and severity were carried over from the Food Network workspace — nothing
          re-entered.
        </div>
      ) : null}
      <div className={styles.columns}>
        <div className={styles.left}>
          <ScenarioControls
            districts={districts}
            geoId={geoId}
            onGeoIdChange={(id) => {
              setGeoId(id);
              setShockResult(null);
              invalidateDownstream();
            }}
            foodCategories={foodCategories}
            foodCategory={foodCategory}
            onFoodCategoryChange={setFoodCategory}
          />
        </div>

        <div className={styles.center}>
          <ShockComposer
            shockField={shockField}
            onShockFieldChange={(f) => {
              setShockField(f);
              invalidateDownstream();
            }}
            severity={severity}
            onSeverityChange={setSeverity}
            maxHops={maxHops}
            onMaxHopsChange={setMaxHops}
            heatChangeC={heatChangeC}
            onHeatChangeChange={setHeatChangeC}
            rainfallChangePct={rainfallChangePct}
            onRainfallChangeChange={setRainfallChangePct}
            onRun={runShock}
            loading={shockLoading}
          />
          <ShockResultPanel result={shockResult} error={shockError} loading={shockLoading} />
          <InterventionCatalogPanel catalog={catalog} shockField={shockField} draft={draft} onAdd={addDraft} />
        </div>

        <div className={styles.right}>
          <PortfolioPanel draft={draft} onRemove={removeDraft} constraints={constraints} onConstraintsChange={setConstraints} />
          <CarbonImpactPanel districts={districts} geoId={geoId} draft={draft} />

          <div className={styles.tabs}>
            <button type="button" className={resultTab === "simulate" ? styles.tabActive : styles.tab} onClick={() => setResultTab("simulate")}>
              Simulate
            </button>
            <button type="button" className={resultTab === "optimize" ? styles.tabActive : styles.tab} onClick={() => setResultTab("optimize")}>
              Optimize
            </button>
          </div>

          {resultTab === "simulate" ? (
            <SimulationResultPanel shockResult={shockResult} result={portfolioResult} error={portfolioError} loading={portfolioLoading} />
          ) : (
            <OptimizationResultPanel result={optimizationResult} error={optimizationError} loading={optimizationLoading} />
          )}
        </div>
      </div>

      <ActionBar
        canSimulate={canSimulate}
        simulating={portfolioLoading}
        onSimulate={runSimulate}
        canOptimize={canOptimize}
        optimizing={optimizationLoading}
        onOptimize={runOptimize}
        canSendToTwin={canSendToTwin}
        onSendToTwin={sendToTwin}
      />
    </div>
  );
}
