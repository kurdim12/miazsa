# 01 — Project Overview

| Field         | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Document      | 01-project-overview.md                                                |
| Project       | MIZAN — Earth Observation Environmental Intelligence for Jordan       |
| Version       | 0.1 (Draft)                                                           |
| Status        | Phase 1 — Specification                                               |
| Last updated  | 2026-06-10                                                            |
| Related       | [02-problem-definition](02-problem-definition.md) · [03-system-architecture](03-system-architecture.md) · [04-data-sources](04-data-sources.md) · [19-astrocode-compliance](19-astrocode-compliance.md) · [20-limitations](20-limitations.md) |

---

## Purpose

This document is the executive entry point for the MIZAN project. It provides the vision, mission, product name rationale, geographic and scientific context, primary and secondary use cases, target user personas, a high-level map of system capabilities, a formal statement of what MIZAN does and does not claim, a deliverables-to-feature mapping table, measurable success criteria, a full glossary, and the complete document map for all 20 Phase-1 specification files. Any reader — technical, scientific, policy, or evaluative — should be able to form an accurate, complete mental model of MIZAN from this single document and follow cross-references for depth.

**Deliverables mapping:** Functional Prototype · Data Explanation · AI/Analytics Method · Results Visualization · Jordanian Use Case · Impact Statement

---

## 1. Product Name & Identity

### 1.1 Name Meaning

**MIZAN** (Arabic: **ميزان**) means *balance* or *scale* — a measuring instrument used for weighing. The name is deliberately chosen for three layers of resonance:

1. **Hydrological balance** — MIZAN's central scientific metaphor is the water balance: inputs (precipitation, recharge) set against outputs (evapotranspiration, abstraction) to estimate groundwater stress.
2. **Environmental equilibrium** — The product tracks whether Jordan's groundwater systems are in balance or trending toward irreversible deficit, evoking the classic Arabic notion of *mizan* as cosmic order and fairness.
3. **Measurement & accountability** — A *mizan* is a scale of justice; MIZAN asserts that environmental monitoring is a prerequisite for equitable resource governance.

The word is written in right-to-left Arabic (RTL) in localised interfaces, consistent with the platform's full i18n support for Arabic and English.

### 1.2 Visual & Brand Identity

- Primary palette: deep cobalt (water), earth amber (arid land), alert crimson (stress).
- The logotype depicts a stylised balance beam overlaid on a topographic contour ring.
- All text supports both LTR (English) and RTL (Arabic) via the `dir` attribute and `i18n` framework built into the React 18 frontend.

---

## 2. Vision & Mission

### 2.1 Vision

A world where every Jordanian water-management decision — from farmer irrigation scheduling to national aquifer policy — is informed by real-time, satellite-derived, scientifically transparent environmental intelligence.

### 2.2 Mission

Transform freely available Earth Observation (EO) data into actionable groundwater-stress indicators for Jordan, beginning with the Azraq Basin, by:

- Applying rigorous remote-sensing and machine-learning methods to quantify abstraction pressure, recharge deficit, and hydrological divergence;
- Wrapping every output in a transparent, auditable confidence and provenance framework;
- Delivering results through an accessible bilingual web platform designed for government, research, and civil-society users;
- Maintaining strict scientific integrity — never fabricating, overstating, or misrepresenting what satellite data can and cannot reveal.

---

## 3. Jordan Water-Scarcity Context

### 3.1 National Water Stress

Jordan is one of the ten most water-scarce countries on Earth [ref]. Per-capita renewable freshwater availability is estimated at approximately 80–100 m³/person/year [ref], far below the UN water-poverty threshold of 1,000 m³/person/year [ref] and among the lowest nationally reported figures globally. Population growth, refugee influxes, climate change, and agricultural intensification have compounded the deficit throughout the 2000s–2020s [ref].

### 3.2 Groundwater Dependence

