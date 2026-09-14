"""Readiness boundary tests for calculation specifications."""

from __future__ import annotations

from copy import deepcopy

import pytest

from calculations.base import SpecValidationError
from calculations.spec_loader import (
    _validate_spec,
    get_spec_readiness,
    iter_deferred_test_cases,
    iter_test_cases,
    load_all_specs,
    load_spec,
)


MOBILE_ID = "scope-1-mobile-combustion"
MOBILE_BLOCKERS = {
    "implementation_missing",
    "factor_release_missing",
    "approved_expectations_missing",
}


def _executable_spec() -> dict:
    return deepcopy(load_spec("scope-1-stationary-combustion"))


def test_catalog_accounts_for_executable_and_deferred_specs_and_cases():
    all_specs = load_all_specs(include_deferred=True)
    executable_specs = load_all_specs()
    deferred_specs = {
        methodology_id: spec
        for methodology_id, spec in all_specs.items()
        if get_spec_readiness(spec).status == "deferred"
    }

    assert set(all_specs) == set(executable_specs) | set(deferred_specs)
    assert set(executable_specs).isdisjoint(deferred_specs)
    assert len(executable_specs) == 4
    assert sum(len(list(iter_test_cases(spec))) for spec in executable_specs.values()) == 11
    assert set(deferred_specs) == {MOBILE_ID}
    assert len(list(iter_deferred_test_cases(deferred_specs[MOBILE_ID]))) == 3


def test_mobile_readiness_names_every_current_blocker():
    mobile = load_spec(MOBILE_ID, include_deferred=True)
    readiness = get_spec_readiness(mobile)
    assert readiness.status == "deferred"
    assert set(readiness.blockers) == MOBILE_BLOCKERS


def test_runtime_load_rejects_deferred_methodology():
    with pytest.raises(SpecValidationError, match="deferred and cannot be loaded"):
        load_spec(MOBILE_ID)


@pytest.mark.parametrize("bad_value", ["TBD", float("nan"), float("inf"), True])
def test_executable_expected_value_must_be_finite_number(bad_value):
    spec = _executable_spec()
    spec["test_cases"][0]["expected"]["value"] = bad_value
    with pytest.raises(SpecValidationError, match="expected.value must be a finite number"):
        _validate_spec(spec, methodology_id="synthetic-executable")


def test_deferred_status_requires_blockers():
    spec = _executable_spec()
    spec["readiness"] = {"status": "deferred", "blockers": []}
    with pytest.raises(SpecValidationError, match="at least one readiness blocker"):
        _validate_spec(spec, methodology_id="synthetic-deferred")


def test_deferred_cases_cannot_enter_executable_iterator():
    mobile = load_spec(MOBILE_ID, include_deferred=True)
    with pytest.raises(SpecValidationError, match="use iter_deferred_test_cases"):
        list(iter_test_cases(mobile))
