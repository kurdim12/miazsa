"""Pipeline 2.c — CHIRPS rainfall aggregation & SPI-3.

Implements docs/05 §2.c + docs/06 §6:

  * ``precip_mm`` = sum of CHIRPS/DAILY ``precipitation`` over the period, then
    ``reduceRegion(mean)`` of that summed image over the AOI;
  * ``spi_3`` = gamma-fit standardized 3-month precipitation accumulation:
      1. current 3-month accumulation ending at the period end (AOI mean);
      2. baseline series of the *same* calendar 3-month accumulation across the
         configured climatology baseline (default 1991-2020), AOI mean per year;
      3. fit a gamma distribution to the non-zero baseline (``scipy.stats.gamma``),
         apply the mixed-distribution zero correction H(x)=q+(1-q)G(x) for arid
         zero-rainfall months, then SPI = Phi^-1(H(x)).

Honest-data rules (docs/05 §3.2):
  * no CHIRPS days in the period -> ``NoValidImageryError`` for precip_mm;
  * too few usable baseline years to fit the gamma -> ``InsufficientHistoryError``
    for spi_3. Never a fabricated/defaulted value.
"""

from __future__ import annotations

from typing import Any

import ee
import numpy as np
from scipy.stats import gamma, norm

from ..config import get_settings
from . import InsufficientHistoryError, NoValidImageryError

CHIRPS_DAILY_ASSET = "UCSB-CHG/CHIRPS/DAILY"
DATASET_KEY = "chirps_daily"

SUPPORTED = {"precip_mm", "spi_3"}

# CHIRPS native scale ~5.5 km; reduce at 5000 m (docs/05 §1.8 scale discipline).
_SCALE_M = 5000
# SPI accumulation window (months) for spi_3.
_SPI_K_MONTHS = 3
# Minimum usable baseline samples to attempt a gamma fit (docs/06 §6.5 guard).
_MIN_BASELINE_SAMPLES = 10


def _aoi_period_sum(aoi: ee.Geometry, start: str, end: str) -> ee.Number:
    """AOI-mean of the CHIRPS precipitation summed over ``[start, end)``."""
    ic = (
        ee.ImageCollection(CHIRPS_DAILY_ASSET)
        .filterBounds(aoi)
        .filterDate(start, end)
        .select("precipitation")
    )
    summed = ic.sum()
    val = summed.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=_SCALE_M,
        maxPixels=1e10,
        bestEffort=True,
    ).get("precipitation")
    return ee.Number(val)


def compute_chirps(
    aoi: ee.Geometry,
    start: str,
    end: str,
    indicators: list[str],
    *,
    obs_date: str | None = None,
) -> dict[str, dict[str, Any]]:
    """Compute the requested CHIRPS indicators (precip_mm, spi_3).

    ``end`` is treated as exclusive for the precipitation sum window, matching
    EE ``filterDate`` semantics; the SPI accumulation window ends at ``end``.
    """
    wanted = [i for i in indicators if i in SUPPORTED]
    if not wanted:
        return {}

    results: dict[str, dict[str, Any]] = {}
    obs = obs_date or end
    settings = get_settings()

    # ---- precip_mm ----------------------------------------------------------
    if "precip_mm" in wanted:
        ic = (
            ee.ImageCollection(CHIRPS_DAILY_ASSET)
            .filterBounds(aoi)
            .filterDate(start, end)
            .select("precipitation")
        )
        day_count = ee.Number(ic.size())
        summed = ic.sum()
        precip = summed.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=_SCALE_M,
            maxPixels=1e10,
            bestEffort=True,
        ).get("precipitation")
        info = ee.Dictionary({"days": day_count, "precip": precip}).getInfo()
        n_days = int(info.get("days") or 0)
        value = info.get("precip")
        if n_days == 0 or value is None:
            raise NoValidImageryError(
                f"precip_mm: no CHIRPS daily imagery for the AOI in "
                f"[{start}, {end}]; refusing to fabricate precipitation."
            )
        results["precip_mm"] = {
            "value": float(value),
            "obs_date": obs,
            "image_count": n_days,
            # CHIRPS is gap-free over land; coverage is effectively complete.
            "valid_pixel_fraction": 1.0,
            "dataset_key": DATASET_KEY,
            "ee_asset_id": CHIRPS_DAILY_ASSET,
            "processing_method": "chirps daily sum over period (AOI mean)",
            "scale_m": _SCALE_M,
        }

    # ---- spi_3 --------------------------------------------------------------
    if "spi_3" in wanted:
        results["spi_3"] = _compute_spi3(aoi, end, obs, settings)

    return results