Groundwater accounts for approximately 55–60% of Jordan's total water supply [ref]. The principal aquifer systems include the Disi (fossil water, non-renewable), the Yarmouk Basalt, and the Azraq-area alluvial/basalt formations. Over-abstraction of renewable aquifers has been documented across multiple hydrogeological studies [ref], with annual abstraction rates in several basins exceeding estimated safe yield by factors of two to four [ref].

### 3.3 Azraq Basin Significance

The Azraq Basin (~12,700 km²) in northeastern Jordan occupies a unique ecological and hydrological position [ref]:

- **Azraq Oasis/Wetland (RAMSAR Site):** One of only two permanent water bodies in the Syrian Desert; designated a RAMSAR Wetland of International Importance [ref]. The wetland reached near-total desiccation in the 1990s following decades of groundwater over-pumping, and has experienced only partial recovery despite active conservation [ref].
- **Agricultural intensification:** Azraq has been a focal point for irrigated agriculture, particularly vegetables and poultry, driven by access to groundwater. Expansion of irrigated area has been documented via satellite imagery [ref].
- **Safe yield exceedance:** Published estimates suggest that the Azraq safe yield (sustainable annual abstraction) is on the order of 20–24 MCM/year [ref], while actual abstraction has at times exceeded this by a factor of three to five [ref]. MIZAN treats these figures as external literature context only — they are not MIZAN observations.
- **Monitoring infrastructure gap:** Ground-based piezometer networks in Azraq are sparse and spatiotemporally incomplete relative to the spatial variability of abstraction pressures, making EO-based proxy estimation particularly valuable [ref].

### 3.4 National Context

Beyond Azraq, MIZAN is designed to scale to full Jordanian national coverage, providing:

- Rainfall anomaly detection and Standardized Precipitation Index (SPI) monitoring nationwide;
- Irrigated-area change detection supporting Ministry of Water and Irrigation (MWI) reporting;
- Agricultural expansion tracking relevant to National Water Strategy compliance;
- Environmental risk assessment for protected areas managed by the Royal Society for the Conservation of Nature (RSCN).

---

## 4. Goals & Objectives

### 4.1 Primary Goal

Develop a working, scientifically credible EO-based groundwater-stress monitoring system for the Azraq Basin that demonstrates the feasibility of satellite-derived water-balance intelligence as a complement to (not replacement for) in-situ monitoring.

### 4.2 Primary Use Case: Groundwater Stress Monitoring

| Objective | Description |
|-----------|-------------|
| GW-01 | Compute a composite Groundwater Stress Index (0–100) for the Azraq Basin at monthly temporal resolution |
| GW-02 | Decompose the index into five transparent sub-indices: abstraction pressure, recharge deficit, vegetation–water divergence, surface-water decline, regional storage trend |
| GW-03 | Classify stress into four ordinal classes: Low, Moderate, High, Severe |
| GW-04 | Attach a quantified confidence score [0,1] and full provenance to every metric |
| GW-05 | Surface alerts when stress exceeds threshold or anomalous change is detected |

### 4.3 Secondary Use Cases

| Code | Use Case | Output |
|------|----------|--------|
| UC-IR | Irrigation monitoring | Irrigated area (ha), crop type classification, seasonal change maps |
| UC-AG | Agricultural expansion detection | Agri expansion pct (year-over-year), land-cover change maps |
| UC-RF | Rainfall anomaly detection | CHIRPS-derived SPI-1/3/6/12, anomaly classification, spatial maps |
| UC-ER | Environmental risk assessment | Multi-hazard risk layers; combined risk for RAMSAR/protected areas |

### 4.4 Objectives Summary

