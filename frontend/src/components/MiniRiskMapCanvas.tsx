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
    if (target?.bbox) {
      const [minLon, minLat, maxLon, maxLat] = target.bbox;
      map.fitBounds(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { padding: [24, 24] },
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
        { padding: [8, 8] },
      );
    }
  }, [districts, highlightDistrictId, map]);
  return null;
}

export function MiniRiskMapCanvas({
  districts,
  riskByDistrict,
  highlightDistrictId,
}: {
  districts: DistrictsFeatureCollection;
  riskByDistrict: Map<string, RiskResult>;
  highlightDistrictId?: string;
}) {
  const districtStyle = useMemo(
    () =>
      (feature?: any) => {
        const id: string | undefined = feature?.properties?.district_id;
        const risk = id ? riskByDistrict.get(id) : undefined;
        const fill = risk ? riskClassColorVar(risk.risk_class) : "var(--status-neutral)";
        const highlighted = id === highlightDistrictId;
        return {
          color: highlighted ? "var(--accent)" : "var(--surface-1)",
          weight: highlighted ? 2.5 : 0.7,
          fillColor: fill,
          fillOpacity: highlighted ? 0.85 : highlightDistrictId ? 0.25 : 0.6,
        };
      },
    [riskByDistrict, highlightDistrictId],
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
      },
    [riskByDistrict],
  );

  return (
    <MapContainer center={[17.9, 79.3]} zoom={6} style={{ height: "100%", width: "100%", background: "var(--page-plane)" }} zoomControl={false} scrollWheelZoom={false} attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToDistrictBounds districts={districts} highlightDistrictId={highlightDistrictId} />
      <GeoJSON key={`${highlightDistrictId}-${riskByDistrict.size}`} data={districts as any} style={districtStyle as any} onEachFeature={onEachFeature as any} />
    </MapContainer>
  );
}
