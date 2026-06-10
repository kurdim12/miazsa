# 02 — Problem Definition

| Field         | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Document      | 02-problem-definition.md                                              |
| Project       | MIZAN — Earth Observation Environmental Intelligence for Jordan       |
| Version       | 0.1 (Draft)                                                           |
| Status        | Phase 1 — Specification                                               |
| Last updated  | 2026-06-10                                                            |
| Related       | [01-project-overview](01-project-overview.md) · [08-risk-scoring](08-risk-scoring.md) · [09-confidence-engine](09-confidence-engine.md) · [16-validation-framework](16-validation-framework.md) · [20-limitations](20-limitations.md) |

---

## Purpose

This document defines the problem that MIZAN is built to address. It situates the system within Jordan's water-scarcity crisis, characterises the stakeholder landscape and pain points, articulates a crisp problem statement, and translates that problem into a structured requirements specification — functional, non-functional, and ethical. User stories with acceptance criteria define the expected system behaviour from each stakeholder's perspective. The document also establishes the scientific hypotheses MIZAN tests and the risk-mitigation framework for misinterpretation and policy misuse.

**Deliverables mapping:** Jordanian Use Case · Data Explanation · Impact Statement

---

## 1. The Problem

### 1.1 Groundwater Over-Abstraction in Jordan

Jordan's groundwater resources are under acute and accelerating stress. The country is classified as one of the world's most water-scarce nations, with renewable water availability estimated at approximately 80–100 m³ per person per year — roughly 1% of the global average [ref]. Groundwater provides an estimated 55–60% of total national water supply [ref], yet virtually every major aquifer system in Jordan is being abstracted at rates that exceed estimated safe yield [ref].

Key documented symptoms include:

- **Declining water tables:** Piezometric levels in multiple Jordanian aquifer systems have declined by tens of metres over multi-decadal monitoring periods [ref]. In some fossil aquifer zones (Disi), the resource is effectively non-renewable.
- **Licensed vs. unlicensed abstraction:** While the MWI administers a groundwater well licensing system, unlicensed and over-licensed abstraction is widely documented [ref], and enforcement capacity is constrained by monitoring infrastructure gaps.
- **Increasing agricultural demand:** Agricultural water use accounts for approximately 50–60% of total freshwater withdrawals in Jordan [ref]. Expansion of irrigated agriculture — particularly vegetable production — in arid basins drives a disproportionate share of groundwater demand.
- **Climate change compounding:** Rainfall trends over Jordan show statistically significant reductions in annual precipitation and increases in inter-annual variability, reducing natural aquifer recharge [ref].
- **Transboundary complexity:** Some Jordanian aquifer systems have transboundary dimensions (e.g., Yarmouk, Disi), complicating governance [ref].

### 1.2 Azraq Basin: A Paradigm Case

The Azraq Basin represents the most acute and well-documented case of groundwater over-abstraction in Jordan, making it an ideal focal region for MIZAN.

**Historical trajectory:**

- Azraq Oasis has existed for millennia as a rare permanent water body in the Syrian Desert, supporting migratory birds, endemic species, and human settlement since at least the Palaeolithic [ref].
- Systematic groundwater extraction in the basin accelerated from the 1970s to supply Amman and support irrigated agriculture [ref].
- By the early 1990s, the oasis springs ceased to flow naturally, effectively desiccating the wetland that had defined the ecosystem [ref].
- Emergency measures, partial well sealing, and reduced pumping led to partial oasis recovery in the early 2000s [ref], but the wetland remains severely degraded relative to its pre-abstraction extent [ref].
- Published estimates of the Azraq safe yield range from approximately 20–24 MCM/year [ref]. Reported annual abstractions have at times reached 80–100+ MCM/year [ref]. MIZAN cites these figures as external literature context only — they are not MIZAN-computed values.

**Current monitoring deficit:**

The Azraq Basin lacks sufficient spatially distributed, continuously operating piezometer networks to provide real-time, basin-scale groundwater monitoring. The data that does exist is:
- Spatially sparse (point observations, not area coverage);
- Temporally irregular (reporting periods vary by institution);
- Not publicly accessible in real-time or near-real-time;
- Insufficient to resolve spatial heterogeneity in abstraction pressure.

This creates a critical monitoring gap that satellite-derived proxies are well-positioned to partially fill.

### 1.3 Agricultural Expansion as a Driver

Remote sensing evidence from multiple time periods shows expansion of irrigated agricultural area in the Azraq region [ref]. Greenhouses, centre-pivot irrigation systems, and smallholder plots have proliferated in areas where rainfall alone cannot sustain crop production. This expansion is detectable in:

- Seasonal NDVI patterns (crops green during dry season when rainfed vegetation has senesced);
- SAR backscatter signatures (soil moisture, crop structure);
- Multi-temporal land-cover change analysis.

