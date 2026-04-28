"""Shared pytest fixtures for the calculation engine.

Phase 1 walking skeleton: factor lookups go through a CSV-backed resolver
pointed at the already-processed factor files in `factors/processed/`.
When Supabase is loaded (separate workstream tracked in factors/index.md),
swap CsvFactorResolver for a SupabaseFactorResolver implementing the same
interface; nothing else in the test suite changes.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from calculations.factor_resolver import CsvFactorResolver

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = REPO_ROOT / "factors" / "processed"


@pytest.fixture(scope="session")
def factor_resolver() -> CsvFactorResolver:
    csvs = tuple(sorted(PROCESSED_DIR.glob("*.csv")))
    assert csvs, f"No processed factor CSVs found under {PROCESSED_DIR}"
    return CsvFactorResolver(csv_paths=csvs)
