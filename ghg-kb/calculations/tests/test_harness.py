"""Spec-driven test harness.

Walks `wiki/methodologies/`, parses every `calculation_spec` block, and
asserts that each declared `test_case` produces the expected value (within
tolerance) AND uses the expected factor_id. PRD §8.3.

This is the contract test for the entire engine. When EPA publishes
eGRID 2024 next year, this suite tells us within minutes whether anything
broke.

Adding a new methodology is a contract: spec block + Python module + at
least one test_case. The harness picks them up automatically.
"""

from __future__ import annotations

import importlib

import pytest

from calculations.base import CalculationContext, CalculationResult
from calculations.spec_loader import (
    get_spec_readiness,
    iter_deferred_test_cases,
    iter_test_cases,
    load_all_specs,
)


def _load_calculate_function(function_id: str):
    module = importlib.import_module(f"calculations.{function_id}")
    if not hasattr(module, "calculate"):
        pytest.fail(
            f"calculations.{function_id} has no `calculate(inputs, context)` "
            f"entry function"
        )
    return module.calculate


def _spec_test_id(spec: dict, tc) -> str:
    return f"{spec['methodology_id']}::{tc.name}"


def _all_case_parameters():
    """Collect executable cases and explicit skips for deferred declarations."""
    parameters = []
    executable_count = 0
    for spec in load_all_specs(include_deferred=True).values():
        readiness = get_spec_readiness(spec)
        if readiness.status == "executable":
            for tc in iter_test_cases(spec):
                parameters.append(
                    pytest.param(spec, tc, id=_spec_test_id(spec, tc))
                )
                executable_count += 1
            continue

        reason = "deferred: " + ", ".join(readiness.blockers)
        for tc in iter_deferred_test_cases(spec):
            parameters.append(
                pytest.param(
                    spec,
                    tc,
                    id=_spec_test_id(spec, tc),
                    marks=pytest.mark.skip(reason=reason),
                )
            )
    return parameters, executable_count


CASE_PARAMETERS, EXECUTABLE_CASE_COUNT = _all_case_parameters()


@pytest.mark.parametrize(
    "spec,tc",
    CASE_PARAMETERS,
)
def test_methodology_spec(spec, tc, factor_resolver):
    """Run one declared test_case through its methodology's calculate()."""
    calculate = _load_calculate_function(spec["function_id"])

    # Inputs vs context: regulatory_context and reporting_year ride on the
    # context object, everything else is in the inputs dict. The spec
    # declares them in `inputs` for documentation, but at execution time
    # they are split.
    inputs = dict(tc.inputs)
    regulatory_context = inputs.pop("regulatory_context", None)
    reporting_year = inputs.pop("reporting_year", None)
    if regulatory_context is None or reporting_year is None:
        pytest.fail(
            f"{tc.name}: test_case must include regulatory_context and "
            f"reporting_year"
        )

    ctx = CalculationContext(
        regulatory_context=regulatory_context,
        reporting_year=int(reporting_year),
        factor_resolver=factor_resolver,
    )

    result: CalculationResult = calculate(inputs, ctx)

    # Value within tolerance.
    expected = tc.expected_value
    tol = abs(expected) * (tc.tolerance_pct / 100.0)
    assert abs(result.value - expected) <= tol, (
        f"{tc.name}: expected {expected} ± {tol} {tc.expected_unit}, "
        f"got {result.value} {result.unit}"
    )

    # Unit matches.
    if tc.expected_unit:
        assert result.unit == tc.expected_unit, (
            f"{tc.name}: expected unit {tc.expected_unit}, got {result.unit}"
        )

    # Factor selected matches what the spec asserted.
    if tc.expected_factor_id:
        assert tc.expected_factor_id in result.factor_ids, (
            f"{tc.name}: expected factor_id {tc.expected_factor_id} in "
            f"{result.factor_ids}"
        )

    # Provenance is non-empty.
    assert result.methodology_id == spec["methodology_id"]
    assert result.methodology_version == int(spec["version"])
    assert result.factor_ids, "result must cite at least one factor_id"


def test_at_least_one_methodology_loaded():
    """Sanity check: if this fails, executable spec discovery is broken."""
    specs = load_all_specs()
    assert specs, (
        "load_all_specs() returned no specs — either no methodology page has a "
        "calculation_spec block yet, or spec_loader is broken."
    )


def test_at_least_one_executable_case_collected():
    """Prevent an all-deferred catalog from producing a false-green suite."""
    assert EXECUTABLE_CASE_COUNT > 0, (
        "No executable calculation_spec test cases were collected; deferred "
        "case skips cannot satisfy the calculation harness."
    )