Quantifying this expansion is a core MIZAN capability, providing a spatial proxy for increasing abstraction pressure.

### 1.4 Rainfall Deficit and Recharge Reduction

Jordan's climate is predominantly arid to semi-arid. Groundwater recharge in the Azraq Basin occurs primarily through:

- Direct infiltration during episodic high-intensity rainfall events in the eastern badia;
- Wadi flow infiltration following storm events;
- Mountain-front recharge from the western highlands (limited in Azraq compared to western basins).

Prolonged rainfall deficits (negative SPI) reduce recharge while demand for irrigation water (and thus abstraction) increases, creating a compounding stress cycle. Detecting and quantifying these rainfall anomalies at spatial and temporal scales relevant to basin management is a key MIZAN function.

### 1.5 Monitoring and Data Gaps

| Gap Type | Description | Impact |
|----------|-------------|--------|
| Spatial coverage | In-situ piezometers cover <5% of Azraq Basin area [ref] | No basin-scale picture |
| Temporal frequency | Monthly or quarterly manual readings in many wells | Misses intra-season dynamics |
| Public accessibility | Many datasets held by MWI; limited open access | Research/civil society cannot validate |
| Integration | No platform currently integrates EO + in-situ + model outputs | No holistic stress picture |
| Communication | Technical data not translated into accessible decision-support | Policy users underserved |

### 1.6 Broader National Context

Beyond Azraq, Jordan faces:

- **National water accounting gaps:** No comprehensive national EO-based irrigated-area inventory updated at annual or sub-annual frequency;
- **Drought early warning:** Limited operational drought monitoring capability using satellite-derived SPI;
- **Environmental impact tracking:** Protected areas (RAMSAR, RSCN reserves) lack systematic EO-based monitoring;
- **Donor accountability:** International development finance for water projects requires evidence-based impact monitoring that current systems cannot efficiently provide.

---

## 2. Stakeholders & Pain Points

### 2.1 Stakeholder Map

```
                        ┌──────────────────────────────┐
                        │        MIZAN Platform         │
                        └──────────────┬───────────────┘
           ┌────────────────────┬──────┴──────────┬────────────────────┐
           │                    │                  │                    │
    ┌──────▼──────┐     ┌───────▼──────┐  ┌───────▼──────┐   ┌───────▼──────┐
    │   MWI/JVA   │     │  RSCN/Env    │  │  Researchers  │   │   Donors/    │
    │  (Policy &  │     │  (Conservation│  │  (Academic)   │   │  AstroCode   │
    │  Regulation)│     │   & Nature)  │  │               │   │  Judges      │
    └─────────────┘     └─────────────┘  └───────────────┘   └─────────────┘
```

### 2.2 Detailed Pain Points by Stakeholder

**Ministry of Water and Irrigation (MWI) / Jordan Valley Authority (JVA)**

| Pain Point | Current State | MIZAN Solution |
|-----------|--------------|----------------|
| No basin-scale irrigated-area inventory | Manual field surveys, outdated | Monthly satellite-derived irrigated-area maps (ha) |
| Abstraction pressure opaque between survey cycles | Annual or multi-year survey intervals | Monthly EO-proxy abstraction pressure sub-index |
| Rainfall deficit awareness lags | CADD/JMD reports weekly; no spatial SPI | CHIRPS-based SPI maps updated monthly |
| No integrated stress picture | Multiple siloed datasets | Composite GW Stress Index integrating 5 sub-indices |
| Donor/ministerial reporting burden | Manual compilation | Automated PDF report generation with provenance |

**Royal Society for the Conservation of Nature (RSCN)**

| Pain Point | Current State | MIZAN Solution |
|-----------|--------------|----------------|
| Azraq wetland monitoring relies on field visits | Infrequent, weather-dependent | Monthly surface-water extent maps from Sentinel-2 |
| No quantitative vegetation stress tracking | Qualitative observations | NDVI anomaly maps for Azraq Reserve |
| Early warning for rapid desiccation lacking | Reactive rather than proactive | Automated alert when surface-water extent or GWS class changes |
| Cannot easily communicate conservation urgency to donors | Anecdotal evidence | Trend visualizations, before/after comparisons, impact statements |

**Academic Researchers (University of Jordan, JUST, Regional)**

| Pain Point | Current State | MIZAN Solution |
|-----------|--------------|----------------|
| EE data access requires advanced coding skills | High technical barrier | Pre-computed indicator time-series accessible via API |
| Reproducibility of EO analyses is difficult | Lack of documented methods | Full methodology documentation + provenance table |
| Cross-validation against ground truth is fragile | No integrated validation framework | Validation Center with 5-field envelope per metric |
| No open repository of Jordan EO indicators | Fragmented, unpublished | MIZAN API + exportable data |

**Development Finance / Donor Organisations**

