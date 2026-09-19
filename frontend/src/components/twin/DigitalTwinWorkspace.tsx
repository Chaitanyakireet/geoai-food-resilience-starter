"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MiniRiskMap } from "@/components/MiniRiskMap";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getTwinConfig,
  postTwinCompare,
  postTwinRun,
  type ApiError,
  type CompareWorldsResult,
  type DistrictsFeatureCollection,
  type RiskResult,
  type RiskStateResponse,
  type TwinResult,
  type TwinScenarioRequest,
} from "@/lib/api";
import { useScenarioHandoff } from "./useScenarioHandoff";
import { ScenarioContextHeader } from "./ScenarioContextHeader";
import { WorldControls } from "./WorldControls";
import { TwinKpiPanel } from "./TwinKpiPanel";
import { RecoveryChart, type ChartSeries } from "./RecoveryChart";
import { RecoveryMetricsStrip } from "./RecoveryMetricsStrip";
import { CompareWorldsPanel } from "./CompareWorldsPanel";
import { CarbonImpactPanel } from "@/components/CarbonImpactPanel";
import { AssumptionsDrawer } from "./AssumptionsDrawer";
import { TwinActionBar } from "./TwinActionBar";
import { buildBaselineScenario, buildTwinScenarioFromHandoff, metricsForWorld, recoveryForWorld, stateForWorld, type WorldKey } from "./types";
import { persistAiScenarioContext, scenarioHandoffToAiContext } from "@/lib/aiScenarioContext";
import styles from "./DigitalTwinWorkspace.module.css";

