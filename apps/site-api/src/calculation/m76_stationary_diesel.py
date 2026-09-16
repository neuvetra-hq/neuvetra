"""M76 stationary-generator bounded stationary-generator Decimal calculation authority."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import sys
from decimal import Decimal, ROUND_HALF_EVEN, localcontext

SOURCE_SHA256 = "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7"
FACTOR = {
    "hhvMmbtuPerGallon": "0.138",
    "co2KgPerMmbtu": "73.96",
    "ch4GramsPerMmbtu": "3.0",
    "n2oGramsPerMmbtu": "0.60",
}
GWP = {
    "assessment": "IPCC AR5",
    "horizonYears": "100",
    "co2": "1",
    "ch4": "28",
    "n2o": "265",
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def require(condition):
    if not condition:
        raise ValueError("invalid M76 stationary-generator calculation contract")


def keys(value, names):
    require(isinstance(value, dict) and set(value) == set(names.split(",")))


def exact(value):
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def method():
    return {
        "id": "m76.stationary-distillate-no2.ca2025.ar5.default-hhv.v1",
        "version": "m76-development-v1",
        "engineSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "sourceSha256": SOURCE_SHA256,
        "factorSha256": digest(FACTOR),
        "gwpSha256": digest(GWP),
        "sourceTitle": "EPA GHG Emission Factors Hub 2025",
        "sourceSheet": "Emission Factors Hub",
        "factorCells": ["C55", "D55", "E55", "F55", "G55"],
        "gwpCells": ["E524", "E525", "E526"],
        "noteCells": ["D14", "D47:G47", "C94", "C95", "C99", "E523", "C10", "C556"],
        "hhvMmbtuPerGallon": "0.138",
        "co2KgPerMmbtu": "73.96",
        "ch4GramsPerMmbtu": "3.0",
        "n2oGramsPerMmbtu": "0.60",
        "ch4Gwp": "28",
        "n2oGwp": "265",
        "gwpAssessment": "IPCC AR5 100-year",
        "status": "development_candidate_not_released",
        "releaseEligible": False,
        "rights": "unresolved_for_factor_release",
    }


def calculate(value):
    keys(value, "binding,period,equipment,unit,quantityGallons,statementSha256")
    keys(value["binding"], "coverageVersionId,coverageVersionSha256,entityId,facilityId,sourceId,boundaryDecisionId")
    for name, item in value["binding"].items():
        pattern = "[a-f0-9]{64}" if name.endswith("Sha256") else "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
        require(isinstance(item, str) and re.fullmatch(pattern, item))
    require(value["period"] == {"start": "2025-01-01", "endExclusive": "2026-01-01"})
    require(value["unit"] == "US_gallon")
    keys(value["equipment"], "assetId,identifierBasis,equipmentType,engineType,stationaryInstallation,controlBasis,controlExplanation,fuel,fossilFraction,fuelGradeBasis")
    equipment = value["equipment"]
    require(isinstance(equipment["assetId"], str) and re.fullmatch(r"[A-Z0-9][A-Z0-9._-]{0,63}", equipment["assetId"]))
    for name in ("identifierBasis", "controlExplanation", "fuelGradeBasis"):
        text = equipment[name]
        require(isinstance(text, str) and 0 < len(text) <= 500 and text == text.strip())
    for name, expected in {"equipmentType": "stationary_emergency_generator", "engineType": "compression_ignition", "stationaryInstallation": "fixed", "controlBasis": "owned_operational_control_full_year", "fuel": "Fossil Distillate Fuel Oil No. 2", "fossilFraction": "1.000"}.items():
        require(equipment[name] == expected)
    require(isinstance(value["quantityGallons"], str) and re.fullmatch(r"(?:0|[1-9][0-9]{0,11})\.[0-9]{3}", value["quantityGallons"]))
    require(isinstance(value["statementSha256"], str) and re.fullmatch(r"[a-f0-9]{64}", value["statementSha256"]))
    with localcontext() as context:
        context.prec = 96
        gallons = Decimal(value["quantityGallons"])
        hhv = gallons * Decimal("0.138")
        co2 = hhv * Decimal("73.96")
        ch4 = hhv * Decimal("3.0") / Decimal("1000")
        n2o = hhv * Decimal("0.60") / Decimal("1000")
        ch4e = ch4 * Decimal("28")
        n2oe = n2o * Decimal("265")
        total = co2 + ch4e + n2oe
        display = format(total.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN), ".4f")
    gas = lambda mass, unit, co2e: {"mass": exact(mass), "massUnit": unit, "co2e": exact(co2e), "co2eUnit": "kg CO2e"}
    output = {
        "profile": "m76-diesel-decimal-result-v1",
        "input": value,
        "inputSha256": digest(value),
        "method": method(),
        "derivedHhv": {"quantityMmbtu": exact(hhv), "heatBasis": "HHV", "basis": "default_hhv_estimate"},
        "gasResults": {
            "co2": gas(co2, "kg CO2", co2),
            "ch4": gas(ch4, "kg CH4", ch4e),
            "n2o": gas(n2o, "kg N2O", n2oe),
        },
        "total": {"unrounded": exact(total), "display": display, "unit": "kg CO2e", "rounding": "half_even_4dp"},
    }
    return dict(output, resultSha256=digest(output))

def handle(value):
    require(isinstance(value, dict))
    if value.get("action") == "calculate":
        keys(value, "action,input")
        return {"status": "ok", "record": calculate(value["input"])}
    keys(value, "action,records")
    require(value["action"] == "replay_batch" and isinstance(value["records"], list) and len(value["records"]) <= 40)
    for record in value["records"]:
        require(isinstance(record, dict) and calculate(record.get("input")) == record)
    return {"status": "ok", "verified": len(value["records"])}


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(524289)
        require(len(raw) <= 524288)
        print(canonical(handle(json.loads(raw))))
    except Exception:
        print('{"status":"error","code":"m76_calculation_unavailable"}')
        sys.exit(2)