| Pain Point | Current State | MIZAN Solution |
|-----------|--------------|----------------|
| Hard to quantify water-project impact | Before/after comparisons not standardised | Impact Center with trend deltas, standardised metrics |
| Evidence base for proposals is weak | Literature, not real-time data | Near-real-time EO indicators with confidence |
| Language/accessibility barriers | Technical reports in English only | Bilingual platform (EN/AR) with plain-language summaries |

---

## 3. Why Earth Observation?

### 3.1 The Case for EO

| Dimension | Ground Monitoring | Earth Observation |
|-----------|------------------|-------------------|
| **Cost** | High per point; infrastructure, labour, maintenance | Low marginal cost per area-unit; data largely free (Sentinel, CHIRPS, GRACE) |
| **Spatial coverage** | Sparse; point measurements only | Continuous spatial coverage; all pixels |
| **Temporal frequency** | Weekly/monthly manual; varies by well | Sentinel-2: 5-day revisit; CHIRPS: daily/pentad; ERA5: hourly |
| **Objectivity** | Operator-dependent; data can be lost/altered | Consistent automated processing; tamper-evident provenance |
| **Historical record** | Limited; installation date | Landsat archive from 1972; Sentinel from 2015; CHIRPS from 1981 |
| **Accessibility** | Requires physical access to sites | Global access via internet |
| **Scalability** | Adding sensors = large cost increase | National coverage at marginal extra cost |

### 3.2 EO Limitations Acknowledged

EO does not replace in-situ monitoring. It cannot directly observe aquifer levels, measure borehole pressure, or detect pump operations. MIZAN explicitly acknowledges these limitations (see [20-limitations.md](20-limitations.md)) and positions EO as a **complement** to ground monitoring, providing spatial and temporal context that point measurements cannot.

### 3.3 The Integrated Argument

MIZAN's strongest scientific claim is the **convergence argument**: when multiple independent EO proxies (vegetation anomaly, surface water decline, rainfall deficit, irrigation expansion, GRACE storage trend) all point in the same direction, the collective signal provides stronger evidence of groundwater stress than any single indicator alone. The confidence engine (see [09-confidence-engine.md](09-confidence-engine.md)) quantifies this convergence explicitly.

---

## 4. Problem Statement

> **Crisp Problem Statement:**
>
> Jordan's groundwater resources — particularly in the Azraq Basin — are under severe, accelerating stress from over-abstraction and recharge deficit, yet basin-scale monitoring is constrained by sparse in-situ networks, data-access barriers, and the absence of an integrated EO-based decision-support platform. Decision-makers, conservation practitioners, and researchers lack a transparent, near-real-time, spatially comprehensive tool for tracking the hydrological proxies that indicate groundwater stress, quantifying their uncertainty, and communicating findings in accessible, bilingual, evidence-based formats.

---

## 5. Scope

### 5.1 In Scope

| Category | Items |
|----------|-------|
| **Primary AOI** | Azraq Basin (~12,700 km², northeastern Jordan) |
| **Secondary AOI** | Full Jordan national extent (country boundary) |
| **Temporal range** | Historical: 2015–present (Sentinel era); 1981–present for CHIRPS |
| **Primary indicators** | All indicators listed in INDICATOR CODES section of architecture contract |
| **ML models** | RF crop classifier, XGBoost irrigation detector, Isolation Forest anomaly detector |
| **Risk model** | Groundwater Stress Index (composite, 5 sub-indices) |
| **Frontend** | All 10 application pages; bilingual EN/AR |
| **Backend** | Supabase PostgreSQL + PostGIS; Edge Functions; PostgREST API |
| **EO pipeline** | GEE Cloud Run worker; scheduled + on-demand |
| **AI integration** | OpenAI proxy strictly grounded over MIZAN stored data |
| **Export** | PDF reports, JSON API |

### 5.2 Out of Scope

| Category | Exclusion | Rationale |
|----------|-----------|-----------|
| Direct groundwater measurement | MIZAN uses EO proxies only | No satellite can directly observe aquifer levels |
| Legal/regulatory enforcement | MIZAN produces indicators, not regulatory findings | Misuse risk; requires licensed hydrogeological study |
| Real-time IoT sensor integration | Phase 1 does not ingest live piezometer feeds | Future work (see [20-limitations.md](20-limitations.md)) |
| Water quality monitoring | MIZAN monitors quantity stress indicators | Different sensor requirements |
| Demand-side agricultural advisory | Crop recommendations, irrigation scheduling | Out of scope; different persona |
| Non-Jordanian territories | All analysis within Jordan boundary | Scope limitation; transboundary data governance |
| Mobile native application | Web only (PWA-compatible) | Resource constraint |

### 5.3 Assumptions

