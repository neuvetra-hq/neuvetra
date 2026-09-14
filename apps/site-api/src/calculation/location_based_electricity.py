from __future__ import annotations

import hashlib
import json
import re
import sys
from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN, localcontext
from pathlib import Path
from typing import Any


DECIMAL_RE = re.compile(r"^(?:0|[1-9][0-9]{0,29})(?:\.[0-9]{1,18})?$")
METHOD_ID = "scope2-location-based-egrid-subregion"
METHOD_VERSION = "2023-r2-camx-v1"
SOURCE_SHA256 = "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab"

FACTOR = {
    "id": "epa-egrid2023-r2-camx-total-output",
    "version": "eGRID2023-revision-2",
    "status": "development_candidate",
    "release_eligible": False,
    "data_year": "2023",
    "geography": {"country": "United States", "state": "California", "egrid_subregion": "CAMX", "name": "WECC California"},
    "components": {
        "co2": {"value": "194.3512704", "unit": "kg CO2/MWh", "cell": "AC6"},
        "ch4": {"value": "0.01134", "unit": "kg CH4/MWh", "cell": "AE6"},
        "n2o": {"value": "0.0013608", "unit": "kg N2O/MWh", "cell": "AG6"},
    },
    "total_output_co2e": {"value": "195.0402888", "unit": "kg CO2e/MWh", "cell": "AI6"},
    "source": {
        "publisher": "U.S. Environmental Protection Agency",
        "title": "eGRID2023 metric data file, revision 2",
        "workbook_sha256": SOURCE_SHA256,
        "sheet": "SRL23",
        "table": "eGRID subregion annual total output emission rates",
        "row_cells": ["A6", "B6", "C6", "AC6", "AE6", "AG6", "AI6"],
        "header_cells": ["A1", "B1", "C1", "AC1", "AE1", "AG1", "AI1"],
        "publisher_url": "https://www.epa.gov/egrid/detailed-data",
        "rights_status": "federal_public_data_commercial_use_citation_reviewed; method_release_pending",
    },
}

GWP = {
    "id": "epa-egrid2023-ar5-100-year",
    "version": "egrid2023-technical-guide-v1",
    "assessment": "IPCC AR5 without climate-carbon feedbacks",
    "time_horizon_years": "100",
    "values": {"co2": "1", "ch4": "28", "n2o": "265"},
    "source": {
        "publisher": "U.S. Environmental Protection Agency",
        "title": "Technical Guide for eGRID2023",
        "page": "12",
        "section": "3.1.1.2 Annual Emission Estimates for CH4, N2O, and CO2 equivalent",
        "publisher_url": "https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf",
    },
}

EXPECTED_ACTIVITY_KEYS = {"asset_id", "boundary", "geography", "reporting_period", "electricity", "quantity", "unit"}
EXPECTED_GEOGRAPHY_KEYS = {"country", "state", "egrid_subregion"}
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
        fail("activity_contract_invalid", "activity", "Use the complete fixed synthetic electricity activity record.")
    geography = value.get("geography")
    if not isinstance(geography, dict) or set(geography) != EXPECTED_GEOGRAPHY_KEYS:
        fail("geography_required", "geography", "Declare the country, state, and reviewed eGRID subregion.")
    if geography != {"country": "United States", "state": "California", "egrid_subregion": "CAMX"}:
        fail("geography_mismatch", "geography", "This bounded method accepts only the reviewed CAMX synthetic fixture; no subregion is inferred from a state alone.")
    period = value.get("reporting_period")
    if not isinstance(period, dict) or set(period) != EXPECTED_PERIOD_KEYS or period != {"start": "2023-01-01", "end": "2023-12-31"}:
        fail("reporting_period_mismatch", "reporting_period", "Use the fixed 2023 period aligned to the eGRID2023 data year.")
    if value.get("unit") != "MWh":
        fail("unit_conversion_unapproved", "unit", "This demo accepts MWh only. No hidden kWh conversion was applied.")
    if value.get("electricity") != "Grid-delivered purchased electricity":
        fail("activity_unsupported", "electricity", "This bounded demo supports grid-delivered purchased electricity only.")
    if value.get("asset_id") != "Synthetic California office 001" or value.get("boundary") != "Purchased electricity consumed by the reporting company":
        fail("synthetic_fixture_invalid", "activity", "Use the fixed synthetic facility and Scope 2 boundary for this development demo.")
    quantity = value.get("quantity")
    if not isinstance(quantity, str) or not DECIMAL_RE.fullmatch(quantity):
        fail("quantity_invalid", "quantity", "Enter a non-negative plain decimal string with no exponent.")
    try:
        parsed = Decimal(quantity)
    except InvalidOperation:
        fail("quantity_invalid", "quantity", "Enter a finite decimal quantity.")
    if not parsed.is_finite() or parsed < 0:
        fail("quantity_invalid", "quantity", "Enter a finite, non-negative decimal quantity.")
    if quantity != "1":
        fail("synthetic_fixture_invalid", "quantity", "This bounded development method accepts exactly 1 MWh of synthetic activity.")
    return value


