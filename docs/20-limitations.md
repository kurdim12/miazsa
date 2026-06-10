# 20 — Limitations

| Field         | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Document      | 20-limitations.md                                                     |
| Project       | MIZAN — Earth Observation Environmental Intelligence for Jordan       |
| Version       | 0.1 (Draft)                                                           |
| Status        | Phase 1 — Specification                                               |
| Last updated  | 2026-06-10                                                            |
| Related       | [01-project-overview](01-project-overview.md) · [02-problem-definition](02-problem-definition.md) · [07-machine-learning](07-machine-learning.md) · [08-risk-scoring](08-risk-scoring.md) · [09-confidence-engine](09-confidence-engine.md) · [16-validation-framework](16-validation-framework.md) · [19-astrocode-compliance](19-astrocode-compliance.md) |

---

## Purpose

This document provides a complete, honest accounting of what MIZAN cannot do, what uncertainties exist in its outputs, where its data sources fall short, and where its models are unreliable. Scientific credibility depends on transparent limitation disclosure at least as much as on the sophistication of methods. This document is a living specification — it is expected to grow as the system matures and as new limitations are discovered. Every section of this document feeds directly into the confidence engine ([09-confidence-engine](09-confidence-engine.md)), the validation framework ([16-validation-framework](16-validation-framework.md)), and the responsible-use messaging displayed throughout the platform.

**Deliverables mapping:** Data Explanation · Impact Statement

---

## 1. What MIZAN Does NOT Claim

### 1.1 Full Non-Claims Statement

This statement is reproduced in full across multiple platform surfaces (Validation Center, Impact Center, Judge Mode, AI non-claim responses, Limitations page on the platform). It is the canonical, authoritative statement of MIZAN's epistemic boundaries.

> **MIZAN — Formal Statement of Non-Claims**
>
> MIZAN is an Earth Observation-based environmental monitoring platform that estimates groundwater-stress *indicators* from satellite proxy data. The following limitations are non-negotiable, technically enforced where possible, and clearly communicated to all users:
>
> **MIZAN does NOT:**
>
> 1. **Directly observe groundwater.** No satellite in MIZAN's data stack — including Sentinel-2, Sentinel-1, CHIRPS, ERA5-Land, or GRACE — can directly observe water within an aquifer. Aquifer conditions are inferred indirectly from surface and near-surface proxies.
>
> 2. **Observe water table depths or piezometric levels.** MIZAN contains no borehole readings, piezometer measurements, or water-level survey data. The Groundwater Stress Index is not a water table depth measurement, nor is it calibrated to one (in Phase 1).
>
> 3. **Detect, locate, or count individual wells or pumps.** Satellite imagery at Sentinel-2 resolution (10 m) cannot reliably identify individual pump installations, well heads, or abstraction equipment.
>
> 4. **Measure aquifer hydraulic properties.** Porosity, hydraulic conductivity, storativity, transmissivity — none of these are observable from the EO data in MIZAN's stack.
>
> 5. **Directly quantify abstraction volumes.** The `abstraction_estimate_mcm` indicator is a derived estimate from irrigated-area proxies and crop water demand models, not a direct measurement of water extracted.
>
> 6. **Make any legal determination.** MIZAN outputs are not a basis for determining compliance with or violation of water licensing regulations, water law, or any other legal instrument. They are not expert witness evidence.
>
> 7. **Attribute stress to specific actors or land users.** MIZAN provides spatial aggregates at basin and sub-basin scale. It cannot attribute stress to a named farm, company, or individual.
>
> 8. **Guarantee ground-truth accuracy at a specific pixel.** All EO-derived indicators contain uncertainty; classification errors, atmospheric effects, and mixed-pixel issues mean that a single pixel's value may not accurately represent ground conditions. Basin-scale aggregates are more reliable than individual pixel values.
>
> 9. **Replace a hydrogeological survey.** MIZAN is a remote-sensing monitoring tool. It does not produce the detailed subsurface characterisation that requires in-situ investigation, geophysical surveys, or pump testing.
>
> 10. **Provide legally defensible environmental data.** MIZAN outputs are for exploratory monitoring, research, and preliminary decision-support only. Regulatory, legal, or planning decisions require independently verified data from licensed professionals.

### 1.2 What MIZAN DOES Provide

To balance the non-claims statement with an affirmative description:

