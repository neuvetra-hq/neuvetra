"""Scope 1 — Fugitive Refrigerant Emissions.

Implements Method 1 from the methodology page (Simplified Material Balance,
GHG Protocol HFC tool default for organisations without full inventory
tracking):

    emissions_kg     = purchases_kg - recovered_at_disposal_kg
    emissions_kg_co2e = emissions_kg * gwp.value

Single DB lookup (refrigerant-gwp), composite arithmetic — the canonical
"factor lookup + non-trivial formula" case for the spec.

Methods 2 (full Material Balance), 3 (Screening with default leak rates),
and 4 (Purchased Gas) are documented on the methodology page and will get
their own function_ids in a later session — Phase 2 ships only Method 1
to lock the spec semantics.

Refrigerant blends (e.g. R-410A = 50% HFC-32 + 50% HFC-125) are NOT in the
GWP table by design; the IPCC AR6 supplementary lists pure substances. Two
options for blends in current Phase 2 usage: (a) call this function once
per component with the proportional charge, or (b) supply the component
substance name (HFC-134a, HFC-32, ...) directly. A future "blend resolver"
extension is tracked for Phase 3.
"""

from __future__ import annotations

from typing import Any

from calculations.base import CalculationContext, CalculationResult
from calculations.spec_loader import load_spec
from calculations.validator import validate_result


METHODOLOGY_ID = "scope-1-fugitive-refrigerants"


def calculate(inputs: dict[str, Any], context: CalculationContext) -> CalculationResult:
    """Compute Scope 1 fugitive refrigerant emissions (Simplified Material
    Balance) for one refrigerant type for one reporting period.

    Required `inputs`
    -----------------
    refrigerant_type : str
        IPCC substance name as it appears in `emission_factors.substance`
        for factor_type='refrigerant-gwp'. Examples: 'HFC-134a', 'HFC-32',
        'HFC-125', 'SF6'.
    purchases_kg : float
        Total kilograms of this refrigerant purchased during the year
        (new equipment pre-charges + service top-ups). Negative or zero
        is permitted (no purchases) and yields zero/negative net.
    recovered_at_disposal_kg : float, default 0
        Kilograms recovered when retired equipment was disposed of.
    """
    spec = load_spec(METHODOLOGY_ID)

    refrigerant_type = _required(inputs, "refrigerant_type")
    purchases = float(_required(inputs, "purchases_kg"))
    recovered = float(inputs.get("recovered_at_disposal_kg", 0.0))

    if context.regulatory_context is None:
        raise ValueError(
            "regulatory_context is required on the CalculationContext for "
            "fugitive refrigerants (PRD §9.2)."
        )

    # Single DB lookup: GWP for this refrigerant.
    gwp = context.factor_resolver.resolve(
        factor_type="refrigerant-gwp",
        substance=refrigerant_type,
        regulatory_context=context.regulatory_context,
        reporting_year=context.reporting_year,
    )

    # GWP records are global and don't carry geography — resolver matches
    # on substance + required_by + year window only.

    # Honour the chosen GWP basis on the context — refuse silent drift if
    # the user said "AR6" but the only matching record is AR5.
    if gwp.gwp_basis and context.gwp_basis and gwp.gwp_basis != context.gwp_basis:
        warnings = (
            f"Requested GWP basis {context.gwp_basis} but resolver returned "
            f"factor with basis {gwp.gwp_basis} ({gwp.factor_id}). "
            f"Result uses {gwp.gwp_basis}.",
        )
    else:
        warnings = ()

    net_kg = purchases - recovered
    emissions_kg_co2e = net_kg * gwp.value

    # Net leak can be negative if recovered > purchases (recovered legacy
    # stockpile, no new purchase) — that's a real edge case, allow it but
    # flag in validator with allow_negative=True.
    allow_negative = net_kg < 0

    result = CalculationResult(
        value=emissions_kg_co2e,
        unit=spec["output_unit"],
        methodology_id=METHODOLOGY_ID,
        methodology_version=int(spec["version"]),
        factors=(gwp,),
        inputs={
            "refrigerant_type": refrigerant_type,
            "purchases_kg": purchases,
            "recovered_at_disposal_kg": recovered,
            "net_emissions_kg": net_kg,
            "method": "Simplified Material Balance (Method 1)",
        },
        regulatory_context=context.regulatory_context,
        boundary_basis=context.boundary_method,
        uncertainty_pct=gwp.uncertainty_pct,
        warnings=warnings,
    )

    validate_result(result, spec=spec, allow_negative=allow_negative)
    return result


def _required(d: dict[str, Any], key: str) -> Any:
    if key not in d or d[key] is None:
        raise ValueError(f"Missing required input: '{key}'")
    return d[key]
