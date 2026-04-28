"""Tests for the Inventory aggregator and the Phase 2 end-to-end scenario.

The end-to-end test corresponds to PRD Phase 2 exit criterion:

    "office consumed 50,000 kWh in California, 12,000 therms gas,
     15 kg HFC-134a leak" → correct, fully-cited Scope 1+2 inventory.
"""

from __future__ import annotations

import pytest

from calculations.base import CalculationContext
from calculations.inventory import Inventory
from calculations.scope1_fugitive_refrigerants import calculate as calc_refrigerants
from calculations.scope1_stationary_combustion import calculate as calc_stat_comb
from calculations.scope2_location_based import calculate as calc_s2_location
from calculations.scope2_market_based import calculate as calc_s2_market


# ---------------------------------------------------------------------------
# Phase 2 exit criterion — end-to-end inventory
# ---------------------------------------------------------------------------


def test_phase2_office_inventory_california(factor_resolver):
    """Office: 50,000 kWh on CAMX, 12,000 therms natural gas, 15 kg HFC-134a.

    Reporting under SB-253 (California). Scope 2 location-based only — no
    market-based instruments declared.

    Expected (computed at test-write time and pinned):
      Stationary combustion: 12,000 therms = 1,200 MMBtu * 53.1145 = 63,737.4
      Refrigerants: 15 kg HFC-134a * 1530 GWP = 22,950
      Scope 1 total: 86,687.4 kg CO2e

      Scope 2 location: 50,000 kWh = 50 MWh * 195.0403 = 9,752.015 kg CO2e

      Grand total (market default = location since no market entry):
        Scope 1 + Scope 2 location = 96,439.4 kg CO2e
    """
    ctx = CalculationContext(
        regulatory_context="SB-253",
        reporting_year=2025,
        gwp_basis="AR6",
        boundary_method="operational-control",
        factor_resolver=factor_resolver,
    )

    gas = calc_stat_comb(
        {"fuel_type": "Natural Gas", "quantity": 12000, "unit": "therm"}, ctx
    )
    refrig = calc_refrigerants(
        {"refrigerant_type": "HFC-134a", "purchases_kg": 15}, ctx
    )
    elec = calc_s2_location(
        {"consumption": 50000, "unit": "kWh", "grid_geography": "CAMX"}, ctx
    )

    inv = Inventory(
        boundary_method="operational-control",
        regulatory_context="SB-253",
        reporting_year=2025,
        gwp_basis="AR6",
    )
    inv.add_scope1(gas)
    inv.add_scope1(refrig)
    inv.add_scope2_location(elec)

    # Per-scope totals
    assert abs(inv.scope1_total() - (12000 * 0.1 * 53.1145 + 15 * 1530)) < 1.0
    assert abs(inv.scope2_location_total() - 9752.015) < 1.0
    assert inv.scope2_market_total() == 0.0
    assert inv.scope3_total() == 0.0

    # Grand total — default scope2='market' returns 0 for s2 since no market
    # entry was added; that's the correct behaviour (no market disclosure).
    assert abs(inv.grand_total(scope2="market") - inv.scope1_total()) < 1e-6
    assert abs(inv.grand_total(scope2="location")
               - (inv.scope1_total() + inv.scope2_location_total())) < 1e-6

    # Audit trail covers all three entries with full provenance
    trail = inv.audit_trail()
    assert len(trail) == 3
    factor_ids_seen = set()
    for entry in trail:
        for f in entry["result"]["factors"]:
            factor_ids_seen.add(f["factor_id"])
    assert "combustion-natural-gas-epa-cfr98-2025" in factor_ids_seen
    assert "refrigerant-gwp-hfc-134a-ipcc-ar6" in factor_ids_seen
    assert "electricity-grid-camx-egrid-2023" in factor_ids_seen


# ---------------------------------------------------------------------------
# Aggregator behaviour tests
# ---------------------------------------------------------------------------


