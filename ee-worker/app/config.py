"""Application configuration (pydantic-settings).

Reads the environment variables defined in the MIZAN implementation contract
and the root .env.example:

  GEE_PROJECT_ID            — Google Earth Engine / GCP project id
  GEE_SA_JSON               — GEE service-account: a path to a key file OR
                              inline JSON of the service-account key
  SUPABASE_URL              — https://<project-ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY — service-role key (server-side only, full DB access)
  EE_WORKER_AUTH_TOKEN      — shared bearer secret for inbound /compute auth

Secrets are never logged. The Settings object is constructed once and reused.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from . import __version__


class Settings(BaseSettings):
    """Strongly-typed runtime settings sourced from the environment / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- Earth Engine / GCP -------------------------------------------------
    gee_project_id: str = Field(default="", validation_alias="GEE_PROJECT_ID")
    # Either a filesystem path to the SA key, or the inline JSON string itself.
    gee_sa_json: str = Field(default="", validation_alias="GEE_SA_JSON")

    # High-volume endpoint is used for automated / parallel workloads (docs/05 §1.3).
    ee_high_volume: bool = Field(default=True, validation_alias="EE_HIGH_VOLUME")

    # ---- Supabase write target ---------------------------------------------
    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(
        default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY"
    )

    # ---- Inbound auth -------------------------------------------------------
    ee_worker_auth_token: str = Field(
        default="", validation_alias="EE_WORKER_AUTH_TOKEN"
    )

    # ---- Worker metadata ----------------------------------------------------
    # processing_version stamped onto every provenance row; computed_by tag.
    processing_version: str = Field(
        default=__version__, validation_alias="EE_WORKER_VERSION"
    )

    # CHIRPS climatology baseline used for SPI gamma fitting (docs/06 §6.2).
    spi_baseline_start_year: int = Field(
        default=1991, validation_alias="SPI_BASELINE_START_YEAR"
    )
    spi_baseline_end_year: int = Field(
        default=2020, validation_alias="SPI_BASELINE_END_YEAR"
    )

    @property
    def computed_by(self) -> str:
        """Actor string written to provenance.computed_by (docs/11 §5.1)."""
        return f"ee-worker@{self.processing_version}"

    @property
    def supabase_rest_url(self) -> str:
        """Base URL for the PostgREST API."""
        return f"{self.supabase_url.rstrip('/')}/rest/v1"

    @property
    def ee_endpoint(self) -> str:
        """EE API endpoint host recorded in provenance.parameters."""
        return "highvolume" if self.ee_high_volume else "standard"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a process-wide cached Settings instance."""
    return Settings()
