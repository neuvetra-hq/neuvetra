from __future__ import annotations

import hashlib
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from pathlib import Path
from typing import Any

import location_based_electricity as m53


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
BINDING_KEYS = {
    "company_id", "evidence_id", "bill_version_id", "activity_version_id", "facility_id", "boundary_id",
    "extraction_id", "parser_version", "previous_bill_version_id", "activity_version", "bill_version", "evidence_sha256", "source_quantity_kwh", "normalized_quantity_mwh", "correction_reason", "service_period",
    "facility", "boundary",
}


class ContractError(Exception):
    pass


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def adapter_hash() -> str:
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def validate_binding(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != BINDING_KEYS:
        raise ContractError()
    if any(not isinstance(value.get(key), str) or not UUID_RE.fullmatch(value[key]) for key in ("company_id", "evidence_id", "extraction_id", "previous_bill_version_id", "bill_version_id", "activity_version_id", "facility_id", "boundary_id")):
        raise ContractError()
    expected = {
        "bill_version": 2,
        "activity_version": 1,
        "parser_version": "m55-fixed-pdf-v1",
        "correction_reason": "Synthetic review exercise",
        "evidence_sha256": "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135",
        "source_quantity_kwh": "12346.000",
        "normalized_quantity_mwh": "12.346000",
        "service_period": {"start": "2023-01-01", "end": "2023-01-31"},
        "facility": {"name": "Synthetic California office", "country": "United States", "state": "California", "egrid_subregion": "CAMX"},
        "boundary": {"reporting_year": 2023, "approach": "operational_control", "status": "draft", "version": 1},
    }
    for key, expected_value in expected.items():
        if value.get(key) != expected_value:
            raise ContractError()
    return value


def calculate(binding_value: Any) -> dict[str, Any]:
    binding = validate_binding(binding_value)
    with localcontext() as context:
        context.prec = 96
        quantity = Decimal(binding["source_quantity_kwh"]) / Decimal("1000")
        if format(quantity, ".6f") != binding["normalized_quantity_mwh"]:
            raise ContractError()
        authority = m53.calculate({
            "asset_id": "Synthetic California office 001",
            "boundary": "Purchased electricity consumed by the reporting company",
            "geography": {"country": "United States", "state": "California", "egrid_subregion": "CAMX"},
            "reporting_period": {"start": "2023-01-01", "end": "2023-12-31"},
            "electricity": "Grid-delivered purchased electricity",
            "quantity": "1",
            "unit": "MWh",
        })
        if (authority["contract_version"] != "m53-electricity-calculation-result-v1" or authority["method"]["implementation_sha256"] != "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c" or authority["factor"]["candidate_sha256"] != "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356" or authority["gwp_policy"]["policy_sha256"] != "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" or authority["total"]["unrounded"] != "195.0402888"):
            raise ContractError()
        co2_mass = quantity * Decimal(m53.FACTOR["components"]["co2"]["value"])
        ch4_mass = quantity * Decimal(m53.FACTOR["components"]["ch4"]["value"])
        n2o_mass = quantity * Decimal(m53.FACTOR["components"]["n2o"]["value"])
        ch4_co2e = ch4_mass * Decimal(m53.GWP["values"]["ch4"])
        n2o_co2e = n2o_mass * Decimal(m53.GWP["values"]["n2o"])
        component_sum = co2_mass + ch4_co2e + n2o_co2e
        total = quantity * Decimal(m53.FACTOR["total_output_co2e"]["value"])
        delta = total - component_sum
        display = total.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN)

    activity = {
        "asset_id": binding["facility_id"],
        "boundary_id": binding["boundary_id"],
        "electricity": "Grid-delivered purchased electricity",
        "geography": {"country": "United States", "state": "California", "egrid_subregion": "CAMX"},
        "activity_period": binding["service_period"],
        "factor_data_year": "2023",
        "quantity": binding["normalized_quantity_mwh"],
        "unit": "MWh",
    }
    result: dict[str, Any] = {
        "contract_version": "m56-linked-bill-calculation-result-v1",
        "status": "calculated",
        "classification": {"factor": "development_candidate", "runtime": "not_released", "release_eligible": False},
        "input_snapshot": binding,
        "input_snapshot_sha256": digest(binding),
        "activity": activity,
        "method": {
            "id": m53.METHOD_ID,
            "version": m53.METHOD_VERSION,
            "adapter_implementation_sha256": adapter_hash(),
            "reviewed_engine_sha256": m53.implementation_hash(),
            "authority_record_sha256": authority["result_payload_sha256"],
            "formula": "MWh × published eGRID subregion total-output CO2e rate",
        },
        "factor": {**m53.FACTOR, "candidate_sha256": digest(m53.FACTOR)},
        "gwp_policy": {**m53.GWP, "policy_sha256": digest(m53.GWP)},
        "conversion": {"id": "exact-kwh-to-mwh-v1", "expression": "12346.000 / 1000", "source": "12346.000 kWh", "result": "12.346000 MWh"},
        "gas_results": {
            "co2": {"mass": decimal_text(co2_mass), "mass_unit": "kg CO2", "co2e": decimal_text(co2_mass), "co2e_unit": "kg CO2e"},
            "ch4": {"mass": decimal_text(ch4_mass), "mass_unit": "kg CH4", "co2e": decimal_text(ch4_co2e), "co2e_unit": "kg CO2e"},
            "n2o": {"mass": decimal_text(n2o_mass), "mass_unit": "kg N2O", "co2e": decimal_text(n2o_co2e), "co2e_unit": "kg CO2e"},
        },
        "trace": [
            {"step": "reviewed_bill_conversion", "expression": "12346.000 / 1000", "result": "12.346000", "unit": "MWh"},
            {"step": "published_total_output", "expression": "12.346000 * 195.0402888", "result": decimal_text(total), "unit": "kg CO2e"},
            {"step": "component_sum_reference", "expression": f"{decimal_text(co2_mass)} + {decimal_text(ch4_co2e)} + {decimal_text(n2o_co2e)}", "result": decimal_text(component_sum), "unit": "kg CO2e"},
            {"step": "published_rate_rounding_delta", "expression": f"{decimal_text(total)} - {decimal_text(component_sum)}", "result": decimal_text(delta), "unit": "kg CO2e"},
        ],
        "total": {"unrounded": decimal_text(total), "unit": "kg CO2e", "display": format(display, ".4f"), "rounding": "four decimal places; ROUND_HALF_EVEN; no intermediate rounding"},
        "reconciliation": {
            "authority": "published total-output CO2e rate in AI6",
            "component_sum": decimal_text(component_sum),
            "component_rounding_delta": decimal_text(delta),
            "explanation": "EPA publishes the gas-specific rates as rounded columns. They remain inspection values and are not substituted for the published AI6 total-output rate.",
        },
    }
    return {**result, "result_payload_sha256": digest(result)}


def main() -> int:
    try:
        incoming = json.load(sys.stdin)
        if not isinstance(incoming, dict) or set(incoming) != {"action", "binding"} or incoming.get("action") != "calculate_linked_bill":
            raise ContractError()
        print(json.dumps({"status": "ok", "record": calculate(incoming["binding"])}, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return 0
    except ContractError:
        print(json.dumps({"status": "error", "error": {"code": "linked_bill_contract_invalid", "field": "request", "message": "Use the exact reviewed and linked synthetic bill record."}}, separators=(",", ":")))
        return 2
    except Exception:
        print(json.dumps({"status": "error", "error": {"code": "calculation_unavailable", "field": "system", "message": "The local deterministic calculator is unavailable."}}, separators=(",", ":")))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
