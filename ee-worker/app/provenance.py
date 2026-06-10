"""Provenance row construction.

build_provenance() returns a dict whose keys map 1:1 onto the columns of the
``provenance`` table (docs/11 §5.1):

  source, dataset_id, ee_asset_id, period_start, period_end,
  processing_method, processing_version, parameters (jsonb), computed_by

The ``parameters`` jsonb echoes the salient job inputs *and* the quality stats
(image_count, valid-pixel fraction, mean cloud probability, threshold, etc.)
so that every value is reproducible and the confidence engine (docs/09) can
score it from provenance alone (docs/05 §1.9, §3.2 data-integrity invariants).
"""

from __future__ import annotations

from typing import Any


def build_provenance(
    *,
    source: str,
    ee_asset_id: str,
    period_start: str,
    period_end: str,
    processing_method: str,
    processing_version: str,
    computed_by: str,
    image_count: int | None,
    parameters: dict[str, Any],
    dataset_id: str | None = None,
) -> dict[str, Any]:
    """Build a provenance insert payload matching the docs/11 schema.

    ``image_count`` is stored inside the ``parameters`` jsonb (the table has no
    dedicated column; docs/05 §1.9 records it there alongside the other quality
    stats), and is therefore always present for the confidence engine.
    """
    params: dict[str, Any] = dict(parameters or {})
    # Always record the number of contributing scenes, even when zero.
    params.setdefault("image_count", image_count)

    row: dict[str, Any] = {
        "source": source,
        "ee_asset_id": ee_asset_id,
        "period_start": period_start,
        "period_end": period_end,
        "processing_method": processing_method,
        "processing_version": processing_version,
        "parameters": params,
        "computed_by": computed_by,
    }
    if dataset_id is not None:
        row["dataset_id"] = dataset_id
    return row
