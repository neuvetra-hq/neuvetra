"""Frozen unit registry for the calculation engine.

Wraps Pint with a small allowlist of units we actually accept on inputs and
the canonical unit each `unit_class` resolves to before factor application.

The registry is deliberately frozen — we do not allow arbitrary unit
arithmetic from user input. Every unit a user can pass must appear in
INPUT_UNIT_ALIASES below; everything else is rejected. This is the unit
equivalent of a SQL allowlist.

Reference: PRD section 9.1 — unit conversion is the #1 source of error in
production carbon-accounting systems.
"""

from __future__ import annotations

from typing import Optional

import pint

from calculations.base import UnitConversionError


# ---------------------------------------------------------------------------
# Canonical units per unit_class
# ---------------------------------------------------------------------------

CANONICAL_UNIT: dict[str, str] = {
    "energy": "MMBtu",
    "volume": "gallon",
    "mass": "kilogram",
    "distance": "mile",
    "currency": "USD",
    "count": "count",
    "dimensionless": "dimensionless",
}


INPUT_UNIT_ALIASES: dict[str, set[str]] = {
    "energy": {
        "MMBtu", "mmbtu", "million_btu",
        "therm", "therms",
        "kWh", "kwh", "kilowatt_hour",
        "MWh", "mwh", "megawatt_hour",
        "GJ", "gigajoule", "gigajoules",
        "MJ", "megajoule", "megajoules",
    },
    "volume": {
        "gallon", "gallons", "gal",
        "liter", "liters", "litre", "litres", "L",
        "Mcf", "mcf", "thousand_cubic_feet",
        "cubic_meter", "cubic_meters", "m^3", "m3",
    },
    "mass": {
        "kilogram", "kilograms", "kg",
        "gram", "grams", "g",
        "tonne", "tonnes", "metric_ton", "MT", "t",
        "short_ton", "short_tons", "ton",
        "pound", "pounds", "lb", "lbs",
    },
    "distance": {
        "mile", "miles", "mi",
        "kilometer", "kilometers", "km",
        "meter", "meters", "m",
    },
    "currency": {"USD", "usd", "$"},
    "count": {"count", "unit", "units", "each"},
    "dimensionless": {"dimensionless", "fraction", "ratio", "%", "percent"},
}


_ureg: Optional[pint.UnitRegistry] = None


def get_registry() -> pint.UnitRegistry:
    """Return a singleton Pint registry with MMBtu defined.

    Pint already knows therm, kWh, gallon, mile etc. We add MMBtu (not in
    Pint's defaults). Mcf is intentionally not defined — Mcf<->MMBtu
    requires an HHV that varies with gas composition; that conversion
    belongs in a methodology, not in the registry.
    """
    global _ureg
    if _ureg is not None:
        return _ureg
    ureg = pint.UnitRegistry()
    ureg.define("MMBtu = 1e6 * Btu = mmbtu = million_btu")
    _ureg = ureg
    return ureg


# ---------------------------------------------------------------------------
# Public conversion API
# ---------------------------------------------------------------------------


def convert(
    quantity: float,
    from_unit: str,
    unit_class: str,
    to_unit: Optional[str] = None,
) -> float:
    """Convert a quantity to a target unit within a declared unit_class.

    `to_unit` defaults to CANONICAL_UNIT[unit_class] when omitted. Pass
    an explicit `to_unit` when the factor's denominator differs from the
    class canonical (e.g. grid factors are kg CO2e per MWh while energy
    class default is MMBtu, so Scope 2 callers pass to_unit='MWh').

    `to_unit` must itself be in the unit_class's input alias allowlist.

    Raises UnitConversionError when:
    - unit_class is unknown
    - from_unit or to_unit is not in the allowlist for unit_class
    - Pint cannot perform the conversion (dimensional mismatch)
    """
    if unit_class not in CANONICAL_UNIT:
        raise UnitConversionError(
            f"Unknown unit_class '{unit_class}'. "
            f"Valid classes: {sorted(CANONICAL_UNIT)}"
        )

    allowed = INPUT_UNIT_ALIASES[unit_class]
    if from_unit not in allowed:
        raise UnitConversionError(
            f"Unit '{from_unit}' is not an accepted input for unit_class "
            f"'{unit_class}'. Accepted: {sorted(allowed)}"
        )

    target = to_unit if to_unit is not None else CANONICAL_UNIT[unit_class]
    if target not in allowed:
        raise UnitConversionError(
            f"Target unit '{target}' is not in the allowlist for unit_class "
            f"'{unit_class}'."
        )

    if unit_class in {"currency", "count", "dimensionless"}:
        if from_unit != target:
            raise UnitConversionError(
                f"No cross-{unit_class} conversion supported "
                f"({from_unit} -> {target})."
            )
        return float(quantity)

    ureg = get_registry()
    try:
        q = quantity * ureg(from_unit)
        return float(q.to(target).magnitude)
    except pint.errors.DimensionalityError as e:
        raise UnitConversionError(
            f"Cannot convert {from_unit} -> {target} for unit_class "
            f"'{unit_class}': {e}"
        ) from e
    except pint.errors.UndefinedUnitError as e:
        raise UnitConversionError(
            f"Pint does not recognise unit '{from_unit}' or '{target}': {e}"
        ) from e