1. **Scientific:** Implement and document a transparent water-balance/risk model with quantified uncertainty for each sub-index.
2. **Technical:** Build a production-grade cloud-native EO pipeline (GEE → Cloud Run → Supabase → PostgREST → React) that runs on a defined schedule and on demand.
3. **Analytical:** Train and validate ML models (Random Forest crop classifier, XGBoost irrigation detector, Isolation Forest anomaly detector) on available labelled data with documented performance metrics.
4. **Communication:** Deliver a bilingual (EN/AR) platform with accessible visualisations, AI-guided narrative explanations, and a dedicated judge/demo evaluation mode.
5. **Integrity:** Enforce non-fabrication, provenance tracking, and confidence reporting at every layer of the stack.

---

## 5. Target Users & Personas

### 5.1 Persona Matrix

| Persona | Role | Primary Need | Key Pages |
|---------|------|-------------|-----------|
| **Hana (MWI Analyst)** | Water resource analyst, Ministry of Water and Irrigation | Monthly groundwater stress summaries; spatial maps for basin management; exportable PDF reports for ministerial briefings | `/`, `/azraq`, `/reports` |
| **Tariq (Agricultural Engineer)** | Field engineer, Jordan Valley Authority | Irrigated-area maps; ET₀ and crop water demand estimates; comparison vs rainfall | `/satellite`, `/azraq` |
| **Nour (RSCN Conservation Officer)** | Ecologist, Royal Society for Conservation of Nature | Azraq Oasis surface water extent; vegetation stress; wetland trend analysis | `/azraq`, `/map` |
| **Dr. Layla (Academic Researcher)** | Hydrology/Remote Sensing researcher, University of Jordan | Raw indicator data; methodology documentation; confidence metadata; export for publication | `/validation`, `/ai`, `/reports` |
| **Ahmed (Development Finance Officer)** | Programme officer, international donor organisation | Impact metrics; before/after comparisons; scientific credibility; ease of communication | `/impact`, `/reports` |
| **Judge (AstroCode Evaluator)** | Competition evaluator | End-to-end demo; all six deliverables evidenced; scientific integrity; Jordanian relevance | `/judge` |
| **Public/Media** | General public, journalists | Accessible summaries; no jargon; bilingual | `/`, `/impact` |

### 5.2 Role Permissions

Roles follow a four-tier scheme enforced via Row-Level Security (RLS) in Supabase:

| Role | Capabilities |
|------|-------------|
| `viewer` | Read public metrics, maps, AI summaries; no raw data export |
| `analyst` | All viewer + indicator data export, scenario creation, report generation |
| `admin` | All analyst + dataset management, model run management, user management |
| `judge` | Dedicated read-only view with all deliverables visible; audit-log read access |

---

## 6. High-Level System Capabilities

MIZAN delivers its mission through ten application pages, each corresponding to a major capability cluster:

### 6.1 National Command Center (`/`)

The dashboard landing page aggregating Jordan-wide environmental indicators: current SPI status by basin, national irrigated-area change, active alerts, and an interactive choropleth summary map. Designed as the executive entry point.

### 6.2 Jordan Monitoring Map (`/map`)

An interactive full-screen MapLibre GL JS map supporting multiple raster and vector overlay layers: NDVI anomaly, surface-water extent, SPI-3, irrigated-area classification, groundwater stress class. Includes layer toggle, date slider, and probe-point click-to-inspect with provenance pop-up.

### 6.3 Azraq Basin Intelligence (`/azraq`)

The primary scientific dashboard for the Azraq Basin. Hosts the Groundwater Stress Index panel (current value, trend sparkline, sub-index breakdown, confidence badge), time-series charts for all core indicators, satellite image comparison (before/after), surface-water extent trend, and the vegetation–water divergence chart.

### 6.4 Satellite Analysis Center (`/satellite`)

Provides access to the full indicator catalogue: vegetation indices (NDVI, EVI, SAVI, anomaly), water indices (NDWI, MNDWI), SAR-derived soil moisture proxy, precipitation (CHIRPS), land surface temperature, ET₀ (Penman-Monteith), ET_c. Each panel shows current value, time series, spatial map tile, and the 5-field validation envelope.

### 6.5 AI Intelligence Center (`/ai`)

