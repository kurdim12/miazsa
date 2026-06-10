"""MIZAN EE Worker — Earth Engine compute service (Phase 2 vertical slice).

This package is the *only* component in MIZAN permitted to call the Earth
Engine Python API (docs/05 §1.1). It exposes a small FastAPI surface that
runs the spectral / hydrological pipelines, captures full provenance, and
writes traceable results into Supabase Postgres.

Non-negotiable rule (docs/04, docs/05, docs/06): never fabricate data. If a
period / AOI has no valid imagery, the worker returns an honest error for that
indicator and writes nothing — it never defaults or invents a value.
"""

__version__ = "0.1.0"