1. Google Earth Engine service account access is maintained and sufficient quota is available for scheduled pipeline runs.
2. Sentinel-2, CHIRPS, SRTM, GRACE data remain freely available through GEE with their current temporal coverage.
3. Supabase free/pro tier is sufficient for Phase 1 data volumes.
4. FAO GAUL level1/level2 boundaries accurately represent Jordan's administrative divisions for Phase 1 purposes.
5. A reasonable-quality Azraq Basin boundary polygon is obtainable from authoritative MWI/derived watershed sources; MIZAN will not fabricate this boundary.
6. Phase 1 does not require in-situ piezometer data for the core GW Stress model, though such data would be incorporated if available.
7. The Phase 1 ML training datasets can be assembled from publicly available labelled data (ESA WorldCover, IIASA HILDA+, published irrigation maps) sufficient for a functional (not production-final) model.

### 5.4 Constraints

| Constraint | Description |
|------------|-------------|
| Scientific integrity | Non-negotiable: all outputs traceable; no fabricated data; non-claims enforced in UI copy and AI responses |
| Data sources | Only those listed in architecture contract or equivalent authoritative sources |
| Language | EN and AR only in Phase 1; RTL support required |
| Roles | Four-role system (viewer, analyst, admin, judge); RLS on all tables |
| AI grounding | OpenAI calls MUST be proxied through Edge Function; responses MUST reference only stored MIZAN metrics |
| Provenance | Every `indicator_values` row must have a corresponding `provenance` record |
| Confidence | Every metric display must show a confidence score and level badge |

---

## 6. User Stories & Acceptance Criteria

### 6.1 Primary Use Case: Groundwater Stress Monitoring

---

**US-GW-01: View current Azraq Groundwater Stress Index**

> As an MWI analyst, I want to see the current Groundwater Stress Index for the Azraq Basin so that I can understand the current stress level at a glance.

**Acceptance Criteria:**
- [ ] The `/azraq` page displays a current `gw_stress_index` value (0–100) prominently.
- [ ] The value is accompanied by a `gw_stress_class` label: Low / Moderate / High / Severe.
- [ ] A confidence score badge (High/Medium/Low) is visible alongside the index.
- [ ] The data source and computation date are visible (provenance popup on hover/tap).
- [ ] If no data is available for the current month, a clear "No data" state is shown with an explanation.
- [ ] The index value is never displayed without its confidence and provenance.

---

**US-GW-02: View Groundwater Stress Index time series**

> As an MWI analyst, I want to see how the Groundwater Stress Index has changed over the past 5 years so that I can identify trends.

**Acceptance Criteria:**
- [ ] A time-series chart on `/azraq` shows monthly `gw_stress_index` values for at least 5 years.
- [ ] Stress-class thresholds (25, 50, 75) are indicated as horizontal reference lines.
- [ ] The chart allows zooming to a custom date range.
- [ ] Hovering a data point shows exact value, date, and confidence.
- [ ] Chart is accessible (keyboard navigable, ARIA labels present).

---

**US-GW-03: Inspect sub-index breakdown**

> As an MWI analyst, I want to see how each sub-index contributes to the overall Groundwater Stress Index so that I understand which drivers are most significant.

**Acceptance Criteria:**
- [ ] A sub-index panel on `/azraq` shows all 5 sub-indices: abstraction pressure, recharge deficit, vegetation–water divergence, surface-water decline, regional storage trend.
- [ ] Each sub-index shows its current normalised value (0–1) and its weight in the composite.
- [ ] Weights are displayed and labelled "configurable" with a tooltip explaining the default values.
- [ ] Each sub-index links to the underlying indicator data.
- [ ] GRACE-derived regional storage trend is labelled "coarse resolution (~300 km), regional context only."

---

**US-GW-04: Receive stress-class change alert**

> As an MWI analyst, I want to receive an alert when the Azraq Groundwater Stress class changes (e.g., from Moderate to High) so that I can take timely action.

**Acceptance Criteria:**
- [ ] The `alerts` table records a new entry when `gw_stress_class` changes between classification runs.
- [ ] The alert is visible on the National Command Center dashboard (`/`).
- [ ] The alert shows the previous class, new class, date, and a link to `/azraq` for detail.
- [ ] Alerts are accessible only to `analyst` and `admin` roles (RLS enforced).
- [ ] Alert is generated within 24 hours of the triggering computation.

---

**US-GW-05: Run a scenario with modified abstraction pressure**

> As a researcher, I want to change the abstraction pressure weight in the GW Stress model and see how the index changes so that I can understand model sensitivity.

**Acceptance Criteria:**
- [ ] The Digital Twin page (`/twin`) provides a scenario runner panel with weight sliders for each sub-index.
- [ ] Adjusted weights sum to 1.0 (UI enforces normalisation).
- [ ] Scenario computation runs against stored indicator data and returns an updated composite index within 5 seconds.
- [ ] Results are labelled clearly as "Scenario — not a MIZAN operational output."
- [ ] Scenarios are saved to the `scenarios` and `scenario_results` tables with the user's role recorded.
- [ ] `viewer` role cannot save scenarios (read-only scenario display only).

