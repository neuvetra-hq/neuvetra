"""Reviewer-owned M78 expectations, using integer/Fraction arithmetic only.

No application or accounting-author fixture imports. These are explicitly chosen
fictional quantities, not a reconstruction of a hosted inventory.
"""
from fractions import Fraction as F
import json
from pathlib import Path


def exact(x):
    x = F(x)
    denominator = x.denominator
    a = b = 0
    while denominator % 2 == 0:
        denominator //= 2
        a += 1
    while denominator % 5 == 0:
        denominator //= 5
        b += 1
    assert denominator == 1, "Non-terminating decimal"
    places = max(a, b)
    scaled = abs(x.numerator) * (10 ** places // x.denominator)
    digits = str(scaled).zfill(places + 1)
    result = digits if not places else (digits[:-places] + "." + digits[-places:]).rstrip("0").rstrip(".")
    return ("-" if x < 0 else "") + result


def display(x):
    x = F(x)
    assert x >= 0
    whole, remainder = divmod(x.numerator * 10000, x.denominator)
    if remainder * 2 > x.denominator or remainder * 2 == x.denominator and whole % 2:
        whole += 1
    return str(whole // 10000) + "." + str(whole % 10000).zfill(4)


GWP = {"CO2": F(1), "CH4": F(28), "N2O": F(265), "R410A": F(1924), "HFC134a": F(1300), "HFC227ea": F(3350)}


def gas(q):
    q = F(q)
    return {"CO2": q * F("53.06"), "CH4": q * F("0.001"), "N2O": q * F("0.0001")}


def generator(q):
    hhv = F(q) * F("0.138")
    return {"CO2": hhv * F("73.96"), "CH4": hhv * F("0.003"), "N2O": hhv * F("0.0006")}


def vehicle(gallons, miles):
    return {"CO2": F(gallons) * F("10.21"), "CH4": F(miles) * F("0.0000095"), "N2O": F(miles) * F("0.0000431")}


def total(masses):
    return sum((mass * GWP[name] for name, mass in masses.items()), F(0))


def row(id, entity, facility, family, masses):
    t = total(masses)
    return {"id": id, "entity": entity, "facility": facility, "family": family,
            "emittedMassKg": {k: exact(v) for k, v in masses.items()},
            "unroundedKgCo2e": exact(t), "displayKgCo2e": display(t)}


def rollup(rows):
    masses = {}
    for r in rows:
        for name, mass in r["emittedMassKg"].items():
            masses[name] = masses.get(name, F(0)) + F(mass)
    t = total(masses)
    return {"sourceIds": sorted(r["id"] for r in rows), "emittedMassKg": {k: exact(v) for k, v in sorted(masses.items())},
            "unroundedKgCo2e": exact(t), "displayKgCo2e": display(t),
            "sumSourceDisplaysKgCo2e": exact(sum((F(r["displayKgCo2e"]) for r in rows), F(0))),
            "roundingDeltaKgCo2e": exact(F(display(t)) - sum((F(r["displayKgCo2e"]) for r in rows), F(0)))}


def build():
    rows = [row("ng-office", "parent", "office", "M73", gas("1250.125")),
            row("ng-distribution", "subsidiary", "distribution-subsidiary", "M73", gas("875.375")),
            row("generator", "parent", "distribution-parent", "M76", generator("250.125")),
            row("vehicle-one", "parent", "office", "M74", vehicle("1000.125", "12000.500")),
            row("vehicle-two", "subsidiary", "distribution-subsidiary", "M74", vehicle("500.375", "6000.125")),
            row("r410a-office", "parent", "office", "M77", {"R410A": F("1.25")}),
            row("r410a-distribution", "subsidiary", "distribution-subsidiary", "M77", {"R410A": F("0.75")}),
            row("hfc134a", "parent", "office", "M77", {"HFC134a": F("0.125")}),
            row("hfc227ea-office", "parent", "office", "M77", {"HFC227ea": F("0.000001")}),
            row("hfc227ea-distribution", "subsidiary", "distribution-subsidiary", "M77", {"HFC227ea": F("0.000003")})]
    ties = []
    for family, quantity, masses in [("M73", "0.100", gas("0.100")), ("M73", "0.300", gas("0.300")),
                                    ("M76", "25.000", generator("25")), ("M76", "75.000", generator("75")),
                                    ("M74", "gallons=1.000,miles=2.400", vehicle("1", "2.4")),
                                    ("M74", "gallons=1.000,miles=0.800", vehicle("1", "0.8")),
                                    ("M77", "HFC227ea=0.000001kg", {"HFC227ea": F("0.000001")}),
                                    ("M77", "HFC227ea=0.000003kg", {"HFC227ea": F("0.000003")})]:
        ties.append({"family": family, "quantity": quantity, "unrounded": exact(total(masses)), "display": display(total(masses))})
    assert [x["display"] for x in ties] == ["5.3114", "15.9344", "256.0004", "768.0010", "10.2380", "10.2194", "0.0034", "0.0100"]
    company = rollup(rows)
    facilities = {k: rollup([r for r in rows if r["facility"] == k]) for k in sorted({r["facility"] for r in rows})}
    entities = {k: rollup([r for r in rows if r["entity"] == k]) for k in sorted({r["entity"] for r in rows})}
    assert sum(F(v["unroundedKgCo2e"]) for v in facilities.values()) == F(company["unroundedKgCo2e"])
    assert sum(F(v["unroundedKgCo2e"]) for v in entities.values()) == F(company["unroundedKgCo2e"])
    assert rollup(rows[::-1]) == company
    assert sum(F(r["unroundedKgCo2e"]) for r in rows[:3]) == F("115456.15325175")
    assert exact(total(generator("999999999999.999"))) == "10240013999999.989759986"
    assert F("1.924") * 1000 == GWP["R410A"]
    return {"profile": "m78-reviewer-rational-expectations-v1", "status": "fictional_candidate_not_released",
            "workbookSha256": "43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7",
            "quantityDeclaration": "Independently chosen ten-source fixture; vehicle-two is not a hosted-baseline quantity.",
            "sourceCells": {"M73": ["E38", "F38", "G38"], "M74": ["D107", "F256", "G256"], "M76": ["D55", "E55", "F55", "G55"],
                            "GWP": ["E524", "E525", "E526", "E532", "E538", "D575"]},
            "gwp": {k: exact(v) for k, v in GWP.items()}, "sources": rows, "facilities": facilities, "entities": entities, "company": company,
            "halfEvenTies": ties, "maximumGenerator": row("maximum", "parent", "office", "M76", generator("999999999999.999")),
            "roundOnceCounterexamples": [{"case": "two NG sources at 0.100 MMBtu", "exactSum": "10.6229", "sumDisplays": "10.6228"},
                                             {"case": "two HFC227ea sources at 0.000001 kg", "exactSum": "0.0067", "sumDisplays": "0.0068"}],
            "blendConstraint": "R410A emitted blend mass uses 1924 exactly once; no constituent mass lines or 1923.5 alternate total."}


if __name__ == "__main__":
    output = Path(__file__).with_name("m78-independent-rational-expectations.json")
    candidate = json.dumps(build(), indent=2, sort_keys=True) + "\n"
    if output.exists():
        assert output.read_text(encoding="utf-8") == candidate, "Retained expectations differ"
    else:
        output.write_text(candidate, encoding="utf-8", newline="\n")
    print("PASS independent rational expectations: 10 sources, 3 facilities, 2 entities, 8 half-even ties; hierarchy/reordering/max checks")
