// =============================================================================
// src/lib/geo.ts — Region geometry resolution for the map.
//
// Production loads authoritative boundaries; the Phase-2 seed (docs/11 §10) uses
// APPROXIMATE bounding-box polygons. PostgREST does not return PostGIS geometry
// as GeoJSON without an RPC/ST_AsGeoJSON view, so when a region's `geom` is not
// usable we fall back to the documented seed bboxes (clearly approximate). This
// is geometry only — it never fabricates indicator values.
// =============================================================================

import type { GeoJsonGeometry, GeoJsonMultiPolygon, Region } from "@/lib/types";

/** Default map views (docs/13 §B.3). */
export const JORDAN_VIEW = { center: [38.0, 31.5] as [number, number], zoom: 6.2 };
export const AZRAQ_VIEW = { center: [36.8, 31.9] as [number, number], zoom: 8.2 };

/** Build a MultiPolygon from a [w,s,e,n] bbox. */
function bboxPolygon(w: number, s: number, e: number, n: number): GeoJsonMultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    ],
  };
}

/** Documented seed bboxes (docs/11 §10 seed comments). */
const SEED_BBOX: Record<string, [number, number, number, number]> = {
  jordan: [34.9, 29.2, 39.3, 33.4],
  azraq_basin: [36.0, 31.0, 37.5, 32.5],
};

/** A generic small box around Jordan's centroid for unknown regions. */
const DEFAULT_BBOX: [number, number, number, number] = [35.5, 30.5, 38.5, 32.8];

/** Does a value look like a usable GeoJSON Polygon/MultiPolygon? */
function isUsableGeometry(g: unknown): g is GeoJsonGeometry {
  if (!g || typeof g !== "object") return false;
  const t = (g as { type?: string }).type;
  const coords = (g as { coordinates?: unknown }).coordinates;
  return (t === "Polygon" || t === "MultiPolygon") && Array.isArray(coords);
}

/**
 * Resolve a renderable geometry for a region: prefer the real `geom` (if it came
 * back as GeoJSON), else the documented seed bbox by code, else a default box.
 */
export function resolveRegionGeometry(region: Region): GeoJsonGeometry {
  if (isUsableGeometry(region.geom)) return region.geom;
  const key = region.code ?? "";
  if (key in SEED_BBOX) {
    const [w, s, e, n] = SEED_BBOX[key]!;
    return bboxPolygon(w, s, e, n);
  }
  const [w, s, e, n] = DEFAULT_BBOX;
  return bboxPolygon(w, s, e, n);
}

/** True when we had to approximate (no real GeoJSON geometry present). */
export function isApproximateGeometry(region: Region): boolean {
  return !isUsableGeometry(region.geom);
}