---

### 6.2 Irrigation Monitoring (UC-IR)

---

**US-IR-01: View irrigated area map**

> As a JVA field engineer, I want to see a spatial map of irrigated areas in the Azraq Basin for the current growing season so that I can compare it with my field observations.

**Acceptance Criteria:**
- [ ] The `/satellite` page shows a map layer of irrigated-area classification (irrigated vs. rainfed/non-crop) derived from the `xgb_irrigation_detector` model.
- [ ] The map layer includes the season/year of the classification.
- [ ] A total irrigated area estimate in hectares (ha) is shown with confidence badge.
- [ ] The 5-field validation envelope (Source, Date, Methodology, Confidence, Explanation) is accessible for this metric.
- [ ] The map legend clearly labels the classification as "MIZAN estimate — not a survey measurement."

---

**US-IR-02: Detect irrigated-area expansion over time**

> As an MWI analyst, I want to see the change in irrigated area year-over-year so that I can quantify expansion trends.

**Acceptance Criteria:**
- [ ] An `agri_expansion_pct` time series (annual) is displayed on `/satellite` or `/azraq`.
- [ ] Change is shown in absolute ha and percentage relative to baseline year.
- [ ] A before/after map comparison is available for any two selected years.
- [ ] Expansion is annotated with confidence intervals derived from model accuracy estimates.

---

### 6.3 Rainfall Anomaly Detection (UC-RF)

---

**US-RF-01: View SPI maps for Jordan**

> As a national water planner, I want to see current SPI-3 and SPI-12 maps for all of Jordan so that I can identify drought-affected regions.

**Acceptance Criteria:**
- [ ] The Jordan Monitoring Map (`/map`) includes a CHIRPS-derived SPI layer selectable from the layer panel.
- [ ] SPI values are classified using standard WMO drought categories (> +1.0 wet; -1.0 to +1.0 near-normal; -1.0 to -1.5 moderate drought; -1.5 to -2.0 severe drought; < -2.0 extreme drought).
- [ ] Colour scheme follows a diverging scale (blue = wet, red = dry).
- [ ] Current SPI is available for SPI-1, SPI-3, SPI-6, SPI-12 (selectable).
- [ ] Source is labelled as CHIRPS (UCSB-CHG/CHIRPS/DAILY) with compute date.

---

**US-RF-02: Detect rainfall anomalies via Isolation Forest**

> As a researcher, I want to know which months have been flagged as anomalous by the Isolation Forest model so that I can investigate unusual rainfall patterns.

**Acceptance Criteria:**
- [ ] The `iforest_anomaly` model results are stored in `predictions` with a `anomaly_score` and `is_anomaly` flag.
- [ ] Anomaly flags are overlaid on the CHIRPS time-series chart on the Satellite Analysis Center.
- [ ] Anomalous months are annotated with their anomaly score and SHAP feature contributions.
- [ ] The model methodology is described in a tooltip/help panel (link to [07-machine-learning.md](07-machine-learning.md)).

---

### 6.4 Agricultural Expansion Detection (UC-AG)

---

**US-AG-01: Detect new agricultural areas**

> As an RSCN officer, I want to identify areas where new agricultural activity has appeared within or near the Azraq Wetland Reserve buffer zone so that I can flag potential encroachment threats.

**Acceptance Criteria:**
- [ ] The LULC change layer on `/map` shows land-cover transitions classified by the `rf_crop_classifier` model.
- [ ] New cropland pixels (not cropland in baseline year, cropland in current year) are highlighted in a distinct colour.
- [ ] A table shows the area (ha) of new cropland within user-defined buffer zones.
- [ ] The analysis methodology is traceable to a `model_runs` record in the database.

---

### 6.5 Environmental Risk Assessment (UC-ER)

---

**US-ER-01: View composite environmental risk**

> As an RSCN officer, I want to see a combined environmental risk assessment for the Azraq area so that I can prioritise conservation intervention.

**Acceptance Criteria:**
- [ ] The `/azraq` or `/impact` page shows a combined risk summary layer incorporating GW stress, vegetation stress, and surface-water extent decline.
- [ ] Risk is classified into at least three ordinal levels (Low/Moderate/High or equivalent).
- [ ] Each contributing factor is visible with its current value and contribution weight.
- [ ] Risk is labelled as an estimate and not a regulatory finding.

---

### 6.6 AI Intelligence (Cross-cutting)

---

**US-AI-01: Ask a natural-language question about Azraq data**

> As a researcher, I want to ask a natural-language question (e.g., "What has been the trend in NDVI over Azraq in the past 3 years?") and receive a cited, data-grounded answer.

