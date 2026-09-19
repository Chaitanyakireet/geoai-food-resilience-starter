"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  getGraphOverview,
  getLocationLookup,
  getMandals,
  getMarketNodes,
  getRiskForGeo,
  type BottleneckEntry,
  type DistrictsFeatureCollection,
  type GraphOverviewResponse,
  type MandalsFeatureCollection,
  type MarketNode,
  type RiskResult,
  type RiskStateResponse,
  type StateBoundaryFeatureCollection,
} from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import { LayerControl } from "./LayerControl";
import { SearchBox } from "./SearchBox";
import { LocationPanel, type Selection } from "./LocationPanel";
import { ProvenanceDrawer } from "./ProvenanceDrawer";
import { TemporalNote } from "./TemporalNote";
import { RiskSummaryDonut, type DonutSegment } from "@/components/RiskSummaryDonut";
import styles from "./SpatialWorkspace.module.css";

const MapCanvas = dynamic(() => import("./MapCanvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

export function SpatialWorkspace({
  districts,
  boundary,
  riskState,
  graphOverview,
}: {
  districts: DistrictsFeatureCollection;
  boundary: StateBoundaryFeatureCollection | null;
  riskState: RiskStateResponse | null;
  graphOverview: GraphOverviewResponse | null;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mandalsByDistrict, setMandalsByDistrict] = useState<Map<string, MandalsFeatureCollection | null>>(new Map());
  const [mandalsLoadingFor, setMandalsLoadingFor] = useState<string | null>(null);
  const [riskByMandalId, setRiskByMandalId] = useState<Map<string, RiskResult | null>>(new Map());
  const [mandalRiskLoading, setMandalRiskLoading] = useState<string | null>(null);
  const [showRisk, setShowRisk] = useState(riskState !== null);
  const [showMarkets, setShowMarkets] = useState(false);
  const [markets, setMarkets] = useState<MarketNode[] | null | undefined>(undefined);
  const [bottlenecks, setBottlenecks] = useState<BottleneckEntry[] | null | undefined>(undefined);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const riskByDistrict = useMemo(() => {
    const map = new Map<string, RiskResult>();
    riskState?.districts.forEach((d) => map.set(d.region_id, d));
    return map;
  }, [riskState]);

  const districtById = useMemo(() => {
    const map = new Map<string, DistrictsFeatureCollection["features"][number]>();
    districts.features.forEach((f) => map.set(f.properties.district_id, f));
    return map;
  }, [districts]);

  const hyderabadCentroid = useMemo((): [number, number] | null => {
    const f = districtById.get("hyderabad");
    return f ? [f.properties.centroid_lat, f.properties.centroid_lon] : null;
  }, [districtById]);

  // Hyderabad is the platform's principal demand hub, so its urban-core
  // places (Secunderabad, Quthbullapur, Kukatpally, Malkajgiri, Alwal,
  // Hitech City/Gachibowli via Serilingampalle, ...) should be searchable
  // immediately, not only after the district is clicked -- these three
  // districts (Hyderabad + the post-2016 Medchal-Malkajgiri split + Ranga
  // Reddy, which holds the western IT-corridor mandals) cover the real
  // Hyderabad metro mandals already in the dataset.
  useEffect(() => {
    for (const districtId of ["hyderabad", "medchalmalkajgiri", "ranga_reddy"]) {
      if (districtById.has(districtId)) {
        getMandals(districtId).then((result) => {
          setMandalsByDistrict((prev) => (prev.has(districtId) ? prev : new Map(prev).set(districtId, result)));
        });
      }
    }
  }, [districtById]);

  const ensureBottlenecks = useCallback(() => {
    if (bottlenecks !== undefined) return;
    setBottlenecks(null); // mark as "loading" (avoid duplicate fetches) then replace
    getGraphOverview().then((g) => setBottlenecks(g ? g.bottlenecks : null));
  }, [bottlenecks]);

  const selectDistrict = useCallback(
    (districtId: string) => {
      const feature = districtById.get(districtId);
      if (!feature) return;
      setSelection({ kind: "district", districtId, name: feature.properties.name });
      setFlyTarget({ lat: feature.properties.centroid_lat, lon: feature.properties.centroid_lon, zoom: 9 });
      ensureBottlenecks();

      if (!mandalsByDistrict.has(districtId)) {
        setMandalsLoadingFor(districtId);
        getMandals(districtId).then((result) => {
          setMandalsByDistrict((prev) => new Map(prev).set(districtId, result));
          setMandalsLoadingFor(null);
        });
      }
    },
    [districtById, mandalsByDistrict, ensureBottlenecks],
  );

  const selectMandal = useCallback(
    (mandalId: string, districtIdHint?: string) => {
      const districtId =
        districtIdHint ?? [...mandalsByDistrict.entries()].find(([, fc]) => fc?.features.some((f) => f.properties.mandal_id === mandalId))?.[0];
      if (!districtId) return;
      const collection = mandalsByDistrict.get(districtId);
      const feature = collection?.features.find((f) => f.properties.mandal_id === mandalId);
      if (!feature) return;

      if (selection?.kind !== "district" || selection.districtId !== districtId) {
        // Selecting a mandal from search before its district is the active map selection.
        const districtFeature = districtById.get(districtId);
        if (districtFeature && !mandalsByDistrict.has(districtId)) {
          setMandalsLoadingFor(districtId);
          getMandals(districtId).then((result) => {
            setMandalsByDistrict((prev) => new Map(prev).set(districtId, result));
            setMandalsLoadingFor(null);
          });
        }
      }

      setSelection({
        kind: "mandal",
        mandalId,
        name: feature.properties.name,
        districtId,
        districtName: feature.properties.district_name,
      });
      setFlyTarget({ lat: feature.properties.centroid_lat, lon: feature.properties.centroid_lon, zoom: 11 });
      ensureBottlenecks();

      if (!riskByMandalId.has(mandalId)) {
        setMandalRiskLoading(mandalId);
        getRiskForGeo(mandalId).then((result) => {
          setRiskByMandalId((prev) => new Map(prev).set(mandalId, result));
          setMandalRiskLoading(null);
        });
      }
    },
    [mandalsByDistrict, districtById, selection, riskByMandalId, ensureBottlenecks],
  );

  const handleToggleMarkets = useCallback(
    (v: boolean) => {
      setShowMarkets(v);
      if (v && markets === undefined) {
        setMarkets(null);
        getMarketNodes().then(setMarkets);
      }
    },
    [markets],
  );

  const handleCoordinateLookup = useCallback(
    async (lon: number, lat: number) => {
      setLookupError(null);
      const result = await getLocationLookup(lon, lat);
      if (!result || !result.resolved || !result.district) {
        setLookupError("Coordinates did not resolve to a Telangana district.");
        return;
      }
      selectDistrict(result.district.district_id);
      if (result.mandal) {
        const mandalId = result.mandal.mandal_id;
        // Mandals for this district may still be loading; wait for them once, then select.
        const existing = mandalsByDistrict.get(result.district.district_id);
        if (existing) {
          selectMandal(mandalId, result.district.district_id);
        } else {
          const fetched = await getMandals(result.district.district_id);
          setMandalsByDistrict((prev) => new Map(prev).set(result.district!.district_id, fetched));
          if (fetched?.features.some((f) => f.properties.mandal_id === mandalId)) {
            selectMandal(mandalId, result.district.district_id);
          }
        }
      }
    },
    [selectDistrict, selectMandal, mandalsByDistrict],
  );

  const resetToStateView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const stateBbox = boundary?.features[0]?.bbox;
    if (stateBbox) {
      const [minLon, minLat, maxLon, maxLat] = stateBbox;
      map.fitBounds(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { padding: [40, 40] },
      );
      return;
    }
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const f of districts.features) {
      const [a, b, c, d] = f.bbox;
      minLon = Math.min(minLon, a);
      minLat = Math.min(minLat, b);
      maxLon = Math.max(maxLon, c);
      maxLat = Math.max(maxLat, d);
    }
    if (Number.isFinite(minLon)) {
      map.fitBounds(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { padding: [40, 40] },
      );
    }
  }, [boundary, districts]);

  // Every mandal loaded so far (eagerly for the Hyderabad-metro districts,
  // or on demand once a district is clicked) is shown on the map at once,
  // not just the currently-selected district's -- otherwise "major places"
  // like Secunderabad or Serilingampalle only became visible after already
  // knowing to click into their district first.
  const visibleMandals: MandalsFeatureCollection = useMemo(() => {
    const features: MandalsFeatureCollection["features"] = [];
    for (const collection of mandalsByDistrict.values()) {
      if (collection) features.push(...collection.features);
    }
    return { type: "FeatureCollection", features };
  }, [mandalsByDistrict]);

  const featureCollectionValid = districts.type === "FeatureCollection" && Array.isArray(districts.features) && districts.features.length > 0;

  if (!featureCollectionValid) {
    return (
      <div className={`${styles.errorState} card`}>
        District boundary data is malformed or empty — cannot render the map. Check the /gis/districts response.
      </div>
    );
  }

  const sampleRisk = riskState?.districts[0];

  const riskCounts: Record<string, number> = { low: 0, moderate: 0, high: 0, severe: 0, insufficient_data: 0 };
  riskState?.districts.forEach((d) => {
    riskCounts[d.risk_class] = (riskCounts[d.risk_class] ?? 0) + 1;
  });

  const donutSegments: DonutSegment[] = [
    { key: "severe", label: "Severe", count: riskCounts.severe, colorVar: "var(--status-critical)" },
    { key: "high", label: "High", count: riskCounts.high, colorVar: "var(--status-serious)" },
    { key: "moderate", label: "Moderate", count: riskCounts.moderate, colorVar: "var(--status-warning)" },
    { key: "low", label: "Low", count: riskCounts.low, colorVar: "var(--status-good)" },
    { key: "insufficient_data", label: "Insufficient Data", count: riskCounts.insufficient_data, colorVar: "var(--status-neutral)" },
  ];

  const topRiskDistricts = [...(riskState?.districts ?? [])]
    .filter((d): d is RiskResult & { risk_score: number } => d.risk_score !== null)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  return (
    <div className={styles.page}>
    <div className={styles.workspace}>
      <div className={styles.mapArea}>
        <MapCanvas
          boundary={boundary}
          districts={districts}
          mandals={visibleMandals}
          riskByDistrict={riskByDistrict}
          showRisk={showRisk}
          showMarkets={showMarkets}
          markets={markets ?? null}
          selectedDistrictId={selection?.districtId ?? null}
          selectedMandalId={selection?.kind === "mandal" ? selection.mandalId : null}
          hyderabadCentroid={hyderabadCentroid}
          flyTarget={flyTarget}
          onSelectDistrict={selectDistrict}
          onSelectMandal={(id) => selectMandal(id)}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
        />

        <div className={styles.topLeftControls}>
          <SearchBox
            districts={districts}
            loadedMandals={
              new Map([...mandalsByDistrict.entries()].filter((entry): entry is [string, MandalsFeatureCollection] => entry[1] !== null))
            }
            onSelectDistrict={selectDistrict}
            onSelectMandal={(districtId, mandalId) => selectMandal(mandalId, districtId)}
          />
        </div>

        <div className={styles.topRightControls}>
          <LayerControl
            showRisk={showRisk}
            onToggleRisk={setShowRisk}
            showMarkets={showMarkets}
            onToggleMarkets={handleToggleMarkets}
            marketsAvailable
          />
          <button type="button" className={styles.resetViewBtn} onClick={resetToStateView} title="Fit the map to the whole Telangana extent">
            ⤢ Whole State
          </button>
        </div>

        <div className={styles.bottomLeftControls}>
          <TemporalNote
            requestedDays={sampleRisk?.data_coverage.requested_days}
            availableDays={sampleRisk?.data_coverage.available_days}
            date={sampleRisk?.date}
          />
        </div>

        <CoordinateLookup onLookup={handleCoordinateLookup} error={lookupError} />

        <button type="button" className={styles.provenanceLauncher} onClick={() => setProvenanceOpen(true)}>
          Provenance
        </button>

        {!riskState ? (
          <div className={styles.riskUnavailableBanner}>
            Risk service unavailable — showing administrative boundaries only.
          </div>
        ) : null}
      </div>

      {selection ? (
        <LocationPanel
          selection={selection}
          risk={
            selection.kind === "district"
              ? riskByDistrict.get(selection.districtId) ?? null
              : mandalRiskLoading === selection.mandalId
                ? undefined
                : (riskByMandalId.get(selection.mandalId) ?? null)
          }
          riskLoading={
            selection.kind === "mandal" && mandalRiskLoading === selection.mandalId
          }
          bottlenecks={bottlenecks ?? null}
          onClose={() => setSelection(null)}
          onOpenProvenance={() => setProvenanceOpen(true)}
        />
      ) : null}

      <ProvenanceDrawer open={provenanceOpen} onClose={() => setProvenanceOpen(false)} />

      {mandalsLoadingFor ? <div className={styles.mandalLoadingToast}>Loading mandal boundaries…</div> : null}
    </div>

    <div className={styles.bottomGrid}>
      <div className={`${styles.bottomCard} card`}>
        <div className={styles.bottomCardTitle}>State Risk Summary</div>
        <div className={styles.donutRow}>
          <RiskSummaryDonut
            segments={donutSegments}
            centerValue={riskState?.mean_risk_score != null ? riskState.mean_risk_score.toFixed(2) : "—"}
            centerLabel="Mean Risk"
          />
          <ul className={styles.donutLegend}>
            {donutSegments.map((s) => (
              <li key={s.key}>
                <span className={styles.donutLegendDot} style={{ background: s.colorVar }} />
                <span className={styles.donutLegendCount}>{s.count}</span>
                <span className={styles.donutLegendLabel}>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`${styles.bottomCard} card`}>
        <div className={styles.bottomCardTitle}>Top Risk Districts</div>
        {topRiskDistricts.length > 0 ? (
          <ol className={styles.rankList}>
            {topRiskDistricts.map((d, i) => (
              <li key={d.region_id}>
                <span className={styles.rankNumber}>{i + 1}</span>
                <span className={styles.rankName}>{d.region_id.replace(/_/g, " ")}</span>
                <RiskBadge riskClass={d.risk_class} />
                <span className={styles.rankScore}>{d.risk_score?.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="secondary">No scored districts available.</p>
        )}
      </div>

      <div className={`${styles.bottomCard} card`}>
        <div className={styles.bottomCardTitle}>Network State</div>
        {graphOverview ? (
          <ul className={styles.factList}>
            <li>
              <span className="muted">Nodes / edges</span>
              <span className={styles.factValue}>
                {graphOverview.summary.node_count} / {graphOverview.summary.edge_count}
              </span>
            </li>
            <li>
              <span className="muted">Structural bottlenecks</span>
              <span className={styles.factValue}>{graphOverview.bottlenecks.length}</span>
            </li>
            <li>
              <span className="muted">Connectivity</span>
              <span className={styles.factValue}>
                {graphOverview.summary.connectivity.is_weakly_connected
                  ? "Connected"
                  : `${graphOverview.summary.connectivity.weakly_connected_component_count} components`}
              </span>
            </li>
            <li>
              <span className="muted">Isolated nodes</span>
              <span className={styles.factValue}>{graphOverview.summary.connectivity.isolated_node_count}</span>
            </li>
          </ul>
        ) : (
          <p className="secondary">Graph service unavailable.</p>
        )}
      </div>

      <div className={`${styles.bottomCard} card`}>
        <div className={styles.bottomCardTitle}>Data & Provenance</div>
        <ul className={styles.factList}>
          <li>
            <span className="muted">Climate data</span>
            <span className={styles.factValue}>NASA POWER</span>
          </li>
          <li>
            <span className="muted">Boundaries</span>
            <span className={styles.factValue}>OpenStreetMap</span>
          </li>
          <li>
            <span className="muted">Analysis window</span>
            <span className={styles.factValue}>
              {sampleRisk ? `${sampleRisk.data_coverage.available_days}/${sampleRisk.data_coverage.requested_days} days` : "n/a"}
            </span>
          </li>
          <li>
            <span className="muted">Risk method</span>
            <span className={styles.factValue}>{riskState?.method ?? "n/a"}</span>
          </li>
        </ul>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 8, padding: "6px 0" }} onClick={() => setProvenanceOpen(true)}>
          Open full provenance record →
        </button>
      </div>
    </div>
    </div>
  );
}

function CoordinateLookup({ onLookup, error }: { onLookup: (lon: number, lat: number) => void; error: string | null }) {
  const [open, setOpen] = useState(false);
  const [lon, setLon] = useState("");
  const [lat, setLat] = useState("");

  return (
    <div className={styles.coordLookup}>
      <button type="button" className={styles.coordToggle} onClick={() => setOpen((v) => !v)}>
        {open ? "×" : "📍 Coordinates"}
      </button>
      {open ? (
        <form
          className={styles.coordForm}
          onSubmit={(e) => {
            e.preventDefault();
            const lonNum = parseFloat(lon);
            const latNum = parseFloat(lat);
            if (!Number.isNaN(lonNum) && !Number.isNaN(latNum)) onLookup(lonNum, latNum);
          }}
        >
          <input placeholder="Longitude (76-82)" value={lon} onChange={(e) => setLon(e.target.value)} />
          <input placeholder="Latitude (15.5-20)" value={lat} onChange={(e) => setLat(e.target.value)} />
          <button type="submit">Locate</button>
          {error ? <div className={styles.coordError}>{error}</div> : null}
        </form>
      ) : null}
    </div>
  );
}