| What MIZAN provides | Confidence level | Appropriate use |
|--------------------|-----------------|-----------------|
| Monthly NDVI anomaly maps (Azraq, 10 m) | Medium–High | Vegetation stress screening; irrigated area proxies |
| Monthly surface-water extent (Azraq, 10 m) | Medium–High | Wetland trend monitoring; oasis status |
| Monthly SPI at 1/3/6/12 months (Jordan, ~5.5 km) | High | Drought monitoring; recharge-deficit estimation |
| Monthly GW Stress Index (Azraq, basin aggregate) | Medium | Early-warning indicator; policy monitoring |
| Annual irrigated-area estimate (Azraq, ha) | Medium | Abstraction pressure proxy; trend tracking |
| Monthly ET₀ estimate (basin, km²-grid) | Medium–High | Water demand estimation context |
| GRACE TWS anomaly (Jordan region, ~300 km) | Low–Medium | Regional storage trend context ONLY |
| ML anomaly flags (CHIRPS/NDVI time series) | Medium | Data exploration; hypothesis generation |

---

## 2. Scientific Limitations

### 2.1 Indicators, Not Measurements

The most fundamental scientific limitation of MIZAN is one of epistemic category. MIZAN produces **indicators** — observable signals that correlate with, but do not directly measure, groundwater conditions. This distinction matters practically:

- An indicator can be high even when the underlying condition is stable (false positive);
- An indicator can be low even when the underlying condition is deteriorating (false negative);
- The relationship between indicator and condition is mediated by assumptions that may not hold in all seasons, years, or sub-basins.

For example: a high `ndvi_anomaly` in August could indicate:
- Active irrigation drawing on groundwater (the intended signal);
- An unusual rainy summer (confound — rainfall-driven greenness);
- A crop type switch to perennial vegetation that is naturally more resilient (confound);
- Post-processing artefact from residual cloud contamination (artefact).

MIZAN's confidence engine attempts to quantify this uncertainty, but it cannot eliminate it.

### 2.2 Proxy Assumptions

Each of MIZAN's five GW Stress sub-indices rests on proxy assumptions:

| Sub-Index | Proxy Assumption | Known Violation Conditions |
|-----------|-----------------|---------------------------|
| Abstraction pressure | Irrigated area → proportional groundwater abstraction | Drip irrigation significantly reduces volume per ha; surface-water irrigation requires no GW |
| Recharge deficit | Negative SPI → reduced GW recharge | Episodic high-intensity rainfall may not infiltrate; recharge is highly localised in Azraq |
| Vegetation–water divergence | Dry-season NDVI > baseline → GW-dependent vegetation | Some deep-rooted natural vegetation (e.g., tamarisk) is naturally drought-tolerant; phenology varies by species |
| Surface-water decline | Reduced MNDWI → oasis contraction | Oasis extent varies seasonally and with episodic flooding; short-term fluctuations ≠ trend |
| GRACE regional storage | Negative GRACE TWS → GW depletion | GRACE measures ALL water storage (snow, soil, surface, groundwater) at coarse scale; cannot isolate GW component in Jordan |

### 2.3 Spatial Resolution Limits

| Data Source | Native Resolution | Limitation |
|------------|------------------|-----------|
| Sentinel-2 | 10 m (VNIR bands used for NDVI/EVI/NDWI) | Mixed-pixel problem at field edges; sub-10m features (ditches, hedgerows) are not resolved |
| Sentinel-1 | 10 m (GRD pixel) | Speckle noise at native resolution; multi-look averaging reduces effective resolution to ~20–40 m |
| CHIRPS | ~5.5 km (~0.05°) | Cannot resolve sub-km rainfall variability; convective storm cells may be significantly under-resolved |
| ERA5-Land | ~9 km (~0.1°) | ET₀ inputs are model reanalysis, not observations; local topographic effects not captured |
| SRTM | 30 m | Adequate for basin delineation; insufficient for detailed drainage modelling |
| GRACE | ~300 km (mascon) | Cannot resolve basin-scale or field-scale GW storage changes; only meaningful at regional/national scale |
| FAO GAUL | Variable | Administrative boundaries do not correspond to hydrogeological catchments |

**Critical implication for CHIRPS:** CHIRPS at ~5.5 km cannot capture the spatial variability of convective rainfall events that are the primary recharge mechanism in Azraq. A thunderstorm that recharges a specific wadi may be partially or completely missed at CHIRPS resolution. This limits the accuracy of point-specific SPI interpretation. MIZAN displays CHIRPS resolution on all SPI outputs and warns against sub-pixel interpretation.

**Critical implication for GRACE:** The GRACE footprint (~300 km) is comparable to the entire extent of Jordan. A GRACE signal over Jordan aggregates water storage from multiple basins, land cover types, and the Mediterranean coast. The signal attributed to "Azraq" in GRACE context is in fact a very coarse spatial average and should be used only to confirm the direction of a trend that is already evident from higher-resolution indicators. MIZAN labels every GRACE output with "~300 km resolution, regional context only."

### 2.4 Temporal Resolution and Latency Limits

