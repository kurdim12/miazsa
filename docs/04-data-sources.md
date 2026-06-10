# 04 — Data Sources

| | |
|---|---|
| **Document** | 04 — Data Sources |
| **Project** | MIZAN — Earth Observation Environmental Intelligence for Jordan |
| **Version** | 0.1 (Draft) |
| **Status** | Phase 1 — Specification |
| **Last updated** | 2026-06-10 |
| **Related** | [01-project-overview](./01-project-overview.md) · [02-problem-definition](./02-problem-definition.md) · [03-system-architecture](./03-system-architecture.md) · [05-earth-engine-pipelines](./05-earth-engine-pipelines.md) · [06-remote-sensing-methods](./06-remote-sensing-methods.md) · [07-machine-learning](./07-machine-learning.md) · [08-risk-scoring](./08-risk-scoring.md) · [09-confidence-engine](./09-confidence-engine.md) · [11-database-schema](./11-database-schema.md) · [16-validation-framework](./16-validation-framework.md) · [19-astrocode-compliance](./19-astrocode-compliance.md) · [20-limitations](./20-limitations.md) |

**Purpose.** This document is the authoritative catalog of every Earth Observation (EO) and geospatial dataset MIZAN consumes, the role each plays in estimating groundwater-stress **indicators**, and the preprocessing required before any value is trusted. It records exact Google Earth Engine (GEE) asset IDs, providers, resolutions, revisit/latency, bands used, licenses/attribution, caveats, and update cadence. Crucially, it ties each dataset to the **freshness** factor of the confidence engine ([09-confidence-engine](./09-confidence-engine.md)) and to the **provenance** model ([11-database-schema](./11-database-schema.md)). It enforces the non-negotiable rule: **MIZAN never fabricates environmental, satellite, rainfall, or groundwater data** — every number originates from one of the assets below, from stored datasets, or from model outputs derived from them.

**Scientific reminder.** MIZAN does **not** directly observe groundwater, wells, the water table, or aquifer pressure. The datasets below supply **proxies** (vegetation, surface water, rainfall, radar moisture, terrain, regional mass change) that feed a transparent water-balance / risk model. Dataset caveats in this document are part of why outputs are bounded by confidence and never presented as direct groundwater measurement.

**Deliverables mapping.** Directly supports the AstroCode **Data Explanation** deliverable, and underpins **AI/Analytics Method**, **Results Visualization**, **Jordanian Use Case**, and **Impact Statement** by guaranteeing provenance and honest data limits.

---

## 1. Dataset portfolio overview

MIZAN's datasets fall into a **core** set (always used) and an **optional/enrichment** set (used where they add value to specific indicators or improve confidence via convergence).

| Tier | Dataset | EE Asset ID | Primary contribution |
|------|---------|-------------|----------------------|
| Core | Sentinel-2 SR (Harmonized) | `COPERNICUS/S2_SR_HARMONIZED` | Vegetation & water indices (NDVI/EVI/SAVI/NDWI/MNDWI), crop/irrigation mapping |
| Core | Sentinel-2 Cloud Probability | `COPERNICUS/S2_CLOUD_PROBABILITY` | Cloud masking companion for S2 SR |
| Core | Sentinel-1 GRD | `COPERNICUS/S1_GRD` | Radar backscatter (VV/VH), RVI, soil-moisture proxy; all-weather |
| Core | CHIRPS Daily | `UCSB-CHG/CHIRPS/DAILY` | Precipitation, anomalies, SPI |
| Core | CHIRPS Pentad | `UCSB-CHG/CHIRPS/PENTAD` | Faster-latency precip aggregation |
| Core | SRTM | `USGS/SRTMGL1_003` | Terrain (elevation/slope) for watershed, masks, recharge context |
| Core | FAO GAUL L1 | `FAO/GAUL/2015/level1` | Governorate-level admin boundaries |
| Core | FAO GAUL L2 | `FAO/GAUL/2015/level2` | District-level admin boundaries |
| Core | Azraq Basin boundary | Authoritative MWI / derived watershed | Primary demo AOI |
| Optional | Landsat 8 L2 | `LANDSAT/LC08/C02/T1_L2` | Historical/long-baseline optical, cross-check |
| Optional | Landsat 9 L2 | `LANDSAT/LC09/C02/T1_L2` | Optical continuity with Landsat 8 |
| Optional | SMAP L4 | `NASA/SMAP/SPL4SMGP/007` | Modeled soil moisture (root-zone) |
| Optional | ERA5-Land Hourly | `ECMWF/ERA5_LAND/HOURLY` | Meteorology for ET0 (Penman-Monteith) |
| Optional | ERA5-Land Daily Agg | `ECMWF/ERA5_LAND/DAILY_AGGR` | Daily meteorology aggregates |
| Optional | VIIRS Nightlights | `NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG` | Human-activity proxy (pumping/settlement context) |
| Optional | GRACE Mascon | `NASA/GRACE/MASS_GRIDS_V03/MASCON_CRI` | **Coarse, regional** terrestrial water-storage context only |

