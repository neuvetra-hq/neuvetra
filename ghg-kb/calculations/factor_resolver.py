"""Factor resolver — looks up the right emission factor record for a calculation.

In the walking-skeleton phase this resolves against a CSV stub that mirrors the
Supabase `emission_factors` schema. The public interface is identical to what
the future Supabase implementation will expose:

    resolver.resolve(query: dict, reporting_year: int) -> FactorReference

so that swapping the backend is a drop-in change in `Phase 2/3`.

Design notes:
- This layer never falls back to a "close enough" factor. If the structured
  query returns zero rows, we raise FactorNotFoundError. PRD §9.2.
- Year filtering applies the version window: a factor with effective_start ≤
  reporting_year_end and (effective_end is null or > reporting_year_start) is
  current for that year. PRD §9.6.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable, Optional

from calculations.base import FactorNotFoundError, FactorReference


# ---------------------------------------------------------------------------
# Backend interface
# ---------------------------------------------------------------------------


@dataclass
class CsvFactorResolver:
    """CSV-backed factor resolver. Mirrors the Supabase emission_factors schema.

    Parameters
    ----------
    csv_paths:
        One or more CSVs to load. Each row must follow the schema in
        factors/schema.sql.
    """

    csv_paths: tuple[Path, ...]

    def __post_init__(self) -> None:
        rows: list[dict] = []
        for p in self.csv_paths:
            with open(p, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    rows.append(row)
        self._rows = rows

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def resolve(
        self,
        *,
        factor_type: str,
        substance: Optional[str] = None,
        geography: Optional[str] = None,
        regulatory_context: Optional[str] = None,
        reporting_year: Optional[int] = None,
        scope3_category: Optional[int] = None,
    ) -> FactorReference:
        """Return exactly one matching FactorReference, or raise.

        All filter arguments are AND-combined. `regulatory_context` is checked
        against the factor's `required_by` array (Postgres TEXT[]). Year window
        filtering is applied last.
        """
        candidates = list(self._iter_matches(
            factor_type=factor_type,
            substance=substance,
            geography=geography,
            regulatory_context=regulatory_context,
            scope3_category=scope3_category,
        ))

        if reporting_year is not None:
            candidates = [r for r in candidates if _in_year_window(r, reporting_year)]

        if not candidates:
            raise FactorNotFoundError(
                "No emission factor matches: "
                f"factor_type={factor_type!r}, substance={substance!r}, "
                f"geography={geography!r}, regulatory_context={regulatory_context!r}, "
                f"reporting_year={reporting_year!r}"
            )

        if len(candidates) > 1:
            # Tie-break: prefer the most recently effective record. If still
            # ambiguous, this is a data-quality issue — refuse rather than
            # guess. PRD §9.2.
            candidates.sort(key=lambda r: r.get("effective_start", ""), reverse=True)
            top, second = candidates[0], candidates[1]
            if top.get("effective_start") == second.get("effective_start"):
                ids = ", ".join(c["factor_id"] for c in candidates)
                raise FactorNotFoundError(
                    f"Ambiguous factor match — multiple records share the same "
                    f"effective_start: {ids}"
                )
            row = top
        else:
            row = candidates[0]

        return _row_to_reference(row)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _iter_matches(
        self,
        *,
        factor_type: str,
        substance: Optional[str],
        geography: Optional[str],
        regulatory_context: Optional[str],
        scope3_category: Optional[int],
    ) -> Iterable[dict]:
        for r in self._rows:
            if r["factor_type"] != factor_type:
                continue
            if substance is not None and r.get("substance") != substance:
                continue
            if geography is not None and r.get("geography") != geography:
                continue
            if scope3_category is not None and str(r.get("scope3_category", "")) != str(scope3_category):
                continue
            if regulatory_context is not None:
                required_by = _parse_required_by(r.get("required_by", ""))
                if regulatory_context not in required_by:
                    continue
            yield r


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_required_by(raw: str) -> set[str]:
    """Parse the Postgres TEXT[] export form '{A,B,C}' into a Python set.

    Accepts either the Postgres array form or a plain comma-separated string.
    """
    if not raw:
        return set()
    raw = raw.strip()
    if raw.startswith("{") and raw.endswith("}"):
        raw = raw[1:-1]
    return {x.strip().strip('"') for x in raw.split(",") if x.strip()}


def _in_year_window(row: dict, reporting_year: int) -> bool:
    """Return True iff the row's effective window covers any part of the year."""
    start = _parse_date(row.get("effective_start"))
    end = _parse_date(row.get("effective_end"))
    year_start = date(reporting_year, 1, 1)
    year_end = date(reporting_year, 12, 31)
    if start is not None and start > year_end:
        return False
    if end is not None and end <= year_start:
        return False
    return True


def _parse_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None
    return date.fromisoformat(raw)


def _row_to_reference(row: dict) -> FactorReference:
    def _maybe_float(key: str) -> Optional[float]:
        v = row.get(key, "")
        if v in (None, "", "NULL"):
            return None
        return float(v)

    return FactorReference(
        factor_id=row["factor_id"],
        name=row["name"],
        value=float(row["value"]),
        unit=row["unit"],
        source_document=row.get("source_document", ""),
        effective_start=row.get("effective_start") or None,
        effective_end=row.get("effective_end") or None,
        gwp_basis=row.get("gwp_basis") or None,
        uncertainty_pct=_maybe_float("uncertainty_pct"),
    )
