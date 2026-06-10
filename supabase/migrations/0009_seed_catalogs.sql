-- =============================================================================
-- 0009_seed_catalogs.sql
-- MIZAN — Phase 2 Catalog Seed Data
-- Seeds: datasets, indicators, models, regions (Jordan + Azraq Basin approx.)
-- Source of truth: docs/11-database-schema.md §10 + implementation contract.
--
-- All INSERTs are ON CONFLICT DO NOTHING so re-running is idempotent.
-- Region geometries flagged APPROXIMATE — production ingest loads authoritative
-- MWI / HydroSHEDS boundaries; the polygons below are bounding-box approximations
-- for local demo and schema-validation purposes only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- datasets — EO / geospatial source catalog
-- Full list from docs/11 §10.1 (15 sources).
-- ---------------------------------------------------------------------------
INSERT INTO datasets (
  key, name, provider, ee_asset_id,
  spatial_res_m, temporal_res, latency,
  license, attribution,
  freshness_threshold_days, source_quality, notes
) VALUES
  (
    's2_sr_harmonized',
    'Sentinel-2 SR Harmonized',
    'ESA Copernicus',
    'COPERNICUS/S2_SR_HARMONIZED',
    10, '5d', 'hours-days',
    'Copernicus open',
    'Contains modified Copernicus Sentinel data',
    10, 0.90,
    'Cloud mask via S2_CLOUD_PROBABILITY + SCL; apply harmonization offset'
  ),
  (
    's2_cloud_prob',
    'Sentinel-2 Cloud Probability',
    'ESA / s2cloudless',
    'COPERNICUS/S2_CLOUD_PROBABILITY',
    10, '5d', 'hours-days',
    'Copernicus open',
    'Contains modified Copernicus Sentinel data',
    10, 0.85,
    'Companion cloud mask'
  ),
  (
    's1_grd',
    'Sentinel-1 GRD',
    'ESA Copernicus',
    'COPERNICUS/S1_GRD',
    10, '6-12d', '~1d',
    'Copernicus open',
    'Contains modified Copernicus Sentinel data',
    14, 0.85,
    'Speckle filter required; VV,VH'
  ),
  (
    'chirps_daily',
    'CHIRPS Daily',
    'UCSB CHG',
    'UCSB-CHG/CHIRPS/DAILY',
    5500, 'daily', '~3w',
    'Open/public domain',
    'UCSB Climate Hazards Group CHIRPS',
    45, 0.80,
    'Coarse; preliminary vs final'
  ),
  (
    'chirps_pentad',
    'CHIRPS Pentad',
    'UCSB CHG',
    'UCSB-CHG/CHIRPS/PENTAD',
    5500, 'pentad', 'days',
    'Open/public domain',
    'UCSB Climate Hazards Group CHIRPS',
    15, 0.75,
    'Faster latency'
  ),
  (
    'srtm',
    'SRTM 30m',
    'NASA/USGS',
    'USGS/SRTMGL1_003',
    30, 'static', 'n/a',
    'Public domain',
    'NASA/USGS SRTM',
    NULL, 0.90,
    'Static terrain (2000)'
  ),
  (
    'gaul_l1',
    'FAO GAUL L1',
    'FAO',
    'FAO/GAUL/2015/level1',
    NULL, 'static', 'n/a',
    'FAO GAUL terms',
    'FAO GAUL 2015 (analytical boundaries)',
    NULL, 0.80,
    'Non-legal boundaries; 2015 vintage'
  ),
  (
    'gaul_l2',
    'FAO GAUL L2',
    'FAO',
    'FAO/GAUL/2015/level2',
    NULL, 'static', 'n/a',
    'FAO GAUL terms',
    'FAO GAUL 2015 (analytical boundaries)',
    NULL, 0.80,
    'Non-legal boundaries; 2015 vintage'
  ),
  (
    'landsat8_l2',
    'Landsat 8 L2',
    'USGS/NASA',
    'LANDSAT/LC08/C02/T1_L2',
    30, '16d', '~1d',
    'Public domain',
    'USGS/NASA Landsat',
    16, 0.80,
    'Cross-sensor harmonization'
  ),
  (
    'landsat9_l2',
    'Landsat 9 L2',
    'USGS/NASA',
    'LANDSAT/LC09/C02/T1_L2',
    30, '16d', '~1d',
    'Public domain',
    'USGS/NASA Landsat',
    16, 0.80,
    'Continuity with L8'
  ),
  (
    'smap_l4',
    'SMAP L4 Soil Moisture',
    'NASA',
    'NASA/SMAP/SPL4SMGP/007',
    9000, '3-hourly', 'days',
    'NASA open',
    'NASA SMAP SPL4SMGP v007',
    7, 0.70,
    'Modeled, coarse'
  ),
  (
    'era5_land_hourly',
    'ERA5-Land Hourly',
    'ECMWF C3S',
    'ECMWF/ERA5_LAND/HOURLY',
    9000, 'hourly', '~5d',
    'Copernicus C3S',
    'Copernicus Climate Change Service information',
    10, 0.75,
    'Reanalysis; drivers for ET0'
  ),
  (
    'era5_land_daily',
    'ERA5-Land Daily Agg',
    'ECMWF C3S',
    'ECMWF/ERA5_LAND/DAILY_AGGR',
    9000, 'daily', '~5d',
    'Copernicus C3S',
    'Copernicus Climate Change Service information',
    10, 0.75,
    'Daily aggregates'
  ),
  (
    'viirs_dnb',
    'VIIRS Nightlights',
    'NOAA',
    'NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG',
    500, 'monthly', 'weeks',
    'NOAA open',
    'NOAA/Colorado School of Mines VIIRS DNB',
    45, 0.60,
    'Indirect activity proxy'
  ),
  (
    'grace_mascon',
    'GRACE Mascon CRI',
    'NASA JPL',
    'NASA/GRACE/MASS_GRIDS_V03/MASCON_CRI',
    55000, 'monthly', 'months',
    'NASA open',
    'NASA JPL GRACE/GRACE-FO Mascon V03 (CRI)',
    90, 0.55,
    'COARSE regional context only'
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- indicators — canonical indicator catalog
-- All codes from docs/11 §10.2 + implementation contract.
-- ---------------------------------------------------------------------------
INSERT INTO indicators (code, name_en, unit, category, value_min, value_max, description) VALUES
  -- Vegetation
  ('ndvi',              'NDVI',                                '1',          'vegetation', -1.0,  1.0,  'Normalized Difference Vegetation Index; (NIR-Red)/(NIR+Red); Sentinel-2 B8,B4'),
  ('evi',               'EVI',                                 '1',          'vegetation', -1.0,  1.0,  'Enhanced Vegetation Index; reduces canopy background and atmospheric influences'),
  ('savi',              'SAVI',                                '1',          'vegetation', -1.0,  1.0,  'Soil-Adjusted Vegetation Index; L=0.5 standard'),
  ('ndvi_anomaly',      'NDVI anomaly',                        '1',          'vegetation', -2.0,  2.0,  'NDVI departure from long-term mean (z-score or fractional)'),
  ('s1_rvi',            'Radar Vegetation Index',              '1',          'vegetation',  0.0,  1.0,  'Dual-pol RVI from Sentinel-1 VV/VH; sensitive to vegetation density'),
  -- Water
  ('ndwi',              'NDWI',                                '1',          'water',      -1.0,  1.0,  'Normalized Difference Water Index; (Green-NIR)/(Green+NIR); Sentinel-2 B3,B8'),
  ('mndwi',             'MNDWI',                               '1',          'water',      -1.0,  1.0,  'Modified NDWI; (Green-SWIR)/(Green+SWIR); Sentinel-2 B3,B11'),
  ('surface_water_extent_km2', 'Surface water extent',        'km2',        'water',       0.0, NULL,  'Open water area derived from MNDWI threshold within the region'),
  ('s1_vv',             'Sentinel-1 VV',                       'dB',         'water',     -30.0, 10.0,  'Sentinel-1 GRD VV backscatter (dB); water detection and soil moisture proxy'),
  ('s1_vh',             'Sentinel-1 VH',                       'dB',         'water',     -35.0,  5.0,  'Sentinel-1 GRD VH backscatter (dB)'),
  ('soil_moisture_proxy','Soil moisture proxy',                '1',          'water',       0.0,  1.0,  'Normalized soil moisture proxy from S1 or SMAP, region-averaged'),
  ('recharge_proxy_mm', 'Recharge proxy',                      'mm',         'water',       0.0, NULL,  'Estimated recharge potential: effective precipitation minus estimated ET0'),
  ('abstraction_estimate_mcm', 'Abstraction estimate',        'mcm',        'water',       0.0, NULL,  'Estimated groundwater abstraction (million cubic metres); derived from irrigated area × Kc × ET0'),
  ('water_balance_mcm', 'Water balance',                       'mcm',        'water',      NULL, NULL,  'Estimated basin water balance: recharge minus abstraction (MCM); negative = deficit'),
  ('gws_anomaly_cm',    'GRACE storage anomaly',               'cm',         'water',     -30.0, 30.0,  'GRACE/GRACE-FO terrestrial water storage anomaly (cm EWH); coarse regional signal'),
  -- Climate
  ('precip_mm',         'Precipitation',                       'mm',         'climate',     0.0, NULL,  'CHIRPS accumulated precipitation over the observation period (mm)'),
  ('precip_anomaly_pct','Precipitation anomaly',               'pct',        'climate',  -100.0, 300.0, 'Precipitation departure from long-term mean (percent); negative = below normal'),
  ('spi_1',             'SPI-1',                               '1',          'climate',    -3.0,  3.0,  'Standardised Precipitation Index at 1-month accumulation'),
  ('spi_3',             'SPI-3',                               '1',          'climate',    -3.0,  3.0,  'Standardised Precipitation Index at 3-month accumulation'),
  ('spi_6',             'SPI-6',                               '1',          'climate',    -3.0,  3.0,  'Standardised Precipitation Index at 6-month accumulation'),
  ('spi_12',            'SPI-12',                              '1',          'climate',    -3.0,  3.0,  'Standardised Precipitation Index at 12-month accumulation'),
  ('tmax_c',            'Max temperature',                     'C',          'climate',   -5.0,  50.0,  'ERA5-Land daily maximum 2m air temperature (°C)'),
  ('tmin_c',            'Min temperature',                     'C',          'climate',  -10.0,  40.0,  'ERA5-Land daily minimum 2m air temperature (°C)'),
  ('rh_pct',            'Relative humidity',                   'pct',        'climate',    0.0, 100.0,  'ERA5-Land mean relative humidity at 2m (%)'),
  ('wind_2m',           'Wind speed 2m',                       'm/s',        'climate',    0.0,  30.0,  'ERA5-Land wind speed at 2m height (m/s)'),
  ('srad_mj',           'Solar radiation',                     'MJ/m2/day',  'climate',    0.0,  40.0,  'ERA5-Land downward shortwave radiation (MJ/m²/day)'),
  ('et0_pm_mm',         'Reference ET (Penman-Monteith)',      'mm',         'climate',    0.0,  20.0,  'FAO-56 Penman-Monteith reference evapotranspiration computed from ERA5-Land'),
  -- Agriculture
  ('etc_mm',            'Crop water demand',                   'mm',         'agriculture', 0.0, NULL,  'Actual crop ET (ETc = ET0 × Kc) aggregated over irrigated parcels'),
  ('cropland_area_ha',  'Cropland area',                       'ha',         'agriculture', 0.0, NULL,  'Total cropland area within region derived from NDVI/EVI seasonality'),
  ('irrigated_area_ha', 'Irrigated area',                      'ha',         'agriculture', 0.0, NULL,  'Irrigated parcel area from XGBoost irrigation detector'),
  ('crop_class',        'Crop class',                          '1',          'agriculture', NULL, NULL,  'Dominant crop type label from RF crop classifier (categorical)'),
  ('agri_expansion_pct','Agricultural expansion',              'pct',        'agriculture',-50.0,200.0, 'Year-on-year change in irrigated area (percent)'),
  -- Risk
  ('gw_stress_index',   'Groundwater stress index',            'index_0_100','risk',        0.0, 100.0, 'Composite groundwater stress score 0–100; weighted sum of five sub-indices (docs/08)'),
  ('gw_stress_class',   'Groundwater stress class',            '1',          'risk',        NULL, NULL,  'Binned stress class: Low 0–25 / Moderate 25–50 / High 50–75 / Severe 75–100')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- models — model registry
-- Six canonical models from the implementation contract.
-- ---------------------------------------------------------------------------
INSERT INTO models (key, name, kind, framework, description) VALUES
  (
    'rf_crop_classifier',
    'Random Forest crop classifier',
    'classifier',
    'ee.smileRandomForest',
    'Earth Engine smileRandomForest trained on Sentinel-2 multi-temporal stack + terrain to classify crop type per parcel'
  ),
  (
    'xgb_irrigation_detector',
    'XGBoost irrigation detector',
    'detector',
    'xgboost',
    'XGBoost binary classifier distinguishing irrigated from rainfed parcels using S2 vegetation seasonality and S1 moisture signals'
  ),
  (
    'iforest_anomaly',
    'Isolation Forest anomaly detector',
    'anomaly',
    'IsolationForest',
    'scikit-learn IsolationForest trained on baseline indicator distributions; flags anomalous NDVI/NDWI/abstraction observations'
  ),
  (
    'penman_monteith',
    'Penman-Monteith ET0',
    'physical',
    'formula',
    'FAO-56 Penman-Monteith reference evapotranspiration formula applied to ERA5-Land daily aggregates (Tmax, Tmin, RH, Wind, Srad)'
  ),
  (
    'shap_explainer',
    'SHAP TreeExplainer',
    'explainer',
    'shap',
    'SHAP TreeExplainer applied to XGBoost/RF outputs to produce per-feature attributions stored in predictions.shap jsonb'
  ),
  (
    'gw_stress_model',
    'Groundwater stress composite model',
    'composite',
    'formula+ml',
    'Weighted composite of five sub-indices (abstraction_pressure 0.30, recharge_deficit 0.25, veg_water_divergence 0.20, surface_water_decline 0.15, regional_storage_grace 0.10) scored 0–100'
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- regions — Jordan (country) and Azraq Basin (basin/AOI)
--
-- IMPORTANT: These geometries are APPROXIMATE bounding-box polygons for
-- schema-validation and local-demo purposes ONLY.
-- Production ingest MUST replace them with authoritative boundaries from:
--   - Jordan country: MWI / FAO GAUL 2015 level-0 / UN OCHA COD
--   - Azraq Basin: MWI / HydroSHEDS level-6 watershed / RSCN GIS
--
-- Jordan approximate bbox: 34.9–39.3 E, 29.2–33.4 N
-- Azraq Basin approximate bbox: 36.0–37.5 E, 31.0–32.5 N
--   (centred on ~36.82E, 31.83N; covers the main Azraq wetland + basin)
-- ---------------------------------------------------------------------------

INSERT INTO regions (
  code, name_en, name_ar, kind, source, area_km2, geom
) VALUES (
  'jordan',
  'Jordan',
  'الأردن',
  'country',
  'APPROXIMATE — MWI/FAO GAUL 2015 level-0; replace with authoritative boundary before production',
  89342.0,  -- approximate; official area ≈ 89,342 km²
  ST_Multi(ST_GeomFromText(
    'POLYGON((
      34.9 29.2,
      39.3 29.2,
      39.3 33.4,
      34.9 33.4,
      34.9 29.2
    ))',
    4326
  ))
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO regions (
  code, name_en, name_ar, kind, parent_id, source, area_km2, geom
) VALUES (
  'azraq_basin',
  'Azraq Basin (approximate AOI)',
  'حوض الأزرق (منطقة اهتمام تقريبية)',
  'basin',
  (SELECT id FROM regions WHERE code = 'jordan'),
  'APPROXIMATE AOI — replace with authoritative MWI/HydroSHEDS watershed boundary before production. Centred ~36.82E 31.83N.',
  12800.0,  -- approximate; Azraq Basin ~12,000–14,000 km²
  ST_Multi(ST_GeomFromText(
    'POLYGON((
      36.0 31.0,
      37.5 31.0,
      37.5 32.5,
      36.0 32.5,
      36.0 31.0
    ))',
    4326
  ))
)
ON CONFLICT (code) DO NOTHING;
