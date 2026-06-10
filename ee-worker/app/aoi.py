"""AOI resolution: GeoJSON or stored region geometry -> ee.Geometry.

Two resolution paths (docs/05 §2 AOI convention; contract JobSpec.aoi):

  1. Request supplies an inline GeoJSON Polygon / MultiPolygon geometry.
  2. Request supplies region_id (a regions.id uuid, or the regions.code text);
     the geometry is fetched from Supabase and converted to an ee.Geometry.

The returned object also carries the resolved region_id (uuid) when known, so
the write path can satisfy indicator_values.region_id (NOT NULL FK -> regions).
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import ee

from .supabase_writer import SupabaseWriter


@dataclass
class ResolvedAOI:
    """The AOI a job runs over, plus its database linkage when available."""

    geometry: ee.Geometry
    region_id: str | None  # regions.id (uuid) — None for ad-hoc GeoJSON AOIs
    region_code: str | None
    source: str  # 'geojson' | 'region'


def _looks_like_uuid(value: str) -> bool:
    """Heuristic: a 36-char dashed string is treated as a regions.id uuid."""
    return len(value) == 36 and value.count("-") == 4


def geojson_to_ee_geometry(geojson: dict) -> ee.Geometry:
    """Convert a GeoJSON geometry (or Feature/FeatureCollection) to ee.Geometry."""
    if not isinstance(geojson, dict):
        raise ValueError("aoi GeoJSON must be a JSON object")

    gj_type = geojson.get("type")
    if gj_type == "Feature":
        return geojson_to_ee_geometry(geojson["geometry"])
    if gj_type == "FeatureCollection":
        feats = geojson.get("features") or []
        if not feats:
            raise ValueError("aoi FeatureCollection has no features")
        geoms = [geojson_to_ee_geometry(f["geometry"]) for f in feats]
        return ee.Geometry.MultiPolygon(
            ee.List([g.coordinates() for g in geoms])
        ) if len(geoms) > 1 else geoms[0]

    if gj_type not in ("Polygon", "MultiPolygon"):
        raise ValueError(
            f"aoi geometry type must be Polygon or MultiPolygon, got {gj_type!r}"
        )

    # ee.Geometry accepts a GeoJSON geometry dict directly (geodesic=False to
    # treat coordinates as planar lon/lat, matching stored EPSG:4326 polygons).
    return ee.Geometry(geojson, geodesic=False)


def resolve_aoi(
    *,
    aoi_geojson: dict | None,
    region_id: str | None,
    writer: SupabaseWriter,
) -> ResolvedAOI:
    """Resolve the AOI for a job.

    Precedence: an explicit inline GeoJSON wins; otherwise the stored region
    geometry is fetched by region_id (uuid) or region code.
    """
    # ---- Path 1: inline GeoJSON --------------------------------------------
    if aoi_geojson:
        geom = geojson_to_ee_geometry(aoi_geojson)
        # If a region_id was *also* supplied, keep it so writes can link the row;
        # resolve a bare code to its uuid for the FK.
        resolved_id: str | None = None
        resolved_code: str | None = None
        if region_id:
            row = writer.get_region(region_id)
            if row:
                resolved_id = row["id"]
                resolved_code = row.get("code")
        return ResolvedAOI(
            geometry=geom,
            region_id=resolved_id,
            region_code=resolved_code,
            source="geojson",
        )

    # ---- Path 2: stored region geometry ------------------------------------
    if not region_id:
        raise ValueError(
            "AOI unresolved: provide either an inline GeoJSON 'aoi' or a "
            "'region_id' referencing a stored region."
        )

    row = writer.get_region(region_id)
    if not row:
        ident = "uuid" if _looks_like_uuid(region_id) else "code"
        raise ValueError(
            f"region not found for {ident}={region_id!r}; cannot resolve AOI."
        )

    geojson_geom = row.get("geojson")
    if not geojson_geom:
        raise ValueError(
            f"region {region_id!r} has no usable geometry (empty geom); "
            "cannot resolve AOI."
        )
    if isinstance(geojson_geom, str):
        geojson_geom = json.loads(geojson_geom)

    geom = geojson_to_ee_geometry(geojson_geom)
    return ResolvedAOI(
        geometry=geom,
        region_id=row["id"],
        region_code=row.get("code"),
        source="region",
    )