An AI-assisted analytical interface where users can ask natural-language questions about MIZAN's stored metrics. The OpenAI proxy Edge Function grounds all responses strictly in stored indicator values and provenance — it never invents numbers. SHAP-based feature importance is displayed for ML model outputs. Citations to source tables are included in every AI response.

### 6.6 Digital Twin (`/twin`)

A deck.gl-powered 3D interactive visualisation of the Azraq Basin showing: terrain (SRTM), groundwater stress as a 3D heat layer, irrigated-area footprints, aquifer recharge zones, and animated rainfall-to-recharge flow. Scenario runner allows users to adjust abstraction pressure or rainfall assumptions and observe simulated index response.

### 6.7 Validation Center (`/validation`)

Houses the validation framework: comparison of MIZAN's irrigated-area estimates against published MWI statistics (where available), rainfall estimates vs CHIRPS cross-validation, model performance tables (accuracy, F1, confusion matrices), and a per-metric validation record viewer showing all five validation-envelope fields.

### 6.8 Impact Center (`/impact`)

Communicates real-world significance through narrative cards, before/after spatial comparisons, trend delta highlights (e.g., irrigated-area growth over 5 years, SPI deficit months), and exportable impact statements. Designed for donor audiences and public communication.

### 6.9 Judge Mode (`/judge`)

A structured, self-guided evaluation interface for AstroCode competition judges. Presents a six-tab checklist aligned to the six AstroCode deliverables, with direct links to supporting evidence within the platform. Includes a score rubric overlay, scientific-integrity statement, and audit-log viewer.

### 6.10 Report Generator (`/reports`)

Allows authenticated users to compose structured PDF/Markdown reports combining selected indicators, maps, AI-generated narrative, and metadata sections (title, date range, AOI, confidence summary). Reports are stored with full provenance and can be scheduled for recurring delivery.

---

## 7. Scientific Stance

### 7.1 What MIZAN Does

MIZAN estimates **groundwater-stress indicators** from Earth Observation proxies and a transparent, weighted water-balance/risk model. Specifically, MIZAN observes and processes:

- **Irrigated-area expansion & crop water demand** — satellite-detected increases in irrigated footprint imply increased abstraction pressure;
- **Rainfall anomalies & SPI** — prolonged rainfall deficits indicate reduced natural recharge;
- **Vegetation–water divergence** — vegetation that remains green through the dry season despite low rainfall suggests groundwater-dependent irrigation;
- **Surface-water / Azraq Oasis extent decline** — reduction in mapped open-water extent is a measurable proxy for wetland/groundwater health;
- **GRACE/GRACE-FO terrestrial water storage anomaly** — coarse-resolution (~300 km) regional trend indicator for total water storage change.

### 7.2 What MIZAN Does NOT Claim

> **Non-negotiable scientific-integrity statement — must be preserved in all outputs:**

MIZAN does **NOT**:

- Directly observe groundwater, water tables, aquifer levels, or borehole/piezometer readings;
- Directly detect wells or pump activity from satellite data;
- Directly measure aquifer pressure or hydraulic head;
- Make any legal determination about water rights, abstraction violations, or regulatory status;
- Guarantee that EO-derived indicators match ground-truth conditions at a specific point;
- Substitute for a hydrogeological survey, in-situ monitoring network, or licensed hydrological study.

All MIZAN outputs are **indicators** and **estimates**, not measurements of groundwater directly. The Groundwater Stress Index is a composite of proxy signals, not a direct physical measurement. Every output is accompanied by a confidence score and provenance chain to support appropriate interpretation.

### 7.3 Literature References

Literature values (e.g., Azraq safe yield estimates, historical abstraction rates, RAMSAR designation facts) are cited as **external context only**, labelled with `[ref]` placeholders, and are never presented as MIZAN-computed outputs.

---

## 8. AstroCode Deliverables → Feature Mapping

