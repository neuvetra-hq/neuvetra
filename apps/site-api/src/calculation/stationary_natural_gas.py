#!/usr/bin/env python3
"""Canonical Decimal authority for the M42 synthetic calculation demo."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN, localcontext
from pathlib import Path
from typing import Any


METHOD_ID = "stationary-natural-gas-combustion"
METHOD_VERSION = "m42-development-v1"
FACTOR_ID = "combustion-natural-gas-epa-cfr98-2025"
FACTOR_VERSION = "epa-hub-2025-table1-natural-gas-v1"
GWP_ID = "ipcc-ar5-100-year"
GWP_VERSION = "epa-hub-2025-table11-v1"
SOURCE_SHA256 = "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7"
DECIMAL_RE = re.compile(r"^(?:0|[1-9][0-9]{0,29})(?:\.[0-9]{1,18})?$")

FACTOR = {
    "id": FACTOR_ID,
    "version": FACTOR_VERSION,
    "status": "development_candidate_not_released",
    "release_eligible": False,
    "fuel": "Natural Gas",
    "heat_basis": "HHV",
    "components": {
        "co2": {"value": "53.06", "unit": "kg CO2/MMBtu", "cell": "E38"},
        "ch4": {"value": "1.0", "unit": "g CH4/MMBtu", "cell": "F38"},
        "n2o": {"value": "0.10", "unit": "g N2O/MMBtu", "cell": "G38"},
    },
    "source": {
        "publisher": "U.S. Environmental Protection Agency",
        "title": "GHG Emission Factors Hub 2025",
        "workbook_sha256": SOURCE_SHA256,
        "sheet": "Emission Factors Hub",
        "table": "Table 1 - Stationary Combustion",
        "header_cells": ["B12", "C12", "C14", "D14", "E14", "F14", "G14", "E15", "F15", "G15"],
        "row_cells": ["C38", "E38", "F38", "G38"],
        "method_note_cells": {"hhv": "C94", "combustion_only_upstream_excluded": "C99"},
        "publisher_url": "https://www.epa.gov/climateleadership/ghg-emission-factors-hub",
        "rights_status": "unresolved_for_factor_release",
    },
}

GWP = {
    "id": GWP_ID,
    "version": GWP_VERSION,
    "assessment": "IPCC AR5",
    "time_horizon_years": "100",
    "values": {"co2": "1", "ch4": "28", "n2o": "265"},
    "source_cells": {"co2": "E524", "ch4": "E525", "n2o": "E526"},
    "source": {
        "publisher": "U.S. Environmental Protection Agency",
        "title": "GHG Emission Factors Hub 2025",
        "workbook_sha256": SOURCE_SHA256,
        "sheet": "Emission Factors Hub",
        "table": "Table 11 - Global Warming Potential (GWP)",
        "title_cells": ["B521", "C521"],
        "horizon_cell": "E523",
        "assessment_note_cells": ["C10", "C556"],
    },
}

EXPECTED_ACTIVITY_KEYS = {"asset_id", "boundary", "geography", "reporting_period", "fuel", "quantity", "unit"}
EXPECTED_PERIOD_KEYS = {"start", "end"}


class ContractError(Exception):
    def __init__(self, code: str, field: str, message: str):
        self.code = code
        self.field = field
        self.message = message
        super().__init__(message)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def fail(code: str, field: str, message: str) -> None:
    raise ContractError(code, field, message)


def validate_activity(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != EXPECTED_ACTIVITY_KEYS:
        fail("activity_contract_invalid", "activity", "Use the complete fixed synthetic activity record.")
    period = value.get("reporting_period")
    if not isinstance(period, dict) or set(period) != EXPECTED_PERIOD_KEYS:
        fail("reporting_period_mismatch", "reporting_period", "Use the fixed 2025 demo reporting period.")
    if value.get("geography") != "United States":
        fail("geography_required", "geography", "Declare United States; this candidate cannot be applied to an undeclared geography.")
    if period != {"start": "2025-01-01", "end": "2025-12-31"}:
        fail("reporting_period_mismatch", "reporting_period", "Use 2025-01-01 through 2025-12-31; no latest-factor substitution was made.")
    if value.get("unit") != "MMBtu":
        fail("unit_conversion_unapproved", "unit", "This demo accepts MMBtu only. No hidden heat-content conversion was applied.")
    if value.get("fuel") != "Natural Gas":
        fail("fuel_unsupported", "fuel", "This bounded demo supports Natural Gas only.")
    if value.get("asset_id") != "Synthetic boiler 001" or value.get("boundary") != "Owned stationary combustion source":
        fail("synthetic_fixture_invalid", "activity", "Use the fixed synthetic boiler and boundary for this development demo.")
    quantity = value.get("quantity")
    if not isinstance(quantity, str) or not DECIMAL_RE.fullmatch(quantity):
        fail("quantity_invalid", "quantity", "Enter a non-negative plain decimal string with no exponent.")
    try:
        parsed = Decimal(quantity)
    except InvalidOperation:
        fail("quantity_invalid", "quantity", "Enter a finite decimal quantity.")
    if not parsed.is_finite() or parsed < 0:
        fail("quantity_invalid", "quantity", "Enter a finite, non-negative decimal quantity.")
    return value


def implementation_hash() -> str:
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def calculate(activity: Any) -> dict[str, Any]:
    checked = validate_activity(activity)
    with localcontext() as context:
        # The input contract allows 30 integer plus 18 fractional digits. The
        # longest coefficient used by this method is 53.1145, so 96 digits
        # preserves every permitted finite product and the final quantize.
        context.prec = 96
        quantity = Decimal(checked["quantity"])
        co2_mass = quantity * Decimal(FACTOR["components"]["co2"]["value"])
        ch4_mass = quantity * Decimal(FACTOR["components"]["ch4"]["value"]) / Decimal("1000")
        n2o_mass = quantity * Decimal(FACTOR["components"]["n2o"]["value"]) / Decimal("1000")
        ch4_co2e = ch4_mass * Decimal(GWP["values"]["ch4"])
        n2o_co2e = n2o_mass * Decimal(GWP["values"]["n2o"])
        total = co2_mass + ch4_co2e + n2o_co2e
        display = total.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN)

    factor_hash = digest(FACTOR)
    gwp_hash = digest(GWP)
    input_hash = digest(checked)
    result: dict[str, Any] = {
        "contract_version": "m42-calculation-result-v1",
        "status": "calculated",
        "classification": {
            "source": "retained_primary_source",
            "factor": "development_candidate",
            "extraction_approval": "pending_independent_factor_method_approval",
            "method_approval": "pending_independent_factor_method_approval",
            "rights": "unresolved_for_factor_release",
            "runtime": "not_released",
            "release_eligible": False,
        },
        "activity": checked,
        "input_snapshot_sha256": input_hash,
        "method": {
            "id": METHOD_ID,
            "version": METHOD_VERSION,
            "implementation_sha256": implementation_hash(),
            "scope": "Scope 1",
            "category": "stationary combustion",
            "formula": "CO2 + (CH4 kg * CH4 GWP) + (N2O kg * N2O GWP)",
        },
        "factor": {**FACTOR, "candidate_sha256": factor_hash},
        "gwp_policy": {**GWP, "policy_sha256": gwp_hash},
        "conversion": {"id": "grams-to-kilograms-v1", "ratio": "1000 g = 1 kg"},
        "gas_results": {
            "co2": {"mass": decimal_text(co2_mass), "mass_unit": "kg CO2", "co2e": decimal_text(co2_mass), "co2e_unit": "kg CO2e"},
            "ch4": {"mass": decimal_text(ch4_mass), "mass_unit": "kg CH4", "co2e": decimal_text(ch4_co2e), "co2e_unit": "kg CO2e"},
            "n2o": {"mass": decimal_text(n2o_mass), "mass_unit": "kg N2O", "co2e": decimal_text(n2o_co2e), "co2e_unit": "kg CO2e"},
        },
        "trace": [
            {"step": "co2_mass", "expression": f'{checked["quantity"]} * 53.06', "result": decimal_text(co2_mass), "unit": "kg CO2"},
            {"step": "ch4_mass", "expression": f'{checked["quantity"]} * 1.0 / 1000', "result": decimal_text(ch4_mass), "unit": "kg CH4"},
            {"step": "ch4_co2e", "expression": f'{decimal_text(ch4_mass)} * 28', "result": decimal_text(ch4_co2e), "unit": "kg CO2e"},
            {"step": "n2o_mass", "expression": f'{checked["quantity"]} * 0.10 / 1000', "result": decimal_text(n2o_mass), "unit": "kg N2O"},
            {"step": "n2o_co2e", "expression": f'{decimal_text(n2o_mass)} * 265', "result": decimal_text(n2o_co2e), "unit": "kg CO2e"},
            {"step": "total", "expression": f'{decimal_text(co2_mass)} + {decimal_text(ch4_co2e)} + {decimal_text(n2o_co2e)}', "result": decimal_text(total), "unit": "kg CO2e"},
        ],
        "total": {
            "unrounded": decimal_text(total),
            "unit": "kg CO2e",
            "display": format(display, ".4f"),
            "rounding": "four decimal places; ROUND_HALF_EVEN; no intermediate rounding",
        },
    }
    return {**result, "result_payload_sha256": digest(result)}


def replay(record: Any) -> dict[str, Any]:
    if not isinstance(record, dict) or record.get("contract_version") != "m42-calculation-result-v1":
        fail("replay_contract_invalid", "record", "Replay accepts only an exported M42 calculation record.")
    supplied_hash = record.get("result_payload_sha256")
    unhashed = {key: value for key, value in record.items() if key != "result_payload_sha256"}
    if not isinstance(supplied_hash, str) or digest(unhashed) != supplied_hash:
        fail("replay_hash_mismatch", "record", "The exported calculation record was altered and cannot be replayed.")
    recalculated = calculate(record.get("activity"))
    if recalculated != record:
        fail("replay_binding_mismatch", "record", "The method, factor, GWP, or implementation binding changed; replay was stopped.")
    return {"record": recalculated, "hash_match": True}


def handle(message: Any) -> dict[str, Any]:
    if not isinstance(message, dict) or set(message) not in ({"action", "activity"}, {"action", "record"}):
        fail("request_contract_invalid", "request", "Use the calculation or replay contract.")
    if message.get("action") == "calculate" and "activity" in message:
        return {"status": "ok", "record": calculate(message["activity"])}
    if message.get("action") == "replay" and "record" in message:
        return {"status": "ok", **replay(message["record"])}
    fail("request_contract_invalid", "request", "Use action calculate or replay with its required payload.")


def main() -> int:
    try:
        incoming = json.load(sys.stdin)
        output = handle(incoming)
        print(json.dumps(output, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return 0
    except ContractError as error:
        print(json.dumps({"status": "error", "error": {"code": error.code, "field": error.field, "message": error.message}}, separators=(",", ":")))
        return 2
    except Exception:
        print(json.dumps({"status": "error", "error": {"code": "calculation_unavailable", "field": "system", "message": "The local deterministic calculator is unavailable."}}, separators=(",", ":")))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