export function DigitalTwinWorkspace({ districts, riskState }: { districts: DistrictsFeatureCollection; riskState: RiskStateResponse | null }) {
  const router = useRouter();
  const handoff = useScenarioHandoff();

  const [manualScenario, setManualScenario] = useState<TwinScenarioRequest | null>(null);
  const handoffScenario = useMemo(() => (handoff ? buildTwinScenarioFromHandoff(handoff) : null), [handoff]);
  const scenario = manualScenario ?? handoffScenario;

  const [twinResult, setTwinResult] = useState<TwinResult | null>(null);
  const [twinError, setTwinError] = useState<ApiError | null>(null);
  const [twinLoading, setTwinLoading] = useState(false);

  const [compareResult, setCompareResult] = useState<CompareWorldsResult | null>(null);
  const [compareError, setCompareError] = useState<ApiError | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [activeWorld, setActiveWorld] = useState<WorldKey>("shock");
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [recoveryThreshold, setRecoveryThreshold] = useState<number | undefined>(undefined);

  useEffect(() => {
    getTwinConfig().then((cfg) => {
      const model = cfg?.recovery_model as Record<string, number> | undefined;
      if (model?.recovery_threshold != null) setRecoveryThreshold(model.recovery_threshold);
    });
  }, []);

  const riskByDistrict = useMemo(() => {
    const map = new Map<string, RiskResult>();
    riskState?.districts.forEach((d) => map.set(d.region_id, d));
    return map;
  }, [riskState]);

  const runSimulation = async (overrideScenario?: TwinScenarioRequest) => {
    const s = overrideScenario ?? scenario;
    if (!s) return;
    setTwinLoading(true);
    setTwinError(null);
    setCompareResult(null);
    setCompareError(null);
    const { data, error } = await postTwinRun(s);
    setTwinResult(data);
    setTwinError(error);
    setTwinLoading(false);
    if (data) {
      setActiveWorld(data.optimized_state ? "optimized" : data.intervention_state ? "intervention" : data.shocked_state ? "shock" : "baseline");
    }
  };

  const runCompare = async () => {
    if (!scenario) return;
    setCompareLoading(true);
    setCompareError(null);
    const { data, error } = await postTwinCompare(scenario);
    setCompareResult(data);
    setCompareError(error);
    setCompareLoading(false);
  };

  const handlePickBaseline = (geoId: string, foodCategory: string) => {
    const s = buildBaselineScenario(geoId, foodCategory);
    setManualScenario(s);
    setTwinResult(null);
    setCompareResult(null);
    runSimulation(s);
  };

  const sendToBrief = () => {
    if (handoff) {
      persistAiScenarioContext(scenarioHandoffToAiContext(handoff));
    } else if (scenario) {
      persistAiScenarioContext({ geo_id: scenario.geo_id, food_category: scenario.food_category });
    }
    router.push("/ai-brief");
  };

  const currentGeoId = scenario?.geo_id ?? handoff?.geo_id;

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (!twinResult) return [];
    const series: ChartSeries[] = [];
    if (twinResult.shock_recovery) {
      series.push({
        key: "shock",
        label: "World A — no intervention",
        points: twinResult.shock_recovery.points,
        colorVar: "var(--cat-blue)",
        emphasize: activeWorld === "shock",
      });
    }
    const activeTrajectory = recoveryForWorld(twinResult, activeWorld);
    if (activeTrajectory && activeWorld !== "shock") {
      series.push({
        key: activeWorld,
        label: activeWorld === "optimized" ? "World B — optimized" : "Manual portfolio",
        points: activeTrajectory.points,
        colorVar: "var(--cat-aqua)",
        emphasize: true,
      });
    }
    return series;
  }, [twinResult, activeWorld]);

  return (
    <div className={styles.workspace}>
      <ScenarioContextHeader handoff={handoff} districts={districts} onRun={() => runSimulation()} running={twinLoading} onPickBaseline={handlePickBaseline} />

      {twinError ? (
        <div className={`${styles.errorBanner} card state-block-error`}>
          <div className="state-block-title">Simulation failed ({twinError.status || "network"})</div>
          <p className="secondary">{twinError.detail}</p>
        </div>
      ) : null}

      {twinResult ? (
        <div className={styles.mainGrid}>
          <div className={styles.center}>
            <div className={`${styles.chartCard} card`}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>
                  Recovery trajectory <StatusBadge status="SIMULATED" compact />
                </div>
                <p className={styles.chartSubnote}>Baseline → Shock → Intervention → Recovery, over the simulated horizon.</p>
              </div>
              {chartSeries.length > 0 ? (
                <RecoveryChart series={chartSeries} thresholdFraction={recoveryThreshold} />
              ) : (
                <p className="muted" style={{ padding: "40px 0", textAlign: "center" }}>
                  {activeWorld === "baseline" ? "Baseline has no shock — no recovery trajectory to display." : "No recovery trajectory available for this world."}
                </p>
              )}
              <RecoveryMetricsStrip metrics={metricsForWorld(twinResult, activeWorld)} />
            </div>
          </div>

          <div className={styles.side}>
            <WorldControls result={twinResult} active={activeWorld} onChange={setActiveWorld} />
            <TwinKpiPanel world={activeWorld} state={stateForWorld(twinResult, activeWorld)} />
            {currentGeoId && districts ? (
              <MiniRiskMap
                districts={districts}
                riskByDistrict={riskByDistrict}
                highlightDistrictId={currentGeoId}
                title="Selected geography"
                subtitle={`Scenario resolution: ${twinResult.geo_level}. District-centroid risk — mandal precision is not implied.`}
                showLink={false}
                showLegend={false}
                height={220}
              />
            ) : null}
          </div>
        </div>
      ) : twinLoading ? (
        <div className={`${styles.loadingBlock} card state-block`}>
          <div className="pulse state-block-title">Running simulation…</div>
        </div>
      ) : null}

      <CompareWorldsPanel result={compareResult} error={compareError} loading={compareLoading} />

      {currentGeoId && districts ? <CarbonImpactPanel districts={districts} geoId={currentGeoId} /> : null}

      <TwinActionBar
        canCompare={scenario !== null && twinResult !== null}
        comparing={compareLoading}
        onCompare={runCompare}
        onSendToBrief={sendToBrief}
        onOpenAssumptions={() => setAssumptionsOpen(true)}
      />

      <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} result={twinResult} />
    </div>
  );
}