| Data Source | Temporal Resolution | Latency | Impact |
|------------|--------------------|---------|----|
| Sentinel-2 | 5-day revisit; cloud-free composite: monthly | 1–5 days after acquisition | Monthly analysis misses sub-monthly irrigation events |
| Sentinel-1 | 6-day revisit | 1–3 days after acquisition | SAR soil moisture proxy valid for near-surface (0–5 cm), not root zone |
| CHIRPS Daily | Daily | ~2–3 weeks after dekad end | Near-real-time SPI requires awareness of preliminary vs final product quality differences |
| ERA5-Land | Hourly; daily aggregates available | ~2–5 days | Model reanalysis, not real-time; subject to reanalysis version updates |
| GRACE | Monthly; ~60-day product latency | ~2 months | Cannot be used for near-real-time monitoring |

Monthly compositing means MIZAN cannot detect intra-month changes. An irrigation event lasting one week within a month is diluted in the monthly composite. Similarly, a brief but intense rainfall event may not shift the monthly SPI significantly. Users should not interpret MIZAN monthly outputs as representing specific short-duration events.

### 2.5 Cloud Cover Gaps

Sentinel-2 optical data is severely affected by cloud cover. Jordan's climate is arid, which means cloud cover is less frequent than in humid regions — but winter months (November–February) can see substantial cloud coverage over the western highlands and even in the eastern badia during active weather systems.

- Cloud masking (`COPERNICUS/S2_CLOUD_PROBABILITY` threshold) removes contaminated pixels but creates spatial data gaps.
- Monthly compositing (e.g., median composite over a month) helps reduce but cannot eliminate gaps when persistent cloud cover occurs.
- The `cloud_coverage_pct` field in the `provenance` table records the proportion of the AOI affected by cloud in each composite period.
- The `freshness` factor in the confidence engine penalises metrics computed from heavily cloud-affected periods.
- MIZAN will display a "Limited data — cloud coverage X%" warning when `cloud_coverage_pct` exceeds a configurable threshold (default: 30%).

### 2.6 SAR Ambiguity

Sentinel-1 SAR backscatter (VV, VH) is sensitive to multiple surface properties simultaneously:

- Surface roughness (tillage, wind effects on crops);
- Volumetric soil moisture (the target signal for soil-moisture proxy);
- Vegetation structure (biomass, stem orientation, canopy density);
- Topographic effects (slope, aspect — corrected in GRD processing but not perfectly);
- Radar look angle variations.

The soil moisture proxy derived from SAR is therefore sensitive to confounding factors. In Azraq, with a mix of bare desert, irrigated cropland, and basalt outcrops, the soil moisture proxy requires cautious interpretation. MIZAN labels the SAR-derived `soil_moisture_proxy` as "approximate relative indicator, not an absolute soil water content measurement."

### 2.7 ET₀ and ETc Model Assumptions

The Penman-Monteith ET₀ model (FAO-56) is a physically-based, internationally accepted standard. However, it carries assumptions:

- Input data quality: ERA5-Land reanalysis inputs may differ from actual surface conditions, particularly for humidity and wind speed in complex terrain.
- Crop coefficients (Kc): The conversion from ET₀ to ETc uses FAO-recommended Kc values for standard crop types. Actual Kc values in Azraq conditions (water-stressed crops, unusual varieties, greenhouse conditions) may differ.
- Spatial representativeness: ERA5-Land inputs at ~9 km are used for basin-level ET₀ estimation, not for field-level calculations.
- The Penman-Monteith model does not account for water stress (it computes potential ET, not actual ET). Actual ET under water-limited conditions is lower.

ETc estimates are therefore upper bounds on crop water demand under non-stressed conditions. Actual crop water use may be lower if irrigation is insufficient.

### 2.8 Arid Recharge Estimation Uncertainty

Estimating groundwater recharge in arid environments from EO data is fundamentally uncertain:

- Recharge is episodic and spatially heterogeneous — controlled by preferential flow pathways (fractures, wadi beds) that are not resolved by EO.
- The relationship between rainfall amount and recharge is non-linear and threshold-dependent: below a minimum rainfall intensity, all water is evaporated before reaching the water table.
- Interception losses, bare-soil evaporation rates, and antecedent moisture conditions all modulate recharge efficiency in ways that CHIRPS and ERA5-Land cannot capture.
- MIZAN's `recharge_proxy_mm` is derived from CHIRPS rainfall and a simple effective-recharge coefficient; it is a coarse approximation, not a hydrogeological recharge estimate.

The uncertainty in recharge_proxy_mm should be considered very high (confidence level: Low) and the indicator treated as a directional signal (more rain = more recharge potential) rather than a quantitative recharge estimate.

### 2.9 No Direct Groundwater Data

MIZAN has no access to:
- Historical piezometer records;
- Groundwater level surveys;
- Aquifer test data (pumping tests, slug tests);
- Well completion records;
- Spring discharge measurements.