**Acceptance Criteria:**
- [ ] The AI Intelligence Center (`/ai`) provides a text input for natural-language queries.
- [ ] The response references specific stored `indicator_values` records with their dates and confidence scores.
- [ ] The response includes an explicit statement that it is grounded in MIZAN's stored data.
- [ ] If the query asks about something MIZAN cannot measure (e.g., "What is the water table depth?"), the AI responds with a clear non-claim statement and explains what MIZAN can and cannot observe.
- [ ] The AI never invents a number; all values in the response must be traceable to the `indicator_values` table.
- [ ] Response time < 10 seconds for standard queries.

---

### 6.7 Judge / Evaluation (AstroCode)

---

**US-JM-01: Navigate all six deliverables in Judge Mode**

> As an AstroCode judge, I want to navigate a structured evaluation interface that presents evidence for each of the six deliverables so that I can efficiently assess the submission.

**Acceptance Criteria:**
- [ ] The `/judge` page has six tabs corresponding to each AstroCode deliverable.
- [ ] Each tab contains: a deliverable description, a list of MIZAN features satisfying it, direct links to supporting pages/data, and a self-assessment summary.
- [ ] The audit log showing all model runs, pipeline executions, and data ingestion events is accessible from Judge Mode.
- [ ] Scientific integrity statement is displayed prominently.
- [ ] The judge can navigate the entire evaluation in < 5 minutes without prior system knowledge.
- [ ] All content in Judge Mode is read-only for the `judge` role.

---

## 7. Functional Requirements

### 7.1 Data Ingestion & Processing

| ID | Requirement |
|----|-------------|
| FR-D-01 | System SHALL ingest Sentinel-2 SR data from GEE (`COPERNICUS/S2_SR_HARMONIZED`) with cloud masking applied |
| FR-D-02 | System SHALL compute vegetation indices (NDVI, EVI, SAVI) and their anomalies relative to a multi-year baseline |
| FR-D-03 | System SHALL compute water indices (NDWI, MNDWI) and derive surface-water extent in km² |
| FR-D-04 | System SHALL ingest Sentinel-1 GRD (VV, VH) and compute SAR-derived RVI and soil moisture proxy |
| FR-D-05 | System SHALL ingest CHIRPS daily/pentad data and compute SPI at 1, 3, 6, 12-month timescales |
| FR-D-06 | System SHALL compute FAO-56 Penman-Monteith ET₀ from ERA5-Land inputs |
| FR-D-07 | System SHALL run the `rf_crop_classifier` model in GEE and store per-pixel classification results |
| FR-D-08 | System SHALL run the `xgb_irrigation_detector` model and store irrigated-area estimates with confidence |
| FR-D-09 | System SHALL run the `iforest_anomaly` model on CHIRPS and vegetation time series |
| FR-D-10 | System SHALL compute the GW Stress Index using the 5-sub-index weighted composite formula |
| FR-D-11 | System SHALL record a provenance entry for every indicator value written to the database |
| FR-D-12 | System SHALL compute and store a confidence score for every indicator value |
| FR-D-13 | Scheduled pipeline runs SHALL execute at least monthly via Cloud Scheduler → Pub/Sub → Cloud Run |
| FR-D-14 | On-demand pipeline execution SHALL be available via Edge Function `ee-compute` |

### 7.2 Data Storage & Retrieval

| ID | Requirement |
|----|-------------|
| FR-S-01 | All indicator values SHALL be stored in the `indicator_values` table with PostGIS geometry |
| FR-S-02 | All model outputs SHALL be traceable to a `model_runs` record |
| FR-S-03 | Row-Level Security SHALL be enforced on all tables; no unauthenticated writes |
| FR-S-04 | The PostgREST API SHALL expose indicator data with provenance and confidence in every response |
| FR-S-05 | All map tiles SHALL be served via EE `getMapId` or pre-exported COG |

### 7.3 Presentation & User Interface

| ID | Requirement |
|----|-------------|
| FR-U-01 | All 10 application pages SHALL be implemented and functional |
| FR-U-02 | The application SHALL support full English (LTR) and Arabic (RTL) localisation |
| FR-U-03 | Every displayed metric SHALL show a confidence badge (High/Medium/Low) |
| FR-U-04 | Every displayed metric SHALL have an accessible provenance popup |
| FR-U-05 | The application SHALL display the 5-field validation envelope for every indicator |
| FR-U-06 | Map layers SHALL support layer toggle, date selection, and probe-click inspection |
| FR-U-07 | The application SHALL include a scenario runner on the Digital Twin page |
| FR-U-08 | The application SHALL provide PDF report generation |
| FR-U-09 | Judge Mode SHALL present all six AstroCode deliverables with evidence |
| FR-U-10 | AI responses SHALL include source citations and non-claim statements where applicable |

