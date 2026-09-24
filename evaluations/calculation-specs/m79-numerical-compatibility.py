"""Independent M79 source-derived numerical expectations and engine comparison.

This file intentionally does not import Neuvetra calculation code. Expected
values use Fraction arithmetic and values independently re-read from the
retained EPA workbook. Pinned engines are invoked only after expectations are
fixed, and their selected output fields are compared as black-box results.
"""
from __future__ import annotations

from fractions import Fraction
from hashlib import sha256
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import json
import re
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = ROOT / "docs/research/m79-method-source-inventory.json"
EXPECTED_PATH = Path(__file__).with_name("m79-numerical-expected.json")
RESULT_PATH = Path(__file__).with_name("m79-numerical-result.json")
SNAPSHOT_PATH = ROOT / "operations/agent-improvement/snapshots/M79-NUMERICAL-COMPATIBILITY-01-CANDIDATE1.json"
ENGINE_DIR = ROOT / "apps/site-api/src/calculation"
ENGINE_PATHS = {
    "natural_gas": ENGINE_DIR / "m73_stationary_natural_gas.py",
    "mobile_diesel": ENGINE_DIR / "m74_mobile_diesel.py",
    "stationary_diesel": ENGINE_DIR / "m76_stationary_diesel.py",
    "fugitive": ENGINE_DIR / "m77_fugitive.py",
}
ENGINE_HASHES = {
    "natural_gas": "e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14",
    "mobile_diesel": "1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6",
    "stationary_diesel": "60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266",
    "fugitive": "3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4",
}
WORKBOOK_HASH = "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7"
METHOD_HASHES = {
    "natural_gas": "a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898",
    "mobile_diesel": "7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497",
    "stationary_diesel": "8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722",
    "fugitive": "acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af",
}
PERIOD = {"start": "2025-01-01", "endExclusive": "2026-01-01"}
UUIDS = {
    "coverageVersionId": "10000000-0000-4000-8000-000000000001",
    "coverageVersionSha256": "a" * 64,
    "entityId": "10000000-0000-4000-8000-000000000002",
    "facilityId": "10000000-0000-4000-8000-000000000003",
    "sourceId": "10000000-0000-4000-8000-000000000004",
    "boundaryDecisionId": "10000000-0000-4000-8000-000000000005",
}


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def exact(value: Fraction) -> str:
    denominator = value.denominator
    twos = fives = 0
    while denominator % 2 == 0:
        denominator //= 2
        twos += 1
    while denominator % 5 == 0:
        denominator //= 5
        fives += 1
    assert denominator == 1
    places = max(twos, fives)
    scaled = abs(value.numerator) * (10**places // value.denominator)
    digits = str(scaled).zfill(places + 1)
    text = digits if not places else (digits[:-places] + "." + digits[-places:]).rstrip("0").rstrip(".")
    return ("-" if value < 0 else "") + text


def half_even_4(value: Fraction) -> str:
    assert value >= 0
    lower, remainder = divmod(value.numerator * 10000, value.denominator)
    if remainder * 2 > value.denominator or remainder * 2 == value.denominator and lower % 2:
        lower += 1
    return f"{lower // 10000}.{lower % 10000:04d}"


def _xlsx_cells(path: Path, addresses: list[str]) -> dict[str, dict[str, object]]:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
          "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "p": "http://schemas.openxmlformats.org/package/2006/relationships"}
    with zipfile.ZipFile(path) as book:
        workbook = ET.fromstring(book.read("xl/workbook.xml"))
        rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        sheet = next(s for s in workbook.find("m:sheets", ns) if s.attrib["name"] == "Emission Factors Hub")
        target = targets[sheet.attrib[f"{{{ns['r']}}}id"]].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        xml = ET.fromstring(book.read(target))
        shared: list[str] = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ET.fromstring(book.read("xl/sharedStrings.xml"))
            for item in strings.findall("m:si", ns):
                shared.append("".join(t.text or "" for t in item.iterfind(".//m:t", ns)))
        styles = ET.fromstring(book.read("xl/styles.xml"))
        num_formats = styles.find("m:numFmts", ns)
        cell_formats = styles.find("m:cellXfs", ns)
        custom = {int(n.attrib["numFmtId"]): n.attrib["formatCode"] for n in ([] if num_formats is None else num_formats)}
        xfs = list([] if cell_formats is None else cell_formats)
        found: dict[str, dict[str, object]] = {}
        wanted = set(addresses)
        for cell in xml.iterfind(".//m:c", ns):
            address = cell.attrib.get("r")
            if address not in wanted:
                continue
            raw_node = cell.find("m:v", ns)
            raw = "" if raw_node is None else raw_node.text or ""
            kind = cell.attrib.get("t")
            value = shared[int(raw)] if kind == "s" else raw
            style_index = int(cell.attrib.get("s", "0"))
            fmt_id = int(xfs[style_index].attrib.get("numFmtId", "0")) if style_index < len(xfs) else 0
            fmt = custom.get(fmt_id)
            found[address] = {"raw": raw, "value": value, "styleIndex": style_index,
                              "numberFormatId": fmt_id, "customNumberFormat": fmt}
        assert set(found) == wanted, (set(addresses) - set(found))
        return found


def _published(raw: str, places: int) -> str:
    quant = Decimal(1).scaleb(-places)
    return format(Decimal(raw).quantize(quant, rounding=ROUND_HALF_UP), f".{places}f")


def source_values(inventory: dict) -> tuple[dict[str, Fraction], dict[str, object]]:
    retained = {x["artifactId"]: x for x in inventory["retainedArtifacts"]}
    workbook = Path(retained["epa_hub_2025_xlsx"]["path"])
    assert digest(workbook) == WORKBOOK_HASH
    places = {"E38": 2, "F38": 1, "G38": 2, "D55": 3, "E55": 2, "F55": 1, "G55": 2,
              "D107": 2, "F256": 4, "G256": 4, "E524": 0, "E525": 0, "E526": 0,
              "E532": 0, "E538": 0, "D575": 0}
    addresses = ["F3", "C38", "E38", "F38", "G38", "C55", "D55", "E55", "F55", "G55",
                 "D107", "F256", "G256", "E524", "E525", "E526", "C532", "E532", "C538", "E538",
                 "C575", "D575", "E575"]
    cells = _xlsx_cells(workbook, addresses)
    published = {cell: _published(str(cells[cell]["raw"]), count) for cell, count in places.items()}
    expected_published = {"E38": "53.06", "F38": "1.0", "G38": "0.10", "D55": "0.138", "E55": "73.96",
                          "F55": "3.0", "G55": "0.60", "D107": "10.21", "F256": "0.0095", "G256": "0.0431",
                          "E524": "1", "E525": "28", "E526": "265", "E532": "1300", "E538": "3350", "D575": "1924"}
    assert published == expected_published
    assert cells["F3"]["value"] == "Last Modified: January 15, 2025"
    assert cells["C38"]["value"] == "Natural Gas"
    assert cells["C55"]["value"] == "Distillate Fuel Oil No. 2"
    assert cells["C532"]["value"] == "HFC-134a" and cells["C538"]["value"] == "HFC-227ea"
    assert cells["C575"]["value"] == "R-410A" and cells["E575"]["value"] == "50% HFC-32 , 50% HFC-125"
    values = {cell: Fraction(text) for cell, text in published.items()}
    observation = {"workbookPath": str(workbook), "bytes": workbook.stat().st_size, "sha256": digest(workbook),
                   "sheet": "Emission Factors Hub", "edition": cells["F3"]["value"], "published": published,
                   "raw": {k: cells[k]["raw"] for k in places},
                   "r410a": {"gas": cells["C575"]["value"], "composition": cells["E575"]["value"]}}
    return values, observation


def _gas_rows(masses: dict[str, Fraction], gwp: dict[str, Fraction]) -> list[dict[str, str]]:
    return [{"gas": gas, "massKgExact": exact(mass), "co2eKgExact": exact(mass * gwp[gas])}
            for gas, mass in masses.items()]


def _case(case_id: str, family: str, activity: dict[str, str], masses: dict[str, Fraction], gwp: dict[str, Fraction]) -> dict[str, object]:
    total = sum((mass * gwp[gas] for gas, mass in masses.items()), Fraction())
    return {"id": case_id, "family": family, "activity": activity, "gasRows": _gas_rows(masses, gwp),
            "kgCo2eExact": exact(total), "kgCo2eDisplay": half_even_4(total)}


def build_expected(inventory: dict, source: dict[str, Fraction], observation: dict[str, object]) -> dict[str, object]:
    gwp = {"CO2": source["E524"], "CH4": source["E525"], "N2O": source["E526"],
           "HFC-134a": source["E532"], "HFC-227ea": source["E538"], "R-410A": source["D575"]}
    def natural(q: str):
        value = Fraction(q)
        return {"CO2": value * source["E38"], "CH4": value * source["F38"] / 1000,
                "N2O": value * source["G38"] / 1000}
    def mobile(gallons: str, miles: str):
        return {"CO2": Fraction(gallons) * source["D107"], "CH4": Fraction(miles) * source["F256"] / 1000,
                "N2O": Fraction(miles) * source["G256"] / 1000}
    def stationary(gallons: str):
        hhv = Fraction(gallons) * source["D55"]
        return {"CO2": hhv * source["E55"], "CH4": hhv * source["F55"] / 1000,
                "N2O": hhv * source["G55"] / 1000}
    cases = [
        _case("ng_representative", "natural_gas", {"quantityMmbtu": "1250.125"}, natural("1250.125"), gwp),
        _case("ng_zero", "natural_gas", {"quantityMmbtu": "0.000"}, natural("0"), gwp),
        _case("ng_tie_even_lower", "natural_gas", {"quantityMmbtu": "0.100"}, natural("0.100"), gwp),
        _case("ng_tie_odd_lower", "natural_gas", {"quantityMmbtu": "0.300"}, natural("0.300"), gwp),
        _case("mobile_representative", "mobile_diesel", {"quantityGallons": "1000.125", "distanceMiles": "12000.500"}, mobile("1000.125", "12000.500"), gwp),
        _case("mobile_zero", "mobile_diesel", {"quantityGallons": "0.000", "distanceMiles": "0.000"}, mobile("0", "0"), gwp),
        _case("mobile_tie_even_lower", "mobile_diesel", {"quantityGallons": "1.000", "distanceMiles": "2.400"}, mobile("1", "2.4"), gwp),
        _case("mobile_tie_odd_lower", "mobile_diesel", {"quantityGallons": "1.000", "distanceMiles": "0.800"}, mobile("1", "0.8"), gwp),
        _case("stationary_representative", "stationary_diesel", {"quantityGallons": "250.125"}, stationary("250.125"), gwp),
        _case("stationary_zero", "stationary_diesel", {"quantityGallons": "0.000"}, stationary("0"), gwp),
        _case("stationary_tie_odd_lower", "stationary_diesel", {"quantityGallons": "25.000"}, stationary("25"), gwp),
        _case("stationary_tie_even_lower", "stationary_diesel", {"quantityGallons": "75.000"}, stationary("75"), gwp),
    ]
    fugitive_cases = [("fugitive_hfc134a", "HFC-134a", "0.125000"), ("fugitive_hfc227ea", "HFC-227ea", "2.500003"),
                      ("fugitive_r410a", "R-410A", "2.500000"), ("fugitive_zero", "HFC-134a", "0"),
                      ("fugitive_tie_odd_lower", "HFC-227ea", "0.000001"), ("fugitive_tie_even_lower", "HFC-227ea", "0.000003")]
    for case_id, gas, amount in fugitive_cases:
        cases.append(_case(case_id, "fugitive", {"gas": gas, "refillKg": amount}, {gas: Fraction(amount)}, gwp))
    first = next(c for c in cases if c["id"] == "fugitive_tie_odd_lower")
    second = next(c for c in cases if c["id"] == "fugitive_tie_even_lower")
    round_once = []
    for name, component in [("two_odd_lower_ties", first), ("two_even_lower_ties", second)]:
        exact_sum = Fraction(component["kgCo2eExact"]) * 2
        displayed_sum = Fraction(component["kgCo2eDisplay"]) * 2
        aggregate_display = half_even_4(exact_sum)
        round_once.append({"id": name, "componentExact": component["kgCo2eExact"], "componentDisplay": component["kgCo2eDisplay"],
                           "kgCo2eExact": exact(exact_sum), "kgCo2eDisplay": aggregate_display,
                           "sumOfDisplayedSources": exact(displayed_sum),
                           "displayRoundingDelta": exact(Fraction(aggregate_display) - displayed_sum)})
    blend_mass = Fraction("2.5")
    return {"schemaVersion": 1, "taskId": "M79-NUMERICAL-COMPATIBILITY-01", "status": "candidate_not_released",
            "sourceObservation": observation,
            "sourceInventorySha256": digest(INVENTORY_PATH), "workbookSha256": WORKBOOK_HASH,
            "methodPins": METHOD_HASHES, "enginePins": ENGINE_HASHES,
            "profileCount": len(inventory["profiles"]), "rowCount": sum(len(p["rows"]) for p in inventory["profiles"]),
            "roundingPolicy": "round-half-to-even once at four decimal kg CO2e",
            "cases": cases, "roundOnceAggregation": round_once,
            "unitChecks": {"naturalGasCh4OneMmbtuKg": exact(source["F38"] / 1000),
                           "naturalGasN2oOneMmbtuKg": exact(source["G38"] / 1000),
                           "stationaryDieselOneGallonHhvMmbtu": exact(source["D55"]),
                           "mobileCh4OneMileKg": exact(source["F256"] / 1000),
                           "mobileN2oOneMileKg": exact(source["G256"] / 1000)},
            "r410aOpaqueBlend": {"massKg": exact(blend_mass), "publishedWholeBlendGwp": exact(gwp["R-410A"]),
                                 "kgCo2eExact": exact(blend_mass * gwp["R-410A"]),
                                 "constituentComparisonGwpNotUsed": "1923.5",
                                 "comparisonKgCo2eNotUsed": exact(blend_mass * Fraction("1923.5")),
                                 "constituentMassesInferred": False},
            "boundaryExpectations": {"missingActivity": "no calculation", "unsupportedUnitsOrGas": "refuse",
                                     "combustionNegativeActivity": "refuse", "mobileMixedZero": "no calculation",
                                     "stationaryDefaultHhv": "estimate only after explicit unavailable supplier HHV/carbon facts",
                                     "fugitiveZero": "explicit zero evidence plus all eligibility declarations",
                                     "linkedKnownRelease": "reconcile to refill; do not add release mass"},
            "claims": {"sourceApproved": False, "methodApproved": False, "rightsApproved": False,
                       "domainApproved": False, "customerReady": False, "productionReleased": False,
                       "scope1Complete": False, "legalOrAssuranceConclusion": False}}


def _natural_input(q: str) -> dict:
    return {"binding": UUIDS, "period": PERIOD, "fuel": "Natural Gas", "heatBasis": "HHV", "unit": "MMBtu",
            "quantityMmbtu": q, "statementSha256": "b" * 64}


def _mobile_input(gallons: str, miles: str) -> dict:
    return {"binding": UUIDS, "period": PERIOD,
            "vehicle": {"assetId": "TRUCK-1", "vehicleClass": "Medium- and Heavy-Duty Vehicles",
                        "classificationBasis": "Retained fictional classification basis.", "modelYear": 2018,
                        "fuel": "Fossil Diesel", "controlBasis": "owned_operational_control_full_year"},
            "quantityGallons": gallons, "quantityUnit": "US_gallon", "distanceMiles": miles,
            "distanceUnit": "vehicle_mile", "fuelStatementSha256": "c" * 64, "mileageStatementSha256": "d" * 64}


def _stationary_input(gallons: str) -> dict:
    return {"binding": UUIDS, "period": PERIOD,
            "equipment": {"assetId": "GEN-1", "identifierBasis": "Retained fictional asset identity.",
                          "equipmentType": "stationary_emergency_generator", "engineType": "compression_ignition",
                          "stationaryInstallation": "fixed", "controlBasis": "owned_operational_control_full_year",
                          "controlExplanation": "Retained fictional operational-control basis.",
                          "fuel": "Fossil Distillate Fuel Oil No. 2", "fossilFraction": "1.000",
                          "fuelGradeBasis": "Retained fictional grade basis."},
            "unit": "US_gallon", "quantityGallons": gallons, "statementSha256": "e" * 64}


def _fugitive_input(gas: str, amount: str, *, linked_release: bool = False) -> dict:
    equipment = {"R-410A": "fixed_hvac", "HFC-134a": "fixed_refrigeration", "HFC-227ea": "fixed_fire_suppression"}.get(gas, "fixed_hvac")
    zero = Fraction(amount) == 0
    refills = [] if zero else [{"id": "REFILL-1", "date": "2025-06-02", "kg": amount,
                                "contractor": "CONTRACTOR-1", "reference": "SERVICE-1"}]
    releases = []
    if linked_release:
        releases = [{"id": "RELEASE-1", "date": "2025-06-01", "kg": "1.000000", "evidence": "LOSS-1",
                     "refill_id": "REFILL-1", "preceded_refill_verified": True}]
    return {"year": 2025, "asset_id": "ASSET-1", "gas": gas, "equipment": equipment, "unit": "kg",
            "opening_date": "2025-01-01", "closing_date": "2025-12-31", "opening_capacity": "10.000000",
            "closing_capacity": "10.000000",
            "declarations": {k: True for k in ["full_year_operational_control", "california_office_or_distribution",
                "no_installation_retirement_or_retrofit", "no_stocks_recovery_reuse_or_transfer",
                "complete_all_provider_service_records", "all_known_releases_recorded", "opening_full_charge_verified",
                "closing_full_charge_verified"]},
            "evidence": {"asset_identity": "ASSET-EVIDENCE", "capacity": "CAPACITY-EVIDENCE",
                         "opening_full_charge": "OPENING-EVIDENCE", "closing_full_charge": "CLOSING-EVIDENCE",
                         "annual_contractor_record": "ANNUAL-EVIDENCE"},
            "refills": refills, "releases": releases, "zero_activity_evidence": "ZERO-EVIDENCE" if zero else None,
            "uncertainty": "Candidate servicing estimate; retained evidence is not independently authenticated."}


def _invoke_script(path: Path, payload: dict) -> tuple[int, dict]:
    result = subprocess.run([sys.executable, str(path)], input=canonical(payload), text=True, capture_output=True, check=False)
    return result.returncode, json.loads(result.stdout)


def _invoke_fugitive(input_value: dict) -> tuple[int, dict]:
    wrapper = ("import json,runpy,sys\nmodule=runpy.run_path(sys.argv[1])\ntry:\n result=module['calculate'](json.load(sys.stdin))\n"
               " print(json.dumps({'status':'ok','record':result},sort_keys=True,separators=(',',':')))\n"
               "except module['UnsupportedFugitiveInput'] as error:\n print(json.dumps({'status':'unsupported','message':str(error)}));sys.exit(2)\n")
    result = subprocess.run([sys.executable, "-I", "-c", wrapper, str(ENGINE_PATHS["fugitive"])],
                            input=canonical(input_value), text=True, capture_output=True, check=False)
    return result.returncode, json.loads(result.stdout)


def compare_engines(expected: dict) -> dict[str, object]:
    observed = []
    for case in expected["cases"]:
        family = case["family"]
        activity = case["activity"]
        if family == "natural_gas":
            code, body = _invoke_script(ENGINE_PATHS[family], {"action": "calculate", "input": _natural_input(activity["quantityMmbtu"])})
            record = body.get("record", {})
            actual_rows = [{"gas": gas.upper(), "massKgExact": row["mass"], "co2eKgExact": row["co2e"]}
                           for gas, row in record.get("gasResults", {}).items()]
            actual_exact, actual_display = record.get("total", {}).get("unrounded"), record.get("total", {}).get("display")
        elif family == "mobile_diesel":
            code, body = _invoke_script(ENGINE_PATHS[family], {"action": "calculate", "input": _mobile_input(activity["quantityGallons"], activity["distanceMiles"])})
            record = body.get("record", {})
            actual_rows = [{"gas": gas.upper(), "massKgExact": row["mass"], "co2eKgExact": row["co2e"]}
                           for gas, row in record.get("gasResults", {}).items()]
            actual_exact, actual_display = record.get("total", {}).get("unrounded"), record.get("total", {}).get("display")
        elif family == "stationary_diesel":
            code, body = _invoke_script(ENGINE_PATHS[family], {"action": "calculate", "input": _stationary_input(activity["quantityGallons"])})
            record = body.get("record", {})
            actual_rows = [{"gas": gas.upper(), "massKgExact": row["mass"], "co2eKgExact": row["co2e"]}
                           for gas, row in record.get("gasResults", {}).items()]
            actual_exact, actual_display = record.get("total", {}).get("unrounded"), record.get("total", {}).get("display")
        else:
            code, body = _invoke_fugitive(_fugitive_input(activity["gas"], activity["refillKg"]))
            record = body.get("record", {})
            actual_rows = [{"gas": record.get("gas"), "massKgExact": record.get("estimated_emitted_kg"),
                            "co2eKgExact": record.get("kg_co2e_exact")}]
            actual_exact, actual_display = record.get("kg_co2e_exact"), record.get("kg_co2e_display")
        expected_rows = sorted(case["gasRows"], key=lambda x: x["gas"])
        actual_rows = sorted(actual_rows, key=lambda x: x["gas"] or "")
        passed = code == 0 and body.get("status") == "ok" and expected_rows == actual_rows and case["kgCo2eExact"] == actual_exact and case["kgCo2eDisplay"] == actual_display
        observed.append({"id": case["id"], "family": family, "pass": passed, "expectedExact": case["kgCo2eExact"],
                         "actualExact": actual_exact, "expectedDisplay": case["kgCo2eDisplay"], "actualDisplay": actual_display,
                         "gasRowsMatch": expected_rows == actual_rows, "exitCode": code})
    boundaries = []
    invalids = [
        ("natural_missing_quantity", "natural_gas", lambda: _invoke_script(ENGINE_PATHS["natural_gas"], {"action": "calculate", "input": {k: v for k, v in _natural_input("1.000").items() if k != "quantityMmbtu"}})),
        ("natural_unsupported_scf", "natural_gas", lambda: _invoke_script(ENGINE_PATHS["natural_gas"], {"action": "calculate", "input": dict(_natural_input("1.000"), unit="scf")})),
        ("mobile_unsupported_class", "mobile_diesel", lambda: _invoke_script(ENGINE_PATHS["mobile_diesel"], {"action": "calculate", "input": {**_mobile_input("1.000", "1.000"), "vehicle": {**_mobile_input("1.000", "1.000")["vehicle"], "vehicleClass": "Passenger Cars"}}})),
        ("stationary_supplier_hhv_unit", "stationary_diesel", lambda: _invoke_script(ENGINE_PATHS["stationary_diesel"], {"action": "calculate", "input": dict(_stationary_input("1.000"), unit="MMBtu")})),
        ("fugitive_unsupported_gas", "fugitive", lambda: _invoke_fugitive(_fugitive_input("SF6", "1.000000"))),
        ("fugitive_wrong_equipment", "fugitive", lambda: _invoke_fugitive(dict(_fugitive_input("R-410A", "1.000000"), equipment="fixed_refrigeration"))),
    ]
    for case_id, family, invoke in invalids:
        code, body = invoke()
        boundaries.append({"id": case_id, "family": family, "pass": code == 2 and body.get("status") in {"error", "unsupported"},
                           "exitCode": code, "status": body.get("status"), "message": body.get("message")})
    code, linked = _invoke_fugitive(_fugitive_input("HFC-227ea", "2.000000", linked_release=True))
    linked_record = linked.get("record", {})
    boundaries.append({"id": "fugitive_linked_release_not_added", "family": "fugitive",
                       "pass": code == 0 and linked_record.get("estimated_emitted_kg") == "2" and linked_record.get("kg_co2e_exact") == "6700" and linked_record.get("known_release_count") == 1,
                       "exitCode": code, "estimatedEmittedKg": linked_record.get("estimated_emitted_kg"),
                       "kgCo2eExact": linked_record.get("kg_co2e_exact"), "knownReleaseCount": linked_record.get("known_release_count")})
    return {"engineCases": observed, "engineBoundaryCases": boundaries}


def write_snapshot() -> None:
    paths = [
        "evaluations/calculation-specs/m79-numerical-compatibility.py",
        "evaluations/calculation-specs/m79-numerical-expected.json",
        "evaluations/calculation-specs/m79-numerical-result.json",
        "evaluations/calculation-specs/m79-numerical-boundaries.test.ts",
        "docs/research/m79-numerical-compatibility.md",
    ]
    files = []
    for relative in paths:
        path = ROOT / relative
        raw = path.read_bytes()
        files.append({"path": relative, "sha256": sha256(raw).hexdigest(), "text": raw.decode("utf-8")})
    snapshot = {"schemaVersion": 1, "taskId": "M79-NUMERICAL-COMPATIBILITY-01",
                "status": "candidate1_pending_independent_review", "createdAt": "2026-09-22",
                "files": files}
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    assert len(inventory["profiles"]) == 4 and sum(len(p["rows"]) for p in inventory["profiles"]) == 12
    for profile in inventory["profiles"]:
        assert profile["methodIdentity"]["engineSha256"] == ENGINE_HASHES[profile["family"]]
    for family, path in ENGINE_PATHS.items():
        assert digest(path) == ENGINE_HASHES[family]
    source, observation = source_values(inventory)
    expected = build_expected(inventory, source, observation)
    expected_text = json.dumps(expected, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if EXPECTED_PATH.exists():
        assert EXPECTED_PATH.read_text(encoding="utf-8") == expected_text, "retained M79 expectations changed"
    else:
        EXPECTED_PATH.write_text(expected_text, encoding="utf-8", newline="\n")
    comparison = compare_engines(expected)
    passes = all(x["pass"] for x in comparison["engineCases"] + comparison["engineBoundaryCases"])
    result = {"schemaVersion": 1, "taskId": "M79-NUMERICAL-COMPATIBILITY-01",
              "status": "pass_candidate_numerical_compatibility" if passes else "fail_candidate_numerical_compatibility",
              "expectedSha256": sha256(expected_text.encode()).hexdigest(), "enginePins": ENGINE_HASHES,
              "sourceInventorySha256": digest(INVENTORY_PATH), **comparison,
              "summary": {"profiles": 4, "rows": 12, "engineCases": len(comparison["engineCases"]),
                          "boundaryCases": len(comparison["engineBoundaryCases"]),
                          "failures": [x["id"] for x in comparison["engineCases"] + comparison["engineBoundaryCases"] if not x["pass"]]},
              "releaseEligible": False, "productionReleased": False, "scope1Complete": False}
    RESULT_PATH.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    assert passes, result["summary"]
    write_snapshot()
    print(f"PASS M79: 4 profiles, 12 rows, {len(comparison['engineCases'])} numerical cases, {len(comparison['engineBoundaryCases'])} engine boundaries")


if __name__ == "__main__":
    main()