The absence of these data means that MIZAN cannot:
1. Calibrate its Groundwater Stress Index against observed aquifer behaviour;
2. Validate whether high-stress periods detected by MIZAN correspond to observed water-level declines;
3. Establish any quantitative relationship between the GW Stress Index and actual aquifer drawdown.

This is the most significant scientific limitation of MIZAN Phase 1. The GW Stress Index is an uncalibrated composite of proxy signals. Its value in absolute terms is less important than its value as a relative, temporal indicator of changing conditions.

---

## 3. Data Limitations

### 3.1 Data Latency

| Source | Availability Lag | Impact on MIZAN |
|--------|-----------------|-----------------|
| Sentinel-2 SR harmonised | 1–5 days after acquisition | Monthly analysis is up to 5 weeks behind current date at start of month |
| CHIRPS daily | ~3 weeks preliminary; ~6 weeks final | Monthly SPI computed with preliminary data may be revised when final product released |
| ERA5-Land reanalysis | 2–5 days | Near-real-time ET₀ is feasible; historical data stable |
| GRACE-FO mascon | ~2 months | GW storage trend is always at least 2 months behind current date |
| Sentinel-1 GRD | 1–3 days | SAR data is relatively fresh but monthly aggregation still introduces delay |

Data latency means MIZAN's "current" indicators are actually a composite of data from multiple weeks prior. The `created_at` and `date` fields in `indicator_values` clearly distinguish the data date (the satellite acquisition period) from the processing date (when MIZAN ran the pipeline).

### 3.2 Spatial Coverage Gaps

- **Cloud-persistent periods:** As noted in Section 2.5, some months may have spatial gaps in Sentinel-2 optical data.
- **Sentinel-1 coverage patterns:** SAR coverage varies by orbit pass; some Azraq sub-regions may be covered by ascending or descending passes only, affecting temporal consistency.
- **GRACE coverage:** GRACE-FO has data gaps due to battery management and orbital mechanics; some months have no GRACE observations. The gap years 2017–2018 between GRACE and GRACE-FO are handled by indicating data absence.

### 3.3 Missing In-Situ Validation

MIZAN Phase 1 lacks ground-truth in-situ data for:

- **Irrigated area validation:** No independent satellite-derived reference map of Azraq irrigated areas exists in the public domain for the full time series. MIZAN uses ESA WorldCover and IIASA HILDA+ as partial proxies, which have their own uncertainties.
- **Rainfall validation:** CHIRPS is a multi-source product that incorporates rain gauge data where available; station density in the Azraq region is limited, reducing CHIRPS accuracy in this area specifically.
- **ET₀ validation:** No eddy covariance or lysimeter data for Azraq is available in the public domain to validate Penman-Monteith ET₀ estimates.
- **Groundwater validation:** No piezometer data is available for MIZAN Phase 1 (by definition — see Section 2.9).

This limitation is directly reflected in the `model_validation` factor of the confidence engine, which receives a lower score for indicators lacking independent validation datasets.

### 3.4 Administrative vs. Hydrogeological Boundaries

MIZAN uses FAO GAUL administrative boundaries for national coverage analysis. The Azraq Basin boundary is derived from watershed/catchment analysis using SRTM DEM. These boundaries differ:

- The administrative boundary of Azraq Governorate does not align with the hydrogeological Azraq Basin.
- MIZAN uses the hydrogeological basin boundary (MWI/watershed-derived) as the primary AOI for groundwater stress analysis.
- For national-level reporting, FAO GAUL level1/level2 boundaries are used, acknowledging that they do not represent aquifer extents.

Users should be aware that "Azraq Basin" in MIZAN refers to the watershed-derived hydrogeological extent, not the administrative governorate.

### 3.5 Historical Data Depth Variation

| Data Source | Available from | Implications |
|------------|---------------|-------------|
| Sentinel-2 | March 2015 | ~10 years of data; adequate for trend detection |
| Sentinel-1 | April 2014 | Similar to S-2 |
| CHIRPS Daily | January 1981 | 45+ years; very strong for SPI computation |
| GRACE original | April 2002 | 15 years; gap 2017–2018; GRACE-FO from 2018 |
| ERA5-Land | January 1950 | Very long record; consistent reanalysis |
| SRTM | 2000 (single acquisition) | Static DEM; not time-varying |

The inconsistent start dates mean that a long SPI baseline (CHIRPS from 1981) can be computed, while the vegetation/irrigation change analysis baseline is limited to the Sentinel era (from 2015). Landsat (1972–present) can extend the irrigation change analysis prior to 2015 if included in future phases.

---

## 4. Model Limitations

### 4.1 Training Data Scarcity and Quality

