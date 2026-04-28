"""Scope 1 — Stationary Combustion.

Computes CO2e emissions from a single fuel/quantity stationary-combustion
event using the EPA-aligned combustion factors stored in the
`emission_factors` table (factor_type='combustion').

Formula (PRD §7.1, methodology page wiki/methodologies/scope-1-stationary-combustion.md):

    emissions_kg_co2e = quantity_in_canonical_unit * factor.value

For combustion the canonical input unit is MMBtu and the factor unit is
kg CO2e / MMBtu, both aligned with EPA 40 CFR 98 Table C-1 / Hub 2025.

The methodology is single-factor (one factor lookup, one multiplication),
so the spec's `formula` field is here for documentation and the actual
arithmetic lives in this module — exactly as the PRD allows for
single-factor methodologies.
"""

from __future__ import annotations

from typing import Any

from calculations.base import CalculationContext, CalculationResult
from calculations.spec_loader import load_spec
from calculations.unit_registry import convert
from calculations.validator import validate_result


METHODOLOGY_ID = "scope-1-stationary-combustion"


def calculate(inputs: dict[str, Any], context: CalculationContext) -> CalculationResult:
    """Compute Scope 1 stationary-combustion emissions for one fuel event.

    Required `inputs`
    -----------------
    fuel_type : str
        Substance name as it appears in `emission_factors.substance`
        (e.g. "Natural Gas", "Distillate Fuel Oil No. 2").
    quantity : float
        Numerical fuel consumption.
    unit : str
        Unit of the quantity. Must be one of the energy aliases declared in
        unit_registry.INPUT_UNIT_ALIASES['energy'].

    Optional `inputs`
    -----------------
    geography : str, default 'US-national'
    """
    spec = load_spec(METHODOLOGY_ID)

    fuel_type = _required(inputs, "fuel_type")
    quantity = float(_required(inputs, "quantity"))
    unit_in = _required(inputs, "unit")
    geography = inputs.get("geography", "US-national")

    if context.regulatory_context is None:
        raise ValueError(
            "regulatory_context is required on the CalculationContext for "
            "stationary combustion (PRD §9.2)."
        )

    # 1. Look up the right factor for this regulatory regime + fuel + year.
    factor = context.factor_resolver.resolve(
        factor_type="combustion",
        substance=fuel_type,
        geography=geography,
        regulatory_context=context.regulatory_context,
        reporting_year=context.reporting_year,
    )

    # 2. Convert input quantity to the factor's canonical unit (MMBtu).
    quantity_canonical = convert(quantity, unit_in, unit_class="energy")

    # 3. Apply the factor.
    emissions = quantity_canonical * factor.value

    result = CalculationResult(
        value=emissions,
        unit=spec["output_unit"],
        methodology_id=METHODOLOGY_ID,
        methodology_version=int(spec["version"]),
        factors=(factor,),
        inputs={
            "fuel_type": fuel_type,
            "quantity": quantity,
            "unit": unit_in,
            "quantity_canonical_MMBtu": quantity_canonical,
            "geography": geography,
        },
        regulatory_context=context.regulatory_context,
        boundary_basis=context.boundary_method,
        uncertainty_pct=factor.uncertainty_pct,
    )

    validate_result(result, spec=spec)
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _required(d: dict[str, Any], key: str) -> Any:
    if key not in d or d[key] is None:
        raise ValueError(f"Missing required input: '{key}'")
    return d[key]
