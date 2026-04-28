"""Post-calculation validation.

Runs after every methodology's `calculate()` returns a CalculationResult.
Cheap, deterministic checks that catch obviously-wrong outputs before they
escape the engine — a defense-in-depth layer behind the methodology's own
internal asserts.

Phase 1 implements the minimum useful set:
- Result value is finite and non-negative (negative emissions are valid only
  for explicit removal methodologies; flagged separately).
- Output unit matches what the spec declared.
- factor_ids are non-empty (every emission number must cite at least one
  factor).

Phase 5 will add per-sector sanity bounds (PRD §10.5).
"""

from __future__ import annotations

import math
from typing import Any

from calculations.base import CalculationError, CalculationResult


def validate_result(
    result: CalculationResult,
    *,
    spec: dict[str, Any],
    allow_negative: bool = False,
) -> None:
    """Raise CalculationError if the result fails a basic sanity check."""
    if not math.isfinite(result.value):
        raise CalculationError(
            f"{result.methodology_id} returned non-finite value: {result.value}"
        )

    if not allow_negative and result.value < 0:
        raise CalculationError(
            f"{result.methodology_id} returned negative emissions ({result.value} "
            f"{result.unit}) without allow_negative=True; flag as a removal "
            f"methodology if this is intentional."
        )

    expected_unit = spec.get("output_unit")
    if expected_unit and result.unit != expected_unit:
        raise CalculationError(
            f"{result.methodology_id} output unit '{result.unit}' does not match "
            f"spec.output_unit '{expected_unit}'"
        )

    if not result.factor_ids:
        raise CalculationError(
            f"{result.methodology_id} returned a result with no factor_ids — "
            f"every emission number must cite at least one factor."
        )
