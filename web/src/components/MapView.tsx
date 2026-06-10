// =============================================================================
// components/MapView.tsx — MapLibre GL JS map (docs/13 §B.3).
//
// - Style from MapTiler using VITE_MAPTILER_KEY (falls back to a free raster
//   OSM style when the key is absent, so the map still renders in dev).
// - Renders supplied region polygons as a fill+outline layer.
// - Fits the view to the regions' bounds (or a default Jordan/Azraq view).
// - Click on a region -> onSelectRegion(regionId); selected region highlighted.
//
// Attribution (MapTiler / OSM) is shown via MapLibre's AttributionControl, as
// the licenses require (docs/13 §B.3 / §F.2).
// =============================================================================

import { useEffect, useRef } from "react";
import maplibregl, {
  type Map as MlMap,
  type LngLatBoundsLike,
  type StyleSpecification,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import type { GeoJsonGeometry } from "@/lib/types";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

/** Default views (docs/13 §B.3). */
export const JORDAN_VIEW = { center: [38.0, 31.5] as [number, number], zoom: 6.2 };
export const AZRAQ_VIEW = { center: [36.8, 31.9] as [number, number], zoom: 8.2 };

export interface MapRegionFeature {
  id: string;
  name: string;
  geometry: GeoJsonGeometry;
  /** Optional stress color for choropleth fill. */
  color?: string;
}

export interface MapViewProps {
  regions: MapRegionFeature[];
  selectedRegionId?: string | null;
  onSelectRegion?: (regionId: string) => void;
  /** Fallback view when no region geometry is available. */
  fallback?: { center: [number, number]; zoom: number };
  className?: string;
  ariaLabel?: string;
}

/** Build a MapTiler style URL, or a free OSM raster style as a fallback. */
function resolveStyle(): string | StyleSpecification {
  if (MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
  }
  // Fallback: OSM raster tiles (no key). Keeps the map usable without MapTiler.
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

/** Compute a bounding box [w,s,e,n] from region geometries. */
function boundsOf(regions: MapRegionFeature[]): LngLatBoundsLike | null {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  let found = false;
  for (const r of regions) {
    const polys =
      r.geometry.type === "Polygon" ? [r.geometry.coordinates] : r.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) {
          found = true;
          if (lng < w) w = lng;
          if (lng > e) e = lng;
          if (lat < s) s = lat;
          if (lat > n) n = lat;
        }
      }
    }
  }
  if (!found) return null;
  return [
    [w, s],
    [e, n],
  ];
}

function toFeatureCollection(regions: MapRegionFeature[]) {
  return {
    type: "FeatureCollection" as const,
    features: regions.map((r) => ({
      type: "Feature" as const,
      id: r.id,
      properties: { id: r.id, name: r.name, color: r.color ?? "#1D4ED8" },
      geometry: r.geometry,
    })),
  };
}

export function MapView({
  regions,
  selectedRegionId,
  onSelectRegion,
  fallback = JORDAN_VIEW,
  className,
  ariaLabel = "Map of Jordan regions",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle(),
      center: fallback.center,
      zoom: fallback.zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("regions", { type: "geojson", data: toFeatureCollection(regions) });
      map.addLayer({
        id: "regions-fill",
        type: "fill",
        source: "regions",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "case",
            ["==", ["get", "id"], selectedRegionId ?? "__none__"],
            0.45,
            0.2,
          ],
        },
      });
      map.addLayer({
        id: "regions-outline",
        type: "line",
        source: "regions",
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "case",
            ["==", ["get", "id"], selectedRegionId ?? "__none__"],
            3,
            1.5,
          ],
        },
      });

      map.on("click", "regions-fill", (e) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined;
        const id = f?.properties?.id as string | undefined;
        if (id && onSelectRef.current) onSelectRef.current(id);
      });
      map.on("mouseenter", "regions-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "regions-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      const b = boundsOf(regions);
      if (b) map.fitBounds(b, { padding: 48, maxZoom: 9, duration: 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update source data + fit bounds when regions change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("regions") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(toFeatureCollection(regions));
      const b = boundsOf(regions);
      if (b) map.fitBounds(b, { padding: 48, maxZoom: 9, duration: 300 });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [regions]);

  // Reflect selection changes in the paint expressions.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const sel = selectedRegionId ?? "__none__";
    if (map.getLayer("regions-fill")) {
      map.setPaintProperty("regions-fill", "fill-opacity", [
        "case",
        ["==", ["get", "id"], sel],
        0.45,
        0.2,
      ]);
    }
    if (map.getLayer("regions-outline")) {
      map.setPaintProperty("regions-outline", "line-width", [
        "case",
        ["==", ["get", "id"], sel],
        3,
        1.5,
      ]);
    }
  }, [selectedRegionId]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className ?? "h-full w-full"}
    />
  );
}
