"""Supabase write path via PostgREST (httpx).

The EE Worker is the only MIZAN component besides the Edge Functions that holds
the **service-role** key. It writes results straight to Postgres through the
PostgREST API (``$SUPABASE_URL/rest/v1``) using the service role, which bypasses
RLS so the provenance / indicator_values / confidence_scores rows can be created
(docs/11 §9 — "mutations to value/derived tables are performed by the service
role").

Responsibilities (docs/05 §1.9, §1.10; docs/11 §5.1, §6.1, §6.6):

  * resolve catalog ids: ``indicators.code -> id``, ``datasets.key -> id``;
  * fetch a stored region geometry (as GeoJSON) by uuid or code;
  * ``insert_provenance(row) -> id`` (the traceability spine, written first);
  * ``insert_indicator_value(row)`` with the NOT NULL ``provenance_id`` FK;
  * ``insert_confidence(row)`` (authoritative six-factor confidence record).

Every method raises ``SupabaseWriteError`` on a non-2xx response — the worker
never silently swallows a failed write (a value with no provenance row would
violate the core data-integrity invariant).
"""

from __future__ import annotations

from typing import Any

import httpx

from .config import Settings, get_settings


class SupabaseWriteError(RuntimeError):
    """Raised when a PostgREST request returns a non-success status."""


class SupabaseWriter:
    """Thin PostgREST client scoped to the worker's write/read needs."""

    def __init__(self, settings: Settings | None = None, *, timeout: float = 30.0):
        self._settings = settings or get_settings()
        if not self._settings.supabase_url:
            raise SupabaseWriteError("SUPABASE_URL is not configured.")
        if not self._settings.supabase_service_role_key:
            raise SupabaseWriteError("SUPABASE_SERVICE_ROLE_KEY is not configured.")

        key = self._settings.supabase_service_role_key
        self._client = httpx.Client(
            base_url=self._settings.supabase_rest_url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=timeout,
        )
        # Small in-process caches: catalogs are static within a run.
        self._indicator_id_cache: dict[str, str] = {}
        self._dataset_id_cache: dict[str, str] = {}

    # ---- lifecycle ----------------------------------------------------------
    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "SupabaseWriter":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ---- low-level helpers --------------------------------------------------
    def _get(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        resp = self._client.get(path, params=params)
        if resp.status_code >= 300:
            raise SupabaseWriteError(
                f"GET {path} failed: {resp.status_code} {resp.text}"
            )
        data = resp.json()
        if not isinstance(data, list):
            raise SupabaseWriteError(f"GET {path} returned non-list: {data!r}")
        return data

    def _insert(self, path: str, row: dict[str, Any]) -> dict[str, Any]:
        """Insert one row and return the representation of the created row."""
        resp = self._client.post(
            path,
            params={"select": "*"},
            headers={"Prefer": "return=representation"},
            json=row,
        )
        if resp.status_code >= 300:
            raise SupabaseWriteError(
                f"POST {path} failed: {resp.status_code} {resp.text}"
            )
        data = resp.json()
        if isinstance(data, list):
            if not data:
                raise SupabaseWriteError(f"POST {path} returned empty representation")
            return data[0]
        if isinstance(data, dict):
            return data
        raise SupabaseWriteError(f"POST {path} returned unexpected body: {data!r}")

    # ---- catalog lookups ----------------------------------------------------
    def get_indicator_id(self, code: str) -> str | None:
        """Resolve indicators.code -> indicators.id (cached)."""
        if code in self._indicator_id_cache:
            return self._indicator_id_cache[code]
        rows = self._get(
            "/indicators", {"select": "id,code", "code": f"eq.{code}", "limit": "1"}
        )
        if not rows:
            return None
        ind_id = rows[0]["id"]
        self._indicator_id_cache[code] = ind_id
        return ind_id

    def get_dataset_id(self, key: str) -> str | None:
        """Resolve datasets.key -> datasets.id (cached)."""
        if key in self._dataset_id_cache:
            return self._dataset_id_cache[key]
        rows = self._get(
            "/datasets", {"select": "id,key", "key": f"eq.{key}", "limit": "1"}
        )
        if not rows:
            return None
        ds_id = rows[0]["id"]
        self._dataset_id_cache[key] = ds_id
        return ds_id

    def get_region(self, ident: str) -> dict[str, Any] | None:
        """Fetch a region by uuid (regions.id) or by code (regions.code).

        Returns a dict with at least ``id``, ``code`` and ``geojson`` (the geom
        column serialized as a GeoJSON geometry). PostgREST returns a PostGIS
        ``geometry`` column as a GeoJSON object when the PostGIS extension is
        installed, which is the MIZAN deployment baseline (docs/11 §1).
        """
        # 36-char dashed string -> treat as uuid; else treat as code.
        is_uuid = len(ident) == 36 and ident.count("-") == 4
        column = "id" if is_uuid else "code"
        rows = self._get(
            "/regions",
            {
                "select": "id,code,name_en,geom",
                column: f"eq.{ident}",
                "limit": "1",
            },
        )
        if not rows:
            return None
        row = rows[0]
        # Normalize the geometry key the AOI resolver expects.
        row["geojson"] = row.get("geom")
        return row

    # ---- write path ---------------------------------------------------------
    def insert_provenance(self, row: dict[str, Any]) -> str:
        """Insert a provenance row; return its new id (docs/11 §5.1).

        Written FIRST so the indicator value can carry its NOT NULL
        ``provenance_id`` FK (docs/11 §8 write rule).
        """
        created = self._insert("/provenance", row)
        prov_id = created.get("id")
        if not prov_id:
            raise SupabaseWriteError("provenance insert returned no id")
        return prov_id

    def insert_indicator_value(self, row: dict[str, Any]) -> str:
        """Insert an indicator_values row; return its new id (docs/11 §6.1)."""
        created = self._insert("/indicator_values", row)
        iv_id = created.get("id")
        if not iv_id:
            raise SupabaseWriteError("indicator_values insert returned no id")
        return iv_id

    def insert_confidence(self, row: dict[str, Any]) -> str:
        """Insert a confidence_scores row; return its new id (docs/11 §6.6)."""
        created = self._insert("/confidence_scores", row)
        cs_id = created.get("id")
        if not cs_id:
            raise SupabaseWriteError("confidence_scores insert returned no id")
        return cs_id
