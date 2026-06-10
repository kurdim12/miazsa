"""Pipeline 2.a — Sentinel-2 spectral indices (NDVI / NDWI / MNDWI).

Implements docs/05 §2.a + docs/06 §1-2:

  * S2_SR_HARMONIZED filtered to AOI + period, joined to S2_CLOUD_PROBABILITY
    for s2cloudless masking (+ SCL cloud/shadow classes), reflectance scaled;
  * median composite of the per-scene indices;
  * ``reduceRegion(mean)`` of each index band over the AOI at 10 m;
  * per-index quality: image_count, valid_pixel_fraction, mean_cloud_prob.

Honest-data rule: if the period has no scenes, or an index is fully masked over
the AOI (no valid pixels -> ``None``), the pipeline raises
``NoValidImageryError`` for that indicator and writes nothing (docs/05 §3.2).
"""

from __future__ import annotations

from typing import Any

import ee

from . import (
    NoValidImageryError,
    S2_BANDS,
    S2_CLOUD_PROB_ASSET,
    S2_SR_ASSET,
    s2_spectral_composite,
)

# Indicators this pipeline can produce, mapped to the composite band names.
SUPPORTED = {"ndvi": "ndvi", "ndwi": "ndwi", "mndwi": "mndwi"}

DATASET_KEY = "s2_sr_harmonized"
EE_ASSET_ID = f"{S2_SR_ASSET}, {S2_CLOUD_PROB_ASSET}"
PROCESSING_METHOD = "s2cloudless+scl_mask median composite spectral index"

# Native S2 reduction scale (10 m for B3/B4/B8; 20 m for B11 — use 10 m, EE
# resamples). docs/05 §2.a reduces at 10 m over Azraq.
_SCALE_M = 10


def compute_indices(
    aoi: ee.Geometry,
    start: str,
    end: str,
    indicators: list[str],
    *,
    cloud_prob_threshold: float = 40.0,
    composite: str = "median",
    obs_date: str | None = None,
) -> dict[str, dict[str, Any]]:
    """Compute the requested S2 indices over ``aoi`` for ``[start, end]``.

    Returns ``{indicator: result_dict}`` for the indices it owns among
    ``indicators``. ``result_dict`` carries ``value``, ``obs_date``,
    ``image_count``, ``valid_pixel_fraction`` and ``mean_cloud_prob``.

    Raises ``NoValidImageryError`` if there is no imagery for the whole AOI/
    period (applies to all requested indices at once).
    """
    wanted = [i for i in indicators if i in SUPPORTED]
    if not wanted:
        return {}

    comp, masked = s2_spectral_composite(
        aoi, start, end, cloud_prob_threshold, composite
    )

    # One getInfo round-trip for all the scalar stats we need.
    image_count = ee.Number(masked.size())
    mean_cloud_prob = ee.Number(
        masked.aggregate_mean("cloud_prob_mean")
    )

    # Per-AOI total pixel count at the reduction scale (denominator for the
    # valid-pixel fraction). Use a constant image so the count is the AOI's full
    # pixel population regardless of masking.
    total_pixels = (
        ee.Image.constant(1)
        .rename("ones")
        .reduceRegion(
            reducer=ee.Reducer.count(),
            geometry=aoi,
            scale=_SCALE_M,
            maxPixels=1e10,
            bestEffort=True,
        )
        .get("ones")
    )

    # Mean + valid-pixel count per index band over the AOI.
    band_names = [SUPPORTED[i] for i in wanted]
    reducer = ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=True)
    stats = comp.select(band_names).reduceRegion(
        reducer=reducer,
        geometry=aoi,
        scale=_SCALE_M,
        maxPixels=1e10,
        bestEffort=True,
        tileScale=4,
    )

    payload = ee.Dictionary(
        {
            "image_count": image_count,
            "mean_cloud_prob": mean_cloud_prob,
            "total_pixels": total_pixels,
            "stats": stats,
        }
    ).getInfo()

    n_images = int(payload.get("image_count") or 0)
    if n_images == 0:
        raise NoValidImageryError(
            f"No Sentinel-2 scenes for AOI in [{start}, {end}] "
            f"(cloud_prob_threshold={cloud_prob_threshold})."
        )

    stats_info: dict[str, Any] = payload.get("stats") or {}
    total = payload.get("total_pixels")
    total = float(total) if total else 0.0
    mean_cloud = payload.get("mean_cloud_prob")
    obs = obs_date or end

    results: dict[str, dict[str, Any]] = {}
    for indicator in wanted:
        band = SUPPORTED[indicator]
        value = stats_info.get(f"{band}_mean", stats_info.get(band))
        valid = stats_info.get(f"{band}_count")
        if value is None:
            # Index fully masked over the AOI -> no fabrication.
            raise NoValidImageryError(
                f"{indicator}: no valid (cloud-free) pixels over the AOI in "
                f"[{start}, {end}]; refusing to fabricate a value."
            )
        valid = float(valid) if valid is not None else 0.0
        valid_fraction = (valid / total) if total > 0 else None
        results[indicator] = {
            "value": float(value),
            "obs_date": obs,
            "image_count": n_images,
            "valid_pixel_fraction": valid_fraction,
            "mean_cloud_prob": (float(mean_cloud) if mean_cloud is not None else None),
            "dataset_key": DATASET_KEY,
            "ee_asset_id": EE_ASSET_ID,
            "processing_method": PROCESSING_METHOD,
            "scale_m": _SCALE_M,
            "cloud_prob_threshold": cloud_prob_threshold,
            "composite": composite,
        }
    return results