### 7.4 Machine Learning

| ID | Requirement |
|----|-------------|
| FR-ML-01 | RF crop classifier SHALL be trained with documented training data, features, and validation metrics |
| FR-ML-02 | XGBoost irrigation detector SHALL achieve ≥ 0.75 F1 on held-out validation set |
| FR-ML-03 | All model predictions SHALL store SHAP feature importance values |
| FR-ML-04 | Model run metadata (training date, parameters, validation metrics) SHALL be stored in `model_runs` |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P-01 | API p95 response time | < 2 seconds |
| NFR-P-02 | Frontend time-to-interactive | < 3 seconds on 4G |
| NFR-P-03 | Map tile render time | < 1.5 seconds per layer |
| NFR-P-04 | Report generation time | < 10 seconds standard report |
| NFR-P-05 | AI response time | < 10 seconds |
| NFR-P-06 | Scenario computation time | < 5 seconds |

### 8.2 Security

| ID | Requirement |
|----|-------------|
| NFR-S-01 | All API access SHALL require JWT authentication (Supabase Auth) |
| NFR-S-02 | Row-Level Security SHALL be active on all Supabase tables |
| NFR-S-03 | OpenAI API key SHALL be held server-side in Edge Function only; never exposed to frontend |
| NFR-S-04 | GEE service account credentials SHALL be held in Cloud Run environment secrets |
| NFR-S-05 | All data modifications SHALL be recorded in `audit_log` with user ID and timestamp |
| NFR-S-06 | HTTPS SHALL be enforced on all endpoints |

### 8.3 Reliability & Data Integrity

| ID | Requirement |
|----|-------------|
| NFR-R-01 | Pipeline failure SHALL not result in data corruption; partial runs SHALL roll back |
| NFR-R-02 | 100% of indicator_values rows SHALL have a linked provenance record (enforced by FK constraint) |
| NFR-R-03 | 100% of indicator_values rows SHALL have a linked confidence_scores record |
| NFR-R-04 | No fabricated data SHALL appear in any MIZAN output (technically enforced + QA tested) |
| NFR-R-05 | Scheduled pipeline uptime SHALL be ≥ 95% |

### 8.4 Usability & Accessibility

| ID | Requirement |
|----|-------------|
| NFR-U-01 | Arabic RTL layout SHALL be fully functional with no layout breakage |
| NFR-U-02 | All interactive elements SHALL be keyboard navigable |
| NFR-U-03 | WCAG 2.1 AA compliance SHALL be verified by automated scan |
| NFR-U-04 | Colour palettes SHALL meet AA contrast ratios |
| NFR-U-05 | All charts SHALL have accessible tooltips and ARIA labels |
| NFR-U-06 | Error states SHALL provide actionable guidance |

### 8.5 Internationalisation

| ID | Requirement |
|----|-------------|
| NFR-I-01 | All user-facing strings SHALL be defined in i18n resource files (EN + AR) |
| NFR-I-02 | Date formats SHALL adapt to locale (Gregorian for EN; appropriate for AR) |
| NFR-I-03 | Numeric formats SHALL respect locale conventions |
| NFR-I-04 | RTL direction SHALL be applied to the entire page, not individual components only |

### 8.6 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-M-01 | All components SHALL follow the project's TypeScript + shadcn/ui conventions |
| NFR-M-02 | EE pipeline code SHALL be documented with inline comments referencing indicator codes |
| NFR-M-03 | Database migrations SHALL be versioned and reproducible |

---

## 9. Hypotheses MIZAN Tests

MIZAN is built around five primary scientific hypotheses that the system produces evidence for or against through its indicators. These are observational/monitoring hypotheses, not controlled experiments.

| Hypothesis | MIZAN Indicators | Falsification Condition |
|------------|-----------------|------------------------|
| **H1:** Irrigated area in the Azraq Basin has expanded over the Sentinel era (2015–present), implying increasing groundwater abstraction pressure. | `irrigated_area_ha`, `agri_expansion_pct`, LULC change maps | Stable or declining irrigated area detected with high confidence |
| **H2:** Rainfall deficits (negative SPI) in the Azraq catchment have become more frequent or prolonged over the past decade, reducing recharge opportunity. | `spi_3`, `spi_12`, `precip_anomaly_pct` time series | No statistically significant change in SPI distribution |
| **H3:** Vegetation–water divergence (green vegetation during dry-season rainfall deficit) is detectable in the Azraq Basin and is spatially correlated with known irrigated areas. | `ndvi_anomaly`, `spi_3` cross-correlation, dry-season NDVI vs rainfall | No spatial correlation between dry-season NDVI and irrigated-area map |
| **H4:** Azraq Oasis surface-water extent shows a declining or highly variable trend over the Sentinel-2 era, reflecting continued hydrological stress. | `surface_water_extent_km2`, `ndwi`, `mndwi` time series | Stable or increasing extent with high confidence |
| **H5:** The GRACE-derived TWS anomaly over the Azraq/eastern Jordan region shows a sustained negative trend over the GRACE record. | `gwa_anomaly_cm` (GRACE mascon, coarse resolution) | No significant trend in GRACE TWS over the region (labelled as coarse-resolution context) |

