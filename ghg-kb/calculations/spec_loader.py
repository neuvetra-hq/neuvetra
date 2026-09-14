"""Parse calculation_spec blocks out of methodology page frontmatter.

The wiki is the single source of truth (see CLAUDE.md). Methodology Python
modules consult their spec at runtime so test cases, factor queries, and
versioning live next to the human-readable prose.

Public API:

    load_spec(methodology_id)   -> dict
    load_all_specs()            -> dict[methodology_id, spec]
    iter_test_cases(spec)       -> Iterable[TestCase]

Pass ``include_deferred=True`` only for inspection and readiness reporting.
Normal loading exposes executable specifications only.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from pathlib import Path
from typing import Any, Iterable, Optional

import yaml

from calculations.base import SpecValidationError


# Repository root inferred relative to this file: <repo>/calculations/spec_loader.py
REPO_ROOT = Path(__file__).resolve().parent.parent
METHODOLOGIES_DIR = REPO_ROOT / "wiki" / "methodologies"


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------


def _read_frontmatter(path: Path) -> dict[str, Any]:
    """Extract the YAML frontmatter dict from a markdown file.

    Returns an empty dict if no frontmatter block is present.
    """
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    # parts == ['', '<yaml>', '<body>']
    if len(parts) < 3:
        return {}
    return yaml.safe_load(parts[1]) or {}


# ---------------------------------------------------------------------------
# Spec loading
# ---------------------------------------------------------------------------


def load_spec(
    methodology_id: str, *, include_deferred: bool = False
) -> dict[str, Any]:
    """Load the calculation_spec for a single methodology by ID.

    Raises SpecValidationError if the page exists but has no spec, if the spec
    fails structural validation, or if it is deferred and the caller did not
    explicitly request inspection metadata.
    """
    page = METHODOLOGIES_DIR / f"{methodology_id}.md"
    if not page.exists():
        raise SpecValidationError(f"No methodology page found for id '{methodology_id}'")
    fm = _read_frontmatter(page)
    spec = fm.get("calculation_spec")
    if spec is None:
        raise SpecValidationError(
            f"Page '{methodology_id}' has no calculation_spec block"
        )
    _validate_spec(spec, methodology_id=methodology_id)
    # Inject the methodology_id from the page id so callers don't have to
    # cross-reference it manually.
    spec.setdefault("methodology_id", fm.get("id", methodology_id))
    readiness = get_spec_readiness(spec)
    if readiness.status == "deferred" and not include_deferred:
        raise SpecValidationError(
            f"calculation_spec for '{methodology_id}' is deferred and cannot "
            f"be loaded for execution; blockers: {list(readiness.blockers)}"
        )
    return spec


def load_all_specs(*, include_deferred: bool = False) -> dict[str, dict[str, Any]]:
    """Return validated executable specs, plus deferred specs when requested.

    Pages without a calculation_spec block are silently skipped — they remain
    documentation-only methodologies.
    """
    out: dict[str, dict[str, Any]] = {}
    for page in sorted(METHODOLOGIES_DIR.glob("*.md")):
        fm = _read_frontmatter(page)
        if "calculation_spec" not in fm:
            continue
        spec = fm["calculation_spec"]
        _validate_spec(spec, methodology_id=fm.get("id", page.stem))
        spec.setdefault("methodology_id", fm.get("id", page.stem))
        if (
            get_spec_readiness(spec).status == "deferred"
            and not include_deferred
        ):
            continue
        out[spec["methodology_id"]] = spec
    return out


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TestCase:
    """A single assertion declared in a methodology's calculation_spec."""

    name: str
    inputs: dict[str, Any]
    expected_value: float
    tolerance_pct: float
    expected_factor_id: Optional[str] = None
    expected_unit: Optional[str] = None


@dataclass(frozen=True)
class DeferredTestCase:
    """A declared case retained for readiness accounting, not execution."""

    name: str
    blockers: tuple[str, ...]


@dataclass(frozen=True)
class SpecReadiness:
    """Machine-readable execution status for a calculation specification."""

    status: str
    blockers: tuple[str, ...] = ()


ALLOWED_READINESS_STATUSES = {"executable", "deferred"}
ALLOWED_DEFERRED_BLOCKERS = {
    "implementation_missing",
    "factor_release_missing",
    "approved_expectations_missing",
}


def get_spec_readiness(spec: dict[str, Any]) -> SpecReadiness:
    """Return readiness metadata; legacy specs default to executable."""
    raw = spec.get("readiness")
    if raw is None:
        return SpecReadiness(status="executable")
    return SpecReadiness(
        status=raw["status"],
        blockers=tuple(raw.get("blockers", [])),
    )


def iter_test_cases(spec: dict[str, Any]) -> Iterable[TestCase]:
    """Yield executable TestCase objects from a ready specification."""
    readiness = get_spec_readiness(spec)
    if readiness.status != "executable":
        raise SpecValidationError(
            f"calculation_spec for '{spec.get('methodology_id', '<unknown>')}' "
            "is deferred; use iter_deferred_test_cases() for inspection"
        )
    for tc in spec.get("test_cases", []):
        expected = tc.get("expected", {})
        yield TestCase(
            name=tc.get("name", "<unnamed>"),
            inputs=tc.get("inputs", {}),
            expected_value=float(expected["value"]),
            tolerance_pct=float(expected.get("tolerance_pct", 0.5)),
            expected_factor_id=tc.get("factor_used"),
            expected_unit=expected.get("unit"),
        )