**RF Crop Classifier:**
- Training data for Jordan-specific crop classification is limited. No comprehensive, published, publicly available Jordan-specific crop-type training dataset exists.
- MIZAN Phase 1 assembles training data from: ESA WorldCover (10 m, 2020/2021), IIASA HILDA+ global land use, manual photo-interpretation of high-confidence areas, and available published land-cover studies.
- This composite training dataset is heterogeneous in quality and spatial accuracy.
- The classifier is expected to perform acceptably on major LULC classes (cropland, bare, urban, water) but may have lower accuracy for fine-grained crop-type discrimination.

**XGBoost Irrigation Detector:**
- Binary classification (irrigated vs. rainfed) requires examples of both classes with confirmed ground truth.
- Confirmed "irrigated" examples can be identified from imagery with high confidence in centre-pivot areas (distinctive circular patterns visible at 10 m). Smallholder drip/furrow irrigation is harder to label confidently.
- Rainfed vs. fallow bare field distinction is challenging in the dry season when both have low NDVI.
- Class imbalance: irrigated pixels are a minority of total cropland pixels in Jordan; class weighting is applied but cannot fully compensate for label scarcity.

**Isolation Forest:**
- Contamination parameter (the expected fraction of anomalies) is set heuristically. An incorrect contamination estimate leads to either too many or too few flagged anomalies.
- In a short time series (10 years of Sentinel), the model has limited data to characterise "normal" variation, making anomaly definitions less robust.
- Anomaly detection is sensitive to data distribution assumptions; the gamma distribution commonly assumed for SPI may not perfectly describe all tails.

### 4.2 Model Transferability

The RF and XGBoost models are trained primarily on Azraq Basin data. Their performance when applied to the full Jordan extent may degrade due to:

- Different crop mixes (Jordan Valley irrigated agriculture differs substantially from Azraq badia irrigation patterns);
- Different soil and terrain backgrounds (Mediterranean soils in northwest Jordan vs. basalt and alluvium in Azraq);
- Different spectral baselines (higher biomass in wetter western Jordan elevates NDVI baselines, potentially confusing dry-season divergence signals).

National-level application of models trained exclusively on Azraq data requires explicit recalibration or separate model training per agro-ecological zone. Phase 1 documents this limitation and flags national outputs as having lower confidence than Azraq-specific outputs.

### 4.3 Class Imbalance

The land-cover and irrigation classification problems are inherently imbalanced:

- Irrigated cropland covers perhaps 5–15% of the Azraq Basin area.
- Severely stressed pixels (High/Severe GW stress) may be rare in normal years.
- LULC change pixels (new agricultural conversion) are a small fraction of total pixels.

Standard accuracy metrics (overall accuracy) can be misleading with imbalanced classes. MIZAN reports per-class precision, recall, and F1 in addition to overall accuracy. The confidence engine's `model_validation` factor uses F1 weighted by class support, not overall accuracy.

### 4.4 Temporal Drift

ML models trained on historical data assume that the statistical relationship between features and labels is stable over time. In an actively changing environment like Azraq:

- Crop mix may change as farmers adapt to water stress (switching from water-intensive vegetables to olives);
- Spectral responses of new crop varieties may differ from training data;
- The EO data itself changes (Sentinel-2 harmonisation corrections, band recalibrations) in ways that can subtly affect model inputs.

MIZAN Phase 1 documents this limitation and specifies that models should be retrained annually with updated training data. The `model_runs` table records training date, allowing evaluation of model age.

### 4.5 GW Stress Index Model Limitations

The Groundwater Stress Index is a **transparent weighted composite** of proxy sub-indices. Its limitations include:

**Weight uncertainty:** Default weights (abstraction 0.30, recharge deficit 0.25, vegetation divergence 0.20, surface-water decline 0.15, GRACE 0.10) are expert-informed but not empirically calibrated against observed GW stress. Different expert teams may choose significantly different weights. The sensitivity of the index to weight choice is not fully characterised in Phase 1.

**Non-linearity not captured:** The composite uses a weighted linear combination of normalised sub-indices. True groundwater stress may involve non-linear interactions (e.g., stress only becomes critical when both abstraction pressure AND recharge deficit are simultaneously high — a product term, not a sum term).

**Sub-index normalisation assumptions:** Each sub-index is normalised to [0,1] using a min-max approach based on the observed range in the historical time series. This means:
- Adding new historical data can change the normalisation range and alter historical index values;
- The normalisation is relative, not absolute — a "0.8" on abstraction pressure means it is near the top of the observed range for Azraq, not that 80% of the aquifer safe yield has been exceeded.

**Absence of GW validation data:** As stated in Section 2.9, the index has never been calibrated against observed aquifer water levels. Its directional validity (higher index = worse conditions) is assumed but not empirically verified in Phase 1.

---

## 5. How Uncertainty Is Communicated

