"""Pipeline 2.e — Surface-water extent via MNDWI + Otsu thresholding.

Implements docs/05 §2.e + docs/06 §5:

  * reuse the masked S2 composite's MNDWI band (same masking as pipeline 2.a);
  * compute an adaptive **Otsu** threshold on the MNDWI histogram over the AOI
    (maximize between-class variance); fall back to a fixed ``MNDWI > 0`` when
    the histogram is degenerate / unimodal;
  * water mask = ``MNDWI > threshold``;
  * area = ``sum(pixelArea over water) / 1e6`` -> surface_water_extent_km2.

Honest-data rule: no imagery (zero scenes / empty histogram with no valid
pixels) raises ``NoValidImageryError`` — never a fabricated extent.
"""

from __future__ import annotations

from typing import Any

import ee

from . import (
    NoValidImageryError,
    S2_CLOUD_PROB_ASSET,
    S2_SR_ASSET,
    s2_spectral_composite,
)

INDICATOR = "surface_water_extent_km2"
SUPPORTED = {INDICATOR}

DATASET_KEY = "s2_sr_harmonized"
EE_ASSET_ID = f"{S2_SR_ASSET}, {S2_CLOUD_PROB_ASSET}"
PROCESSING_METHOD = "mndwi otsu water mask pixelArea sum"

_SCALE_M = 10
# Fallback fixed MNDWI threshold (docs/06 §5.1) when Otsu is unusable.
_FALLBACK_THRESHOLD = 0.0


def _otsu(histogram: dict[str, Any]) -> float | None:
    """Otsu threshold from an EE ``ee.Reducer.histogram`` getInfo() dict.

    Returns the threshold maximizing between-class variance, or ``None`` if the
    histogram is degenerate (single bucket / no counts).
    """
    if not histogram:
        return None
    counts = histogram.get("histogram")
    bucket_means = histogram.get("bucketMeans")
    if not counts or not bucket_means or len(counts) < 2:
        return None

    total = sum(counts)
    if total <= 0:
        return None

    sum_all = sum(c * m for c, m in zip(counts, bucket_means))
    w_back = 0.0
    sum_back = 0.0
    best_var = -1.0
    best_thr: float | None = None

    for i in range(len(counts)):
        w_back += counts[i]
        if w_back == 0:
            continue
        w_fore = total - w_back
        if w_fore == 0:
            break
        sum_back += counts[i] * bucket_means[i]
        mean_back = sum_back / w_back
        mean_fore = (sum_all - sum_back) / w_fore
        between = w_back * w_fore * (mean_back - mean_fore) ** 2
        if between > best_var:
            best_var = between
            best_thr = bucket_means[i]
    return best_thr


def compute_surface_water(
    aoi: ee.Geometry,
    start: str,
    end: str,
    *,
    cloud_prob_threshold: float = 40.0,
    composite: str = "median",
    obs_date: str | None = None,
) -> dict[str, dict[str, Any]]:
    """Compute surface_water_extent_km2 over ``aoi`` for ``[start, end]``.

    Returns ``{indicator: result_dict}``; raises ``NoValidImageryError`` on no
    usable imagery.
    """
    comp, masked = s2_spectral_composite(
        aoi, start, end, cloud_prob_threshold, composite
    )
    mndwi = comp.select("mndwi")

    image_count = ee.Number(masked.size())
    mean_cloud_prob = ee.Number(masked.aggregate_mean("cloud_prob_mean"))

    # MNDWI histogram over the AOI for Otsu (server-side reduce, client Otsu).
    histogram = mndwi.reduceRegion(
        reducer=ee.Reducer.histogram(maxBuckets=256),
        geometry=aoi,
        scale=_SCALE_M,
        maxPixels=1e10,
        bestEffort=True,
        tileScale=4,
    ).get("mndwi")

    pre = ee.Dictionary(
        {
            "image_count": image_count,
            "mean_cloud_prob": mean_cloud_prob,
            "histogram": histogram,
        }
    ).getInfo()

    n_images = int(pre.get("image_count") or 0)
    if n_images == 0:
        raise NoValidImageryError(
            f"No Sentinel-2 scenes for AOI in [{start}, {end}] "
            "for surface-water mapping."
        )

    hist = pre.get("histogram")
    thr = _otsu(hist)
    threshold_method = "otsu"
    if thr is None:
        # Degenerate histogram -> fixed-threshold fallback (recorded in params).
        thr = _FALLBACK_THRESHOLD
        threshold_method = "fixed_fallback"

    # Water area: sum(pixelArea over MNDWI > threshold) / 1e6.
    water = mndwi.gt(thr)
    area_img = water.multiply(ee.Image.pixelArea())
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
    valid_pixels = mndwi.reduceRegion(
        reducer=ee.Reducer.count(),
        geometry=aoi,
        scale=_SCALE_M,
        maxPixels=1e10,
        bestEffort=True,
    ).get("mndwi")
    area_m2 = area_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=aoi,
        scale=_SCALE_M,
        maxPixels=1e10,
        bestEffort=True,
        tileScale=4,
    ).get("mndwi")

    out = ee.Dictionary(
        {
            "area_m2": area_m2,
            "total_pixels": total_pixels,
            "valid_pixels": valid_pixels,
        }
    ).getInfo()

    area_m2_val = out.get("area_m2")
    if area_m2_val is None:
        # No valid MNDWI pixels at all over the AOI -> honest no-data.
        raise NoValidImageryError(
            "surface_water_extent_km2: no valid (cloud-free) pixels over the "
            f"AOI in [{start}, {end}]; refusing to fabricate an extent."
        )

    total = float(out.get("total_pixels") or 0.0)
    valid = float(out.get("valid_pixels") or 0.0)
    valid_fraction = (valid / total) if total > 0 else None
    mean_cloud = pre.get("mean_cloud_prob")
    km2 = float(area_m2_val) / 1e6

    return {
        INDICATOR: {
            "value": km2,
            "obs_date": obs_date or end,
            "image_count": n_images,
            "valid_pixel_fraction": valid_fraction,
            "mean_cloud_prob": (float(mean_cloud) if mean_cloud is not None else None),
            "threshold": float(thr),
            "threshold_method": threshold_method,
            "dataset_key": DATASET_KEY,
            "ee_asset_id": EE_ASSET_ID,
            "processing_method": PROCESSING_METHOD,
            "scale_m": _SCALE_M,
            "cloud_prob_threshold": cloud_prob_threshold,
            "composite": composite,
        }
    }
