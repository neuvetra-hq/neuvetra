"""Direct tests for the CSV-backed factor resolver.

Behaviour tests — not arithmetic tests. Arithmetic correctness for
methodologies lives in test_harness.py.
"""

from __future__ import annotations

import pytest

from calculations.base import FactorNotFoundError


def test_resolve_natural_gas_combustion(factor_resolver):
    f = factor_resolver.resolve(
        factor_type="combustion",
        substance="Natural Gas",
        geography="US-national",
        regulatory_context="CARB-MRR",
        reporting_year=2025,
    )
    assert f.factor_id == "combustion-natural-gas-epa-cfr98-2025"
    assert abs(f.value - 53.1145) < 1e-6
    assert f.unit == "kg CO2e / MMBtu"


def test_resolve_unknown_substance_raises(factor_resolver):
    with pytest.raises(FactorNotFoundError):
        factor_resolver.resolve(
            factor_type="combustion",
            substance="Unobtanium",
            regulatory_context="CARB-MRR",
            reporting_year=2025,
        )


def test_resolve_wrong_regulatory_context_raises(factor_resolver):
    """If a regulatory regime doesn't list the factor, refuse — don't
    silently substitute. PRD §9.2."""
    with pytest.raises(FactorNotFoundError):
        factor_resolver.resolve(
            factor_type="combustion",
            substance="Natural Gas",
            regulatory_context="ESRS-E1-only-fictional",  # not in any required_by
            reporting_year=2025,
        )


def test_resolve_year_window(factor_resolver):
    """Records with effective_start in 2025 should not match a 2020 query."""
    with pytest.raises(FactorNotFoundError):
        factor_resolver.resolve(
            factor_type="combustion",
            substance="Natural Gas",
            regulatory_context="CARB-MRR",
            reporting_year=2020,
        )
