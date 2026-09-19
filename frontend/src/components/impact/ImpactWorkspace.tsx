"use client";

import { useEffect, useState } from "react";
import {
  getRiskForGeo,
  postTwinCompare,
  postTwinRun,
  type ApiError,
  type CompareWorldsResult,
  type DistrictsFeatureCollection,
  type ProvenanceResponse,
  type RiskResult,
  type TwinResult,
} from "@/lib/api";
import { aiContextToTwinScenario } from "@/lib/aiScenarioContext";
import { useAiScenarioContext } from "@/components/ai-brief/useAiScenarioContext";
import { CompareWorldsPanel } from "@/components/twin/CompareWorldsPanel";
import { CarbonImpactPanel } from "@/components/CarbonImpactPanel";
import { ScenarioContextStrip } from "./ScenarioContextStrip";
import { TruthStatusStrip } from "./TruthStatusStrip";
import { ImpactSummaryPanel } from "./ImpactSummaryPanel";
import { SdgFramework } from "./SdgFramework";
import { ConfidenceDataCoverage } from "./ConfidenceDataCoverage";
import { ProvenancePanel } from "./ProvenancePanel";
import { ResponsibleAiChecklist } from "./ResponsibleAiChecklist";
import { HumanReviewPanel } from "./HumanReviewPanel";
import { ImpactTrace } from "./ImpactTrace";
import { AuthorSection } from "./AuthorSection";
import { scenarioFingerprint, useReviewState } from "./useReviewState";
import styles from "./ImpactWorkspace.module.css";

type ProvenanceBundle = {
  gis: ProvenanceResponse | null;
  risk: ProvenanceResponse | null;
  graph: ProvenanceResponse | null;
  intervention: Record<string, unknown> | null;
  optimization: Record<string, unknown> | null;
  twin: Record<string, unknown> | null;
  ai: {
    provider: { name: string; configured: boolean };
    approved_tools: string[];
    evidence_corpus: { document_count: number };
    truth_status_discipline: string[];
    limitations: string[];
  } | null;
};

export function ImpactWorkspace({ provenance, districts }: { provenance: ProvenanceBundle; districts: DistrictsFeatureCollection | null }) {
  const context = useAiScenarioContext();

  const [twinResult, setTwinResult] = useState<TwinResult | null>(null);
  const [twinError, setTwinError] = useState<ApiError | null>(null);
  const [twinLoading, setTwinLoading] = useState(false);

  const [compareResult, setCompareResult] = useState<CompareWorldsResult | null>(null);
  const [compareError, setCompareError] = useState<ApiError | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);

  const fingerprint = scenarioFingerprint(context);
  const { record, markReviewed, clearReview } = useReviewState(fingerprint);

  useEffect(() => {
    const scenario = aiContextToTwinScenario(context ?? {});
    if (!scenario) {
      // No geo_id yet -- state is already null from useState's initial value,
      // nothing to synchronize.
      return;
    }

    // All setState calls below live inside this nested async function (a
    // callback, not the effect's own direct body) so "start loading" and
    // "apply result" are both legitimate reactions to the fetch, not a
    // synchronous effect-body mutation.
    (async () => {
      setTwinLoading(true);
      const { data, error } = await postTwinRun(scenario);
      setTwinResult(data);
      setTwinError(error);
      setTwinLoading(false);
    })();

    getRiskForGeo(scenario.geo_id).then(setRiskResult);

    (async () => {
      if (scenario.shock && (scenario.intervention_portfolio || scenario.optimize_candidates)) {
        setCompareLoading(true);
        const { data, error } = await postTwinCompare(scenario);
        setCompareResult(data);
        setCompareError(error);
        setCompareLoading(false);
      } else {
        setCompareResult(null);
        setCompareError(null);
      }
    })();
    // fingerprint captures every field of `context` that matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const headline = twinResult ? (twinResult.optimized_state ?? twinResult.intervention_state ?? twinResult.shocked_state ?? twinResult.baseline_state) : null;

  return (
    <div className={styles.workspace}>
      <ScenarioContextStrip context={context} />

      <ImpactTrace context={context} hasImpactResult={!!twinResult} reviewed={!!record} />

      <ImpactSummaryPanel result={twinResult} error={twinError} loading={twinLoading} />

      <SdgFramework headline={headline} />

      <CompareWorldsPanel result={compareResult} error={compareError} loading={compareLoading} />

      {context?.geo_id && districts ? <CarbonImpactPanel districts={districts} geoId={context.geo_id} /> : null}

      <ConfidenceDataCoverage risk={riskResult} />

      <TruthStatusStrip />

      <ProvenancePanel
        gis={provenance.gis}
        risk={provenance.risk}
        graph={provenance.graph}
        intervention={provenance.intervention}
        optimization={provenance.optimization}
        twin={provenance.twin}
        ai={provenance.ai}
      />

      <ResponsibleAiChecklist />

      <HumanReviewPanel limitations={twinResult?.limitations ?? []} record={record} markReviewed={markReviewed} clearReview={clearReview} />

      <AuthorSection />
    </div>
  );
}