### 5.1 The Confidence Engine

MIZAN's primary mechanism for quantifying and communicating uncertainty is the confidence engine, fully specified in [09-confidence-engine](09-confidence-engine.md). The engine computes a composite confidence score [0,1] for every metric using a weighted geometric mean of six factors:

| Factor | Weight | What it captures |
|--------|--------|-----------------|
| Freshness | 0.20 | How recently the data was acquired relative to the display date |
| Source quality | 0.20 | The quality tier of the underlying data source (peer-reviewed vs. model output vs. proxy) |
| Spatial coverage | 0.20 | The fraction of the AOI covered by valid (non-cloud, non-gap) data |
| Temporal completeness | 0.15 | The fraction of the target time window covered by data |
| Model validation | 0.15 | The independently validated accuracy of any model contributing to the metric |
| Convergence | 0.10 | The degree to which independent indicators agree on the direction of the signal |

The geometric mean (as opposed to arithmetic mean) ensures that a very low score on any single factor substantially depresses the overall confidence, preventing a "high confidence" label on a metric with a critical weakness.

For non-model metrics (e.g., CHIRPS SPI — no ML model involved), the `model_validation` factor is dropped and the remaining factors are renormalised.

Confidence levels:
- **High ≥ 0.80** — displayed with a green badge
- **Medium 0.50–0.79** — displayed with a yellow badge
- **Low < 0.50** — displayed with a red badge and an expanded explanation

### 5.2 5-Field Validation Envelope

Every metric displayed in MIZAN has a 5-field validation envelope accessible to users:

| Field | Content |
|-------|---------|
| **Source** | The data source(s) contributing to this metric (e.g., "COPERNICUS/S2_SR_HARMONIZED — Sentinel-2 Surface Reflectance") |
| **Date** | The acquisition period or model run date for this specific value |
| **Methodology** | A plain-language description of how the metric was computed |
| **Confidence** | The composite confidence score [0,1] with the scores for each individual factor |
| **Explanation** | A non-technical explanation of what the metric represents, its limitations, and how it should be interpreted |

### 5.3 Resolution Labels

Every map layer and every chart is labelled with the native resolution of the underlying data:
- "10 m Sentinel-2" for optical vegetation and water indices
- "~5.5 km CHIRPS" for all SPI and precipitation indicators
- "~9 km ERA5-Land" for climate/ET₀ inputs
- "~300 km GRACE mascon" for TWS anomaly (always with additional "regional context only" warning)

### 5.4 Non-Claim Labels

Every displayed metric carries a brief non-claim statement appropriate to its indicator type:
- GW Stress Index: "Estimated indicator from EO proxies — not a direct groundwater measurement"
- Irrigated area: "MIZAN ML estimate — not a survey measurement"
- Abstraction estimate: "Derived from irrigated-area proxy — not a metered abstraction measurement"
- GRACE TWS: "Coarse resolution (~300 km) — regional context only; cannot resolve Azraq Basin groundwater specifically"

### 5.5 Scenario Labels

All outputs from the Digital Twin scenario runner are labelled:
- "Scenario output — not a MIZAN operational observation"
- "Based on stored indicator data with modified model parameters"
- Scenario results cannot be saved as `indicator_values` — they are stored only in `scenario_results` with a clear `is_scenario=TRUE` flag

---

## 6. Ethical, Social, and Policy Limitations

### 6.1 Equity and Access

MIZAN is a web platform requiring internet access. This creates access inequities:
- Smallholder farmers who may be most directly affected by policies informed by MIZAN outputs may have the least access to the platform.
- Technical literacy requirements — interpreting confidence scores, validation envelopes, sub-index breakdowns — create a knowledge barrier for non-specialist users.
- While MIZAN is bilingual (EN/AR), many rural Jordanian communities use spoken dialects that differ from Modern Standard Arabic; the platform's Arabic uses MSA.

### 6.2 Risk of Misuse in Policy

The spatial precision of MIZAN's irrigated-area maps (~10 m) creates a risk that the outputs could be used to:
- Identify and target specific farms for enforcement action based on EO-derived estimates with significant uncertainty;
- Justify policy decisions that disproportionately affect marginalised communities;
- Replace proper hydrogeological investigation with cheaper but less reliable remote-sensing estimates.

**MIZAN's mitigation:** All outputs carry explicit non-claim labels. The platform does not allow attribution to individual land users. The Responsible Use Statement (see Section 7 below) is prominently displayed. The confidence engine ensures that low-confidence outputs are clearly flagged. MIZAN's documentation explicitly states that it is not a substitute for in-situ investigation.

### 6.3 Scientific Uncertainty vs. Policy Urgency