The following table maps each of the six AstroCode competition deliverables to the concrete MIZAN features that satisfy it:

| AstroCode Deliverable | MIZAN Feature(s) | Evidence Pages | Doc Reference |
|-----------------------|-----------------|----------------|---------------|
| **Functional Prototype** | Fully deployed React 18 + Supabase + GEE pipeline; all 10 pages operational with real data | All 10 routes; live demo | [03](03-system-architecture.md), [18](18-deployment.md) |
| **Data Explanation** | Validation Center with 5-field envelope on every metric; Provenance popups on map; AI citations; Dataset Catalogue | `/validation`, `/satellite`, `/ai` | [04](04-data-sources.md), [09](09-confidence-engine.md), [16](16-validation-framework.md) |
| **AI/Analytics Method** | GEE-based RF/XGBoost/IsolationForest pipelines; Penman-Monteith ET₀; GW Stress composite model; SHAP explainability; OpenAI narrative proxy | `/ai`, `/azraq`, `/satellite` | [05](05-earth-engine-pipelines.md), [06](06-remote-sensing-methods.md), [07](07-machine-learning.md), [08](08-risk-scoring.md) |
| **Results Visualization** | 10-page interactive platform; MapLibre choropleth; Recharts time series; deck.gl 3D digital twin; before/after comparisons | All pages | [13](13-ui-pages.md), [10](10-digital-twin.md) |
| **Jordanian Use Case** | Azraq Basin primary demo; national Jordan monitoring; MWI/RSCN personas; bilingual EN/AR; Jordan-specific data (FAO GAUL boundaries, CHIRPS Jordan) | `/azraq`, `/map`, `/impact` | [02](02-problem-definition.md), [13](13-ui-pages.md) |
| **Impact Statement** | Impact Center with trend deltas, before/after comparisons, exportable impact statements; Report Generator; Judge Mode impact tab | `/impact`, `/reports`, `/judge` | [15](15-report-generator.md), [19](19-astrocode-compliance.md) |

---

## 9. Product Success Criteria & KPIs

### 9.1 Technical KPIs

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| EE pipeline success rate | ≥ 95% scheduled runs complete without error | Cloud Run logs, Supabase `model_runs` table |
| API p95 response time | < 2 seconds for PostgREST endpoints | Supabase metrics |
| Frontend time-to-interactive | < 3 seconds on 4G connection | Lighthouse CI |
| Map tile load time | < 1.5 seconds per layer toggle | Browser performance API |
| Data freshness | All monthly indicators refreshed within 48h of month end | `indicator_values.created_at` vs calendar |

### 9.2 Scientific KPIs

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| Crop classification accuracy | ≥ 80% OA on validation set | `validation_records` table, F1 per class |
| Irrigation detection F1 | ≥ 0.75 on held-out AOI | Cross-validation in `model_runs` |
| CHIRPS correlation vs ERA5 | Pearson r ≥ 0.85 over Jordan | Offline cross-validation |
| Confidence score coverage | 100% of indicator values have a confidence record | Supabase constraint + test |
| Provenance coverage | 100% of indicator values link to a provenance record | DB foreign key + test |

### 9.3 User Experience KPIs

| KPI | Target |
|-----|--------|
| Arabic/English language toggle | Fully functional, no layout breakage in RTL |
| WCAG AA compliance | All pages pass automated a11y scan |
| Report generation time | < 10 seconds for standard 10-indicator report |
| Judge Mode completeness | All 6 AstroCode deliverables navigable in < 5 minutes |

### 9.4 Impact KPIs

| KPI | Target |
|-----|--------|
| Indicator time-series depth | ≥ 5 years of historical monthly data loaded for Azraq |
| Basin coverage | 100% Azraq Basin spatial coverage for primary indicators |
| Alert lead time | Stress-class change alert dispatched within 24h of detection |

---

## 10. Glossary

