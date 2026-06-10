"""EE compute pipelines for the MIZAN Phase-2 vertical slice.

Each pipeline ingests an Earth Engine asset over an AOI + period, derives one or
more MIZAN indicators with the exact contract formulas (docs/06), and returns a
plain-dict result carrying the value **and** the confidence/quality inputs the
confidence engine needs (valid-pixel fraction, image_count, mean cloud
probability, recency) — never a fabricated value when imagery is absent.

Shared building blocks (S2 cloud masking + spectral composite) live here so the
surface-water pipeline (docs/05 §2.e) reuses the exact same masked S2 composite
as the spectral-index pipeline (docs/05 §2.a).
"""

from __future__ import annotations

import ee


class PipelineError(RuntimeError):
    """Base class for pipeline failures surfaced as per-indicator error items."""

    #: machine-readable code echoed into the /compute ``errors[].code`` field.
    code = "PIPELINE_ERROR"


class NoValidImageryError(PipelineError):
    """No usable imagery for the AOI/period — honest-data rule (docs/05 §3.2).

    Raised when a period/AOI yields zero scenes or a fully-masked composite.
    The worker turns this into an HTTP 422-style item and writes NOTHING. A
    value is NEVER invented or defaulted.
    """

    code = "NO_VALID_IMAGERY"


class InsufficientHistoryError(PipelineError):
    """Not enough baseline history to fit a distribution (e.g. SPI gamma fit)."""

    code = "INSUFFICIENT_HISTORY"

# Sentinel-2 SR band mapping (implementation contract / docs/06 §1.1).
S2_BANDS = {
    "blue": "B2",
    "green": "B3",
    "red": "B4",
    "nir": "B8",
    "swir1": "B11",
    "swir2": "B12",
}

S2_SR_ASSET = "COPERNICUS/S2_SR_HARMONIZED"
S2_CLOUD_PROB_ASSET = "COPERNICUS/S2_CLOUD_PROBABILITY"

# SCL classes masked as cloud / cirrus / shadow / defect (docs/06 §2.3).
#   1 saturated/defective, 3 cloud shadow, 8 cloud med, 9 cloud high,
#   10 thin cirrus, 11 snow/ice.
_SCL_MASK_CLASSES = [1, 3, 8, 9, 10, 11]

# S2 SR reflectance scale factor (DN -> reflectance, docs/06 §1.1).
_S2_SCALE = 10000.0


def build_s2_masked_collection(
    aoi: ee.Geometry,
    start: str,
    end: str,
    cloud_prob_threshold: float = 40.0,
) -> ee.ImageCollection:
    """Return the S2 SR collection joined to s2cloudless, cloud/shadow-masked.

    Steps (docs/05 §2.a, docs/06 §2):
      1. filter S2_SR_HARMONIZED to AOI + period, pre-filter very cloudy scenes;
      2. join each scene to its COPERNICUS/S2_CLOUD_PROBABILITY counterpart by
         ``system:index``;
      3. cloud mask = (s2cloudless probability > threshold) OR SCL cloud/cirrus
         classes; shadow mask = SCL == 3; final mask removes their union;
      4. scale reflectance (÷10000).

    Each masked image keeps a per-scene ``cloud_prob_mean`` property (mean
    s2cloudless probability over the AOI) so the worker can report mean cloud
    probability for the source_quality confidence factor.
    """
    s2 = (
        ee.ImageCollection(S2_SR_ASSET)
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80))
    )
    cld = (
        ee.ImageCollection(S2_CLOUD_PROB_ASSET)
        .filterBounds(aoi)
        .filterDate(start, end)
    )

    joined = ee.Join.saveFirst("cloud").apply(
        primary=s2,
        secondary=cld,
        condition=ee.Filter.equals(
            leftField="system:index", rightField="system:index"
        ),
    )

    threshold = ee.Number(cloud_prob_threshold)

    def _mask(img: ee.Image) -> ee.Image:
        img = ee.Image(img)
        prob = ee.Image(img.get("cloud")).select("probability")
        scl = img.select("SCL")
        is_cloud = prob.gt(threshold)
        for cls in _SCL_MASK_CLASSES:
            is_cloud = is_cloud.Or(scl.eq(cls))
        mask = is_cloud.Not()
        scaled = img.updateMask(mask).divide(_S2_SCALE)
        # Mean cloud probability over the AOI for this scene (source_quality).
        cloud_prob_mean = prob.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=20,
            maxPixels=1e9,
            bestEffort=True,
        ).get("probability")
        return (
            scaled.copyProperties(img, ["system:time_start", "system:index"])
            .set("cloud_prob_mean", cloud_prob_mean)
        )

    return ee.ImageCollection(joined).map(_mask)


def s2_spectral_composite(
    aoi: ee.Geometry,
    start: str,
    end: str,
    cloud_prob_threshold: float = 40.0,
    composite: str = "median",
) -> tuple[ee.Image, ee.ImageCollection]:
    """Median (default) composite of NDVI/NDWI/MNDWI over the masked S2 stack.

    Returns ``(composite_image, masked_collection)``. The composite carries the
    three index bands ``ndvi``, ``ndwi``, ``mndwi`` (docs/06 §1.2 formulas):

        NDVI  = (NIR  - Red)   / (NIR  + Red)
        NDWI  = (Green - NIR)  / (Green + NIR)     [McFeeters]
        MNDWI = (Green - SWIR1)/ (Green + SWIR1)   [Xu]
    """
    masked = build_s2_masked_collection(aoi, start, end, cloud_prob_threshold)

    def _indices(img: ee.Image) -> ee.Image:
        img = ee.Image(img)
        green = img.select(S2_BANDS["green"])
        red = img.select(S2_BANDS["red"])
        nir = img.select(S2_BANDS["nir"])
        swir1 = img.select(S2_BANDS["swir1"])
        ndvi = nir.subtract(red).divide(nir.add(red)).rename("ndvi")
        ndwi = green.subtract(nir).divide(green.add(nir)).rename("ndwi")
        mndwi = green.subtract(swir1).divide(green.add(swir1)).rename("mndwi")
        return ee.Image.cat([ndvi, ndwi, mndwi]).copyProperties(
            img, ["system:time_start"]
        )

    index_ic = masked.map(_indices)
    if composite == "greenest":
        comp = index_ic.qualityMosaic("ndvi")
    else:
        comp = index_ic.median()
    return comp, masked