Water managers face a tension between waiting for scientifically perfect data and acting on the best available information in urgent situations. MIZAN is designed to help inform — not decide — this trade-off. The risk is that:
- Decision-makers may treat MIZAN outputs as more certain than they are, acting on Low-confidence indicators;
- Alternatively, uncertainty communication may be used as a reason to delay necessary action.

MIZAN's confidence engine and validation framework are designed to communicate uncertainty proportionately, not to paralyse decision-making.

### 6.4 Climate Justice Context

Jordan's water scarcity is partly driven by climate change caused overwhelmingly by industrialised nations' emissions. MIZAN measures the symptoms of this injustice in Jordan without addressing its causes. Impact messaging should avoid framing that blames local populations for a crisis with global structural drivers.

### 6.5 Data Sovereignty

All primary data sources used by MIZAN (Sentinel, CHIRPS, GRACE, ERA5-Land) are collected by international agencies (ESA, UCSB, NASA, ECMWF) and made freely available. Jordanian environmental data is not owned by MIZAN. Any future integration of MWI-owned piezometer data would require a formal data-sharing agreement in which Jordan retains sovereignty over its data.

---

## 7. Responsible Use Guidance

The following guidance is displayed in the Impact Center and on the Limitations page of the platform:

### 7.1 Appropriate Uses of MIZAN

| Appropriate Use | Reason |
|----------------|--------|
| Monitoring temporal trends in GW stress indicators at basin scale | MIZAN is designed for this; monthly time series + trend charts |
| Identifying areas of potential concern for further investigation | EO screening to prioritise ground-survey resources |
| Communicating water-scarcity urgency to non-technical audiences | Impact Center + report generator designed for this |
| Research and hypothesis generation for hydrological studies | Full indicator API + provenance + methodology documentation |
| Supporting donor reporting on water project progress | Impact metrics with provenance; exportable PDF reports |
| Teaching and public awareness about EO and water scarcity | Platform is openly accessible; educational framing available |

### 7.2 Inappropriate Uses of MIZAN

| Inappropriate Use | Risk | Guidance |
|------------------|------|---------|
| Legal proceedings or regulatory enforcement actions | Insufficient accuracy; not legally validated | Always use licensed hydrogeological survey data |
| Individual farm or well-level attribution | MIZAN provides basin aggregates; pixel-level attribution is misleading | Aggregate interpretation only; no individual attribution |
| Replacing in-situ monitoring networks | EO proxies cannot substitute for piezometer readings | MIZAN is a complement, not a replacement |
| Financial instruments based on MIZAN indices (insurance triggers, etc.) | Model calibration is insufficient for actuarial use | Requires independent actuarial validation |
| Claims of "proven groundwater depletion" | MIZAN provides indicators, not proof | Use MIZAN as evidence alongside, not instead of, hydrogeological data |
| Policy decisions without stakeholder consultation | Risk of disproportionate impact on vulnerable communities | Integrate MIZAN data into participatory processes |

---

## 8. Future Work to Reduce Limitations

This section describes the priority directions for Phase 2 and beyond that would directly address the most significant limitations identified above.

### 8.1 In-Situ Data Integration

**Priority:** Critical

If piezometer or water-level data from MWI or USGS WRIS Jordan becomes accessible, Phase 2 should:
- Ingest piezometer readings into the `observations` table;
- Calibrate the GW Stress Index against observed water-level anomalies;
- Use piezometer data as a `model_validation` ground-truth for the confidence engine;
- Compute correlation coefficients between GW Stress Index and observed water-level changes.

This single integration would fundamentally improve the scientific credibility of the GW Stress Index.

### 8.2 Higher-Resolution Commercial Data

**Priority:** High

Commercial satellite data with sub-meter to 3 m resolution (e.g., PlanetScope, Maxar WorldView) would enable:
- Individual field-level irrigation detection without mixed-pixel problems;
- Well and pump identification (potentially);
- More accurate crop-type mapping with finer field boundary delineation.

Cost of commercial data is a barrier; Phase 1 restricts to free/open data. Partnership with Planet Labs Education Program or equivalent should be explored.

### 8.3 GRACE Downscaling

**Priority:** Medium

GRACE ~300 km resolution is a fundamental limitation. Several published techniques exist for statistical downscaling of GRACE TWS anomalies using in-situ data or land-surface model outputs:
- GRACE + GLDAS ensemble downscaling (e.g., Vishwakarma et al. method);
- Machine learning downscaling (Random Forest: GRACE coarse + soil moisture + NDVI → 1 km TWS estimate).

Phase 2 should evaluate GRACE downscaling methods and, where validated, produce a higher-resolution regional TWS estimate while clearly documenting the additional uncertainty introduced.

### 8.4 Citizen Science Integration

**Priority:** Medium

