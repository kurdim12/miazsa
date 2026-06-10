# 19 — AstroCode Compliance

| Field         | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Document      | 19-astrocode-compliance.md                                            |
| Project       | MIZAN — Earth Observation Environmental Intelligence for Jordan       |
| Version       | 0.1 (Draft)                                                           |
| Status        | Phase 1 — Specification                                               |
| Last updated  | 2026-06-10                                                            |
| Related       | [01-project-overview](01-project-overview.md) · [14-judge-mode](14-judge-mode.md) · [16-validation-framework](16-validation-framework.md) · [20-limitations](20-limitations.md) |

---

## Purpose

This document demonstrates MIZAN's compliance with every AstroCode competition deliverable. It provides a detailed compliance matrix showing how each deliverable is satisfied, a complete feature-to-deliverable traceability table confirming that every system feature maps to at least one deliverable, a judge evaluation rubric mapping tied to the Judge Mode interface specification, a demo-day evidence checklist for the live presentation, and a scientific-integrity compliance section showing how the non-negotiable data-integrity rules are technically enforced throughout the platform.

**Deliverables mapping:** Functional Prototype · Data Explanation · AI/Analytics Method · Results Visualization · Jordanian Use Case · Impact Statement

---

## 1. AstroCode Deliverables: Definitions

The six AstroCode deliverables are defined here as MIZAN interprets them, with a plain-English rationale for why each matters to the competition's evaluation goals.

| # | Deliverable | Plain-English Intent | MIZAN Interpretation |
|---|-------------|---------------------|----------------------|
| D1 | **Functional Prototype** | A working system, not just mockups or slides — it processes real data and produces real outputs | A deployed, fully operational platform processing real Sentinel/CHIRPS/GEE data and returning real indicator values through a live UI |
| D2 | **Data Explanation** | The team understands their data: provenance, quality, limitations, methodology | Every metric has a 5-field validation envelope; a Validation Center; provenance stored in DB; confidence scores quantify data quality |
| D3 | **AI/Analytics Method** | Sophisticated analytical methods — beyond simple averages; ML, modelling, spatial analysis | GEE-based ML (RF, XGBoost, Isolation Forest), Penman-Monteith deterministic model, composite GW Stress model, SHAP explainability, AI narrative via LLM |
| D4 | **Results Visualization** | Results are clearly communicated through effective visual interfaces | 10-page React platform, MapLibre maps, Recharts time series, deck.gl 3D digital twin, before/after comparisons |
| D5 | **Jordanian Use Case** | The solution is genuinely relevant to Jordan — not a generic tool rebranded | Azraq Basin primary demo; Jordanian data (FAO GAUL, JMD), personas (MWI, RSCN), Arabic language, Jordan national coverage |
| D6 | **Impact Statement** | The team can articulate real-world significance and stakeholder value | Impact Center, before/after trend deltas, exportable impact statements, Judge Mode impact tab |

---

## 2. Detailed Compliance Matrix

### 2.1 D1 — Functional Prototype

**Deliverable Standard:** A complete, deployed system that processes real Earth Observation or environmental data end-to-end and returns outputs through a usable interface, demonstrating engineering completeness.

| Compliance Aspect | MIZAN Implementation | Evidence Location | Status |
|-------------------|---------------------|-------------------|--------|
| Real data ingested | Sentinel-2 SR, CHIRPS, Sentinel-1, SRTM, GRACE — all via Google Earth Engine live API calls | `ee-compute` Edge Function; GEE Cloud Run worker | Specified |
| End-to-end pipeline | GEE Python → Cloud Run → Pub/Sub → Supabase Postgres → PostgREST → React frontend | [03-system-architecture](03-system-architecture.md) | Specified |
| Scheduled automation | Cloud Scheduler → Pub/Sub → Cloud Run → GEE pipeline → DB write | [18-deployment](18-deployment.md) | Specified |
| On-demand computation | Edge Function `ee-compute` triggered from frontend | [12-api-specification](12-api-specification.md) | Specified |
| All 10 pages operational | `/`, `/map`, `/azraq`, `/satellite`, `/ai`, `/twin`, `/validation`, `/impact`, `/judge`, `/reports` | [13-ui-pages](13-ui-pages.md) | Specified |
| Authentication working | Supabase Auth JWT + RLS; role-based access (viewer/analyst/admin/judge) | [17-security](17-security.md) | Specified |
| Database populated | `indicator_values`, `provenance`, `confidence_scores`, `model_runs` tables contain real data | [11-database-schema](11-database-schema.md) | Specified |
| API responding | PostgREST `/rest/v1/` endpoints + Edge Functions `/functions/v1/` respond with real data | [12-api-specification](12-api-specification.md) | Specified |
| Maps rendering real tiles | MapLibre GL JS rendering EE-derived map tiles for NDVI, SPI, irrigated area, GW stress | [13-ui-pages](13-ui-pages.md) | Specified |
| Report generation functional | PDF/Markdown report containing real indicators generated on demand | [15-report-generator](15-report-generator.md) | Specified |

