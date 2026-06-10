"""Earth Engine authentication and initialization.

Initializes EE with a GEE-registered service account (docs/05 §1.3). The
service-account material is supplied via GEE_SA_JSON, which may be either:

  * a filesystem path to the JSON key file, or
  * the inline JSON string of the key itself.

Initialization is idempotent (a module-level guard) so it is performed once
per process (cold start) and reused across requests, exactly as the spec's
``init_ee()`` illustration prescribes.
"""

from __future__ import annotations

import json
import os
import threading

import ee

from .config import Settings, get_settings

# Earth Engine OAuth scopes — earthengine for compute, devstorage for COG export.
_SCOPES = [
    "https://www.googleapis.com/auth/earthengine",
    "https://www.googleapis.com/auth/devstorage.read_write",
]

_HIGH_VOLUME_URL = "https://earthengine-highvolume.googleapis.com"

# Re-init guard. EE state is per-process; serialize init under a lock so two
# concurrent requests on a cold instance cannot double-initialize.
_INITIALIZED = False
_INIT_LOCK = threading.Lock()


def _load_sa_info(gee_sa_json: str) -> dict:
    """Resolve GEE_SA_JSON to a service-account info dict.

    Accepts either a path to a key file or the inline JSON string.
    """
    if not gee_sa_json:
        raise RuntimeError(
            "GEE_SA_JSON is not set; cannot authenticate Earth Engine. "
            "Provide a service-account key path or inline JSON."
        )

    candidate = gee_sa_json.strip()

    # Inline JSON (starts with '{') — parse directly.
    if candidate.startswith("{"):
        return json.loads(candidate)

    # Otherwise treat it as a filesystem path.
    if os.path.isfile(candidate):
        with open(candidate, "r", encoding="utf-8") as fh:
            return json.load(fh)

    raise RuntimeError(
        "GEE_SA_JSON is neither valid inline JSON nor a path to an existing "
        f"file: {candidate!r}"
    )


def init_ee(settings: Settings | None = None) -> None:
    """Idempotent Earth Engine initialization with a service account.

    Safe to call repeatedly; only the first call performs the real init.
    """
    global _INITIALIZED
    if _INITIALIZED:
        return

    with _INIT_LOCK:
        if _INITIALIZED:  # double-checked locking
            return

        settings = settings or get_settings()
        if not settings.gee_project_id:
            raise RuntimeError("GEE_PROJECT_ID is not set; cannot initialize EE.")

        sa_info = _load_sa_info(settings.gee_sa_json)
        sa_email = sa_info.get("client_email")
        if not sa_email:
            raise RuntimeError(
                "Service-account JSON is missing 'client_email'; invalid key."
            )

        # ee.ServiceAccountCredentials accepts the key data via key_data=...
        credentials = ee.ServiceAccountCredentials(
            email=sa_email,
            key_data=json.dumps(sa_info),
        )

        init_kwargs = {
            "credentials": credentials,
            "project": settings.gee_project_id,
        }
        if settings.ee_high_volume:
            init_kwargs["opt_url"] = _HIGH_VOLUME_URL

        ee.Initialize(**init_kwargs)
        _INITIALIZED = True


def is_initialized() -> bool:
    """Return True if Earth Engine has been initialized in this process."""
    return _INITIALIZED
