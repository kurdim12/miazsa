# MIZAN EE Worker

The **Earth Engine compute service** for the MIZAN Phase-2 vertical slice. It is
the only component permitted to call the Earth Engine Python API (docs/05 §1.1).
Given a JobSpec it runs the spectral / hydrological pipelines over an AOI and
period, captures full **provenance**, and writes traceable results into Supabase
Postgres via PostgREST.

Slice path: **EE Worker → Supabase → Edge Functions → React** for the Azraq Basin.

## What it computes

| Indicator | Unit | Pipeline | Source assets |
|---|---|---|---|
| `ndvi`, `ndwi`, `mndwi` | `1` | `pipelines/s2_indices.py` | `COPERNICUS/S2_SR_HARMONIZED` + `COPERNICUS/S2_CLOUD_PROBABILITY` |
| `surface_water_extent_km2` | `km2` | `pipelines/surface_water.py` | S2 MNDWI composite + Otsu |
| `precip_mm` | `mm` | `pipelines/chirps.py` | `UCSB-CHG/CHIRPS/DAILY` |
| `spi_3` | `1` | `pipelines/chirps.py` | CHIRPS 3-month accumulation, gamma-fit SPI |

Formulas (docs/06 §1.2): NDVI = (NIR−Red)/(NIR+Red); NDWI = (Green−NIR)/(Green+NIR);
MNDWI = (Green−SWIR1)/(Green+SWIR1). S2 bands: Blue=B2, Green=B3, Red=B4, NIR=B8,
SWIR1=B11, SWIR2=B12. Surface water: MNDWI > Otsu threshold → `pixelArea` sum → km².

## Honest-data behaviour (non-negotiable)

If a period/AOI has **no valid imagery** for an indicator (zero scenes, a
fully cloud-masked composite, or — for SPI — insufficient baseline history), the
worker returns that indicator as a **422-style error item** and **writes
nothing**. It never invents, defaults, or interpolates a value. If *every*
requested indicator fails, `POST /compute` returns HTTP **422**.

Every persisted value writes a `provenance` row **first** (the NOT NULL
`provenance_id` FK on `indicator_values` makes an unattributed value impossible),
then the `indicator_values` row, then an authoritative `confidence_scores` row.
The confidence inputs (valid-pixel fraction → `spatial_coverage`, image count →
`temporal_completeness`, mean cloud probability / dataset reliability →
`source_quality`, observation recency → `freshness`) are also echoed into
`provenance.parameters` so any value is reproducible from its provenance alone.

## Configuration

Environment variables (see `.env.example`):

| Var | Purpose |
|---|---|
| `GEE_PROJECT_ID` | Earth Engine / GCP project id |
| `GEE_SA_JSON` | GEE service-account key: a **path** to the JSON file, or the **inline JSON** string |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (server-side only; bypasses RLS) |
| `EE_WORKER_AUTH_TOKEN` | shared bearer secret required on `POST /compute` |
| `EE_HIGH_VOLUME` | use the `earthengine-highvolume` endpoint (default `true`) |
| `SPI_BASELINE_START_YEAR` / `SPI_BASELINE_END_YEAR` | CHIRPS SPI climatology baseline (default 1991–2020) |

> **Real GEE credentials are required to run end to end.** The worker
> authenticates with a *GEE-registered* service account (`ee.ServiceAccountCredentials`)
> and calls live Earth Engine; there is no offline/mock data path (that would
> violate the honest-data rule). The service account must be enrolled in your
> Earth Engine project and the Supabase catalogs (`datasets`, `indicators`,
> `regions`) must be seeded (see `supabase/migrations/`).

## Run locally

```bash
cd ee-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in real values

uvicorn app.main:app --reload --port 8080
```

Health check:

```bash
curl -s http://localhost:8080/health
# {"status":"ok","service":"mizan-ee-worker","version":"0.1.0","ee_initialized":false}
```

## `POST /compute` example

Authenticated with the bearer token. Resolve the AOI from a stored region
(`region_id` may be the `regions.id` uuid or the `regions.code`, e.g.
`azraq_basin`), or pass an inline GeoJSON polygon **together with** a
`region_id` (the NOT NULL `indicator_values.region_id` must resolve to a stored
region for results to persist).

```bash
curl -s -X POST http://localhost:8080/compute \
  -H "Authorization: Bearer $EE_WORKER_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "region_id": "azraq_basin",
    "indicators": ["ndvi", "mndwi", "surface_water_extent_km2", "precip_mm", "spi_3"],
    "period": { "start": "2024-06-01", "end": "2024-07-01" },
    "options": { "cloud_prob_threshold": 40, "composite": "median" }
  }'
```

Response shape:

```jsonc
{
  "region_id": "…uuid…",
  "results": [
    {
      "indicator": "ndvi",
      "obs_date": "2024-07-01",
      "value": 0.234,
      "unit": "1",
      "provenance_id": "…uuid…",
      "quality": { "image_count": 6, "valid_pixel_fraction": 0.97, "mean_cloud_prob": 8.1 },
      "confidence_inputs": { "spatial_coverage": 0.97, "source_quality": 0.90, "…": "…" },
      "confidence": { "score": 0.86, "level": "High" }
    }
  ],
  "errors": [
    { "indicator": "spi_3", "code": "INSUFFICIENT_HISTORY", "message": "…" }
  ]
}
```

Each result item also carries the flat fields the `ee-compute` Edge Function
consumes (`valid_pixel_fraction`, `cloud_fraction`, `n_observations`,
`n_expected`, `ee_asset_id`, `dataset_key`, `processing_method`).

## Container

```bash
docker build -t mizan-ee-worker .
docker run --rm -p 8080:8080 --env-file .env mizan-ee-worker
```

The image runs as a non-root user, listens on `$PORT` (default 8080), and ships
a `HEALTHCHECK` against `/health`. See docs/18-deployment.md for Cloud Run.
