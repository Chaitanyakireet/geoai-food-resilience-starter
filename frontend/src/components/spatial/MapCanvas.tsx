"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, ScaleControl, Tooltip, useMap } from "react-leaflet";
import type { Layer, LeafletMouseEvent, Map as LeafletMap, Path } from "leaflet";
import type {
  DistrictFeature,
  DistrictsFeatureCollection,
  MandalsFeatureCollection,
  MarketNode,
  RiskResult,
  StateBoundaryFeatureCollection,
} from "@/lib/api";
import { riskClassColorVar } from "@/components/RiskBadge";

// react-leaflet's GeoJSON typings expect the standard `geojson` package
// shapes; our API types are structurally compatible (real GeoJSON from the
// backend) but not nominally typed as such, so the `data`/`style`/
// `onEachFeature` interop points below are intentionally loosely typed.
/* eslint-disable @typescript-eslint/no-explicit-any */

const TELANGANA_CENTER: [number, number] = [17.9, 79.3];
const TELANGANA_DEFAULT_ZOOM = 7;

function FitToBounds({ boundary }: { boundary: StateBoundaryFeatureCollection | null }) {
  const map = useMap();
  useEffect(() => {
    const bbox = boundary?.features[0]?.bbox;
    if (!bbox) return;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [16, 16] },
    );
  }, [boundary, map]);
  return null;
}

function FlyToTarget({ target }: { target: { lat: number; lon: number; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], target.zoom ?? 10, { duration: 0.6 });
  }, [target, map]);
  return null;
}

function MapRefBridge({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export function MapCanvas({
  boundary,
  districts,
  mandals,
  riskByDistrict,
  showRisk,
  showMarkets,
  markets,
  selectedDistrictId,
  selectedMandalId,
  hyderabadCentroid,
  flyTarget,
  onSelectDistrict,
  onSelectMandal,
  onMapReady,
}: {
  boundary: StateBoundaryFeatureCollection | null;
  districts: DistrictsFeatureCollection;
  mandals: MandalsFeatureCollection | null;
  riskByDistrict: Map<string, RiskResult>;
  showRisk: boolean;
  showMarkets: boolean;
  markets: MarketNode[] | null;
  selectedDistrictId: string | null;
  selectedMandalId: string | null;
  hyderabadCentroid: [number, number] | null;
  flyTarget: { lat: number; lon: number; zoom?: number } | null;
  onSelectDistrict: (districtId: string) => void;
  onSelectMandal: (mandalId: string) => void;
  onMapReady: (map: LeafletMap) => void;
}) {
  const districtStyle = useMemo(
    () =>
      (feature?: any) => {
        const id: string | undefined = feature?.properties?.district_id;
        const isSelected = id === selectedDistrictId;
        const risk = id ? riskByDistrict.get(id) : undefined;
        const fill = showRisk && risk ? riskClassColorVar(risk.risk_class) : "var(--text-muted)";
        return {
          color: isSelected ? "var(--accent)" : "var(--surface-1)",
          weight: isSelected ? 3 : 1,
          fillColor: fill,
          fillOpacity: showRisk ? 0.55 : 0.12,
        };
      },
    [riskByDistrict, selectedDistrictId, showRisk],
  );

  const onEachDistrict = useMemo(
    () =>
      (feature: DistrictFeature, layer: Layer) => {
        const id = feature.properties.district_id;
        const risk = riskByDistrict.get(id);
        layer.bindTooltip(
          `${feature.properties.name}${risk ? ` — ${risk.risk_class} (${risk.risk_score?.toFixed(2) ?? "n/a"})` : ""}`,
          { sticky: true },
        );
        layer.on({
          click: () => onSelectDistrict(id),
          mouseover: (e: LeafletMouseEvent) => {
            (e.target as Path).setStyle({ weight: 3, fillOpacity: showRisk ? 0.75 : 0.25 });
          },
          mouseout: (e: LeafletMouseEvent) => {
            (e.target as Path).setStyle(districtStyle(feature));
          },
        });
      },
    [riskByDistrict, onSelectDistrict, districtStyle, showRisk],
  );

  const mandalStyle = useMemo(
    () =>
      (feature?: any) => {
        const id: string | undefined = feature?.properties?.mandal_id;
        const isSelected = id === selectedMandalId;
        return {
          color: isSelected ? "var(--accent)" : "#ffffff",
          weight: isSelected ? 3 : 1,
          fillColor: "transparent",
          fillOpacity: 0,
          dashArray: "3,3",
        };
      },
    [selectedMandalId],
  );

  const onEachMandal = useMemo(
    () =>
      (feature: any, layer: Layer) => {
        const id = feature.properties.mandal_id;
        layer.bindTooltip(feature.properties.name, { sticky: true });
        layer.on({ click: () => onSelectMandal(id) });
      },
    [onSelectMandal],
  );

  const geoJsonKey = `districts-${selectedDistrictId}-${showRisk}-${riskByDistrict.size}`;
  const mandalKey = `mandals-${mandals?.features.length ?? 0}-${selectedMandalId}`;

  return (
    <MapContainer
      center={TELANGANA_CENTER}
      zoom={TELANGANA_DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%", background: "var(--page-plane)" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapRefBridge onReady={onMapReady} />
      <FitToBounds boundary={boundary} />
      <FlyToTarget target={flyTarget} />
      <ScaleControl position="bottomleft" imperial={false} />

      {boundary ? (
        <GeoJSON
          data={boundary as any}
          style={{ color: "var(--text-primary)", weight: 2, fillOpacity: 0, dashArray: "4,4" } as any}
          interactive={false}
        />
      ) : null}

      <GeoJSON key={geoJsonKey} data={districts as any} style={districtStyle as any} onEachFeature={onEachDistrict as any} />

      {mandals ? (
        <GeoJSON key={mandalKey} data={mandals as any} style={mandalStyle as any} onEachFeature={onEachMandal as any} />
      ) : null}

      {showMarkets && markets
        ? markets.map((m) => (
            <CircleMarker
              key={m.node_id}
              center={[m.lat, m.lon]}
              radius={5}
              pathOptions={{ color: "var(--cat-blue)", fillColor: "var(--cat-blue)", fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip>{m.name} (observed market)</Tooltip>
            </CircleMarker>
          ))
        : null}

      {hyderabadCentroid ? (
        <CircleMarker
          center={hyderabadCentroid}
          radius={8}
          pathOptions={{ color: "var(--status-serious)", fillColor: "var(--status-serious)", fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            Hyderabad — principal demand hub
          </Tooltip>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}