**Summary Evidence Statement (D1):** MIZAN is not a mockup. Every data path — from EE collection query through to rendered chart — operates on real satellite data. The Cloud Run worker executes actual GEE Python API calls against `COPERNICUS/S2_SR_HARMONIZED` and `UCSB-CHG/CHIRPS/DAILY`. Results are stored in a live PostgreSQL database with PostGIS geometry. The React frontend renders these stored values through a production-grade API. The Judge Mode audit log displays actual pipeline execution records.

---

### 2.2 D2 — Data Explanation

**Deliverable Standard:** The team can explain where their data comes from, how it was processed, what its quality and limitations are, and how they know their outputs are trustworthy.

| Compliance Aspect | MIZAN Implementation | Evidence Location | Status |
|-------------------|---------------------|-------------------|--------|
| Data source catalogue | Full catalogue with EE IDs, resolution, temporal range, licensing for all datasets | [04-data-sources](04-data-sources.md) | Specified |
| 5-field validation envelope | Source, Date, Methodology, Confidence, Explanation — on every displayed metric | [16-validation-framework](16-validation-framework.md) | Specified |
| Provenance table | `provenance` table records EE collection ID, run ID, spatial filter, date range, processing version for every value | [11-database-schema](11-database-schema.md) | Specified |
| Confidence scoring | Quantified [0,1] confidence via 6-factor geometric mean; High/Medium/Low badge on every metric | [09-confidence-engine](09-confidence-engine.md) | Specified |
| Validation Center page | `/validation` shows cross-validation results, model performance tables, per-metric validation records | [16-validation-framework](16-validation-framework.md) | Specified |
| Provenance popups | Map probe-click shows EE collection ID, date, spatial coverage, processing method | [13-ui-pages](13-ui-pages.md) | Specified |
| Limitations documented | Full limitations document covering scientific, data, and model limitations | [20-limitations](20-limitations.md) | Specified |
| AI cites sources | Every AI response in `/ai` references specific `indicator_values` record IDs and dates | [12-api-specification](12-api-specification.md) | Specified |
| Resolution labelling | All outputs labelled with spatial resolution (e.g., "10 m Sentinel-2", "~5.5 km CHIRPS", "~300 km GRACE") | [13-ui-pages](13-ui-pages.md) | Specified |
| GRACE labelling | GRACE outputs carry permanent "coarse resolution (~300 km), regional context only" label | [13-ui-pages](13-ui-pages.md), [20-limitations](20-limitations.md) | Specified |

**Summary Evidence Statement (D2):** MIZAN's data explanation is architectural, not cosmetic. The `provenance` table is a first-class database citizen with a foreign key constraint from every `indicator_values` row — it cannot be bypassed. The confidence engine runs deterministically for every metric using a documented formula. The 5-field validation envelope is rendered in the Validation Center and accessible via provenance popups on every map interaction. The data-source catalogue ([04-data-sources](04-data-sources.md)) provides exact EE collection IDs, so any evaluator can independently verify the inputs.

---

### 2.3 D3 — AI/Analytics Method

**Deliverable Standard:** The team applies sophisticated, documented analytical methods that go beyond simple statistics. ML, physical models, spatial analysis, and AI interpretation are expected.

| Compliance Aspect | MIZAN Implementation | Evidence Location | Status |
|-------------------|---------------------|-------------------|--------|
| ML model 1: RF crop classifier | EE `smileRandomForest` trained on labelled crop/LULC data; features include multi-date S2 spectral indices, SAR, elevation; OA target ≥80% | [07-machine-learning](07-machine-learning.md) | Specified |
| ML model 2: XGBoost irrigation detector | Python scikit-learn/XGBoost; irrigated vs. rainfed binary classification; features include dry-season NDVI, EVI, soil moisture proxy; F1 target ≥0.75 | [07-machine-learning](07-machine-learning.md) | Specified |
| ML model 3: Isolation Forest | Unsupervised anomaly detection on CHIRPS and NDVI time series; contamination parameter calibrated on historical data | [07-machine-learning](07-machine-learning.md) | Specified |
| Physical/deterministic model: Penman-Monteith | FAO-56 ET₀ from ERA5-Land inputs (Tmax, Tmin, RH, wind, Srad); exact equation documented | [06-remote-sensing-methods](06-remote-sensing-methods.md) | Specified |
| Composite risk model: GW Stress Index | Transparent 5-sub-index weighted geometric composite; weights configurable; formula published | [08-risk-scoring](08-risk-scoring.md) | Specified |
| SHAP explainability | TreeExplainer applied to XGBoost and RF predictions; per-feature SHAP values stored in DB; visualised in `/ai` | [07-machine-learning](07-machine-learning.md) | Specified |
| SPI computation | Standardised precipitation index at 1/3/6/12 months via L-moments or maximum-likelihood gamma fitting | [06-remote-sensing-methods](06-remote-sensing-methods.md) | Specified |
| Vegetation–water divergence analysis | NDVI anomaly cross-correlated with SPI; residuals identify groundwater-dependent vegetation | [06-remote-sensing-methods](06-remote-sensing-methods.md) | Specified |
| LLM AI integration | OpenAI GPT-4-class proxied through Edge Function; strictly grounded over MIZAN stored metrics; structured prompt template | [12-api-specification](12-api-specification.md) | Specified |
| Scenario modelling | Weight perturbation on GW Stress sub-indices; stored in `scenarios` + `scenario_results` | [10-digital-twin](10-digital-twin.md) | Specified |
| Spatial analytics | PostGIS geometry operations; zonal statistics for AOI aggregation; raster-to-vector at Supabase layer | [11-database-schema](11-database-schema.md) | Specified |

