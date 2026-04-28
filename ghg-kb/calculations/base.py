"""Core dataclasses and exceptions for the calculation engine.

These types are the contract between every methodology module and the
chatbot / inventory aggregator that consumes results. Keep them stable —
breaking changes here ripple through every methodology.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class CalculationError(Exception):
    """Base class for all calculation engine errors."""


class FactorNotFoundError(CalculationError):
    """Raised when the factor resolver cannot find any matching record.

    The engine MUST surface this rather than silently substituting a
    near-match — wrong factor under the wrong regulatory regime is the
    canonical failure mode the engine is designed to prevent.
    """


class AmbiguousMethodologyError(CalculationError):
    """Raised when more than one methodology could apply and the choice is
    material. The chatbot must ask the user to disambiguate."""


class UnitConversionError(CalculationError):
    """Raised when input units cannot be converted to the factor's expected
    canonical unit (e.g., trying to convert kilograms to MMBtu)."""


class SpecValidationError(CalculationError):
    """Raised when a calculation_spec block is malformed or internally
    inconsistent."""


# ---------------------------------------------------------------------------
# Result and context
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FactorReference:
    """Lightweight reference to an emission factor used in a calculation.

    Captured on every CalculationResult so the audit trail can be
    reconstructed without re-querying the database.
    """

    factor_id: str
    name: str
    value: float
    unit: str
    source_document: str
    effective_start: Optional[str] = None
    effective_end: Optional[str] = None
    gwp_basis: Optional[str] = None
    uncertainty_pct: Optional[float] = None


@dataclass(frozen=True)
class CalculationResult:
    """Immutable result of a single methodology calculation.

    Every numerical output the chatbot returns to a user MUST originate
    from one of these. The chatbot's presenter layer is allowed to format
    `value` and `unit` for display but never to mutate them.
    """

    value: float
    unit: str
    methodology_id: str
    methodology_version: int
    factors: tuple[FactorReference, ...]
    inputs: dict[str, Any]
    regulatory_context: str
    boundary_basis: Optional[str] = None
    uncertainty_pct: Optional[float] = None
    warnings: tuple[str, ...] = field(default_factory=tuple)
    computed_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )

    @property
    def factor_ids(self) -> tuple[str, ...]:
        """Convenience accessor for the audit trail."""
        return tuple(f.factor_id for f in self.factors)

    def to_audit_dict(self) -> dict[str, Any]:
        """Render as a JSON-serialisable audit record."""
        d = asdict(self)
        # asdict turns the FactorReference tuple into a list of dicts already.
        return d


@dataclass
class CalculationContext:
    """Per-call configuration shared across one calculation (or one
    Inventory's worth of calculations).

    Carrying these as a context object — rather than as positional
    arguments to every methodology function — lets us add new context
    fields (e.g. Supabase session, feature flags) without touching every
    methodology signature.
    """

    regulatory_context: str  # 'CARB-MRR', 'SB-253', 'ESRS-E1', ...
    reporting_year: int
    gwp_basis: str = "AR6"  # 'AR4', 'AR5', 'AR6'
    boundary_method: Optional[str] = None  # 'operational-control', etc.
    factor_resolver: Any = None  # injected; concrete type avoided to break import cycle
    unit_registry: Any = None  # injected