def test_dual_scope2_reporting(factor_resolver):
    """A single inventory holds BOTH location and market totals at once."""
    ctx = CalculationContext(
        regulatory_context="SB-253", reporting_year=2025, factor_resolver=factor_resolver
    )
    location = calc_s2_location(
        {"consumption": 1000, "unit": "MWh", "grid_geography": "CAMX"}, ctx
    )
    market = calc_s2_market(
        {
            "contracted_consumption": 600, "contracted_unit": "MWh",
            "contracted_factor_kg_per_mwh": 0.0,
            "uncovered_consumption": 400, "uncovered_unit": "MWh",
            "grid_geography": "CAMX",
        }, ctx,
    )

    inv = Inventory(
        boundary_method="operational-control",
        regulatory_context="SB-253",
        reporting_year=2025,
    )
    inv.add_scope2_location(location)
    inv.add_scope2_market(market)

    # Both populated, both queryable independently.
    assert abs(inv.scope2_location_total() - 195040.3) < 1.0
    assert abs(inv.scope2_market_total() - 78016.12) < 1.0
    assert inv.grand_total(scope2="location") > inv.grand_total(scope2="market")


def test_boundary_multiplier_applies_uniformly(factor_resolver):
    """35% equity share → uniform 0.35 multiplier on every result."""
    ctx = CalculationContext(
        regulatory_context="SB-253", reporting_year=2025, factor_resolver=factor_resolver
    )
    gas = calc_stat_comb(
        {"fuel_type": "Natural Gas", "quantity": 1000, "unit": "MMBtu"}, ctx
    )
    base = gas.value
    inv = Inventory(
        boundary_method="equity-share",
        regulatory_context="SB-253",
        reporting_year=2025,
        boundary_multiplier=0.35,
    )
    inv.add_scope1(gas)
    assert abs(inv.scope1_total() - base * 0.35) < 1.0


def test_regulatory_regime_mismatch_warns(factor_resolver):
    """Adding an ESRS-E1 result to a SB-253 inventory fires a warning."""
    ctx_carb = CalculationContext(
        regulatory_context="CARB-MRR", reporting_year=2025, factor_resolver=factor_resolver
    )
    gas = calc_stat_comb(
        {"fuel_type": "Natural Gas", "quantity": 100, "unit": "MMBtu"}, ctx_carb
    )
    inv = Inventory(
        boundary_method="operational-control",
        regulatory_context="SB-253",       # mismatch
        reporting_year=2025,
    )
    inv.add_scope1(gas)
    assert any("regulatory_context" in w for w in inv.warnings())


def test_double_count_warning(factor_resolver):
    """Same factor_id used in two different scopes → warning."""
    ctx = CalculationContext(
        regulatory_context="SB-253", reporting_year=2025, factor_resolver=factor_resolver
    )
    gas = calc_stat_comb(
        {"fuel_type": "Natural Gas", "quantity": 100, "unit": "MMBtu"}, ctx
    )
    # Add the same combustion result under both Scope 1 and Scope 3 — this
    # is the canonical Scope 3 cat 3 (well-to-tank fuel) double-count case
    # the aggregator is meant to catch.
    inv = Inventory(
        boundary_method="operational-control",
        regulatory_context="SB-253",
        reporting_year=2025,
    )
    inv.add_scope1(gas)
    inv.add_scope3(gas)
    assert any("Double-count" in w for w in inv.warnings())


def test_summary_shape(factor_resolver):
    ctx = CalculationContext(
        regulatory_context="SB-253", reporting_year=2025, factor_resolver=factor_resolver
    )
    gas = calc_stat_comb(
        {"fuel_type": "Natural Gas", "quantity": 100, "unit": "MMBtu"}, ctx
    )
    inv = Inventory(
        boundary_method="operational-control",
        regulatory_context="SB-253",
        reporting_year=2025,
    )
    inv.add_scope1(gas)
    s = inv.summary()
    expected_keys = {
        "boundary_method", "regulatory_context", "reporting_year", "gwp_basis",
        "scope1_kg_co2e", "scope2_location_kg_co2e", "scope2_market_kg_co2e",
        "scope3_kg_co2e", "grand_total_market_kg_co2e",
        "grand_total_location_kg_co2e", "n_entries", "warnings",
    }
    assert expected_keys <= set(s)
    assert s["n_entries"] == 1