**Summary Evidence Statement (D3):** MIZAN deploys four distinct analytical paradigms: (1) supervised classification ML (RF, XGBoost), (2) unsupervised anomaly detection (Isolation Forest), (3) physically-based deterministic modelling (FAO-56 Penman-Monteith), and (4) composite index modelling (GW Stress Index). Each is coupled with SHAP-based explainability. The AI layer uses a production LLM grounded over real stored data — not a chatbot over generic knowledge. Methods are fully documented in [05](05-earth-engine-pipelines.md), [06](06-remote-sensing-methods.md), [07](07-machine-learning.md), and [08](08-risk-scoring.md).

---

### 2.4 D4 — Results Visualization

**Deliverable Standard:** Results are presented through clear, effective visual interfaces that communicate findings to diverse audiences without requiring technical expertise.

| Compliance Aspect | MIZAN Implementation | Evidence Location | Status |
|-------------------|---------------------|-------------------|--------|
| Interactive map (choropleth/layers) | MapLibre GL JS with Maptiler basemap; toggle layers: NDVI anomaly, SPI, irrigated area, GW stress class, surface water | [13-ui-pages](13-ui-pages.md) | Specified |
| Time-series charts | Recharts line/bar charts for all indicators; zoom, hover tooltips, threshold lines | [13-ui-pages](13-ui-pages.md) | Specified |
| Sub-index breakdown chart | Radial or stacked bar chart of 5 GW Stress sub-indices with weight annotation | [13-ui-pages](13-ui-pages.md) | Specified |
| Before/after spatial comparison | Side-by-side or swipe map comparison for any two years on irrigated area, NDVI, surface water | [13-ui-pages](13-ui-pages.md) | Specified |
| 3D digital twin | deck.gl terrain + heatmap + scatter layers; animated recharge flow; scenario overlay | [10-digital-twin](10-digital-twin.md) | Specified |
| Confidence badges | Colour-coded badge (green=High, yellow=Medium, red=Low) on every metric | [09-confidence-engine](09-confidence-engine.md), [13-ui-pages](13-ui-pages.md) | Specified |
| Alert dashboard | National Command Center aggregates active alerts with map pin + severity colouring | [13-ui-pages](13-ui-pages.md) | Specified |
| Impact trend cards | Impact Center presents delta values (e.g., "+1,200 ha irrigated area since 2018") with clear framing | [13-ui-pages](13-ui-pages.md) | Specified |
| PDF reports | Structured PDF with maps, charts, narrative, confidence tables, provenance | [15-report-generator](15-report-generator.md) | Specified |
| Bilingual UI | All visualisations and labels in EN/AR; RTL chart axis mirroring; right-aligned Arabic tooltips | [13-ui-pages](13-ui-pages.md) | Specified |
| Accessibility | WCAG AA, keyboard navigation, ARIA labels on all interactive elements | [13-ui-pages](13-ui-pages.md) | Specified |

**Summary Evidence Statement (D4):** MIZAN's visualization layer spans five distinct modalities: interactive GIS maps, time-series analytics, 3D immersive digital twin, structured reports, and contextual AI narrative — all in a bilingual, accessible interface. Visualizations are not decorative; each is directly connected to a specific analytical output stored in the database, with provenance and confidence surfaced on every interaction.

---

### 2.5 D5 — Jordanian Use Case

**Deliverable Standard:** The solution is genuinely relevant to Jordan's specific environmental challenges, geography, governance context, and user needs — not a generic tool applied superficially.