def _compute_spi3(
    aoi: ee.Geometry,
    end: str,
    obs: str,
    settings: Any,
) -> dict[str, Any]:
    """Compute SPI-3 (gamma fit + zero correction) for the AOI ending at ``end``."""
    end_date = ee.Date(end)
    acc_start = end_date.advance(-_SPI_K_MONTHS, "month")

    # Current k-month accumulation (AOI mean).
    current_x = _aoi_period_sum(aoi, acc_start.format("YYYY-MM-dd"), end)

    # Baseline series: same calendar k-month window across baseline years.
    base_start = int(settings.spi_baseline_start_year)
    base_end = int(settings.spi_baseline_end_year)
    years = ee.List.sequence(base_start, base_end)

    def _year_acc(y: ee.Number) -> ee.Number:
        y = ee.Number(y)
        # Window ending at the same month/day as `end`, but in baseline year y.
        win_end = end_date.update(year=y)
        win_start = win_end.advance(-_SPI_K_MONTHS, "month")
        ic = (
            ee.ImageCollection(CHIRPS_DAILY_ASSET)
            .filterBounds(aoi)
            .filterDate(win_start, win_end)
            .select("precipitation")
        )
        summed = ic.sum()
        # Years with no CHIRPS imagery reduce to null -> arrive as None in the
        # client list and are filtered there (never fabricated as a number).
        return summed.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=_SCALE_M,
            maxPixels=1e10,
            bestEffort=True,
        ).get("precipitation")

    baseline_list = years.map(_year_acc)

    payload = ee.Dictionary(
        {"current": current_x, "baseline": baseline_list}
    ).getInfo()

    current_val = payload.get("current")
    if current_val is None:
        raise NoValidImageryError(
            f"spi_3: no CHIRPS imagery for the current 3-month window ending "
            f"{end}; refusing to fabricate an SPI value."
        )

    raw_baseline = payload.get("baseline") or []
    baseline = np.asarray(
        [v for v in raw_baseline if v is not None and v >= 0.0], dtype=float
    )
    if baseline.size < _MIN_BASELINE_SAMPLES:
        raise InsufficientHistoryError(
            f"spi_3: only {baseline.size} usable baseline years "
            f"({base_start}-{base_end}); need >= {_MIN_BASELINE_SAMPLES} to fit "
            "the gamma distribution. Refusing to fabricate an SPI value."
        )

    spi = _spi_from_accumulation(float(current_val), baseline)

    return {
        "value": float(spi),
        "obs_date": obs,
        "image_count": int(baseline.size),
        "valid_pixel_fraction": 1.0,
        "dataset_key": DATASET_KEY,
        "ee_asset_id": CHIRPS_DAILY_ASSET,
        "processing_method": "chirps 3-month accumulation gamma-fit SPI",
        "scale_m": _SCALE_M,
        "spi_k_months": _SPI_K_MONTHS,
        "baseline_start_year": base_start,
        "baseline_end_year": base_end,
        "baseline_n": int(baseline.size),
        "distribution": "gamma",
    }


def _spi_from_accumulation(current_x: float, baseline_xs: np.ndarray) -> float:
    """SPI from a k-month accumulation given the baseline series (docs/06 §6.4).

    Mixed distribution for arid zero-inflation: H(x) = q + (1-q)·G(x), where q is
    the baseline zero fraction and G is the gamma CDF fitted to the non-zeros;
    SPI = Phi^-1(H(x)), clipped away from 0/1 to keep the quantile finite.
    """
    x = np.asarray(baseline_xs, dtype=float)
    q = float((x == 0).mean()) if x.size else 0.0
    nz = x[x > 0]

    if nz.size < 2 or float(np.std(nz)) == 0.0:
        # Cannot fit a gamma to <2 non-zero points (or zero variance).
        raise InsufficientHistoryError(
            "spi_3: insufficient non-zero baseline precipitation to fit the "
            "gamma distribution; refusing to fabricate an SPI value."
        )

    a, loc, scale = gamma.fit(nz, floc=0)

    if current_x <= 0:
        cdf = q
    else:
        cdf = q + (1.0 - q) * float(gamma.cdf(current_x, a, loc=0, scale=scale))

    cdf = float(np.clip(cdf, 1e-6, 1 - 1e-6))
    return float(norm.ppf(cdf))