A lightweight mobile-friendly reporting interface could allow farmers, field officers, and conservationists to submit:
- Crop type labels (georeferenced photos);
- Irrigation system type (drip, sprinkler, flood);
- Well status observations;
- Wetland condition notes.

This crowdsourced ground-truth data would dramatically improve ML training data quality and provide in-situ validation points. Design principles: open submission (no account required), anonymised by default, moderated before incorporation into training data.

### 8.5 Longer Landsat Archive Integration

**Priority:** Medium

The Landsat archive extends to 1972 (Landsat-1 MSS). Landsat 8/9 (2013–present, 30 m) overlaps with the Sentinel era and provides consistent NDVI/EVI for the full Sentinel period. Full Landsat integration would:
- Extend irrigation change detection back to the 1980s–1990s;
- Enable before/after comparisons spanning the Azraq desiccation crisis;
- Provide a longer baseline for anomaly detection.

### 8.6 SAR Soil Moisture Downscaling and Calibration

**Priority:** Low–Medium

SMAP L4 soil moisture (~9 km) and Sentinel-1 SAR can be combined using the DUAl-SCalE (DUACS) or related approaches to produce a higher-resolution soil moisture product:
- SMAP provides absolute calibration;
- Sentinel-1 provides spatial detail.

This would improve the reliability of the `soil_moisture_proxy` indicator and reduce its dependence on pure SAR backscatter.

### 8.7 Multi-Year Model Retraining Pipeline

**Priority:** High

Phase 2 should implement an automated model retraining pipeline that:
- Assembles updated training data annually from new validated samples;
- Retrains RF and XGBoost models with the updated data;
- Evaluates performance on a held-out test set;
- Stores model performance metrics in `model_runs` for tracking;
- Flags when model performance degrades below the operational threshold (F1 < 0.75 for irrigation detector);
- Triggers a human review before deploying the retrained model.

### 8.8 Aquifer-Specific Model Development

**Priority:** Medium-term**

The Phase 1 GW Stress Index is a generic basin-level composite. A Phase 3 goal would be to develop aquifer-specific risk models that:
- Use hydrogeological domain knowledge (aquifer type, transmissivity ranges, depth to water) to parameterise the composite;
- Weight sub-indices differently for different aquifer types (the recharge deficit weight should be lower for fossil aquifers where recharge is negligible);
- Produce a probability distribution over stress levels rather than a point estimate.

---

## 9. Summary Limitations Table

A concise reference table for all significant limitations:

| ID | Category | Limitation | Confidence Impact | Mitigation |
|----|----------|-----------|------------------|-----------|
| L01 | Scientific | No direct GW observation | Affects ALL GW metrics | Non-claim labels; MIZAN does not claim this |
| L02 | Scientific | CHIRPS ~5.5 km resolution | Medium impact on SPI accuracy | Resolution label; no sub-pixel interpretation |
| L03 | Scientific | GRACE ~300 km resolution | Severe — cannot isolate Azraq GW | "Regional context only" label everywhere |
| L04 | Scientific | Proxy assumption violations | Variable per-metric | Sub-index assumption table in [08-risk-scoring](08-risk-scoring.md) |
| L05 | Scientific | Cloud gaps in S-2 optical | Medium — seasonal | `cloud_coverage_pct` in provenance; freshness penalty |
| L06 | Scientific | SAR multi-signal ambiguity | Medium | "Approximate relative indicator" label |
| L07 | Scientific | ET₀ is potential, not actual | Medium | "Upper bound on demand" label |
| L08 | Scientific | Recharge estimation uncertainty | High | recharge_proxy_mm confidence = Low by default |
| L09 | Data | No in-situ GW validation | Critical | model_validation factor penalised; Phase 2 target |
| L10 | Data | CHIRPS preliminary product lag | Low | freshness factor accounts for lag |
| L11 | Data | GRACE 2-month latency | High | GRACE labelled; freshness penalty |
| L12 | Data | Admin ≠ hydrogeological boundary | Medium | Document difference; use watershed boundary for GW |
| L13 | Model | Training data scarcity (Jordan) | High for RF, Medium for XGB | model_validation factor; validation metrics published |
| L14 | Model | Model transferability (national) | High | National outputs flagged lower confidence |
| L15 | Model | Class imbalance | Medium | F1-weighted reporting; class weighting in training |
| L16 | Model | Temporal drift | Low–Medium (Phase 1) | Annual retraining plan; model age recorded |
| L17 | Model | GWS index uncalibrated | Critical | Non-claim labels; directional interpretation only |
| L18 | Model | Linear composite non-linearity | Medium | Scenario runner explores sensitivity |
| L19 | Ethical | Digital access inequity | Social | Open platform; bilingual design |
| L20 | Ethical | Policy misuse risk | High | Non-claim labels; responsible-use statement |

---

*End of Document 20 — Limitations*