| Compliance Aspect | MIZAN Implementation | Evidence Location | Status |
|-------------------|---------------------|-------------------|--------|
| Azraq Basin as primary demo AOI | All primary analytics are scoped to Azraq Basin; RAMSAR oasis wetland included; basin boundary from authoritative MWI/watershed source | [02-problem-definition](02-problem-definition.md) | Specified |
| Jordan national coverage | SPI, irrigated area, NDVI anomaly available for all Jordan via FAO GAUL boundaries | [04-data-sources](04-data-sources.md), [13-ui-pages](13-ui-pages.md) | Specified |
| MWI/JVA persona design | Primary analyst persona modelled on MWI water resource analyst; report format matches MWI briefing conventions | [02-problem-definition](02-problem-definition.md), [15-report-generator](15-report-generator.md) | Specified |
| RSCN conservation use case | Wetland extent, vegetation stress, and encroachment detection designed for RSCN Azraq Reserve officers | [02-problem-definition](02-problem-definition.md) | Specified |
| Arabic language (RTL) | Full Arabic translation, right-to-left layout, Arabic numerals option | [13-ui-pages](13-ui-pages.md) | Specified |
| Jordan-specific data | CHIRPS data filtered to Jordan extent; FAO GAUL level1/2 for Jordan admin boundaries; ERA5-Land for Jordan climate forcing | [04-data-sources](04-data-sources.md) | Specified |
| Jordanian literature context | Problem framing cites Jordan-specific water scarcity literature with [ref] placeholders | [02-problem-definition](02-problem-definition.md) | Specified |
| Azraq Oasis historical narrative | Product name, Azraq desiccation history, and recovery context are woven into Impact Center and project framing | [01-project-overview](01-project-overview.md), [02-problem-definition](02-problem-definition.md) | Specified |
| Water balance units in MCM | All volumetric outputs in Million Cubic Metres — standard Jordan water accounting unit | [01-project-overview](01-project-overview.md) (Glossary) | Specified |
| Scenario for policy use | Scenario runner designed for MWI to test abstraction reduction scenarios | [10-digital-twin](10-digital-twin.md) | Specified |

**Summary Evidence Statement (D5):** MIZAN is not an off-the-shelf EO template. The Azraq Basin desiccation crisis is the foundational motivation for the product. Every persona, use case, data source, and output format has been designed with Jordanian governance, ecological, and linguistic context in mind. The Arabic language implementation is not a translation overlay — it is a core design requirement built into the component architecture. MIZAN uses Jordan-specific administrative boundaries, Jordan-specific literature, and Jordan-specific MWI reporting conventions.

---

### 2.6 D6 — Impact Statement

**Deliverable Standard:** The team can articulate how their system creates real-world value: who benefits, what decisions it improves, what change it enables, and how impact is measured.

| Compliance Aspect | MIZAN Implementation | Evidence Location | Status |
|-------------------|---------------------|-------------------|--------|
| Impact Center page | Dedicated `/impact` page with narrative cards, trend deltas, before/after comparisons | [13-ui-pages](13-ui-pages.md) | Specified |
| Quantified trend deltas | Irrigated-area growth in ha/yr; SPI deficit months per year; surface-water extent change in km² | [13-ui-pages](13-ui-pages.md) | Specified |
| Stakeholder benefit statements | Per-persona impact framing: MWI (decision support), RSCN (early warning), donors (evidence base), public (awareness) | [02-problem-definition](02-problem-definition.md), [13-ui-pages](13-ui-pages.md) | Specified |
| Exportable impact statements | PDF/Markdown reports include an "Impact Summary" section with key trend metrics | [15-report-generator](15-report-generator.md) | Specified |
| Judge Mode impact tab | Dedicated tab in `/judge` presenting impact evidence, trend visualisations, and stakeholder value narrative | [14-judge-mode](14-judge-mode.md) | Specified |
| Before/after spatial evidence | Side-by-side maps showing irrigated area, NDVI, surface water at two time points | [13-ui-pages](13-ui-pages.md) | Specified |
| Non-fabricated impact metrics | All impact metrics are derived from MIZAN's own stored indicator values — no invented figures | [20-limitations](20-limitations.md) | Specified |
| Responsible-use framing | Impact messaging is contextualised with responsible-use guidance; no overclaiming | [20-limitations](20-limitations.md) | Specified |
| Alignment with SDGs | Impact Center references SDG 6 (Clean Water), SDG 13 (Climate Action), SDG 15 (Life on Land) where appropriate | [13-ui-pages](13-ui-pages.md) | Specified |

**Summary Evidence Statement (D6):** MIZAN's impact statement is not a slide deck claim — it is derived from the same analytical pipeline that produces the indicators. The Impact Center renders real computed trend deltas. The Report Generator embeds these deltas in exportable documents. The Judge Mode impact tab provides a curated view of the most significant impact evidence. Crucially, every impact figure is traceable to its provenance record, preventing the inflation of results.