---

## 10. Risks & Ethical Considerations

### 10.1 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Misinterpretation of indicators as direct GW measurements** | High | High | Non-claim statements in every UI component; AI enforced non-claims; limitations page; validation envelope |
| **Policy misuse (e.g., penalising farmers based on indicator maps)** | Medium | High | Explicit "not a regulatory finding" labels; methodology documentation; Limitations doc; responsible-use guidance in Impact Center |
| **Data fabrication by AI component** | Low (by design) | Critical | AI is proxied through Edge Function with strict prompting; responses are grounded exclusively in stored data; OpenAI never has direct DB access |
| **GEE quota exhaustion disrupting pipeline** | Medium | Medium | Scheduled runs are optimised for EE compute units; on-demand calls are rate-limited; fallback to cached data with staleness label |
| **Model accuracy insufficient for operational use** | Medium | Medium | Confidence engine transparently communicates low model_validation scores; outputs labelled as estimates; validation metrics published |
| **CHIRPS spatial resolution (~5.5 km) misapplied at field scale** | Medium | Medium | Resolution labelled on every CHIRPS-derived output; users warned against sub-pixel interpretation |
| **GRACE coarse resolution (~300 km) misread as local GW signal** | High | High | GRACE outputs labelled "coarse resolution (~300 km), regional context only" throughout UI; dedicated limitation note |
| **Azraq Basin boundary inaccuracy** | Low | Medium | Boundary sourced from authoritative MWI/watershed data; methodology documented; sensitivity to boundary noted in validation |
| **Arabic translation errors creating scientific misstatements** | Medium | Medium | Scientific terms reviewed by Arabic-speaking domain expert before deployment; glossary maintained in both languages |
| **Availability of Sentinel-2 data (cloud cover in winter)** | Medium | Low–Medium | Cloud masking applied; cloud_coverage_pct stored in provenance; freshness factor in confidence engine penalises cloud-affected periods |

### 10.2 Ethical Considerations

**Data Sovereignty and Governance**
MIZAN uses globally available open datasets (Sentinel, CHIRPS, GRACE) that are collected by international agencies and made freely available. No proprietary Jordanian government data is ingested without explicit permission. In-situ piezometer data, if integrated in future phases, would require formal data-sharing agreements.

**Equity and Access**
The platform is bilingual (EN/AR) to reduce language-based access barriers. The `viewer` role is broadly accessible. However, MIZAN recognises that digital access itself is not uniformly distributed; smallholder farmers who may be most affected by the policy implications of MIZAN's outputs are least likely to have direct access to the platform.

**Potential for Misuse in Policy**
Any tool that produces spatial maps of groundwater stress or irrigated area expansion can potentially be used to justify punitive enforcement actions against land users. MIZAN mitigates this by:
1. Clearly labelling all outputs as indicators/estimates, not legal measurements;
2. Prominently stating that MIZAN cannot identify individual wells, pump operators, or specific violators;
3. Providing confidence scores that communicate uncertainty, discouraging over-reliance on low-confidence outputs;
4. Including a responsible-use guidance statement in the Impact Center and Limitations page.

**Scientific Transparency**
MIZAN commits to publishing its full methodology (this specification suite), model validation metrics, and provenance chains. This supports independent scrutiny and prevents the system from being used as a "black box" authority.

**Climate Justice Framing**
Jordan's groundwater crisis is exacerbated by climate change driven primarily by industrialised nations. MIZAN's impact messaging acknowledges this context while focusing its outputs on actionable monitoring within Jordan's control.

### 10.3 Mitigation Summary

| Ethical/Risk Domain | Technical Mitigation | Documentary Mitigation |
|--------------------|---------------------|------------------------|
| No fabrication | Provenance FK constraint; AI prompt guardrails | [20-limitations](20-limitations.md) Section 3 |
| No overclaiming | Non-claim UI labels; confidence badges | [01-project-overview](01-project-overview.md) Section 7.2 |
| No regulatory determination | "not a regulatory finding" copy throughout | Responsible-use statement in [20-limitations](20-limitations.md) |
| Model transparency | SHAP explainability; validation metrics public | [07-machine-learning](07-machine-learning.md) |
| Data provenance | 5-field envelope; audit_log | [16-validation-framework](16-validation-framework.md) |
| Misuse prevention | Role-based access; no individual-level attribution | [17-security](17-security.md) |

---

*End of Document 02 — Problem Definition*
