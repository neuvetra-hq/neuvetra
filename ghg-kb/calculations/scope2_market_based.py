"""Scope 2 — Market-Based.

Computes Scope 2 emissions using contractual instruments (RECs, GOs, PPAs,
supplier-specific rates) for the covered portion of consumption, plus a
residual-mix factor for the uncovered portion.

This is the canonical multi-source methodology in Phase 2 — it locks the
spec semantics for the case where one calculation needs:
  (a) a value supplied directly by the user (the contractual instrument's
      own emission rate, which is unique to that contract and not in our
      factor database), AND
  (b) a value looked up from the factor database (the residual-mix factor
      for the market geography).

PRD §9.4 multi-factor mitigation. The Python module performs both reads
and the composite arithmetic; the spec's `formula` field documents the
combination but does not parse-and-execute (Phase 1+ documentary-only
formula policy stands).

Residual-mix handling
---------------------
True residual-mix factors (e.g. Green-e / AIB residual mix) are not yet in
the emission_factors table. Per the methodology page's documented fallback:
"If no residual mix is available: use location-based grid average and
disclose the absence in the inventory." This module does exactly that —
falls back to the location-based eGRID factor for the geography and emits
a warning on the CalculationResult.
"""

from __future__ import annotations

from typing import Any

from calculations.base import (
    CalculationContext,
    CalculationResult,
    FactorReference,
)
from calculations.spec_loader import load_spec
from calculations.unit_registry import convert
from calculations.validator import validate_result


METHODOLOGY_ID = "scope-2-market-based"


def calculate(inputs: dict[str, Any], context: CalculationContext) -> CalculationResult:
    """Compute Scope 2 market-based emissions for one market block.

    Required `inputs`
    -----------------
    contracted_consumption : float
        Energy covered by qualifying contractual instruments.
    contracted_unit : str
        Unit alias for contracted_consumption.
    contracted_factor_kg_per_mwh : float
        Emission rate of the contractual instrument (e.g. 0.0 for a 100%
        renewable PPA, supplier disclosed rate for a green tariff). Cannot
        be looked up from the DB — each instrument is unique.
    uncovered_consumption : float
        Energy not covered by any instrument.
    uncovered_unit : str
        Unit alias for uncovered_consumption.
    grid_geography : str
        eGRID-style geography for the residual-mix proxy lookup (CAMX,
        ERCT, etc.).

    Optional `inputs`
    -----------------
    residual_mix_factor_kg_per_mwh : float
        Override the residual-mix proxy. When supplied, the eGRID lookup
        is skipped and this value is used directly. Useful when the user
        has an authoritative residual-mix figure (Green-e, AIB).
    """
    spec = load_spec(METHODOLOGY_ID)

    contracted = float(_required(inputs, "contracted_consumption"))
    contracted_unit = _required(inputs, "contracted_unit")
    contracted_factor = float(_required(inputs, "contracted_factor_kg_per_mwh"))
    uncovered = float(_required(inputs, "uncovered_consumption"))
    uncovered_unit = _required(inputs, "uncovered_unit")
    geography = _required(inputs, "grid_geography")

    if context.regulatory_context is None:
        raise ValueError(
            "regulatory_context is required on the CalculationContext for "
            "Scope 2 market-based (PRD §9.2)."
        )

    contracted_mwh = convert(contracted, contracted_unit, "energy", to_unit="MWh")
    uncovered_mwh = convert(uncovered, uncovered_unit, "energy", to_unit="MWh")

    factors_used: list[FactorReference] = []
    warnings: list[str] = []

    # --- Lookup 1: residual-mix factor for the uncovered consumption -------
    residual_override = inputs.get("residual_mix_factor_kg_per_mwh")
    if residual_override is not None:
        residual_factor_value = float(residual_override)
        residual_ref = FactorReference(
            factor_id=f"user-supplied-residual-{geography}",
            name=f"User-supplied residual mix for {geography}",
            value=residual_factor_value,
            unit="kg CO2e / MWh",
            source_document="user input",
        )
        factors_used.append(residual_ref)
        warnings.append(
            f"Residual-mix factor supplied directly by user "
            f"({residual_factor_value} kg CO2e/MWh) — not from DB."
        )
    else:
        # Documented fallback: use location-based grid average, warn that
        # this is a proxy not a true residual-mix.
        grid_factor = context.factor_resolver.resolve(
            factor_type="electricity-grid",
            geography=geography,
            regulatory_context=context.regulatory_context,
            reporting_year=context.reporting_year,
        )
        residual_factor_value = grid_factor.value
        factors_used.append(grid_factor)
        warnings.append(
            f"True residual-mix factor not available for {geography}; "
            f"using location-based grid average ({grid_factor.factor_id}) "
            f"as documented fallback. Disclose this proxy in the inventory."
        )

    # --- The contracted-instrument "factor" is user-supplied, not from DB.
    # Track it as a synthetic FactorReference so the audit trail still
    # carries every value that influenced the result.
    contracted_ref = FactorReference(
        factor_id="user-supplied-contracted-instrument",
        name="Contractual instrument emission rate (user-supplied)",
        value=contracted_factor,
        unit="kg CO2e / MWh",
        source_document="user input — contractual instrument disclosure",
    )
    factors_used.append(contracted_ref)

    # --- Composite arithmetic --------------------------------------------
    contracted_emissions = contracted_mwh * contracted_factor
    uncovered_emissions = uncovered_mwh * residual_factor_value
    total = contracted_emissions + uncovered_emissions

    result = CalculationResult(
        value=total,
        unit=spec["output_unit"],
        methodology_id=METHODOLOGY_ID,
        methodology_version=int(spec["version"]),
        factors=tuple(factors_used),
        inputs={
            "contracted_mwh": contracted_mwh,
            "contracted_factor_kg_per_mwh": contracted_factor,
            "contracted_emissions_kg": contracted_emissions,
            "uncovered_mwh": uncovered_mwh,
            "residual_factor_kg_per_mwh": residual_factor_value,
            "uncovered_emissions_kg": uncovered_emissions,
            "grid_geography": geography,
        },
        regulatory_context=context.regulatory_context,
        boundary_basis=context.boundary_method,
        warnings=tuple(warnings),
    )

    validate_result(result, spec=spec)
    return result


def _required(d: dict[str, Any], key: str) -> Any:
    if key not in d or d[key] is None:
        raise ValueError(f"Missing required input: '{key}'")
    return d[key]
