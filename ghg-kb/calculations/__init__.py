"""Neuvetra GHG Calculation Engine.

The deterministic layer that sits between the chatbot and the emission factor
database. LLMs orchestrate; this package calculates.

Public entry points:

    from calculations import CalculationContext, CalculationResult
    from calculations.scope1_stationary_combustion import calculate

See docs/specs/calculation-spec-schema.md for the spec format that drives this
package, and calculations/README.md for the consumer-facing guide.
"""

from calculations.base import (
    CalculationContext,
    CalculationResult,
    CalculationError,
    FactorNotFoundError,
    AmbiguousMethodologyError,
    UnitConversionError,
)

__all__ = [
    "CalculationContext",
    "CalculationResult",
    "CalculationError",
    "FactorNotFoundError",
    "AmbiguousMethodologyError",
    "UnitConversionError",
]

__version__ = "0.1.0"
