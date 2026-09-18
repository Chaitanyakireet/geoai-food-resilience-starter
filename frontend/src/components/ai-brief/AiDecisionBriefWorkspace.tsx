"use client";

import { useEffect, useState } from "react";
import {
  getAiProvenance,
  postAiDecisionBrief,
  postAiQuery,
  type AiQueryOutput,
  type AiScenarioContext,
  type AiToolCallRecord,
  type ApiError,
  type DecisionBriefOutput,
  type DistrictsFeatureCollection,
  type EvidenceItem,
} from "@/lib/api";
import { persistAiScenarioContext } from "@/lib/aiScenarioContext";
import { useAiScenarioContext } from "./useAiScenarioContext";
import { ScenarioContextBar } from "./ScenarioContextBar";
import { DecisionBriefView } from "./DecisionBriefView";
import { ConversationTurn } from "./ConversationTurn";
import { Composer } from "./Composer";
import { ToolTraceSidebar } from "./ToolTraceSidebar";
import styles from "./AiDecisionBriefWorkspace.module.css";

type ConversationEntry = { question: string; output: AiQueryOutput | { error: string } };
type SidebarSource = { toolTrace: AiToolCallRecord[]; citations: EvidenceItem[]; label: string };

export function AiDecisionBriefWorkspace({ districts }: { districts: DistrictsFeatureCollection }) {
  const handoffContext = useAiScenarioContext();
  const [manualContext, setManualContext] = useState<AiScenarioContext | null>(null);
  const context = manualContext ?? handoffContext;

  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [providerName, setProviderName] = useState<string | null>(null);

  const [brief, setBrief] = useState<DecisionBriefOutput | null>(null);
  const [briefError, setBriefError] = useState<ApiError | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [asking, setAsking] = useState(false);

  const [sidebar, setSidebar] = useState<SidebarSource>({ toolTrace: [], citations: [], label: "No operation run yet." });

  useEffect(() => {
    getAiProvenance().then((prov) => {
      setProviderConfigured(prov?.provider.configured ?? false);
      setProviderName(prov?.provider.name ?? null);
    });
  }, []);

  const generateBrief = async () => {
    if (!context?.geo_id) return;
    setBriefLoading(true);
    setBriefError(null);
    const { data, error } = await postAiDecisionBrief(context);
    setBrief(data);
    setBriefError(error);
    setBriefLoading(false);
    if (data) {
      setSidebar({ toolTrace: data.tool_trace, citations: data.citations, label: "Decision Brief" });
    }
  };

  const ask = async (question: string) => {
    setAsking(true);
    const { data, error } = await postAiQuery(question, context ?? undefined);
    if (data) {
      setConversation((prev) => [...prev, { question, output: data }]);
      setSidebar({ toolTrace: data.tool_trace, citations: data.citations, label: `“${question}”` });
    } else {
      setConversation((prev) => [...prev, { question, output: { error: error?.detail ?? "Request failed." } }]);
    }
    setAsking(false);
  };

  const handlePickGeo = (geoId: string) => {
    const ctx: AiScenarioContext = { geo_id: geoId, food_category: "all_food" };
    setManualContext(ctx);
    persistAiScenarioContext(ctx);
  };

  return (
    <div className={styles.workspace}>
      <ScenarioContextBar
        context={context}
        districts={districts}
        providerConfigured={providerConfigured}
        providerName={providerName}
        onGenerateBrief={generateBrief}
        generating={briefLoading}
        onPickGeo={handlePickGeo}
      />

      <div className={styles.mainGrid}>
        <div className={styles.main}>
          <DecisionBriefView brief={brief} error={briefError} loading={briefLoading} />

          {conversation.length > 0 ? (
            <div className={`${styles.conversationCard} card`}>
              <div className={styles.conversationTitle}>Copilot conversation</div>
              {conversation.map((entry, i) => (
                <ConversationTurn key={i} question={entry.question} output={entry.output} />
              ))}
            </div>
          ) : null}

          <Composer onAsk={ask} asking={asking} hasContext={!!context?.geo_id} />
        </div>

        <div className={styles.side}>
          <ToolTraceSidebar toolTrace={sidebar.toolTrace} citations={sidebar.citations} label={sidebar.label} />
        </div>
      </div>
    </div>
  );
}
