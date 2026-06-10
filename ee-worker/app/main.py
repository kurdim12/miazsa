"""MIZAN EE Worker — FastAPI surface.

Endpoints (implementation contract / docs/05 §1):

  GET  /health   — liveness/readiness probe (no auth).
  POST /compute  — Bearer ``EE_WORKER_AUTH_TOKEN`` protected. Accepts a JobSpec,
                   resolves the AOI, dispatches the requested indicators to the
                   spectral / surface-water / CHIRPS pipelines, writes a
                   provenance row + an indicator_values row (+ a confidence_scores
                   row) per computed indicator, and returns the results plus an
                   honest per-indicator error list.

Honest-data rule (CRITICAL, docs/04/05/06): if a period/AOI has no valid
imagery for an indicator, that indicator is returned as a 422-style error item
and NOTHING is written. If *every* requested indicator fails, the whole call
returns HTTP 422. A value is never invented or defaulted.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import Any

import ee
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .aoi import resolve_aoi
from .config import Settings, get_settings
from .ee_auth import init_ee, is_initialized
from .pipelines import PipelineError
from .pipelines import chirps as chirps_pipe
from .pipelines import s2_indices as s2_pipe
from .pipelines import surface_water as water_pipe
from .provenance import build_provenance
from .supabase_writer import SupabaseWriter, SupabaseWriteError

# Canonical indicator units (docs/11 §10.2 indicators catalog).
INDICATOR_UNITS = {
    "ndvi": "1",
    "ndwi": "1",
    "mndwi": "1",
    "surface_water_extent_km2": "km2",
    "precip_mm": "mm",
    "spi_3": "1",
}

# Which pipeline owns each supported indicator.
_S2_INDICATORS = set(s2_pipe.SUPPORTED)
_WATER_INDICATORS = set(water_pipe.SUPPORTED)
_CHIRPS_INDICATORS = set(chirps_pipe.SUPPORTED)
SUPPORTED_INDICATORS = _S2_INDICATORS | _WATER_INDICATORS | _CHIRPS_INDICATORS

# Confidence factor weights (docs/09 §2 / _shared/confidence.ts DEFAULT_WEIGHTS).
_CONF_WEIGHTS = {
    "freshness": 0.20,
    "source_quality": 0.20,
    "spatial_coverage": 0.20,
    "temporal_completeness": 0.15,
    "model_validation": 0.15,
    "convergence": 0.10,
}
# Default revisit (days) per dataset for the temporal-completeness denominator.
_REVISIT_DAYS = {"s2_sr_harmonized": 5, "chirps_daily": 1}
_DEFAULT_FRESHNESS_DAYS = 30

app = FastAPI(title="MIZAN EE Worker", version=__version__)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class Period(BaseModel):
    start: str
    end: str


class ComputeOptions(BaseModel):
    cloud_prob_threshold: float | None = None
    composite: str | None = None


class JobSpec(BaseModel):
    region_id: str | None = None
    aoi: dict[str, Any] | None = None  # GeoJSON Polygon / MultiPolygon / Feature
    indicators: list[str] = Field(default_factory=list)
    period: Period
    options: ComputeOptions = Field(default_factory=ComputeOptions)
    # persist=False -> compute-only: the ee-compute Edge Function persists,
    # owning idempotency + audit_log (avoids double-writing). Default True for
    # scheduled / direct worker jobs that write straight to Supabase.
    persist: bool = True


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
def require_bearer(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Validate the inbound ``Authorization: Bearer <EE_WORKER_AUTH_TOKEN>``."""
    expected = settings.ee_worker_auth_token
    if not expected:
        # Fail closed: an unset token must not become an open endpoint.
        raise HTTPException(status_code=500, detail="EE_WORKER_AUTH_TOKEN not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if token != expected:
        raise HTTPException(status_code=403, detail="Invalid bearer token")


# ---------------------------------------------------------------------------
# Confidence helpers (mirror _shared/confidence.ts so the worker can write the
# authoritative confidence_scores row and return confidence_inputs).
# ---------------------------------------------------------------------------
def _clamp01(x: float | None) -> float | None:
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return min(1.0, max(0.0, x))


def _freshness(obs_date: str, t_expected_days: int, tau: float = 1.0) -> float | None:
    try:
        obs = datetime.fromisoformat(obs_date).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    age_days = max(0.0, (datetime.now(timezone.utc) - obs).total_seconds() / 86400.0)
    ratio = age_days / max(t_expected_days, 1e-9)
    return _clamp01(math.exp(-max(0.0, ratio - 1.0) / tau))


def _days_between(start: str, end: str) -> int:
    try:
        d0 = date.fromisoformat(start)
        d1 = date.fromisoformat(end)
    except ValueError:
        return 0
    return max(0, (d1 - d0).days)


def _confidence_inputs(
    result: dict[str, Any],
    *,
    period: Period,
    dataset: dict[str, Any] | None,
) -> dict[str, Any]:
    """Derive the six-factor inputs the confidence engine consumes."""
    dataset_key = result.get("dataset_key")
    source_quality_prior = None
    freshness_days = _DEFAULT_FRESHNESS_DAYS
    if dataset:
        source_quality_prior = dataset.get("source_quality")
        if dataset.get("freshness_threshold_days"):
            freshness_days = int(dataset["freshness_threshold_days"])

    # source_quality: optical -> 1 - cloud_fraction, floored by product prior.
    cloud_fraction = None
    mean_cloud_prob = result.get("mean_cloud_prob")
    if mean_cloud_prob is not None:
        cloud_fraction = _clamp01(mean_cloud_prob / 100.0)
    if cloud_fraction is not None:
        sq = 1.0 - cloud_fraction
        if source_quality_prior is not None:
            sq = min(sq, float(source_quality_prior))
        source_quality = _clamp01(sq)
    elif source_quality_prior is not None:
        source_quality = _clamp01(float(source_quality_prior))
    else:
        source_quality = None

    # temporal_completeness: observed scenes / expected over the window.
    image_count = result.get("image_count")
    revisit = _REVISIT_DAYS.get(dataset_key, 0)
    n_expected = None
    temporal_completeness = None
    if revisit:
        span = _days_between(period.start, period.end)
        n_expected = max(1, math.ceil(span / revisit)) if span else 1
        if image_count is not None:
            temporal_completeness = _clamp01(image_count / n_expected)

    spatial_coverage = _clamp01(result.get("valid_pixel_fraction"))
    freshness = _freshness(result.get("obs_date", period.end), freshness_days)

    return {
        "spatial_coverage": spatial_coverage,
        "source_quality": source_quality,
        "temporal_completeness": temporal_completeness,
        "freshness": freshness,
        # Raw measured inputs (mirrors EeWorkerResultItem in _shared/types.ts).
        "valid_pixel_fraction": result.get("valid_pixel_fraction"),
        "cloud_fraction": cloud_fraction,
        "mean_cloud_prob": mean_cloud_prob,
        "image_count": image_count,
        "n_observations": image_count,
        "n_expected": n_expected,
        "dataset_key": dataset_key,
    }


def _build_confidence_object(inputs: dict[str, Any]) -> dict[str, Any] | None:
    """Weighted geometric mean over the used factors (docs/09 §4)."""
    used = {
        k: _clamp01(inputs.get(k))
        for k in _CONF_WEIGHTS
        if inputs.get(k) is not None and _clamp01(inputs.get(k)) is not None
    }
    if not used:
        return None
    wsum = sum(_CONF_WEIGHTS[k] for k in used)
    if wsum <= 0:
        return None
    eps = 1e-6
    logc = sum(
        (_CONF_WEIGHTS[k] / wsum) * math.log(max(v, eps)) for k, v in used.items()
    )
    score = _clamp01(math.exp(logc)) or 0.0
    if score >= 0.80:
        level = "High"
    elif score >= 0.50:
        level = "Medium"
    else:
        level = "Low"
    factors = {
        k: {"value": round(v, 4), "weight": round(_CONF_WEIGHTS[k] / wsum, 4)}
        for k, v in used.items()
    }
    return {"score": round(score, 3), "level": level, "factors": factors}


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
def _dispatch(
    geometry: ee.Geometry,
    indicators: list[str],
    period: Period,
    options: ComputeOptions,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    """Run each owning pipeline; collect results and per-indicator errors."""
    results: dict[str, dict[str, Any]] = {}
    errors: list[dict[str, str]] = []

    cloud_thr = (
        options.cloud_prob_threshold
        if options.cloud_prob_threshold is not None
        else 40.0
    )
    composite = options.composite or "median"

    s2_wanted = [i for i in indicators if i in _S2_INDICATORS]
    water_wanted = [i for i in indicators if i in _WATER_INDICATORS]
    chirps_wanted = [i for i in indicators if i in _CHIRPS_INDICATORS]

    if s2_wanted:
        try:
            results.update(
                s2_pipe.compute_indices(
                    geometry,
                    period.start,
                    period.end,
                    s2_wanted,
                    cloud_prob_threshold=cloud_thr,
                    composite=composite,
                )
            )
        except PipelineError as exc:
            for ind in s2_wanted:
                errors.append({"indicator": ind, "code": exc.code, "message": str(exc)})
        except ee.EEException as exc:  # pragma: no cover - needs live EE
            for ind in s2_wanted:
                errors.append({"indicator": ind, "code": "EE_ERROR", "message": str(exc)})

    if water_wanted:
        try:
            results.update(
                water_pipe.compute_surface_water(
                    geometry,
                    period.start,
                    period.end,
                    cloud_prob_threshold=cloud_thr,
                    composite=composite,
                )
            )
        except PipelineError as exc:
            for ind in water_wanted:
                errors.append({"indicator": ind, "code": exc.code, "message": str(exc)})
        except ee.EEException as exc:  # pragma: no cover - needs live EE
            for ind in water_wanted:
                errors.append({"indicator": ind, "code": "EE_ERROR", "message": str(exc)})

    if chirps_wanted:
        # CHIRPS indicators are independent; run/catch each so one failing (e.g.
        # spi_3 short history) does not suppress the other (precip_mm).
        for ind in chirps_wanted:
            try:
                results.update(
                    chirps_pipe.compute_chirps(
                        geometry, period.start, period.end, [ind]
                    )
                )
            except PipelineError as exc:
                errors.append({"indicator": ind, "code": exc.code, "message": str(exc)})
            except ee.EEException as exc:  # pragma: no cover - needs live EE
                errors.append({"indicator": ind, "code": "EE_ERROR", "message": str(exc)})

    return results, errors


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness probe; reports whether EE has been initialized in this process."""
    return {
        "status": "ok",
        "service": "mizan-ee-worker",
        "version": __version__,
        "ee_initialized": is_initialized(),
    }


@app.post("/compute", dependencies=[Depends(require_bearer)])
def compute(spec: JobSpec) -> dict[str, Any]:
    """Run the requested indicators and persist results with provenance."""
    settings = get_settings()

    # Validate indicators up front.
    requested = spec.indicators or []
    if not requested:
        raise HTTPException(status_code=422, detail="No indicators requested")
    unknown = [i for i in requested if i not in SUPPORTED_INDICATORS]
    known = [i for i in requested if i in SUPPORTED_INDICATORS]

    errors: list[dict[str, str]] = [
        {
            "indicator": ind,
            "code": "UNSUPPORTED_INDICATOR",
            "message": f"Indicator '{ind}' is not supported by this worker.",
        }
        for ind in unknown
    ]

    if not known:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "No supported indicators requested.",
                "errors": errors,
            },
        )

    # Earth Engine session (idempotent) + Supabase writer.
    init_ee(settings)
    writer = SupabaseWriter(settings)

    try:
        aoi = resolve_aoi(
            aoi_geojson=spec.aoi, region_id=spec.region_id, writer=writer
        )
        if spec.persist and not aoi.region_id:
            # indicator_values.region_id is NOT NULL -> we cannot persist values
            # for an ad-hoc GeoJSON AOI that does not map to a stored region.
            # (Compute-only requests, persist=False, may omit region_id; the
            # calling Edge Function owns persistence.)
            raise HTTPException(
                status_code=422,
                detail=(
                    "AOI has no stored region_id; indicator_values.region_id is "
                    "NOT NULL. Provide a region_id (uuid or code) to persist."
                ),
            )

        computed, pipe_errors = _dispatch(aoi.geometry, known, spec.period, spec.options)
        errors.extend(pipe_errors)

        results_out: list[dict[str, Any]] = []
        for indicator, res in computed.items():
            unit = INDICATOR_UNITS.get(indicator, "1")
            dataset_key = res.get("dataset_key")
            dataset_id = writer.get_dataset_id(dataset_key) if dataset_key else None
            dataset_row = None
            if dataset_id:
                # Re-fetch full dataset row for confidence priors.
                rows = writer._get(  # noqa: SLF001 - internal helper reuse
                    "/datasets",
                    {
                        "select": "id,key,source_quality,freshness_threshold_days,attribution",
                        "id": f"eq.{dataset_id}",
                        "limit": "1",
                    },
                )
                dataset_row = rows[0] if rows else None

            indicator_id = writer.get_indicator_id(indicator)
            if not indicator_id:
                errors.append(
                    {
                        "indicator": indicator,
                        "code": "UNKNOWN_INDICATOR_CODE",
                        "message": f"indicators.code '{indicator}' not in catalog.",
                    }
                )
                continue

            conf_inputs = _confidence_inputs(
                res, period=spec.period, dataset=dataset_row
            )
            conf_obj = _build_confidence_object(conf_inputs)

            # ---- persist provenance / value / confidence (persist mode only)
            # On-demand requests arrive via the ee-compute Edge Function with
            # persist=False: that function owns persistence (idempotency +
            # audit_log) to avoid double-writing. Scheduled / direct jobs persist
            # here. Compute-only mode still returns the REAL computed values and
            # confidence — we never fabricate; we only skip the DB writes.
            provenance_id: str | None = None
            if spec.persist:
                # ---- write provenance (first; traceability spine) ----------
                params = _provenance_parameters(res, spec, aoi, conf_inputs)
                prov_row = build_provenance(
                    source="Earth Engine / Copernicus" if dataset_key != "chirps_daily"
                    else "Earth Engine / CHIRPS",
                    ee_asset_id=res.get("ee_asset_id"),
                    period_start=spec.period.start,
                    period_end=spec.period.end,
                    processing_method=res.get("processing_method", indicator),
                    processing_version=settings.processing_version,
                    computed_by=settings.computed_by,
                    image_count=res.get("image_count"),
                    parameters=params,
                    dataset_id=dataset_id,
                )
                provenance_id = writer.insert_provenance(prov_row)

                # ---- write indicator value ---------------------------------
                iv_row: dict[str, Any] = {
                    "region_id": aoi.region_id,
                    "indicator_id": indicator_id,
                    "obs_date": res["obs_date"],
                    "value": res["value"],
                    "provenance_id": provenance_id,
                }
                if conf_obj:
                    iv_row["confidence"] = conf_obj["score"]
                indicator_value_id = writer.insert_indicator_value(iv_row)

                # ---- write confidence (authoritative six-factor record) ----
                if conf_obj:
                    writer.insert_confidence(
                        {
                            "metric_kind": "indicator_value",
                            "metric_id": indicator_value_id,
                            "factors": conf_obj["factors"],
                            "score": conf_obj["score"],
                            "level": conf_obj["level"],
                        }
                    )

            quality = {
                "image_count": res.get("image_count"),
                "valid_pixel_fraction": res.get("valid_pixel_fraction"),
                "mean_cloud_prob": res.get("mean_cloud_prob"),
            }
            if "threshold" in res:
                quality["threshold"] = res["threshold"]
                quality["threshold_method"] = res.get("threshold_method")

            results_out.append(
                {
                    "indicator": indicator,
                    "obs_date": res["obs_date"],
                    "value": res["value"],
                    "unit": unit,
                    "provenance_id": provenance_id,
                    "quality": quality,
                    "confidence_inputs": conf_inputs,
                    "confidence": (
                        {"score": conf_obj["score"], "level": conf_obj["level"]}
                        if conf_obj
                        else None
                    ),
                    # Flat fields mirrored for the ee-compute Edge Function
                    # (EeWorkerResultItem, _shared/types.ts).
                    "valid_pixel_fraction": res.get("valid_pixel_fraction"),
                    "cloud_fraction": conf_inputs.get("cloud_fraction"),
                    "n_observations": conf_inputs.get("n_observations"),
                    "n_expected": conf_inputs.get("n_expected"),
                    "ee_asset_id": res.get("ee_asset_id"),
                    "dataset_key": dataset_key,
                    "processing_method": res.get("processing_method"),
                }
            )

        body: dict[str, Any] = {
            "region_id": aoi.region_id,
            "results": results_out,
            "errors": errors,
        }

        # Honest-data: if nothing succeeded, surface 422 with the errors.
        if not results_out:
            raise HTTPException(status_code=422, detail=body)

        return body
    except SupabaseWriteError as exc:
        raise HTTPException(status_code=502, detail=f"Supabase write failed: {exc}")
    finally:
        writer.close()


def _provenance_parameters(
    res: dict[str, Any],
    spec: JobSpec,
    aoi: Any,
    conf_inputs: dict[str, Any],
) -> dict[str, Any]:
    """Assemble provenance.parameters jsonb with the salient inputs + quality."""
    params: dict[str, Any] = {
        "scale_m": res.get("scale_m"),
        "image_count": res.get("image_count"),
        "valid_pixel_fraction": res.get("valid_pixel_fraction"),
        "mean_cloud_prob": res.get("mean_cloud_prob"),
        "ee_endpoint": get_settings().ee_endpoint,
        "aoi_source": aoi.source,
        "region_code": aoi.region_code,
        # Confidence inputs so the value is reproducible from provenance alone.
        "confidence_inputs": {
            k: conf_inputs.get(k)
            for k in (
                "spatial_coverage",
                "source_quality",
                "temporal_completeness",
                "freshness",
                "n_observations",
                "n_expected",
            )
        },
    }
    for key in (
        "cloud_prob_threshold",
        "composite",
        "threshold",
        "threshold_method",
        "spi_k_months",
        "baseline_start_year",
        "baseline_end_year",
        "baseline_n",
        "distribution",
        "dataset_key",
    ):
        if key in res:
            params[key] = res[key]
    return {k: v for k, v in params.items() if v is not None}
