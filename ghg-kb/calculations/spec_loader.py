"""Parse calculation_spec blocks out of methodology page frontmatter.

The wiki is the single source of truth (see CLAUDE.md). Methodology Python
modules consult their spec at runtime so test cases, factor queries, and
versioning live next to the human-readable prose.

Public API:

    load_spec(methodology_id)   -> dict
    load_all_specs()            -> dict[methodology_id, spec]
    iter_test_cases(spec)       -> Iterable[TestCase]
"""

from __future__ import annotations

from dataclasses import dataclass
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


def load_spec(methodology_id: str) -> dict[str, Any]:
    """Load the calculation_spec for a single methodology by ID.

    Raises SpecValidationError if the page exists but has no spec, or if the
    spec fails basic structural validation.
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
    return spec


def load_all_specs() -> dict[str, dict[str, Any]]:
    """Walk wiki/methodologies/ and return every page that has a spec.

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


def iter_test_cases(spec: dict[str, Any]) -> Iterable[TestCase]:
    """Yield TestCase objects from a spec's `test_cases` list."""
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

    if not spec.get("test_cases"):
        raise SpecValidationError(
            f"calculation_spec for '{methodology_id}' must include at least one "
            f"test_case (PRD §8.1 validation rule 3)"
        )
