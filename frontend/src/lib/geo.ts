import type { DistrictFeature, DistrictsFeatureCollection } from "./api";

// Simple equirectangular projection (with a cos-latitude width correction)
// for a small static preview thumbnail. This is deliberately not a real GIS
// projection/pan/zoom stack -- that lives in the Spatial Intelligence
// workspace. Coordinates are real (/gis/districts), only the projection is
// approximate.
export type ProjectedDistrict = {
  districtId: string;
  name: string;
  path: string;
};

export type ProjectedLayer = {
  districts: ProjectedDistrict[];
  viewBoxWidth: number;
  viewBoxHeight: number;
};

const WIDTH = 400;

function ringToPath(ring: number[][], project: (lon: number, lat: number) => [number, number]): string {
  return ring
    .map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function polygonToPath(
  coordinates: number[][][],
  project: (lon: number, lat: number) => [number, number],
): string {
  return coordinates.map((ring) => ringToPath(ring, project)).join(" ");
}

export function projectDistricts(collection: DistrictsFeatureCollection): ProjectedLayer {
  const features = collection.features;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const f of features) {
    const [fMinLon, fMinLat, fMaxLon, fMaxLat] = f.bbox;
    minLon = Math.min(minLon, fMinLon);
    minLat = Math.min(minLat, fMinLat);
    maxLon = Math.max(maxLon, fMaxLon);
    maxLat = Math.max(maxLat, fMaxLat);
  }

  const meanLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.cos(meanLatRad);
  const projectedWidth = (maxLon - minLon) * lonScale;
  const projectedHeight = maxLat - minLat;
  const scale = WIDTH / projectedWidth;
  const viewBoxWidth = WIDTH;
  const viewBoxHeight = projectedHeight * scale;

  const project = (lon: number, lat: number): [number, number] => {
    const x = (lon - minLon) * lonScale * scale;
    const y = (maxLat - lat) * scale; // flip: north is up
    return [x, y];
  };

  const districts: ProjectedDistrict[] = features.map((f: DistrictFeature) => {
    const coords =
      f.geometry.type === "Polygon"
        ? (f.geometry.coordinates as number[][][])
        : (f.geometry.coordinates as number[][][][])[0]; // preview: first polygon of a multipolygon is enough
    return {
      districtId: f.properties.district_id,
      name: f.properties.name,
      path: polygonToPath(coords, project),
    };
  });

  return { districts, viewBoxWidth, viewBoxHeight };
}