def iter_deferred_test_cases(
    spec: dict[str, Any],
) -> Iterable[DeferredTestCase]:
    """Yield every declared case from an explicitly deferred specification."""
    readiness = get_spec_readiness(spec)
    if readiness.status != "deferred":
        raise SpecValidationError(
            f"calculation_spec for '{spec.get('methodology_id', '<unknown>')}' "
            "is executable; use iter_test_cases()"
        )
    for tc in spec.get("test_cases", []):
        yield DeferredTestCase(
            name=tc["name"],
            blockers=readiness.blockers,
        )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


REQUIRED_TOP_KEYS = {"function_id", "version", "inputs", "factor_query", "formula", "output_unit"}


def _validate_spec(spec: dict[str, Any], *, methodology_id: str) -> None:
    """Cheap structural validation. Catches obvious typos, not semantic errors.

    Semantic checks (does the formula reference declared inputs? does the
    function_id resolve to a real Python module?) live in the test harness so
    they fire as visible test failures rather than hidden import errors.
    """
    missing = REQUIRED_TOP_KEYS - set(spec)
    if missing:
        raise SpecValidationError(
            f"calculation_spec for '{methodology_id}' is missing required keys: "
            f"{sorted(missing)}"
        )

    if not isinstance(spec["inputs"], list) or not spec["inputs"]:
        raise SpecValidationError(
            f"calculation_spec for '{methodology_id}' must declare a non-empty "
            f"`inputs` list"
        )

    for inp in spec["inputs"]:
        if "name" not in inp or "type" not in inp:
            raise SpecValidationError(
                f"Input declaration in '{methodology_id}' missing name/type: {inp!r}"
            )

    readiness = _validate_readiness(spec, methodology_id=methodology_id)

    if not isinstance(spec.get("test_cases"), list) or not spec["test_cases"]:
        raise SpecValidationError(
            f"calculation_spec for '{methodology_id}' must include at least one "
            f"test_case (PRD §8.1 validation rule 3)"
        )

    for index, test_case in enumerate(spec["test_cases"]):
        _validate_test_case(
            test_case,
            methodology_id=methodology_id,
            index=index,
            executable=readiness.status == "executable",
        )


def _validate_readiness(
    spec: dict[str, Any], *, methodology_id: str
) -> SpecReadiness:
    raw = spec.get("readiness")
    if raw is None:
        return SpecReadiness(status="executable")
    if not isinstance(raw, dict):
        raise SpecValidationError(
            f"readiness for '{methodology_id}' must be a mapping"
        )

    status = raw.get("status")
    if status not in ALLOWED_READINESS_STATUSES:
        raise SpecValidationError(
            f"readiness.status for '{methodology_id}' must be one of "
            f"{sorted(ALLOWED_READINESS_STATUSES)}"
        )

    blockers = raw.get("blockers", [])
    if not isinstance(blockers, list) or any(
        not isinstance(blocker, str) for blocker in blockers
    ):
        raise SpecValidationError(
            f"readiness.blockers for '{methodology_id}' must be a list of codes"
        )
    if len(blockers) != len(set(blockers)):
        raise SpecValidationError(
            f"readiness.blockers for '{methodology_id}' contains duplicates"
        )
    unknown = set(blockers) - ALLOWED_DEFERRED_BLOCKERS
    if unknown:
        raise SpecValidationError(
            f"readiness.blockers for '{methodology_id}' contains unknown codes: "
            f"{sorted(unknown)}"
        )
    if status == "executable" and blockers:
        raise SpecValidationError(
            f"executable calculation_spec for '{methodology_id}' cannot declare "
            "readiness blockers"
        )
    if status == "deferred" and not blockers:
        raise SpecValidationError(
            f"deferred calculation_spec for '{methodology_id}' must declare at "
            "least one readiness blocker"
        )
    return SpecReadiness(status=status, blockers=tuple(blockers))


def _validate_test_case(
    test_case: Any,
    *,
    methodology_id: str,
    index: int,
    executable: bool,
) -> None:
    label = f"test_case {index + 1} in '{methodology_id}'"
    if not isinstance(test_case, dict):
        raise SpecValidationError(f"{label} must be a mapping")
    if not isinstance(test_case.get("name"), str) or not test_case["name"].strip():
        raise SpecValidationError(f"{label} must have a non-empty name")
    if not isinstance(test_case.get("inputs"), dict):
        raise SpecValidationError(f"{label} must have an inputs mapping")

    expected = test_case.get("expected")
    if not isinstance(expected, dict):
        raise SpecValidationError(f"{label} must have an expected mapping")
    if not isinstance(expected.get("unit"), str) or not expected["unit"].strip():
        raise SpecValidationError(f"{label} must have a non-empty expected.unit")

    tolerance = expected.get("tolerance_pct", 0.5)
    if not _is_finite_number(tolerance) or tolerance < 0:
        raise SpecValidationError(
            f"{label} expected.tolerance_pct must be a finite non-negative number"
        )

    value = expected.get("value")
    if executable and not _is_finite_number(value):
        raise SpecValidationError(
            f"{label} expected.value must be a finite number for an executable "
            "calculation_spec"
        )
    if not executable and not (
        value == "TBD" or _is_finite_number(value)
    ):
        raise SpecValidationError(
            f"{label} expected.value must be a finite number or the literal "
            "'TBD' for a deferred calculation_spec"
        )


def _is_finite_number(value: Any) -> bool:
    """True for finite int/float values, excluding booleans and numeric strings."""
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )
