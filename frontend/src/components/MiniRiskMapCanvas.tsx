"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import type { DistrictsFeatureCollection, RiskResult } from "@/lib/api";
import { riskClassColorVar } from "@/components/RiskBadge";

/* eslint-disable @typescript-eslint/no-explicit-any -- react-leaflet's GeoJSON typings expect the standard
   `geojson` package shapes; our API types are structurally compatible (real GeoJSON from the backend) but
   not nominally typed as such. See spatial/MapCanvas.tsx for the same, established pattern. */

function FitToDistrictBounds({ districts, highlightDistrictId }: { districts: DistrictsFeatureCollection; highlightDistrictId?: string }) {
  const map = useMap();
  useEffect(() => {
    const target = highlightDistrictId ? districts.features.find((f) => f.properties.district_id === highlightDistrictId) : null;
    let bounds: [[number, number], [number, number]] | null = null;
    let padding: [number, number] = [8, 8];

    if (target?.bbox) {
      const [minLon, minLat, maxLon, maxLat] = target.bbox;
      bounds = [
        [minLat, minLon],
        [maxLat, maxLon],
      ];
      padding = [24, 24];
    } else {
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
        bounds = [
          [minLat, minLon],
          [maxLat, maxLon],
        ];
      }
    }

    if (!bounds) return;
    // Same container-sizing race guard as the main Spatial map: this
    // widget is often mounted inside a grid/card layout (Command Center,
    // Digital Twin, Food Network) where the flex/grid parent may not have
    // settled its final size the instant Leaflet first measures it.
    map.invalidateSize();
    map.fitBounds(bounds, { padding });
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds!, { padding });
    }, 250);
    return () => clearTimeout(t);
  }, [districts, highlightDistrictId, map]);
  return null;
}

export function MiniRiskMapCanvas({
  districts,
  riskByDistrict,
  highlightDistrictId,
  highlightDistrictIds,
  onSelectDistrict,
}: {
  districts: DistrictsFeatureCollection;
  riskByDistrict: Map<string, RiskResult>;
  highlightDistrictId?: string;
  highlightDistrictIds?: Set<string>;
  onSelectDistrict?: (districtId: string) => void;
}) {
  const districtStyle = useMemo(
    () =>
      (feature?: any) => {
        const id: string | undefined = feature?.properties?.district_id;
        const risk = id ? riskByDistrict.get(id) : undefined;
        const fill = risk ? riskClassColorVar(risk.risk_class) : "var(--status-neutral)";
        const highlighted = id === highlightDistrictId || (id !== undefined && highlightDistrictIds?.has(id));
        return {
          color: highlighted ? "var(--accent)" : "var(--surface-1)",
          weight: highlighted ? 2.5 : 0.7,
          fillColor: fill,
          fillOpacity: highlighted ? 0.85 : highlightDistrictId || (highlightDistrictIds && highlightDistrictIds.size > 0) ? 0.25 : 0.6,
        };
      },
    [riskByDistrict, highlightDistrictId, highlightDistrictIds],
  );

  const onEachFeature = useMemo(
    () =>
      (feature: any, layer: any) => {
        const id = feature.properties.district_id;
        const risk = riskByDistrict.get(id);
        layer.bindTooltip(
          `${feature.properties.name}${risk ? ` — ${risk.risk_class} (${risk.risk_score?.toFixed(2) ?? "n/a"})` : ""}`,
          { sticky: true },
        );
        if (onSelectDistrict) {
          layer.on("click", () => onSelectDistrict(id));
          layer.on("mouseover", () => layer.setStyle({ weight: 2 }));
          layer.on("mouseout", () => layer.setStyle(districtStyle(feature)));
        }
      },
    [riskByDistrict, onSelectDistrict, districtStyle],
  );

  return (
    <MapContainer
      center={[17.9, 79.3]}
      zoom={6}
      style={{ height: "100%", width: "100%", background: "var(--page-plane)", cursor: onSelectDistrict ? "pointer" : undefined }}
      zoomControl={false}
      scrollWheelZoom={false}
      maxZoom={18}
    >
      <TileLayer
        attribution="Esri, HERE, Garmin, GIS User Community"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
      />
      <FitToDistrictBounds districts={districts} highlightDistrictId={highlightDistrictId} />
      <GeoJSON
        key={`${highlightDistrictId}-${riskByDistrict.size}-${highlightDistrictIds?.size ?? 0}`}
        data={districts as any}
        style={districtStyle as any}
        onEachFeature={onEachFeature as any}
      />
    </MapContainer>
  );
}