| Term / Acronym | Definition |
|----------------|-----------|
| **AOI** | Area of Interest — the spatial polygon defining the analysis extent (e.g., Azraq Basin boundary) |
| **COG** | Cloud-Optimised GeoTIFF — a raster file format enabling efficient HTTP range requests for web map tiling |
| **CHIRPS** | Climate Hazards Group InfraRed Precipitation with Station data — quasi-global daily/pentad rainfall dataset at ~5.5 km resolution |
| **DEM** | Digital Elevation Model — raster representation of terrain elevation |
| **EE** / **GEE** | Google Earth Engine — cloud-based geospatial analysis platform used for all EO data processing in MIZAN |
| **EO** | Earth Observation — the collection of environmental data about Earth via remote-sensing satellites |
| **ET₀** | Reference Evapotranspiration — the evapotranspiration of a hypothetical reference crop, calculated via FAO-56 Penman-Monteith equation; units: mm/day or mm/month |
| **ETc** | Crop Evapotranspiration — ET₀ multiplied by a crop coefficient (Kc); estimates actual crop water demand |
| **EVI** | Enhanced Vegetation Index — a vegetation index less prone to saturation than NDVI in high-biomass areas |
| **GRACE / GRACE-FO** | Gravity Recovery and Climate Experiment (Follow-On) — NASA satellite mission measuring terrestrial water storage changes via gravity anomalies; resolution ~300 km |
| **GWS** | Groundwater Stress — the multi-proxy indicator computed by MIZAN's composite risk model |
| **i18n** | Internationalisation — the process of designing software to support multiple languages/locales; MIZAN supports EN and AR |
| **LULC** | Land Use / Land Cover — classification of Earth's surface into categories (cropland, urban, bare, water, etc.) |
| **MCM** | Million Cubic Metres — standard volumetric unit for water resources in Jordan (1 MCM = 10⁶ m³) |
| **MWI** | Ministry of Water and Irrigation — Jordan's primary government body for water resource management |
| **MNDWI** | Modified Normalised Difference Water Index — uses SWIR band; more sensitive to open water than NDWI in arid environments |
| **NDVI** | Normalised Difference Vegetation Index — (NIR−Red)/(NIR+Red); measures photosynthetically active vegetation |
| **NDWI** | Normalised Difference Water Index — (Green−NIR)/(Green+NIR); maps open surface water |
| **PostGIS** | PostgreSQL extension providing geospatial data types, functions, and indexes |
| **PostgREST** | Tool that automatically generates a RESTful API from a PostgreSQL schema; used by Supabase |
| **RLS** | Row-Level Security — PostgreSQL feature allowing fine-grained, per-row access control based on session attributes |
| **RSCN** | Royal Society for the Conservation of Nature — Jordan's primary nature conservation NGO, managing nature reserves including Azraq Wetland Reserve |
| **RTL** | Right-to-Left — text directionality for Arabic, Hebrew, and other scripts |
| **SAR** | Synthetic Aperture Radar — active microwave remote sensing (Sentinel-1); penetrates clouds, sensitive to surface roughness and soil moisture |
| **SAVI** | Soil-Adjusted Vegetation Index — NDVI variant correcting for soil background reflectance; more accurate in sparse-canopy arid areas |
| **SHAP** | SHapley Additive exPlanations — a game-theory-based method for interpreting ML model predictions; produces per-feature contribution scores |
| **SPI** | Standardised Precipitation Index — standardised anomaly of cumulative precipitation over 1, 3, 6, or 12 months; negative SPI = drought |
| **SR** | Surface Reflectance — atmospherically corrected satellite reflectance; Sentinel-2 SR is the input for vegetation/water indices |
| **SRTM** | Shuttle Radar Topography Mission — global 30 m DEM |
| **SWIR** | Short-Wave Infrared — spectral band (1.5–2.5 µm) sensitive to vegetation water content and soil moisture |
| **TanStack Query** | React Query library for server-state management (caching, background refetch, stale-while-revalidate) |
| **TWS** | Terrestrial Water Storage — total water stored in a column of land (surface water + soil moisture + groundwater); measured by GRACE |
| **WGS84** | World Geodetic System 1984 — standard geographic coordinate reference system |

