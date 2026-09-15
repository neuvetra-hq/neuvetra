"""M74 bounded mobile-diesel Decimal calculation authority."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import sys
from decimal import Decimal, ROUND_HALF_EVEN, localcontext

SOURCE_SHA256 = "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7"
FACTOR = {
    "co2KgPerGallon": "10.21",
    "ch4GramsPerMile": "0.0095",
    "n2oGramsPerMile": "0.0431",
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
        raise ValueError("invalid M74 calculation contract")


def keys(value, names):
    require(isinstance(value, dict) and set(value) == set(names.split(",")))


def exact(value):
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def method():
    return {
        "id": "mobile-diesel-combustion",
        "version": "m74-development-v1",
        "engineSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "sourceSha256": SOURCE_SHA256,
        "factorSha256": digest(FACTOR),
        "gwpSha256": digest(GWP),
        "sourceTitle": "EPA GHG Emission Factors Hub 2025",
        "sourceSheet": "Emission Factors Hub",
        "factorCells": ["C103:E103", "C107:E107", "C255:G256"],
        "gwpCells": ["E523:E526"],
        "noteCells": ["F3", "F248:G248", "C255:D256"],
        "co2KgPerGallon": "10.21",
        "ch4GramsPerMile": "0.0095",
        "n2oGramsPerMile": "0.0431",
        "ch4Gwp": "28",
        "n2oGwp": "265",
        "gwpAssessment": "IPCC AR5 100-year",
        "status": "development_candidate_not_released",
        "releaseEligible": False,
        "rights": "unresolved_for_factor_release",
    }


def calculate(value):
    keys(value, "binding,period,vehicle,quantityGallons,quantityUnit,distanceMiles,distanceUnit,fuelStatementSha256,mileageStatementSha256")
    keys(value["binding"], "coverageVersionId,coverageVersionSha256,entityId,facilityId,sourceId,boundaryDecisionId")
    for name, item in value["binding"].items():
        pattern = "[a-f0-9]{64}" if name.endswith("Sha256") else "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
        require(isinstance(item, str) and re.fullmatch(pattern, item))
    require(value["period"] == {"start": "2025-01-01", "endExclusive": "2026-01-01"})
    require(value["quantityUnit"] == "US_gallon" and value["distanceUnit"] == "vehicle_mile")
    keys(value["vehicle"], "assetId,vehicleClass,classificationBasis,modelYear,fuel,controlBasis")
    vehicle = value["vehicle"]
    require(isinstance(vehicle["assetId"], str) and re.fullmatch(r"[A-Z0-9][A-Z0-9._-]{0,63}", vehicle["assetId"]))
    require(vehicle["vehicleClass"] == "Medium- and Heavy-Duty Vehicles")
    require(isinstance(vehicle["classificationBasis"], str) and 0 < len(vehicle["classificationBasis"]) <= 500)
    require(isinstance(vehicle["modelYear"], int) and not isinstance(vehicle["modelYear"], bool) and 2007 <= vehicle["modelYear"] <= 2022)
    require(vehicle["fuel"] == "Fossil Diesel" and vehicle["controlBasis"] == "owned_operational_control_full_year")
    for name in ("quantityGallons", "distanceMiles"):
        require(isinstance(value[name], str) and re.fullmatch(r"(?:0|[1-9][0-9]{0,11})\.[0-9]{3}", value[name]))
    for name in ("fuelStatementSha256", "mileageStatementSha256"):
        require(isinstance(value[name], str) and re.fullmatch(r"[a-f0-9]{64}", value[name]))
    with localcontext() as context:
        context.prec = 96
        gallons = Decimal(value["quantityGallons"])
        miles = Decimal(value["distanceMiles"])
        co2 = gallons * Decimal("10.21")
        ch4 = miles * Decimal("0.0095") / Decimal("1000")
        n2o = miles * Decimal("0.0431") / Decimal("1000")
        ch4e = ch4 * Decimal("28")
        n2oe = n2o * Decimal("265")
        total = co2 + ch4e + n2oe
        display = format(total.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN), ".4f")
    gas = lambda mass, unit, co2e: {"mass": exact(mass), "massUnit": unit, "co2e": exact(co2e), "co2eUnit": "kg CO2e"}
    output = {
        "profile": "m74-decimal-result-v1",
        "input": value,
        "inputSha256": digest(value),
        "method": method(),
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
        print('{"status":"error","code":"m74_calculation_unavailable"}')
        sys.exit(2)