def implementation_hash() -> str:
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def calculate(activity: Any) -> dict[str, Any]:
    checked = validate_activity(activity)
    with localcontext() as context:
        context.prec = 96
        quantity = Decimal(checked["quantity"])
        co2_mass = quantity * Decimal(FACTOR["components"]["co2"]["value"])
        ch4_mass = quantity * Decimal(FACTOR["components"]["ch4"]["value"])
        n2o_mass = quantity * Decimal(FACTOR["components"]["n2o"]["value"])
        ch4_co2e = ch4_mass * Decimal(GWP["values"]["ch4"])
        n2o_co2e = n2o_mass * Decimal(GWP["values"]["n2o"])
        component_sum = co2_mass + ch4_co2e + n2o_co2e
        total = quantity * Decimal(FACTOR["total_output_co2e"]["value"])
        component_rounding_delta = total - component_sum
        display = total.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN)

    factor_hash = digest(FACTOR)
    gwp_hash = digest(GWP)
    result: dict[str, Any] = {
        "contract_version": "m53-electricity-calculation-result-v1",
        "status": "calculated",
        "classification": {
            "source": "retained_primary_source_currentness_checked_2026-09-12",
            "factor": "development_candidate",
            "method_approval": "pending_independent_factor_method_approval",
            "runtime": "not_released",
            "release_eligible": False,
        },
        "activity": checked,
        "input_snapshot_sha256": digest(checked),
        "method": {
            "id": METHOD_ID,
            "version": METHOD_VERSION,
            "implementation_sha256": implementation_hash(),
            "scope": "Scope 2",
            "category": "location-based purchased electricity",
            "formula": "MWh × published eGRID subregion total-output CO2e rate",
        },
        "factor": {**FACTOR, "candidate_sha256": factor_hash},
        "gwp_policy": {**GWP, "policy_sha256": gwp_hash},
        "conversion": {"id": "identity-mwh-v1", "ratio": "1 MWh = 1 MWh"},
        "gas_results": {
            "co2": {"mass": decimal_text(co2_mass), "mass_unit": "kg CO2", "co2e": decimal_text(co2_mass), "co2e_unit": "kg CO2e"},
            "ch4": {"mass": decimal_text(ch4_mass), "mass_unit": "kg CH4", "co2e": decimal_text(ch4_co2e), "co2e_unit": "kg CO2e"},
            "n2o": {"mass": decimal_text(n2o_mass), "mass_unit": "kg N2O", "co2e": decimal_text(n2o_co2e), "co2e_unit": "kg CO2e"},
        },
        "trace": [
            {"step": "published_total_output", "expression": f'{checked["quantity"]} * 195.0402888', "result": decimal_text(total), "unit": "kg CO2e"},
            {"step": "component_sum_reference", "expression": f'{decimal_text(co2_mass)} + {decimal_text(ch4_co2e)} + {decimal_text(n2o_co2e)}', "result": decimal_text(component_sum), "unit": "kg CO2e"},
            {"step": "published_rate_rounding_delta", "expression": f'{decimal_text(total)} - {decimal_text(component_sum)}', "result": decimal_text(component_rounding_delta), "unit": "kg CO2e"},
        ],
        "total": {
            "unrounded": decimal_text(total),
            "unit": "kg CO2e",
            "display": format(display, ".4f"),
            "rounding": "four decimal places; ROUND_HALF_EVEN; no intermediate rounding",
        },
        "reconciliation": {
            "authority": "published total-output CO2e rate in AI6",
            "component_sum": decimal_text(component_sum),
            "component_rounding_delta": decimal_text(component_rounding_delta),
            "explanation": "EPA publishes the gas-specific rates as rounded columns. They are shown for inspection and are not silently substituted for the published CO2e total-output rate.",
        },
    }
    return {**result, "result_payload_sha256": digest(result)}


def replay(record: Any) -> dict[str, Any]:
    if not isinstance(record, dict) or record.get("contract_version") != "m53-electricity-calculation-result-v1":
        fail("replay_contract_invalid", "record", "Replay accepts only an exported M53 electricity calculation record.")
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
        print(json.dumps(handle(incoming), ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return 0
    except ContractError as error:
        print(json.dumps({"status": "error", "error": {"code": error.code, "field": error.field, "message": error.message}}, separators=(",", ":")))
        return 2
    except Exception:
        print(json.dumps({"status": "error", "error": {"code": "calculation_unavailable", "field": "system", "message": "The local deterministic calculator is unavailable."}}, separators=(",", ":")))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
