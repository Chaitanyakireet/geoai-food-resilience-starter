"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, ScaleControl, Tooltip, ZoomControl, useMap, useMapEvent } from "react-leaflet";
import L, { type DivIcon, type Layer, type LeafletMouseEvent, type Map as LeafletMap, type Path } from "leaflet";
import type {
  DistrictFeature,
  DistrictsFeatureCollection,
  MandalsFeatureCollection,
  MarketNode,
  RiskResult,
  StateBoundaryFeatureCollection,
} from "@/lib/api";
import { riskClassColorVar } from "@/components/RiskBadge";
import styles from "./MapCanvas.module.css";

// Zoom level from which mandal name labels appear -- below this the whole
// Hyderabad-metro mandal set (the only mandals eagerly loaded) would be a
// cluttered mass of overlapping text at whole-state zoom.
const MANDAL_LABEL_MIN_ZOOM = 8;

// A plain text label anchored at a lat/lon, built via textContent (not
// innerHTML) so a place name can never be interpreted as markup. Used for
// both district and mandal name labels, which are otherwise only shown on
// hover via the polygon's own tooltip.
function textLabelIcon(text: string, className: string): DivIcon {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return L.divIcon({ html: el, className: styles.labelIconReset, iconSize: [0, 0] });
}

// useMapEvent/useMap only work inside a child of <MapContainer>, not in
// MapCanvas's own body -- this tracker lives inside the map and lifts the
// current zoom up via a callback, same pattern as MapRefBridge below.
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useMapEvent("zoomend", (e) => onZoomChange(e.target.getZoom()));
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
}

// react-leaflet's GeoJSON typings expect the standard `geojson` package
// shapes; our API types are structurally compatible (real GeoJSON from the
// backend) but not nominally typed as such, so the `data`/`style`/
// `onEachFeature` interop points below are intentionally loosely typed.
/* eslint-disable @typescript-eslint/no-explicit-any */

const TELANGANA_CENTER: [number, number] = [17.9, 79.3];
const TELANGANA_DEFAULT_ZOOM = 7;
const STATE_FIT_PADDING: [number, number] = [40, 40];

// Prefers the real /gis/telangana state boundary bbox; falls back to the
// combined bbox of /gis/districts if the state boundary failed to load, so
// the initial view is still the whole real extent, never a hard-coded one.
function computeStateBounds(
  boundary: StateBoundaryFeatureCollection | null,
  districts: DistrictsFeatureCollection,
): [[number, number], [number, number]] | null {
  const stateBbox = boundary?.features[0]?.bbox;
  if (stateBbox) {
    const [minLon, minLat, maxLon, maxLat] = stateBbox;
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
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
  if (!Number.isFinite(minLon)) return null;
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

function FitToBounds({ boundary, districts }: { boundary: StateBoundaryFeatureCollection | null; districts: DistrictsFeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    const bounds = computeStateBounds(boundary, districts);
    if (!bounds) return;

    // Leaflet measures its container on init; if that happens while the
    // dynamically-imported map is still mid-mount (or its flex/grid parent
    // hasn't settled its final size yet), fitBounds computes against a
    // stale size and the initial view can end up wrong -- looking zoomed
    // into a fraction of the state rather than the whole thing. Forcing a
    // re-measure immediately and once more shortly after mount makes the
    // initial fit correct regardless of that race, without depending on
    // exact timing.
    map.invalidateSize();
    map.fitBounds(bounds, { padding: STATE_FIT_PADDING });
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: STATE_FIT_PADDING });
    }, 250);
    return () => clearTimeout(t);
  }, [boundary, districts, map]);
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
  const [zoom, setZoom] = useState(TELANGANA_DEFAULT_ZOOM);

  const districtLabelIcons = useMemo(
    () => new Map(districts.features.map((f) => [f.properties.district_id, textLabelIcon(f.properties.name, styles.districtLabel)])),
    [districts],
  );

  const mandalLabelIcons = useMemo(
    () => new Map((mandals?.features ?? []).map((f) => [f.properties.mandal_id, textLabelIcon(f.properties.name, styles.mandalLabel)])),
    [mandals],
  );

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
      maxZoom={18}
      style={{ height: "100%", width: "100%", background: "var(--page-plane)" }}
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      dragging
      zoomControl={false}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
      />
      <MapRefBridge onReady={onMapReady} />
      <ZoomTracker onZoomChange={setZoom} />
      <FitToBounds boundary={boundary} districts={districts} />
      <FlyToTarget target={flyTarget} />
      {/* The default topleft zoom control sits at the exact corner our
          custom SearchBox overlay occupies (.topLeftControls), silently
          hiding the +/- buttons underneath it -- this was the actual
          "can't zoom out" bug, not a config/logic restriction. Moving it
          to bottomright (clear of every other custom overlay) fixes it. */}
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomleft" imperial={false} />

      {boundary ? (
        <GeoJSON
          data={boundary as any}
          style={{ color: "var(--text-primary)", weight: 2, fillOpacity: 0, dashArray: "4,4" } as any}
          interactive={false}
        />
      ) : null}

      <GeoJSON key={geoJsonKey} data={districts as any} style={districtStyle as any} onEachFeature={onEachDistrict as any} />

      {districts.features.map((f) => {
        const icon = districtLabelIcons.get(f.properties.district_id);
        return icon ? (
          <Marker
            key={f.properties.district_id}
            position={[f.properties.centroid_lat, f.properties.centroid_lon]}
            icon={icon}
            interactive={false}
            keyboard={false}
          />
        ) : null;
      })}

      {mandals ? (
        <GeoJSON key={mandalKey} data={mandals as any} style={mandalStyle as any} onEachFeature={onEachMandal as any} />
      ) : null}

      {zoom >= MANDAL_LABEL_MIN_ZOOM
        ? (mandals?.features ?? []).map((f) => {
            const icon = mandalLabelIcons.get(f.properties.mandal_id);
            return icon ? (
              <Marker
                key={f.properties.mandal_id}
                position={[f.properties.centroid_lat, f.properties.centroid_lon]}
                icon={icon}
                interactive={false}
                keyboard={false}
              />
            ) : null;
          })
        : null}

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
