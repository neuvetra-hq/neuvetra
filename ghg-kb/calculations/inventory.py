"""Inventory aggregator — the only stateful piece of the engine.

Holds an ongoing GHG inventory for a single reporting entity / period.
Adds CalculationResults from individual methodology calls, enforces
regulatory-regime consistency and boundary application, and computes
totals with full audit-trail provenance.

PRD §8.4. Phase 2 ships:
- Constructor with boundary_method, regulatory_context, reporting_year
- add_scope1, add_scope2_location, add_scope2_market, add_scope3
- Regulatory-regime consistency check (warn on mismatch, do not silently mix)
- Boundary multiplier (uniform percent — equity share / partial control)
- Double-count detection (same factor_id across scopes, except the
  scope2_location/scope2_market dual-reporting pair which is by design)
- Dual Scope 2 totals (location AND market)
- audit_trail() — full per-result provenance

Phase 5 will add:
- Uncertainty propagation across totals (RSS for independent sources)
- Per-sector sanity bounds
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from calculations.base import CalculationError, CalculationResult


_BUCKETS = {
    "scope1",
    "scope2_location",
    "scope2_market",
    "scope3",
}

# Scope 2 dual-reporting pair: location-based and market-based are
# alternative reportings of the same underlying consumption per the GHG
# Protocol Scope 2 Guidance. They both legitimately reuse the same eGRID
# factor (location uses it directly; market uses it as the residual-mix
# proxy when no published residual mix is available). Reuse across this
# pair is by design, NOT a double-count, so the double-count detector
# whitelists it.
_SCOPE2_PAIR = {"scope2_location", "scope2_market"}


@dataclass
class _Entry:
    """One result added to the inventory, plus the multiplier applied."""

    bucket: str
    result: CalculationResult
    boundary_multiplier: float


@dataclass
class Inventory:
    """Stateful GHG inventory for one reporting entity and period.

    Construction example
    --------------------
        inv = Inventory(
            boundary_method="operational-control",
            regulatory_context="SB-253",
            reporting_year=2025,
            gwp_basis="AR6",
            boundary_multiplier=1.0,    # 100% (full inclusion)
        )

    Adding results
    --------------
        inv.add_scope1(stationary_combustion_result)
        inv.add_scope1(refrigerant_result)
        inv.add_scope2_location(grid_result)
        inv.add_scope2_market(market_result)
        inv.add_scope3(business_travel_result)

    Reading totals
    --------------
        inv.scope1_total()
        inv.scope2_location_total()
        inv.scope2_market_total()
        inv.scope3_total()
        inv.grand_total()           # uses scope2_market by convention
        inv.grand_total(scope2="location")

    Audit
    -----
        inv.audit_trail()           # list of dicts, one per result
        inv.warnings()              # any flags raised on add or on totals
    """

    boundary_method: str
    regulatory_context: str
    reporting_year: int
    gwp_basis: str = "AR6"
    boundary_multiplier: float = 1.0
    _entries: list[_Entry] = field(default_factory=list)
    _warnings: list[str] = field(default_factory=list)

    # ------------------------------------------------------------------
    # Adders
    # ------------------------------------------------------------------

    def add_scope1(
        self,
        result: CalculationResult,
        *,
        boundary_multiplier_override: Optional[float] = None,
    ) -> None:
        self._add("scope1", result, boundary_multiplier_override)

    def add_scope2_location(
        self,
        result: CalculationResult,
        *,
        boundary_multiplier_override: Optional[float] = None,
    ) -> None:
        self._add("scope2_location", result, boundary_multiplier_override)

    def add_scope2_market(
        self,
        result: CalculationResult,
        *,
        boundary_multiplier_override: Optional[float] = None,
    ) -> None:
        self._add("scope2_market", result, boundary_multiplier_override)

    def add_scope3(
        self,
        result: CalculationResult,
        *,
        boundary_multiplier_override: Optional[float] = None,
    ) -> None:
        self._add("scope3", result, boundary_multiplier_override)

    def _add(
        self,
        bucket: str,
        result: CalculationResult,
        boundary_multiplier_override: Optional[float],
    ) -> None:
        if bucket not in _BUCKETS:
            raise CalculationError(f"Unknown bucket {bucket!r}")

        # Regulatory-regime consistency. PRD §8.4.
        if result.regulatory_context != self.regulatory_context:
            self._warnings.append(
                f"{result.methodology_id}: result has regulatory_context "
                f"{result.regulatory_context!r} but inventory is "
                f"{self.regulatory_context!r}. Mixing regulatory regimes is "
                f"not permitted; this entry was added anyway, fix before "
                f"finalising."
            )

        # Double-count detection (with Scope 2 dual-reporting whitelist).
        for existing in self._entries:
            if existing.bucket == bucket:
                continue
            if {existing.bucket, bucket} <= _SCOPE2_PAIR:
                continue
            shared = set(existing.result.factor_ids) & set(result.factor_ids)
            if shared:
                self._warnings.append(
                    f"Double-count risk: factor_id(s) {sorted(shared)} "
                    f"already used in {existing.bucket} "
                    f"({existing.result.methodology_id}); now reused in "
                    f"{bucket} ({result.methodology_id}). Common case: a "
                    f"Scope 1 fuel factor accidentally re-applied as a "
                    f"Scope 3 cat 3 upstream factor."
                )

        mult = (
            boundary_multiplier_override
            if boundary_multiplier_override is not None
            else self.boundary_multiplier
        )
        if mult < 0 or mult > 1.0:
            self._warnings.append(
                f"Unusual boundary_multiplier {mult} on "
                f"{result.methodology_id}; expected 0.0-1.0 for equity / "
                f"partial-control adjustments."
            )

        self._entries.append(_Entry(bucket=bucket, result=result, boundary_multiplier=mult))

    # ------------------------------------------------------------------
    # Totals
    # ------------------------------------------------------------------

    def _bucket_total(self, bucket: str) -> float:
        return sum(
            e.result.value * e.boundary_multiplier
            for e in self._entries
            if e.bucket == bucket
        )

    def scope1_total(self) -> float:
        return self._bucket_total("scope1")

    def scope2_location_total(self) -> float:
        return self._bucket_total("scope2_location")

    def scope2_market_total(self) -> float:
        return self._bucket_total("scope2_market")

    def scope3_total(self) -> float:
        return self._bucket_total("scope3")

    def grand_total(self, *, scope2: str = "market") -> float:
        """Scope 1 + Scope 2 + Scope 3 in kg CO2e.

        Scope 2 sub-bucket choice mirrors GHG Protocol convention - most
        target-setting frameworks (SBTi, CDP) report market-based as the
        headline. CSRD / ESRS E1 require both totals disclosed and either
        may be the headline depending on the user's framework.
        """
        if scope2 == "market":
            s2 = self.scope2_market_total()
        elif scope2 == "location":
            s2 = self.scope2_location_total()
        else:
            raise CalculationError(
                f"scope2 must be 'market' or 'location', got {scope2!r}"
            )
        return self.scope1_total() + s2 + self.scope3_total()

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    def audit_trail(self) -> list[dict]:
        """Per-entry audit records: each result's full provenance plus the
        multiplier applied and the bucket assigned."""
        return [
            {
                "bucket": e.bucket,
                "boundary_multiplier": e.boundary_multiplier,
                "result": e.result.to_audit_dict(),
            }
            for e in self._entries
        ]

    def warnings(self) -> tuple[str, ...]:
        return tuple(self._warnings)

    def summary(self) -> dict:
        """Compact per-scope summary suitable for chatbot presentation."""
        return {
            "boundary_method": self.boundary_method,
            "regulatory_context": self.regulatory_context,
            "reporting_year": self.reporting_year,
            "gwp_basis": self.gwp_basis,
            "scope1_kg_co2e": self.scope1_total(),
            "scope2_location_kg_co2e": self.scope2_location_total(),
            "scope2_market_kg_co2e": self.scope2_market_total(),
            "scope3_kg_co2e": self.scope3_total(),
            "grand_total_market_kg_co2e": self.grand_total(scope2="market"),
            "grand_total_location_kg_co2e": self.grand_total(scope2="location"),
            "n_entries": len(self._entries),
            "warnings": list(self._warnings),
        }