---

## 3. Feature → Deliverable Traceability Table

Every significant MIZAN feature is listed below with its mapping to one or more AstroCode deliverables. No feature is unmapped; no deliverable is unsupported.

| Feature | D1 Prototype | D2 Data Explanation | D3 AI/Analytics | D4 Visualization | D5 Jordan Use Case | D6 Impact |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| GEE Cloud Run Pipeline (EE Worker) | ✓ | ✓ | ✓ | | | |
| Sentinel-2 NDVI/EVI/SAVI computation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sentinel-2 NDWI/MNDWI / surface-water extent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sentinel-1 SAR soil moisture proxy | ✓ | ✓ | ✓ | ✓ | ✓ | |
| CHIRPS SPI (1/3/6/12 month) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Penman-Monteith ET₀ (FAO-56) | ✓ | ✓ | ✓ | ✓ | ✓ | |
| RF Crop Classifier (EE smileRF) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| XGBoost Irrigation Detector | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Isolation Forest Anomaly Detector | ✓ | ✓ | ✓ | ✓ | ✓ | |
| GW Stress Index (composite, 5 sub-indices) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GRACE TWS anomaly integration | ✓ | ✓ | ✓ | ✓ | ✓ | |
| SHAP TreeExplainer | | ✓ | ✓ | ✓ | | |
| Vegetation–water divergence analysis | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Confidence Engine (6-factor, [0,1]) | ✓ | ✓ | ✓ | ✓ | | |
| Provenance table + FK constraint | ✓ | ✓ | | | | |
| 5-field Validation Envelope | | ✓ | | ✓ | | |
| Supabase Auth + RLS | ✓ | | | | | |
| PostgREST API (all endpoints) | ✓ | ✓ | | | | |
| Edge Functions (ee-compute, risk-score, ai-insights, etc.) | ✓ | | ✓ | | | |
| National Command Center (`/`) | ✓ | | | ✓ | ✓ | ✓ |
| Jordan Monitoring Map (`/map`) | ✓ | ✓ | | ✓ | ✓ | |
| Azraq Basin Intelligence (`/azraq`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Satellite Analysis Center (`/satellite`) | ✓ | ✓ | ✓ | ✓ | ✓ | |
| AI Intelligence Center (`/ai`) | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Digital Twin + Scenario Runner (`/twin`) | ✓ | | ✓ | ✓ | ✓ | ✓ |
| Validation Center (`/validation`) | ✓ | ✓ | ✓ | ✓ | | |
| Impact Center (`/impact`) | ✓ | | | ✓ | ✓ | ✓ |
| Judge Mode (`/judge`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report Generator (`/reports`) | ✓ | ✓ | | ✓ | ✓ | ✓ |
| Alerts system | ✓ | | ✓ | ✓ | ✓ | ✓ |
| Arabic (RTL) i18n | ✓ | | | ✓ | ✓ | |
| Before/after map comparison | | ✓ | | ✓ | ✓ | ✓ |
| Audit log (`audit_log` table) | ✓ | ✓ | | | | |
| LULC change detection (agri expansion) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stress-class alerts | ✓ | | ✓ | ✓ | ✓ | ✓ |
| Scenario results storage + display | ✓ | | ✓ | ✓ | ✓ | ✓ |
| SDG alignment framing | | | | | ✓ | ✓ |

**Coverage summary:** Every feature maps to D1 (all features contribute to the functioning prototype). All data-processing features map to D2 (data explanation). All model and computation features map to D3 (AI/analytics). All UI and output features map to D4 (visualization). All Jordan-specific features map to D5. All output and communication features map to D6. No orphaned features; no uncovered deliverables.

---

## 4. Judge Evaluation Rubric Mapping

This section maps the MIZAN Judge Mode interface specification ([14-judge-mode](14-judge-mode.md)) to the AstroCode evaluation rubric. Each rubric criterion is mapped to the Judge Mode tab, the supporting evidence available on that tab, and the underlying system documentation.

### 4.1 Rubric Structure

The Judge Mode (`/judge`) presents six tabs, one per deliverable, each structured as:
1. **Deliverable statement** — plain-language description of what is being assessed.
2. **MIZAN self-assessment** — what MIZAN claims to satisfy and how.
3. **Live evidence links** — direct navigation to the supporting pages/data in the platform.
4. **Checklist** — itemised list of criteria with status indicators.
5. **Score rationale** — a brief narrative the judge can use as a starting point for their own assessment.

### 4.2 Rubric → Judge Mode Mapping

| Rubric Criterion | Judge Mode Tab | Evidence Type | Supporting Doc |
|-----------------|----------------|--------------|----------------|
| **System processes real data (not synthetic/fake)** | D1 — Prototype | Audit log showing GEE pipeline execution records with timestamps and collection IDs | [05](05-earth-engine-pipelines.md), [11](11-database-schema.md) |
| **System has a working user interface** | D1 — Prototype | Live navigation demo; all 10 pages accessible from Judge Mode links | [13](13-ui-pages.md) |
| **System has a database with real records** | D1 — Prototype | Direct link to `indicator_values` count query via API; provenance count | [11](11-database-schema.md), [12](12-api-specification.md) |
| **Team explains their data sources** | D2 — Data Explanation | Validation Center open to judge; provenance popup demonstration | [04](04-data-sources.md), [16](16-validation-framework.md) |
| **Team quantifies data quality/uncertainty** | D2 — Data Explanation | Confidence score walkthrough on `/azraq`; confidence table in Validation Center | [09](09-confidence-engine.md) |
| **Team acknowledges data limitations** | D2 — Data Explanation | Limitations section visible on Validation Center; link to [20-limitations](20-limitations.md) | [20](20-limitations.md) |
| **Team uses ML or advanced analytics** | D3 — AI/Analytics | Model runs table in Validation Center; SHAP chart on `/ai`; GW Stress formula display | [07](07-machine-learning.md), [08](08-risk-scoring.md) |
| **Team explains how the model works** | D3 — AI/Analytics | SHAP feature importance visualization; sub-index weight panel; Penman-Monteith formula display | [06](06-remote-sensing-methods.md), [07](07-machine-learning.md) |
| **AI/LLM component is grounded (not hallucinating)** | D3 — AI/Analytics | AI response citations panel; demonstration of non-claim response to direct GW query | [12](12-api-specification.md) |
| **Visualizations are clear and informative** | D4 — Visualization | Live map, Recharts time series, deck.gl 3D twin; confidence badge visible | [13](13-ui-pages.md) |
| **Visualizations support the use case** | D4 — Visualization | Before/after Azraq irrigated-area comparison; SPI map for Jordan | [13](13-ui-pages.md) |
| **Solution is specific to Jordan** | D5 — Jordan Use Case | Azraq Basin boundary on map; Arabic UI toggle; MWI persona report; Jordan admin boundaries | [02](02-problem-definition.md), [13](13-ui-pages.md) |
| **Solution addresses a real Jordanian problem** | D5 — Jordan Use Case | Problem framing narrative on `/impact`; Azraq oasis historical context | [01](01-project-overview.md), [02](02-problem-definition.md) |
| **Team can state clear impact** | D6 — Impact | Impact Center trend delta cards; before/after spatial evidence | [13](13-ui-pages.md) |
| **Impact is traceable to real data** | D6 — Impact | Impact metric provenance pop-up showing source dataset and run ID | [16](16-validation-framework.md) |
| **Team understands responsible use** | D6 — Impact | Responsible-use statement in Impact Center; non-claim labels throughout | [20](20-limitations.md) |

### 4.3 Judge Mode Scoring Sheet

The following scoring sheet is embedded in the Judge Mode interface to assist evaluators:

```
AstroCode MIZAN Evaluation Sheet
=================================
D1 Functional Prototype      [ /25 ]
  - Real data processed        [ /10 ]
  - Working UI                 [ /10 ]
  - Engineering completeness   [ /5  ]

D2 Data Explanation          [ /15 ]
  - Source documentation       [ /5  ]
  - Quality/uncertainty        [ /5  ]
  - Limitations acknowledged   [ /5  ]

D3 AI/Analytics Method       [ /20 ]
  - Method sophistication      [ /10 ]
  - Explainability             [ /5  ]
  - Integrity (no hallucination)[ /5 ]

D4 Results Visualization     [ /15 ]
  - Clarity                    [ /7  ]
  - Relevance                  [ /8  ]

D5 Jordanian Use Case        [ /15 ]
  - Jordan specificity         [ /8  ]
  - Problem relevance          [ /7  ]

D6 Impact Statement          [ /10 ]
  - Clarity of impact          [ /5  ]
  - Traceability               [ /5  ]

TOTAL                        [ /100 ]
```

---

## 5. Demo-Day Evidence Checklist

The following checklist defines the evidence that must be demonstrable in a live demo session. Each item specifies the page to navigate to, the action to perform, and the expected result.

### 5.1 Pre-Demo Setup Checklist

- [ ] All 10 application routes are live and loading without errors
- [ ] GEE pipeline has executed within the past 7 days (audit log shows recent run)
- [ ] `indicator_values` table contains data for Azraq Basin for current or previous month
- [ ] `confidence_scores` table is fully populated for all recent indicator values
- [ ] `provenance` table is fully populated (100% coverage)
- [ ] Model runs table shows at least one successful run of each of the 3 ML models
- [ ] Arabic language switch is functioning
- [ ] Judge role credentials are prepared and tested
- [ ] Digital Twin 3D scene loads without GL errors

### 5.2 Live Demo Script Evidence

| Step | Page | Action | Expected Evidence | Deliverable |
|------|------|--------|------------------|-------------|
| 1 | `/judge` | Load Judge Mode, show all 6 tabs | Six-tab interface visible; navigation links working | D1 |
| 2 | `/judge` → Audit Log | Show pipeline execution log | GEE run records with timestamps, collection IDs | D1, D2 |
| 3 | `/azraq` | Show Groundwater Stress Index | Current value, stress class, confidence badge, provenance popup | D1, D4, D5 |
| 4 | `/azraq` | Click provenance popup | 5-field validation envelope: Source=GEE, Date, Methodology, Confidence=[value], Explanation | D2 |
| 5 | `/azraq` | Show sub-index breakdown chart | 5 sub-indices with weights; GRACE labelled "regional context" | D3, D4 |
| 6 | `/satellite` | Show CHIRPS SPI-3 time series | Time series with Isolation Forest anomaly flags; confidence badge | D3, D4 |
| 7 | `/satellite` | Show NDVI anomaly map | MapLibre layer with legend, resolution label, date | D4, D5 |
| 8 | `/ai` | Ask "What is the current groundwater stress in Azraq?" | Grounded response citing indicator_values record IDs; confidence stated | D3, D4 |
| 9 | `/ai` | Ask "What is the water table depth?" | Non-claim response: "MIZAN cannot directly observe aquifer levels..." | D2, D3 |
| 10 | `/ai` | Show SHAP chart for irrigation detector | Feature importance bars for last prediction | D3 |
| 11 | `/map` | Toggle SPI-3 layer over Jordan | CHIRPS-derived SPI choropleth covering Jordan; layer info panel | D4, D5 |
| 12 | `/twin` | Load 3D Digital Twin | deck.gl terrain + GW stress heatmap renders; scroll/zoom works | D4, D5 |
| 13 | `/twin` | Run scenario (reduce abstraction weight) | Updated composite index displayed; labelled "Scenario" | D3, D4 |
| 14 | `/impact` | Show before/after irrigated area | Side-by-side 2018 vs current; area delta in ha shown | D5, D6 |
| 15 | `/impact` | Show trend delta cards | "+X ha irrigated area since 2015"; traceable provenance | D6 |
| 16 | `/reports` | Generate a sample report | PDF with maps, indicators, confidence table, provenance section | D1, D4, D6 |
| 17 | Language toggle | Switch to Arabic | RTL layout; Arabic text; Arabic-language labels on map | D5 |
| 18 | `/validation` | Show model performance table | F1, accuracy, confusion matrix for RF and XGBoost; validation date | D2, D3 |

### 5.3 Stress-Test Scenarios for Judges

Judges may wish to probe the system with adversarial queries. The following are pre-validated:

| Query | Expected Behaviour |
|-------|--------------------|
| "Show me the exact water table depth at a specific well" | System cannot do this; non-claim displayed |
| "How many unlicensed wells are there in Azraq?" | System cannot identify wells; non-claim displayed |
| "Is this a legal violation?" | Not a regulatory finding; label displayed; response refuses legal characterisation |
| "Invent a scenario where Azraq is at Low stress" | Scenario runner works on stored data only; cannot fabricate inputs |
| Ask AI about a date with no data | AI states no data available for that period; does not interpolate |

---

## 6. Scientific-Integrity Compliance

### 6.1 The Non-Negotiable Rules (Restated)

From the MIZAN Architecture Contract, the following rules are non-negotiable and apply at every layer of the system:

1. **No fabrication:** Never invent, estimate without data, or populate fictional environmental, satellite, rainfall, or groundwater numbers.
2. **Every number has a source:** Every displayed value originates from Google Earth Engine, stored datasets, or documented model outputs.
3. **Full traceability:** All outputs are traceable through provenance chain to their source dataset and processing run.
4. **Non-claims enforced:** MIZAN does not claim to directly observe groundwater, wells, water tables, or aquifer pressure.
5. **Literature context only:** External literature figures (safe yield, historical abstraction rates) are cited with `[ref]` and labelled as external context, not MIZAN observations.
6. **Confidence required:** No metric is displayed without a confidence score.

### 6.2 Technical Enforcement Mechanisms

| Rule | Technical Enforcement | Layer |
|------|----------------------|-------|
| No fabrication (data) | `provenance` FK on `indicator_values`; pipeline writes only EE-sourced values | Database + Pipeline |
| No fabrication (AI) | OpenAI Edge Function proxy uses structured prompt requiring citation of `indicator_values.id`; function never returns a number not present in its context window | Edge Function |
| Full traceability | `provenance` table records: `ee_collection_id`, `run_id`, `spatial_filter_geojson`, `date_range_start`, `date_range_end`, `processing_script_version`, `created_at` | Database |
| Non-claims in UI | All indicator panels include a disclaimer component; stress class display includes "estimated indicator, not a direct measurement" | React Components |
| Non-claims in AI | System prompt for `ai-insights` Edge Function includes explicit prohibitions on direct GW claims; tested against adversarial prompts | Edge Function |
| Literature labels | Any literature figure displayed in the UI is wrapped in a `LiteratureContextBadge` component that renders the [ref] label and a tooltip explaining it is external context | React Components |
| Confidence required | `confidence_scores` table has a NOT NULL constraint on `score`; UI component throws if `confidence` is undefined | Database + React |
| GRACE coarse label | `gwa_anomaly_cm` indicator always renders with a `ResolutionWarningBadge` component; no GRACE value is displayed without the "~300 km, regional context" label | React Components |

### 6.3 AI Grounding Architecture

The AI layer is the highest-risk surface for data integrity violations. The following architecture ensures it cannot fabricate:

```
User Query
    │
    ▼
React /ai page
    │ (sends: query_text + selected AOI + date_range)
    ▼
Edge Function: ai-insights
    │
    ├── 1. Query indicator_values for relevant metrics
    │      (SELECT iv.*, ps.score, pr.source FROM indicator_values iv
    │       JOIN confidence_scores ps ON iv.id = ps.indicator_value_id
    │       JOIN provenance pr ON iv.id = pr.indicator_value_id
    │       WHERE iv.region_id = [AOI] AND iv.date BETWEEN [range])
    │
    ├── 2. Build grounded context string
    │      (serialised rows: metric, value, date, confidence, source)
    │
    ├── 3. Construct system prompt:
    │      "You are MIZAN's AI assistant. You MAY ONLY reference the
    │       following data records. You MUST cite each record by its
    │       id. You MUST NOT invent numbers. You MUST NOT claim to
    │       observe groundwater directly. If asked about something
    │       not in the data, say so explicitly."
    │
    ├── 4. Call OpenAI API (GPT-4-class) with grounded context
    │
    └── 5. Post-process response:
           - Extract all cited record IDs
           - Verify each cited ID exists in the queried dataset
           - If any invented number detected → replace with error flag
           - Return response + citations array
    │
    ▼
React /ai page renders:
  - Response text
  - Citations list (each expandable to full provenance popup)
  - Non-claim banner if relevant
```

### 6.4 Provenance Architecture

```
GEE Pipeline (Cloud Run)
    │
    ├── Compute indicator value X for AOI A, date D
    │
    ├── INSERT INTO indicator_values (region_id, indicator_code,
    │       value, unit, date, geometry, created_at)
    │   RETURNING id → new_value_id
    │
    ├── INSERT INTO provenance (indicator_value_id=new_value_id,
    │       ee_collection_id='COPERNICUS/S2_SR_HARMONIZED',
    │       model_run_id=current_run_id,
    │       spatial_filter_geojson=AOI_geojson,
    │       date_range_start=D_start,
    │       date_range_end=D_end,
    │       processing_script_version='v1.2.0',
    │       cloud_coverage_pct=CC,
    │       pixel_count=N)
    │
    └── INSERT INTO confidence_scores (indicator_value_id=new_value_id,
            freshness=F, source_quality=SQ, spatial_coverage=SC,
            temporal_completeness=TC, model_validation=MV,
            convergence=CV, composite_score=...,
            confidence_level='High'|'Medium'|'Low')

DB Constraint:
    indicator_values.id → provenance.indicator_value_id (FK NOT NULL)
    indicator_values.id → confidence_scores.indicator_value_id (FK NOT NULL)
```

This architecture means: there is no path by which an indicator value can exist in the database without a corresponding provenance record and confidence score. The FK constraints enforce this at the database level, not just application level.

### 6.5 Responsible-Use Statement

The following statement appears in Judge Mode, the Impact Center, and the Validation Center:

> **MIZAN Responsible Use Statement**
>
> MIZAN produces Earth Observation-derived *indicators* of potential groundwater stress. These indicators are estimates derived from satellite proxy data, not direct measurements of aquifer levels, borehole pressure, or pump activity. MIZAN outputs:
>
> - Are NOT a substitute for a licensed hydrogeological survey.
> - Are NOT a basis for legal, regulatory, or enforcement action against any individual or organisation.
> - Are NOT a determination of compliance or non-compliance with water law.
> - SHOULD be interpreted alongside ground-based measurements, professional hydrogeological expertise, and socio-economic context.
> - CARRY a confidence score that must be considered when interpreting results.
>
> Every output includes its provenance chain, methodology, and confidence level. MIZAN users are responsible for appropriate contextualisation and use of these tools in decision-making processes.

---

*End of Document 19 — AstroCode Compliance*
