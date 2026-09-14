"""Build the unapproved EPA paragraph candidate offline; never promote a release.

The source is an already retained, pinned EPA PDF. This script requires pypdf,
performs no network/model calls, and writes UTF-8/LF artifacts without replacing
different existing bytes. QA must compare the extraction with the original PDF.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import unicodedata

import pypdf
from pypdf import PdfReader

VERSION = "1.0.0"
BASE_HASH = "5e735bba3c029f2c41c94edb12fd57ff13c4859047446be520fc3a81533b8d99"
SOURCE_HASH = "14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3"
NORMALIZATION = "nfkc_whitespace_v1"
SEPARATOR = "\n\n"
SOURCE_ID = "epa-electricity-2023"
EXTRACTION_ID = "epa-electricity-2023-pages-v1"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def spec(identifier, title, coverage, spans, dependencies=(), qualifications=(), exclusions=()):
    return dict(id=identifier, title=title, coverage=list(coverage), selectors=spans,
                required_passage_ids=list(dependencies), qualifications=list(qualifications),
                exclusions=list(exclusions))


# Start/end strings identify complete sentences/paragraphs in normalized pages.
# The units card deliberately stops after the complete electricity-units sentence;
# subsequent thermal-energy conversion text is outside this release's scope.
SPECS = [
    spec("S01", "Two accounting perspectives for purchased electricity",
         ["accounting_methods", "scope2_reporting"],
         [(4, "The GHG Protocol Scope 2 Guidance provides", "such as renewable energy.")],
         qualifications=["This guidance explains U.S. grid-delivered purchased electricity; it does not determine a company's legal duties."],
         exclusions=["global reporting obligations", "legal applicability", "special supply cases"]),
    spec("S02", "Distinct labels for the two reported results",
         ["scope2_reporting", "accounting_methods"],
         [(9, "Organizations should calculate and report", "used.")], ["S01"],
         ["EPA's reporting recommendation is not a universal legal obligation."],
         ["filing requirements", "company-specific mandatory reporting"]),
    spec("S03", "Electricity purchase records for an inventory period",
         ["activity_evidence", "reporting_period"],
         [(7, "To quantify scope 2 emissions", "incomplete.")],
         qualifications=["This preview explains record collection; it does not prepare an inventory or estimate missing consumption."],
         exclusions=["customer bill uploads", "estimating missing consumption"]),
    spec("S04", "Separate supplier and delivery invoices without duplicate consumption",
         ["activity_evidence", "data_quality"],
         [(7, "Commodity electricity may be purchased", "included in the activity data.")], ["S03"],
         ["Check supplier and delivery invoices for the same consumption; this preview cannot diagnose your records."],
         ["customer transaction diagnosis"]),
    spec("S05", "Units appearing in electricity activity records",
         ["electricity_units", "activity_evidence"],
         [(8, "The units of measure in which activity data", "megawatt-hours (MWh) are most common.")],
         qualifications=["This preview covers electricity units; it does not convert units or cover purchased heat, steam or cooling."],
         exclusions=["unit conversion calculations", "steam heat or cooling units"]),
    spec("S06", "Generation boundary of a purchased-energy factor",
         ["factor_boundaries", "factor_documentation"],
         [(8, "Emission factors are necessary", "activities upstream of the generation facility.")],
         qualifications=["These boundaries concern purchased grid electricity. Calculations of upstream emissions or transmission losses need separate methods."],
         exclusions=["Scope 3 calculations", "life-cycle factor selection", "steam heat or cooling methods"]),
    spec("S07", "Regional grid geography for factor discovery",
         ["grid_factor_sources", "factor_geography"],
         [(9, "If an organization purchases electricity that is delivered through a grid", "representing a grid distribution area.")], ["S06"],
         ["Facility location matters; this preview does not assign a subregion or select a factor."],
         ["company subregion assignment", "direct-line supply"]),
    spec("S08", "EPA eGRID as the U.S. regional data source",
         ["grid_factor_sources", "factor_geography"],
         [(9, "Regional factors are available for several countries", "isolated by transmission constraints.")], ["S07"],
         ["Check the source edition and its data year before use; this preview does not supply current numerical factors."],
         ["latest eGRID release", "numeric emission rates", "international factor selection"]),
    spec("S09", "EPA publication channels and their update timing",
         ["grid_factor_sources", "source_versions"],
         [(9, "EPA publishes a GHG Emission Factors Hub", "available at https://www.epa.gov/egrid.")], ["S08"],
         ["Dataset versions and factor values need a current check of EPA's publication pages."],
         ["latest dataset assertions", "automatic source updates"]),
    spec("S10", "Publisher tool for researching the grid subregion",
         ["grid_factor_sources", "factor_geography"],
         [(10, "To determine in which eGRID subregion", "the appropriate eGRID subregions.")], ["S07"],
         ["This is EPA's documented lookup route; a current facility lookup still needs verification."],
         ["interactive subregion lookup", "company factor selection"]),
    spec("S11", "Market evidence relates to the electricity product purchased",
         ["market_factor_sources", "supplier_factor_sources"],
         [(10, "The market-based method considers contractual arrangements", "on the precision of the factors.")], ["S06"],
         ["Supplier information must be assessed with the relevant quality conditions; this preview does not determine eligibility or choose a fallback factor."],
         ["complete hierarchy selection", "instrument eligibility", "current residual-mix availability"]),
    spec("S12", "Supplier-specific factor must describe the delivered product",
         ["supplier_factor_sources", "factor_boundaries", "factor_documentation"],
         [(10, "An electricity supplier, such as a regulated utility", "the full set of generation facilities supplying the delivered electricity")],
         ["S11", "S15"],
         ["The factor should describe the electricity delivered for the relevant product and period; receiving it does not establish eligibility."],
         ["supplier eligibility certification", "customer product diagnosis", "numeric factor selection"]),
    spec("S13", "Certificate documentation conveys source attributes with conditions",
         ["market_factor_sources", "contractual_evidence"],
         [(10, "If an energy attribute certificate carries with it", "fossil-fuel or biomass generation component).")], ["S11"],
         ["Certificate conditions need review. No conclusion about eligibility, zero emissions or biomass accounting is made here."],
         ["detailed quality criteria", "certificate eligibility", "zero-emissions claims", "biomass accounting"]),
    spec("S14", "Contracts and separately issued certificates are different evidence",
         ["market_factor_sources", "contractual_evidence"],
         [(10, "An organization may have a contract, such as", "or the regional or national factor.")], ["S11", "S13"],
         ["Check who retains the certificates and which conditions apply. Contract eligibility, direct-line cases and fallback factors require separate review."],
         ["contract eligibility", "direct-line methods", "fallback-factor selection", "current residual-mix availability"]),
    spec("S15", "Reporting periods and purchasing agreements may cover different dates",
         ["reporting_period", "supplier_factor_sources", "factor_time_periods"],
         [(11, "An organization should consider the alignment", "covered by any purchasing agreement.")],
         qualifications=["Compare the reporting dates with the agreement's coverage. This preview does not allocate a company's purchases or factors."],
         exclusions=["company factor allocation", "emissions calculation"]),
    spec("S16", "Factor revisions and the EPA guidance's timing recommendation",
         ["source_versions", "factor_time_periods"],
         [(12, "All scope 2 emission factors represent", "adjusted to reflect new factors."),
          (12, "5 This applies whether an organization uses", "the newest factors available in August.")], ["S17", "S18"],
         ["This is EPA's timing recommendation for this guidance. Keep factor data year, calculation date and inventory period distinct; do not treat it as a universal rule or selection of a current factor."],
         ["numeric factor selection", "historical inventory recalculation", "latest-release assertion"]),
    spec("S17", "Methodology changes differ from ordinary factor updates",
         ["source_versions", "factor_time_periods"],
         [(12, "At times, there may be changes in the methodology", "the organization’s base year adjustment policy.")],
         qualifications=["Applying a base-year policy or recalculating a historical inventory requires separate review."],
         exclusions=["base-year policy determination", "historical inventory recalculation"]),
    spec("S18", "Timing and averaging limit factor accuracy",
         ["data_quality", "factor_time_periods"],
         [(17, "The accuracy of calculating emissions from purchased electricity is also", "data may be out of date.")],
         qualifications=["A factor can have timing and averaging limitations; this preview does not quantify their effect or certify a dataset."],
         exclusions=["uncertainty calculations", "current dataset quality certification"]),
]


def immutable_write(path: Path, content: bytes) -> None:
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f"Refusing to replace different existing bytes: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(content)


def build(base_path: Path, extraction_path: Path, created_at: str):
    base_bytes = base_path.read_bytes()
    if digest(base_bytes) != BASE_HASH:
        raise ValueError("Frozen v2 base hash mismatch")
    base = json.loads(base_bytes)
    source = copy.deepcopy(next(s for s in base["sources"] if s["id"] == SOURCE_ID))
    raw = Path(source["local_path"]).read_bytes()
    if digest(raw) != SOURCE_HASH or len(raw) != source["bytes"]:
        raise ValueError("Pinned original EPA source mismatch")
    reader = PdfReader(source["local_path"])
    wanted = sorted({n for item in SPECS for n, _, _ in item["selectors"]})
    pages = {n: normalize(reader.pages[n - 1].extract_text()) for n in wanted}
    extraction = dict(source_sha256=SOURCE_HASH, normalization=NORMALIZATION,
                      pages=[dict(pdf_page_1_based=n, text=pages[n]) for n in wanted])
    extraction_bytes = encode(extraction)
    passages = []
    for item in SPECS:
        spans, parts = [], []
        for number, start, end in item["selectors"]:
            text = pages[number]
            if text.count(start) != 1:
                raise ValueError(f"Ambiguous start for {item['id']}")
            a = text.index(start)
            z = text.index(end, a) + len(end)
            selected = text[a:z]
            spans.append(dict(pdf_page_1_based=number, printed_page=str(number - 3),
                              context_start=a, context_end_exclusive=z,
                              normalized_page_sha256=digest(text.encode("utf-8")),
                              context_sha256=digest(selected.encode("utf-8"))))
            parts.append(selected)
        text = SEPARATOR.join(parts)
        locator = "; ".join(f"PDF page {s['pdf_page_1_based']} / printed page {s['printed_page']}" for s in spans)
        passages.append(dict(id=item["id"], source_id=SOURCE_ID, extraction_id=EXTRACTION_ID,
                             title=item["title"], coverage=item["coverage"], text=text,
                             sha256=digest(text.encode("utf-8")), locator=locator,
                             locator_detail=dict(normalization=NORMALIZATION, separator=SEPARATOR,
                                                 offset_unit="unicode_code_points", spans=spans),
                             required_passage_ids=item["required_passage_ids"],
                             qualifications=item["qualifications"], exclusions=item["exclusions"],
                             applicability="U.S. grid-delivered purchased electricity; conceptual research only; EPA December 2023 guidance",
                             source_method="Exact normalized original sentences/paragraphs; no model extraction or authored replacement text",
                             review_status="pending", rights_scope="pending_internal_research_evaluation_only"))
    ids = {p["id"] for p in passages}
    lookup = {p["id"]: p for p in passages}

    def closure(identifier, stack=()):
        if identifier not in ids or identifier in stack:
            raise ValueError("Missing or cyclic passage dependency")
        found = {identifier}
        for dep in lookup[identifier]["required_passage_ids"]:
            found |= closure(dep, stack + (identifier,))
        return found

    closures = {p["id"]: closure(p["id"]) for p in passages}
    source.update(rights_review="pending", review_status="pending",
                  role="paragraph-corpus candidate; expanded text use pending independent review",
                  rights_scope="pending_internal_research_evaluation_only",
                  intended_use="Candidate private internal research/evaluation use of the selected exact EPA paragraphs, including selected paragraph input to configured Anthropic; independent approval pending",
                  rights_basis="Selected EPA explanatory prose only; the attributed Section 4 GHG Protocol criteria, third-party tables/graphics and branding are excluded. EPA permits noncommercial/scientific/educational use with individual-document caveats. Exact paragraph transmission requires independent scoped review; no blanket commercial permission is asserted.",
                  rights_decision="Prior approval covered selected short statements only; these exact EPA paragraphs and configured-model use need independent scoped review. Section 4's attributed GHG Protocol list is excluded.")
    exclusions = list(base["scope"]["excluded"]) + [
        "Detailed contractual quality criteria, procurement eligibility and certification",
        "Complete market-factor hierarchy or fallback selection",
        "Carbon-neutrality, zero-emissions and avoided-emissions claims",
        "Current source-version assertions without a fresh released status source",
        "Customer uploads, actual record interpretation and company subregion lookup",
    ]
    release = dict(schema_version=2, release_id="scope2-passages", version="1", status="candidate",
                   created_at=created_at,
                   scope=dict(jurisdictions=["US"], allowed_actions=["conceptual_research"],
                              topics=sorted({c for p in passages for c in p["coverage"]}), exclusions=exclusions),
                   review=dict(author="regulatory-research", reviewer=None, reviewed_at=None,
                               expires_at=base["review"]["expires_at"], approved_passage_ids=[],
                               status="pending_independent_qa",
                               expires_at_meaning="Operational review deadline, not source expiration or regulatory effective date",
                               based_on_source_release_sha256=BASE_HASH,
                               intended_approval_scope="Private internal research/evaluation and selected paragraph input to configured Anthropic only; no commercial clearance"),
                   intended_use="Private internal source/evaluation pilot only; expanded text approval pending",
                   commercial_runtime_approval=False, sources=[source],
                   extractions=[dict(id=EXTRACTION_ID, source_id=SOURCE_ID, source_sha256=SOURCE_HASH,
                                     local_path=extraction_path.resolve().as_posix(), sha256=digest(extraction_bytes),
                                     format="normalized_pages_json_v1", normalization=NORMALIZATION,
                                     tool=dict(name="pypdf", version=pypdf.__version__),
                                     extractor=dict(name="extract_scope2_passages.py", version=VERSION),
                                     review_status="pending")], passages=passages,
                   author_checks=dict(original_hash="matched", exact_span_assembly="matched", dependency_cycles="none",
                                      independent_review="pending", model_calls="none",
                                      contains_ghgp_section4="no selected page or passage from Section 4"),
                   publisher_checks=[
                       dict(url="https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance", checked_on="2026-09-09", result="Publisher page still links December 2023 electricity guidance; original bytes reused, not redownloaded."),
                       dict(url="https://www.epa.gov/egrid/detailed-data", checked_on="2026-09-09", result="Official data and historical-resource entry point accessible; no latest-version assertion selected."),
                       dict(url="https://www.epa.gov/egrid/power-profiler", checked_on="2026-09-09", result="Publisher page accessible; text reader showed loading shell; interactive lookup not tested."),
                       dict(url="https://www.epa.gov/web-policies-and-procedures/epa-disclaimers", checked_on="2026-09-09", result="Individual/third-party rights caveats retained; no blanket commercial permission claimed."),
                   ])
    catalog = [{k: p[k] for k in ("id", "title", "coverage", "applicability", "exclusions", "required_passage_ids")} for p in passages]
    summary = dict(passages=len(passages), selected_text_utf8_bytes=sum(len(p["text"].encode("utf-8")) for p in passages),
                   catalog_compact_utf8_bytes=len(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")).encode("utf-8")),
                   largest_single_dependency_closure_text_bytes=max(sum(len(lookup[i]["text"].encode("utf-8")) for i in c) for c in closures.values()),
                   extraction_sha256=digest(extraction_bytes), extraction_bytes=len(extraction_bytes),
                   selected_pdf_pages=wanted)
    return release, extraction_bytes, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-release", type=Path, required=True)
    parser.add_argument("--extraction", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--created-at", required=True, help="Explicit ISO timestamp, preserved for reproducible output")
    args = parser.parse_args()
    release, extraction, summary = build(args.base_release, args.extraction, args.created_at)
    output = encode(release)
    # Check both immutable destinations before writing either.
    for path, content in [(args.extraction, extraction), (args.output, output)]:
        if path.exists() and path.read_bytes() != content:
            raise ValueError(f"Refusing to replace different existing bytes: {path}")
    immutable_write(args.extraction, extraction)
    immutable_write(args.output, output)
    summary.update(release_sha256=digest(output), release_bytes=len(output), approval="candidate_pending")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
