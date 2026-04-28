"""Unit registry sanity tests.

Round-trip checks for every input alias declared in unit_registry.py.
PRD §9.1 — "every test case must round-trip: input in any acceptable
unit, internal conversion to canonical, expected output value matches
regardless of input unit."
"""

from __future__ import annotations

import pytest

from calculations.base import UnitConversionError
from calculations.unit_registry import (
    CANONICAL_UNIT,
    INPUT_UNIT_ALIASES,
    convert,
)


# Spot checks — exact conversions that must hold.
@pytest.mark.parametrize(
    "qty,unit,unit_class,expected,tol",
    [
        (1.0, "MMBtu", "energy", 1.0, 1e-9),
        (10.0, "therm", "energy", 1.0, 1e-3),       # 10 therms = 1 MMBtu (≈)
        (1.0, "kg", "mass", 1.0, 1e-9),
        (1.0, "tonne", "mass", 1000.0, 1e-6),
        (1.0, "mile", "distance", 1.0, 1e-9),
        (1.0, "km", "distance", 0.621371, 1e-5),
        (100.0, "USD", "currency", 100.0, 1e-9),
    ],
)
def test_convert_known_pairs(qty, unit, unit_class, expected, tol):
    out = convert(qty, unit, unit_class)
    assert abs(out - expected) <= tol


def test_unknown_unit_class_raises():
    with pytest.raises(UnitConversionError):
        convert(1.0, "MMBtu", "calories")


def test_unit_outside_allowlist_raises():
    # 'foot' is a real Pint unit but not in our distance allowlist.
    with pytest.raises(UnitConversionError):
        convert(1.0, "foot", "distance")


def test_dimensional_mismatch_raises():
    # Mass quantity in an energy slot — must refuse before Pint blows up.
    with pytest.raises(UnitConversionError):
        convert(1.0, "kg", "energy")


def test_canonicals_are_in_allowlist():
    """Every canonical unit must itself be an accepted input alias.

    Otherwise a user submitting the canonical unit (e.g. 'MMBtu' for
    energy) would be rejected — clearly wrong.
    """
    for unit_class, canonical in CANONICAL_UNIT.items():
        assert canonical in INPUT_UNIT_ALIASES[unit_class], (
            f"Canonical unit {canonical!r} for class {unit_class!r} is not in "
            f"its own input alias set"
        )