> **GRACE caveat is load-bearing:** GRACE/GRACE-FO mascon products are extremely coarse (sub-degree to ~degree-scale). In MIZAN they provide **regional storage context only** (weight 0.10 in the risk index, see [08-risk-scoring](./08-risk-scoring.md)) and are never interpreted as local groundwater at AOI scale.

---

## 2. Core datasets (detailed)

### 2.1 Sentinel-2 SR (Harmonized) — `COPERNICUS/S2_SR_HARMONIZED`
- **Provider / mission:** ESA Copernicus; Sentinel-2A/2B (MSI), Surface Reflectance (Level-2A), harmonized collection.
- **Spatial resolution:** 10 m (B2, B3, B4, B8), 20 m (B5–B7, B8A, B11, B12), 60 m (B1, B9, B10 — atmospheric).
- **Temporal resolution / revisit:** ~5 days (combined S2A+S2B at the equator; better at Jordan's latitude with overlap). Collection start 2017 (harmonized continuity from 2015 era via the harmonized collection conventions).
- **Bands used in MIZAN:** B2 (blue), B3 (green), B4 (red), B8 (NIR), B8A (red-edge NIR), B11 (SWIR1), B12 (SWIR2). Plus QA60 / Scene Classification (SCL) for masking, used with the separate cloud-probability product.
- **Latency:** L2A typically available ~hours–days after acquisition in the EE catalog.
- **License / attribution:** Copernicus open data; attribution "Contains modified Copernicus Sentinel data [year]." Free for any use.
- **MIZAN role:** Backbone of vegetation indices (`ndvi`, `evi`, `savi`, `ndvi_anomaly`) and water indices (`ndwi`, `mndwi`, `surface_water_extent_km2`); primary input to crop classification (`rf_crop_classifier`) and irrigation detection (`xgb_irrigation_detector`); supports `agri_expansion_pct`, `cropland_area_ha`, `irrigated_area_ha`.
- **Caveats / quality flags:** Cloud/cirrus/shadow contamination; SCL imperfections; BRDF/illumination effects; 20 m SWIR for MNDWI limits fine water mapping; harmonization offset (post-2022 reflectance offset) must be applied for cross-time consistency.
- **Required preprocessing:** (1) Cloud/shadow masking by joining `COPERNICUS/S2_CLOUD_PROBABILITY` and SCL; (2) apply harmonization/reflectance-offset correction; (3) scale reflectance (÷10000); (4) temporal compositing (median over window) to suppress residual clouds; (5) clip to region geometry; (6) compute indices per [06-remote-sensing-methods](./06-remote-sensing-methods.md).

### 2.2 Sentinel-2 Cloud Probability — `COPERNICUS/S2_CLOUD_PROBABILITY`
- **Provider:** Sentinel Hub / ESA (s2cloudless), distributed in EE.
- **Spatial resolution:** 10 m probability raster aligned to S2.
- **Temporal:** matches S2 acquisitions (joined by index/time).
- **Bands used:** `probability` (0–100% cloud likelihood).
- **MIZAN role:** Companion mask for S2 SR; thresholded (e.g., >40–60%) and dilated, combined with SCL shadow/cloud classes and a cloud-shadow projection step.
- **Caveats:** Threshold choice trades omission vs. commission; thin cirrus and bright surfaces (sabkha/salt flats common around Azraq) can confuse detection.
- **Preprocessing:** Join to S2 SR by system index; build a combined cloud+shadow mask; record the threshold in provenance `parameters`.

### 2.3 Sentinel-1 GRD — `COPERNICUS/S1_GRD`
- **Provider / mission:** ESA Copernicus; Sentinel-1A/1B C-band SAR, Ground Range Detected.
- **Spatial resolution:** ~10 m (IW mode, GRD).
- **Temporal / revisit:** ~6–12 days depending on constellation availability and orbit overlap.
- **Bands used:** `VV`, `VH` (IW). Angle band used for normalization context.
- **Latency:** Typically ~1 day in the EE catalog after acquisition.
- **License / attribution:** Copernicus open data; same attribution as S2.
- **MIZAN role:** All-weather (cloud-independent) backscatter → `s1_vv`, `s1_vh`, Radar Vegetation Index `s1_rvi`, and a `soil_moisture_proxy`; strengthens irrigation detection (irrigated fields show characteristic VV/VH dynamics) and provides **convergence** with optical signals (improves confidence's convergence factor).
- **Caveats:** Speckle noise; sensitivity to surface roughness and incidence angle; geometric distortions in steep terrain; not a calibrated soil-moisture product (hence "proxy").
- **Required preprocessing:** (1) Filter to IW mode, VV+VH, ascending/descending consistency; (2) GRD border-noise handling; (3) **speckle filtering** (e.g., refined Lee / focal-mean window) — kernel recorded in provenance; (4) convert to dB if needed; (5) optional terrain/angle normalization; (6) clip to region; (7) derive RVI = 4·VH / (VV + VH).

### 2.4 CHIRPS Daily — `UCSB-CHG/CHIRPS/DAILY`
- **Provider:** UCSB Climate Hazards Group (CHIRPS v2).
- **Spatial resolution:** ~0.05° (~5.5 km).
- **Temporal:** Daily; archive from 1981 — enables robust climatology for SPI and anomalies.
- **Bands used:** `precipitation` (mm/day).
- **Latency:** Final product latency ~3 weeks; preliminary product earlier (lower confidence).
- **License / attribution:** Public domain / open; cite Funk et al. (CHIRPS).
- **MIZAN role:** Core precipitation source → `precip_mm`, `precip_anomaly_pct`, and standardized precipitation indices `spi_1`, `spi_3`, `spi_6`, `spi_12`; feeds recharge-proxy and water-balance terms ([08-risk-scoring](./08-risk-scoring.md)).
- **Caveats:** Coarse for small AOIs; blends satellite + station data (sparse stations in arid Jordan increase uncertainty); preliminary vs. final versions differ — version recorded in provenance.
- **Required preprocessing:** (1) Sum/aggregate to target windows (monthly, seasonal); (2) build long-term climatology (mean/SD per window) for anomalies and SPI fitting (gamma → standard normal); (3) clip/zonal-reduce to region; (4) record CHIRPS version (preliminary/final) in provenance.

### 2.5 CHIRPS Pentad — `UCSB-CHG/CHIRPS/PENTAD`
- **Provider:** UCSB CHG.
- **Spatial resolution:** ~0.05°.
- **Temporal:** Pentad (5-day) totals; 1981–present.
- **Bands used:** `precipitation` (mm/pentad).
- **Latency:** Lower than daily-final for near-real-time monitoring.
- **MIZAN role:** Faster-cadence precip aggregation for timely anomaly signals where daily-final latency is too slow; supports SPI computation at coarser temporal granularity.
- **Caveats:** Same blending limitations as daily; pentad boundaries fixed (non-calendar).
- **Preprocessing:** Aggregate pentads to months/seasons; align with daily-final when both available; flag which product was used in provenance.

### 2.6 SRTM — `USGS/SRTMGL1_003`
- **Provider:** NASA/USGS SRTM Global 1 arc-second.
- **Spatial resolution:** ~30 m.
- **Temporal:** Single epoch (Feb 2000) — static terrain.
- **Bands used:** `elevation`.
- **License / attribution:** Public domain (NASA/USGS).
- **MIZAN role:** Derives slope/aspect for watershed delineation, supports the Azraq Basin boundary derivation/QA, masks (e.g., excluding steep terrain from irrigation candidates), and provides terrain context for recharge-proxy reasoning.
- **Caveats:** Voids in original data (filled in this product); ~2000 epoch (no recent terrain change); vertical accuracy limits fine hydrological delineation.
- **Preprocessing:** Compute slope/aspect via `ee.Terrain`; hydrologically condition (fill) if used for flow accumulation; clip to study area.

### 2.7 FAO GAUL — `FAO/GAUL/2015/level1` & `FAO/GAUL/2015/level2`
- **Provider:** FAO Global Administrative Unit Layers (2015).
- **Spatial:** Vector polygons; L1 = first-level admin (governorates), L2 = second-level (districts).
- **Temporal:** 2015 boundary snapshot.
- **Fields used:** Admin names/codes (e.g., `ADM1_NAME`, `ADM1_CODE`, `ADM2_NAME`, `ADM2_CODE`), country filter for Jordan.
- **License / attribution:** FAO GAUL terms (attribution to FAO; not for use in disputed-boundary determination).
- **MIZAN role:** Source for `regions` rows at governorate/district level for **national Jordan** scope; zonal reduction units for indicators; map admin overlays.
- **Caveats:** GAUL boundaries are for analytical convenience, **not** legal/authoritative delimitation; possible mismatches with national official boundaries; 2015 vintage.
- **Preprocessing:** Filter to Jordan; simplify geometries for rendering (keep full-resolution copy for analysis); store with SRID 4326; record source + vintage in provenance/datasets.

### 2.8 Azraq Basin boundary — authoritative MWI / derived watershed
- **Provider / source:** Jordan Ministry of Water and Irrigation (MWI) authoritative basin boundary where available, and/or a watershed delineation **derived from SRTM** and reconciled with authoritative hydrogeological references.
- **Spatial:** Vector polygon (the Azraq Basin AOI — the **demo** focus).
- **MIZAN role:** Primary demonstration AOI for groundwater-stress monitoring, surface-water/oasis decline tracking, and the digital twin scenarios ([10-digital-twin](./10-digital-twin.md)).
- **Caveats / governance:** **Never fabricated.** If an authoritative MWI geometry is used, it is ingested verbatim and credited; if a watershed is derived from SRTM, the derivation method and `processing_version` are recorded in provenance, and the result is clearly labeled "derived watershed (illustrative)" until reconciled with an authoritative source. Boundary choice materially affects zonal statistics, so it is versioned and auditable.
- **Preprocessing:** Validate geometry (no self-intersections), set SRID 4326, store as a `regions` row of type "basin", attach a `datasets`/`provenance` record describing origin.

---

## 3. Optional / enrichment datasets (detailed)

### 3.1 Landsat 8 & 9 L2 — `LANDSAT/LC08/C02/T1_L2`, `LANDSAT/LC09/C02/T1_L2`
- **Provider:** USGS/NASA; Collection 2, Level-2 surface reflectance (Tier 1).
- **Spatial:** 30 m (reflective); 100 m thermal resampled to 30 m.
- **Temporal / revisit:** 16 days each; ~8 days combined (L8+L9); archive back to 2013 (L8) / 2021 (L9), with the broader Landsat record extending decades for long baselines.
- **Bands used:** SR_B2–SR_B7 (blue→SWIR2), QA_PIXEL for masking; thermal optional.
- **License / attribution:** Public domain (USGS).
- **MIZAN role:** Long-baseline optical cross-check and historical context for vegetation/water indices; cross-sensor convergence with Sentinel-2 (raises confidence's convergence factor); fills gaps where S2 history is short.
- **Caveats:** Coarser than S2 (30 m); cloud limitations; cross-sensor harmonization needed (spectral response differs from S2); Collection-2 scaling factors must be applied.
- **Preprocessing:** Apply C2 scale/offset; cloud mask via QA_PIXEL bitmask; harmonize to S2-equivalent indices where compared; composite; clip.

### 3.2 SMAP L4 — `NASA/SMAP/SPL4SMGP/007`
- **Provider:** NASA SMAP, Level-4 Global 3-hourly surface & root-zone soil moisture (model-assimilated).
- **Spatial:** ~9 km (L4 model grid).
- **Temporal:** 3-hourly; 2015–present.
- **Bands used:** `sm_surface`, `sm_rootzone`.
- **License / attribution:** NASA open data.
- **MIZAN role:** Independent (modeled) soil-moisture reference to corroborate the Sentinel-1 `soil_moisture_proxy`; convergence input; context for ET/water-balance.
- **Caveats:** Coarse (9 km) — sub-grid heterogeneity; L4 is a **model assimilation**, not a direct measurement; limited value for small fields.
- **Preprocessing:** Temporal aggregation to daily/weekly; zonal mean to region; align units; record version 007 in provenance.

### 3.3 ERA5-Land — `ECMWF/ERA5_LAND/HOURLY` & `ECMWF/ERA5_LAND/DAILY_AGGR`
- **Provider:** ECMWF Copernicus Climate Change Service (C3S) reanalysis.
- **Spatial:** ~0.1° (~9–11 km).
- **Temporal:** Hourly (and daily aggregates); 1950–present (with a short rolling latency).
- **Bands used:** 2 m temperature (→ `tmax_c`, `tmin_c`), dewpoint (→ `rh_pct`), 10 m wind components (→ `wind_2m` after log-wind adjustment), surface solar radiation (→ `srad_mj`), and total precipitation (cross-check).
- **License / attribution:** Copernicus C3S; cite "Generated using Copernicus Climate Change Service information [year]."
- **MIZAN role:** Meteorological drivers for the **Penman-Monteith** reference evapotranspiration model (`penman_monteith` → `et0_pm_mm`), and hence crop water demand `etc_mm`; supports the water-balance / abstraction-pressure terms.
- **Caveats:** Reanalysis (modeled, not station-direct); ~9 km coarseness; latency for the most recent days; wind at 10 m requires conversion to 2 m.
- **Preprocessing:** Aggregate hourly→daily; convert units (K→°C, J→MJ, dewpoint→RH); wind 10 m→2 m; compute ET0 per FAO-56; clip/zonal-reduce; record formulas/version in provenance.

### 3.4 VIIRS Nightlights — `NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG`
- **Provider:** NOAA/Colorado School of Mines; VIIRS Day/Night Band monthly composites (stray-light corrected).
- **Spatial:** ~500 m.
- **Temporal:** Monthly; 2012–present.
- **Bands used:** `avg_rad` (nW/cm²/sr).
- **License / attribution:** NOAA open data.
- **MIZAN role:** Proxy for human activity / settlement / potential pumping infrastructure intensity, providing weak context for abstraction pressure and agricultural-expansion interpretation (used cautiously, low weight, convergence only).
- **Caveats:** Indirect proxy; gas flares, lighting changes, and lunar/cloud effects confound; **must not** be read as direct pumping.
- **Preprocessing:** Cloud-free monthly compositing (use cf_cvg), outlier/flare masking, zonal stats; clearly label as proxy in provenance.

### 3.5 GRACE Mascon — `NASA/GRACE/MASS_GRIDS_V03/MASCON_CRI`
- **Provider:** NASA JPL GRACE / GRACE-FO mascon (CRI-filtered) terrestrial water-storage anomaly.
- **Spatial:** Native mascon ~3°; provided on a ~0.5° grid (still **coarse**, regional only).
- **Temporal:** Monthly; 2002–present with the GRACE→GRACE-FO gap (2017–2018) — gap recorded and handled.
- **Bands used:** `lwe_thickness` (liquid water equivalent thickness anomaly, cm) → `gws_anomaly_cm` (regional context), feeding the GRACE term `gws_anomaly_cm` / regional storage component.
- **License / attribution:** NASA open data; cite JPL GRACE mascon.
- **MIZAN role:** **Regional storage context only** — the 0.10-weight "regional storage (GRACE)" component of `gw_stress_index` ([08-risk-scoring](./08-risk-scoring.md)). Provides a coarse, independent line of evidence for basin-scale water-storage decline.
- **Caveats (critical):** Far too coarse for AOI/field scale; signal mixes surface water, soil moisture, snow, and groundwater; the 2017–2018 mission gap; leakage/processing assumptions. **Never** presented as local groundwater observation.
- **Preprocessing:** Subset to the Jordan/regional window; treat as regional context (do not downscale to AOI); handle mission gap explicitly; record version V03 + CRI in provenance.

---

## 4. Band & index derivation table

All formulas are specified normatively in [06-remote-sensing-methods](./06-remote-sensing-methods.md); this table maps **source bands → indicator codes** for cross-reference and for the datasets→indicators mapping in §8.

| Indicator code | Formula (canonical) | Source bands / dataset | Notes |
|----------------|---------------------|------------------------|-------|
| `ndvi` | (NIR − Red)/(NIR + Red) | S2 B8, B4 (or Landsat SR_B5, SR_B4) | Vegetation greenness |
| `evi` | 2.5·(NIR − Red)/(NIR + 6·Red − 7.5·Blue + 1) | S2 B8, B4, B2 | Reduces soil/atmosphere effects |
| `savi` | (1+L)·(NIR − Red)/(NIR + Red + L), L=0.5 | S2 B8, B4 | Soil-adjusted; arid-friendly |
| `ndvi_anomaly` | NDVI − NDVI_climatology (z or %) | S2 time series | Vs. per-pixel seasonal baseline |
| `ndwi` | (Green − NIR)/(Green + NIR) | S2 B3, B8 | Open-water / vegetation moisture |
| `mndwi` | (Green − SWIR1)/(Green + SWIR1) | S2 B3, B11 | Better open-water delineation |
| `surface_water_extent_km2` | Σ(water pixels)·pixel_area | S2 MNDWI threshold + JRC context | Azraq oasis/surface water |
| `s1_vv` | VV backscatter (dB) | S1 VV | Speckle-filtered |
| `s1_vh` | VH backscatter (dB) | S1 VH | Speckle-filtered |
| `s1_rvi` | 4·VH/(VV + VH) | S1 VV, VH | Radar vegetation index |
| `soil_moisture_proxy` | f(VV, VH, angle) (relative) | S1 + SMAP cross-ref | Proxy, not calibrated SM |
| `precip_mm` | Σ precipitation over window | CHIRPS daily/pentad | mm |
| `precip_anomaly_pct` | 100·(P − P̄)/P̄ | CHIRPS climatology | % vs. mean |
| `spi_1/3/6/12` | Standardized precip index (1/3/6/12-mo) | CHIRPS (gamma→normal) | Drought metric |
| `tmax_c`,`tmin_c` | Daily max/min 2 m temp | ERA5-Land | °C |
| `rh_pct` | Relative humidity from T + dewpoint | ERA5-Land | % |
| `wind_2m` | 10 m wind → 2 m (log law) | ERA5-Land | m/s |
| `srad_mj` | Surface solar radiation | ERA5-Land | MJ/m²/day |
| `et0_pm_mm` | FAO-56 Penman-Monteith | ERA5-Land drivers | Reference ET |
| `etc_mm` | Kc · ET0 | ET0 + crop coefficients | Crop water demand |
| `cropland_area_ha` | Σ cropland pixels · area | S2 (+S1) classification | `rf_crop_classifier` |
| `irrigated_area_ha` | Σ irrigated pixels · area | S2+S1 classification | `xgb_irrigation_detector` |
| `crop_class` | categorical class | S2+S1 RF | Per parcel/pixel |
| `agri_expansion_pct` | Δ cropland over baseline | S2 multi-date | Expansion detection |
| `recharge_proxy_mm` | f(precip, ET0, terrain) | CHIRPS + ERA5 + SRTM | Transparent proxy |
| `abstraction_estimate_mcm` | f(irrigated_area, etc, efficiency) | derived | Estimate, not metered |
| `water_balance_mcm` | recharge − abstraction (terms) | derived | Basin balance |
| `gws_anomaly_cm` | GRACE LWE anomaly | GRACE mascon | Regional only |
| `gw_stress_index` | weighted risk (see [08](./08-risk-scoring.md)) | composite | 0–100 |
| `gw_stress_class` | bin of index | composite | Low/Moderate/High/Severe |

---

## 5. Azraq Basin & Jordan administrative boundaries (sourcing & governance)

- **National Jordan admin units** come from **FAO GAUL 2015** (L1 governorates, L2 districts), filtered to Jordan, stored as `regions`. They are explicitly labeled as analytical (non-legal) boundaries (GAUL terms).
- **Azraq Basin** (the demo AOI) is sourced from the **MWI authoritative boundary** where available; otherwise a **SRTM-derived watershed** is used and clearly marked as derived/illustrative with full provenance, pending reconciliation.
- **Never fabricated:** No boundary is hand-drawn to fit a narrative. Each boundary row carries a `datasets` + `provenance` record (source, method, version), so any zonal statistic can be traced to the exact geometry version used.
- **Versioning:** Because zonal reductions depend on geometry, boundary updates create a new `processing_version`; historical metrics retain their original geometry reference for reproducibility.

---

## 6. Data update cadence & freshness expectations

Freshness directly feeds the **freshness factor (weight 0.20)** of the confidence engine ([09-confidence-engine](./09-confidence-engine.md)). MIZAN's scheduler ([03-system-architecture](./03-system-architecture.md) §5.1) is tuned to each dataset's realistic cadence.

| Dataset | Native cadence | EE catalog latency | MIZAN refresh target | Freshness "fresh" threshold (illustrative) |
|---------|----------------|--------------------|----------------------|--------------------------------------------|
| Sentinel-2 SR | ~5 days revisit | hours–days | per revisit composite (weekly) | ≤ 7–10 days |
| Sentinel-1 GRD | ~6–12 days | ~1 day | weekly | ≤ 12–14 days |
| CHIRPS daily (final) | daily | ~3 weeks | monthly (final) | ≤ 30–45 days |
| CHIRPS pentad / preliminary | pentad | days | near-real-time anomaly | ≤ 10–15 days (lower source_quality) |
| SRTM | static | n/a | n/a (static terrain) | always "fresh" (static) |
| FAO GAUL | static (2015) | n/a | n/a | static vintage (flagged) |
| Landsat 8/9 L2 | 16 d (8 d combined) | ~1 day | as-needed cross-check | ≤ 16 days |
| SMAP L4 | 3-hourly | ~days | weekly | ≤ 7 days |
| ERA5-Land | hourly/daily | ~5 days rolling | weekly (for ET0) | ≤ 10 days |
| VIIRS nightlights | monthly | ~weeks | monthly | ≤ 45 days |
| GRACE mascon | monthly | ~months | monthly (context) | ≤ 90 days (coarse, low weight) |

**Freshness rules of thumb**
- A metric's freshness factor decays from 1.0 toward 0 as the gap between *now* and the data's `period_end` exceeds the dataset's "fresh" threshold.
- Preliminary products (CHIRPS preliminary, ERA5 rolling) lower the **source_quality** factor while keeping freshness, making the trade-off explicit to users.
- Static datasets (SRTM, GAUL) are exempt from freshness decay but flagged for vintage (GAUL 2015) so users understand they reflect historical boundaries.

---

## 7. Required preprocessing — consolidated pipeline summary

Every dataset passes through a deterministic preprocessing chain before any value is written, and **the exact steps + parameters are recorded in `provenance.parameters` / `processing_method` / `processing_version`** ([11-database-schema](./11-database-schema.md)). The normative implementations live in [05-earth-engine-pipelines](./05-earth-engine-pipelines.md) and [06-remote-sensing-methods](./06-remote-sensing-methods.md); this is the per-dataset checklist that makes outputs reproducible.

| Dataset | Step 1 | Step 2 | Step 3 | Step 4 | Recorded params |
|---------|--------|--------|--------|--------|-----------------|
| Sentinel-2 SR | Join S2_CLOUD_PROBABILITY + SCL → cloud+shadow mask | Apply harmonization/reflectance offset; scale ÷10000 | Median composite over window | Clip to region; compute indices | `cloud_prob_threshold`, `composite`, `window`, `offset_applied` |
| Sentinel-2 Cloud Prob | Join to S2 by system index | Threshold probability | Dilate + project cloud shadows | Combine with SCL classes | `cloud_prob_threshold`, `dilation_px` |
| Sentinel-1 GRD | Filter IW, VV+VH, orbit consistency | Border-noise removal | Speckle filter (refined Lee / focal) | dB convert; RVI; clip | `orbit`, `speckle_kernel`, `window_px` |
| CHIRPS daily | Sum to target window | Build climatology (mean/SD) | Anomaly / SPI fit (gamma→normal) | Zonal-reduce to region | `window`, `chirps_version`, `spi_scale` |
| CHIRPS pentad | Aggregate pentads → month/season | Align with daily-final | SPI at coarse granularity | Zonal-reduce | `window`, `product=pentad` |
| SRTM | `ee.Terrain` slope/aspect | Hydrological fill (if flow) | Flow accumulation (if watershed) | Clip | `fill`, `flow_threshold` |
| FAO GAUL | Filter to Jordan | Simplify for render (keep full-res analysis copy) | Set SRID 4326 | Store region row | `simplify_tol`, `vintage=2015` |
| Azraq boundary | Validate geometry (no self-intersect) | Set SRID 4326 | Label source (MWI vs derived) | Store basin region | `source`, `derivation_method` |
| Landsat 8/9 L2 | Apply C2 scale/offset | QA_PIXEL bitmask cloud mask | Harmonize to S2-equivalent indices | Composite; clip | `scale`, `offset`, `qa_bits` |
| SMAP L4 | Select sm_surface/sm_rootzone | Temporal aggregate (daily/weekly) | Zonal mean to region | Unit align | `agg`, `band`, `version=007` |
| ERA5-Land | Aggregate hourly→daily | Unit convert (K→°C, J→MJ, dewpoint→RH) | Wind 10 m→2 m | FAO-56 ET0; clip | `agg`, `wind_conv`, `et0_method=PM` |
| VIIRS DNB | Cloud-free monthly composite (cf_cvg) | Flare/outlier mask | Zonal stats | Label as proxy | `cf_cvg_min`, `flare_mask` |
| GRACE mascon | Subset Jordan/regional window | Treat as regional context (no downscale) | Handle 2017–2018 gap | Unit align (LWE cm) | `version=V03_CRI`, `gap_handling` |

**Why this matters for confidence.** Steps that fail or degrade lower specific confidence factors ([09-confidence-engine](./09-confidence-engine.md)): a high residual cloud fraction lowers **spatial_coverage**; a CHIRPS *preliminary* version lowers **source_quality**; missing scenes in a window lower **temporal_completeness**; agreement (or disagreement) between Sentinel-1 soil-moisture proxy and SMAP modulates **convergence**. The geometric-mean design means any one collapsed step honestly collapses the metric's confidence.

---

## 8. Data-quality flags & failure handling

MIZAN never silently drops or guesses around bad data — it flags, attributes, and lets confidence reflect reality. Common quality conditions and the system response:

| Condition | Affected datasets | Detection | Response | Confidence effect |
|-----------|-------------------|-----------|----------|-------------------|
| Persistent cloud cover | S2, Landsat | Valid-pixel fraction below threshold | Extend composite window or fall back to S1 (all-weather); flag | ↓ spatial_coverage |
| Speckle / roughness artifacts | S1 | Variance/texture checks | Stronger speckle filter; angle normalization | ↓ source_quality if severe |
| Sparse rain-gauge support | CHIRPS | Arid-region sparsity (known) | Use as coarse signal; cross-check ERA5 precip | bounded source_quality |
| Preliminary vs final product | CHIRPS, ERA5 rolling | Version field | Use with explicit flag; recompute when final available | ↓ source_quality (keeps freshness) |
| Missing scenes / revisit gaps | S2, S1, Landsat | Observation count vs expected | Aggregate over longer window; flag gap | ↓ temporal_completeness |
| Sensor coarseness vs AOI | CHIRPS, SMAP, GRACE | Pixel size ≫ AOI | Restrict to appropriate scale (GRACE = regional only) | ↓ spatial_coverage / low weight |
| Mission gap | GRACE (2017–2018) | Date range | Explicit gap handling; no interpolation passed off as data | flagged; low weight |
| Bright salt-flat / sabkha confusion | S2 (water/cloud) | Spectral checks near Azraq | MNDWI tuning; mask sabkha | ↓ source_quality locally |
| Static vintage drift | SRTM (2000), GAUL (2015) | Known epoch | Flag vintage; never imply currency | flagged (exempt from freshness) |
| Proxy misinterpretation risk | VIIRS, S1 soil moisture, GRACE | By design | Label "proxy"/"context"; low weight; no direct claim | bounded weight |

**Hard rule restated:** under no failure condition does MIZAN invent a value. If grounded data is insufficient, the pipeline writes nothing (or writes with low/`Low` confidence and an explicit flag), and the API returns an honest "insufficient data" response ([12-api-specification](./12-api-specification.md) §1.7). This is the operational expression of the non-negotiable charter: **every number from Earth Engine, stored datasets, or model outputs — never fabricated.**

---

## 9. Licensing, attribution & data governance

| Dataset | License | Required attribution / citation |
|---------|---------|--------------------------------|
| Sentinel-1 / Sentinel-2 | Copernicus open (free, any use) | "Contains modified Copernicus Sentinel data [year]" |
| CHIRPS | Open / public domain | Funk et al., CHIRPS, UCSB Climate Hazards Group |
| SRTM | Public domain | NASA/USGS SRTM |
| FAO GAUL | FAO GAUL terms | FAO GAUL 2015 (analytical, non-legal boundaries) |
| Landsat 8/9 | Public domain | USGS/NASA Landsat |
| SMAP L4 | NASA open | NASA SMAP SPL4SMGP v007 |
| ERA5-Land | Copernicus C3S | "Generated using Copernicus Climate Change Service information [year]" |
| VIIRS DNB | NOAA open | NOAA/Colorado School of Mines VIIRS DNB |
| GRACE mascon | NASA open | NASA JPL GRACE/GRACE-FO Mascon V03 (CRI) |
| Azraq / Jordan boundaries | MWI / derived | Jordan MWI (authoritative) or SRTM-derived watershed (illustrative) |

**Governance principles**
- Every dataset is registered in the **`datasets`** catalog table ([11-database-schema](./11-database-schema.md)) with its `ee_asset_id`, license, attribution string, native resolution, cadence, and notes. Provenance rows reference `dataset_id`, so attribution is recoverable for any value.
- Attribution strings render in the UI footer, Judge Mode, and report appendices ([14-judge-mode](./14-judge-mode.md), [15-report-generator](./15-report-generator.md)).
- Personal/sensitive data: none of these EO datasets contain PII; user data governance is handled separately in [17-security](./17-security.md).
- Boundary sensitivity: GAUL/derived boundaries are explicitly non-legal; MIZAN makes no legal/territorial determination (mirrors the "no legal determination" stance of the scientific charter).

---

## 10. Dataset → indicators → deliverables mapping

This table connects raw datasets to the indicator codes they produce and to the AstroCode deliverables they serve, closing the loop from source to value to story.

| Dataset | Indicators produced | Models involved | AstroCode deliverables served |
|---------|--------------------|-----------------|-------------------------------|
| Sentinel-2 SR | ndvi, evi, savi, ndvi_anomaly, ndwi, mndwi, surface_water_extent_km2, cropland_area_ha, irrigated_area_ha, crop_class, agri_expansion_pct | rf_crop_classifier, xgb_irrigation_detector | Data Explanation, AI/Analytics Method, Results Visualization, Jordanian Use Case |
| Sentinel-2 Cloud Prob | (masking — quality of all S2 indicators) | — | Data Explanation (quality) |
| Sentinel-1 GRD | s1_vv, s1_vh, s1_rvi, soil_moisture_proxy (+ irrigation support, convergence) | xgb_irrigation_detector, iforest_anomaly | Data Explanation, AI/Analytics Method |
| CHIRPS daily/pentad | precip_mm, precip_anomaly_pct, spi_1, spi_3, spi_6, spi_12, recharge_proxy_mm (input) | iforest_anomaly (rainfall anomaly) | Data Explanation, Jordanian Use Case, Impact Statement |
| SRTM | (slope/aspect, watershed, masks; recharge_proxy_mm input) | — | Data Explanation |
| FAO GAUL L1/L2 | (region units for all indicators; admin overlays) | — | Jordanian Use Case, Results Visualization |
| Azraq boundary | (demo AOI for all Azraq indicators) | gw_stress_model | Jordanian Use Case, Functional Prototype |
| Landsat 8/9 | ndvi/ndwi cross-check, historical baselines | — | Data Explanation (convergence) |
| SMAP L4 | soil-moisture corroboration | — | AI/Analytics Method (convergence) |
| ERA5-Land | tmax_c, tmin_c, rh_pct, wind_2m, srad_mj, et0_pm_mm, etc_mm | penman_monteith | AI/Analytics Method, Data Explanation |
| VIIRS DNB | human-activity proxy (abstraction context) | — | Impact Statement (context, cautious) |
| GRACE mascon | gws_anomaly_cm (regional context) | gw_stress_model (0.10 weight) | Data Explanation, Impact Statement |

**End-to-end:** datasets → indicators (this doc + [06](./06-remote-sensing-methods.md)) → models ([07](./07-machine-learning.md)) → risk index ([08](./08-risk-scoring.md)) → confidence ([09](./09-confidence-engine.md)) → stored with provenance ([11](./11-database-schema.md)) → served via API ([12](./12-api-specification.md)) → visualized & narrated in the UI ([13](./13-ui-pages.md), [14](./14-judge-mode.md), [15](./15-report-generator.md)).

---

## 9. Data limitations summary (forward reference)

Each caveat above contributes to the honest limits enumerated in [20-limitations](./20-limitations.md): coarse precipitation/GRACE resolution, proxy (not direct) soil moisture, cloud gaps in optical data, static/old terrain and admin boundaries, reanalysis modeling assumptions, and — above all — that **none of these datasets observe groundwater directly**. MIZAN's value is in transparently combining them into bounded, traceable stress indicators, never in overclaiming what any single sensor can see.
