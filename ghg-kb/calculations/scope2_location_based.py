"""Scope 2 — Location-Based.

Computes Scope 2 emissions for purchased electricity using the average
grid emission factor for the geography where consumption occurs.

PRD §9.4 / methodology page wiki/methodologies/scope-2-location-based.md.

Formula:

    emissions_kg_co2e = consumption_in_MWh * grid_factor.value

The factor lookup is geography-keyed (CAMX, AKGD, ERCT, ...). Substance
on `electricity-grid` records is the grid identifier itself
('grid-electricity-camx' etc.) — we do NOT filter by substance, only by
geography. That's the convention in factors/processed/electricity_grid_*.csv.
"""

from __future__ import annotations

from typing import Any

from calculations.base import CalculationContext, CalculationResult
from calculations.spec_loader import load_spec
from calculations.unit_registry import convert
from calculations.validator import validate_result


METHODOLOGY_ID = "scope-2-location-based"


def calculate(inputs: dict[str, Any], context: CalculationContext) -> CalculationResult:
    """Compute Scope 2 location-based emissions for one consumption block.

    Required `inputs`
    -----------------
    consumption : float
        Numerical electricity consumption.
    unit : str
        One of the energy aliases declared in unit_registry. Converted to
        MWh before applying the factor.
    grid_geography : str
        eGRID-style geography code: 'CAMX' (California), 'AKGD' (Alaska
        Gas Distribution), 'ERCT' (ERCOT/Texas), etc. Must exist in the
        electricity-grid factors table for the reporting_year.
    """
    spec = load_spec(METHODOLOGY_ID)

    consumption = float(_required(inputs, "consumption"))
    unit_in = _required(inputs, "unit")
    geography = _required(inputs, "grid_geography")

    if context.regulatory_context is None:
        raise ValueError(
            "regulatory_context is required on the CalculationContext for "
            "Scope 2 location-based (PRD §9.2)."
        )

    # Grid factors are kg CO2e per MWh. Override the energy-class canonical
    # (MMBtu) with MWh on this call.
    mwh = convert(consumption, unit_in, unit_class="energy", to_unit="MWh")

    factor = context.factor_resolver.resolve(
        factor_type="electricity-grid",
        geography=geography,
        regulatory_context=context.regulatory_context,
        reporting_year=context.reporting_year,
    )

    emissions = mwh * factor.value

    result = CalculationResult(
        value=emissions,
        unit=spec["output_unit"],
        methodology_id=METHODOLOGY_ID,
        methodology_version=int(spec["version"]),
        factors=(factor,),
        inputs={
            "consumption": consumption,
            "unit": unit_in,
            "consumption_canonical_MWh": mwh,
            "grid_geography": geography,
        },
        regulatory_context=context.regulatory_context,
        boundary_basis=context.boundary_method,
        uncertainty_pct=factor.uncertainty_pct,
    )

    validate_result(result, spec=spec)
    return result


def _required(d: dict[str, Any], key: str) -> Any:
    if key not in d or d[key] is None:
        raise ValueError(f"Missing required input: '{key}'")
    return d[key]