---

## 11. Document Map

All 20 Phase-1 specification documents for MIZAN. Cross-reference by filename prefix number.

| # | Filename | One-Line Description |
|---|----------|---------------------|
| 01 | [01-project-overview.md](01-project-overview.md) | **This document** — executive summary, vision, mission, context, glossary, document map |
| 02 | [02-problem-definition.md](02-problem-definition.md) | Problem statement, stakeholder pain points, user stories with acceptance criteria, functional & non-functional requirements, risks |
| 03 | [03-system-architecture.md](03-system-architecture.md) | Full system architecture: component diagram, data flow, tech-stack justification, deployment topology |
| 04 | [04-data-sources.md](04-data-sources.md) | Catalogue of all EO and ancillary datasets with EE IDs, resolution, temporal range, licensing, and MIZAN usage |
| 05 | [05-earth-engine-pipelines.md](05-earth-engine-pipelines.md) | GEE pipeline specifications: collection filtering, cloud masking, index computation, export to Postgres, scheduling |
| 06 | [06-remote-sensing-methods.md](06-remote-sensing-methods.md) | Scientific methodology for all remote-sensing indicators: vegetation, water, SAR, precipitation, thermal, ET₀ |
| 07 | [07-machine-learning.md](07-machine-learning.md) | ML model specifications: RF crop classifier, XGBoost irrigation detector, Isolation Forest anomaly detector; training, validation, SHAP |
| 08 | [08-risk-scoring.md](08-risk-scoring.md) | Groundwater Stress Index design: sub-index definitions, normalisation, weighted composite formula, class thresholds, scenario modelling |
| 09 | [09-confidence-engine.md](09-confidence-engine.md) | Confidence scoring framework: six factors, geometric-mean formula, per-metric application, UI display spec |
| 10 | [10-digital-twin.md](10-digital-twin.md) | Digital Twin specification: deck.gl architecture, 3D data layers, scenario runner, animation design, data contracts |
| 11 | [11-database-schema.md](11-database-schema.md) | Full PostgreSQL/PostGIS schema: all 20+ tables, columns, types, constraints, indexes, RLS policies |
| 12 | [12-api-specification.md](12-api-specification.md) | API contract: PostgREST endpoints, Edge Function specs, request/response shapes, auth headers, error codes |
| 13 | [13-ui-pages.md](13-ui-pages.md) | UI page-by-page spec: component layout, data sources, interactions, state management, i18n keys, accessibility |
| 14 | [14-judge-mode.md](14-judge-mode.md) | Judge Mode design: six-tab evaluation interface, scoring rubric, evidence checklist, audit-log viewer |
| 15 | [15-report-generator.md](15-report-generator.md) | Report Generator specification: template structure, section types, PDF/Markdown export, scheduling, provenance embedding |
| 16 | [16-validation-framework.md](16-validation-framework.md) | Validation framework: 5-field envelope definition, per-indicator validation procedures, cross-validation methodology |
| 17 | [17-security.md](17-security.md) | Security specification: RLS policies, JWT auth flow, API key management, data classification, audit logging |
| 18 | [18-deployment.md](18-deployment.md) | Deployment specification: Cloud Run, Supabase project config, Cloud Scheduler, environment variables, CI/CD pipeline |
| 19 | [19-astrocode-compliance.md](19-astrocode-compliance.md) | AstroCode deliverable compliance matrix, feature traceability table, judge rubric mapping, scientific-integrity enforcement |
| 20 | [20-limitations.md](20-limitations.md) | Scientific, data, and model limitations; uncertainty communication; what MIZAN does NOT claim; responsible-use guidance; future work |

---

*End of Document 01 — Project Overview*
