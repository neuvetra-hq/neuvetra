"""Scope 3 beta calculation engine: distance-, mass- and consumption-based methods from EPA sources.

One file so one SHA-256 identifies the engine. Every factor, GWP and constant comes from the verified
Scope 3 register pinned below (EPA GHG Emission Factors Hub, January 2025, Tables 8-11; eGRID2023 rev2).

Categories (GHG Protocol Corporate Value Chain (Scope 3) Standard):
- 3, activity C, transmission and distribution losses: consumed MWh x GGL / (1 - GGL) x eGRID subregion
  total output rate, the formula and subregion-to-interconnect mapping EPA's own Power Profiler uses
  (USEPA/power-profiler commit f42a47a: app/src/components/EmissionsCalculator.vue line 1005;
  prep/add_egrid_data.py lines 146-151).
  Combustion only: the upstream (cradle-to-gate) part of the lost electricity is not covered.
- 4 and 9, transportation and distribution, distance-based: Hub Table 8 (vehicle-mile when the vehicle is
  dedicated to the company's goods, short ton-mile when it is shared).
- 5 and 12, waste, waste-type-specific or average-data: Hub Table 9, metric tons CO2e per short ton, which
  EPA computed with AR4 GWPs and does not split by gas. A treatment EPA marks NA is not calculated.
- 6 and 7, business travel and employee commuting, distance-based: Hub Table 10.

Rules: quantities are plain decimals with up to 3 decimal places; unknown is never zero; arithmetic is
exact, except that a unit conversion needing a division is rounded once, half-even, to 12 decimal places
and listed in the result; one half-even rounding to 4 dp kg CO2e for display.

Scope 3 completion I-01 (engine foundation and throughput; DESIGN sections 4.1, 4.5, 4.6): the engine hash is computed
once per process; registers are a map of pinned files (only R1 here) chosen by factor-key prefix, and the ZIP table is
loaded only by the methods that need it; `calculate_many` serves many records from one process, each item exactly what
`calculate` returns; each method carries static metadata (method type, activity-data origin, default data quality,
biogenic treatment); the aggregate takes optional per-result annotations and adds per-category profiles. Every result of
the five existing methods is byte-identical to engine 969027f6 apart from `engineSha256` and `resultSha256` (A1; the
golden test `scope3_engine_golden_test.py` proves it).

Scope 3 completion I-03 part 1 (purchases; DESIGN 4.3, 4.4, 4.6, A12, A19-A21): register R2 (EPA Supply Chain GHG Emission
Factors v1.3, 2022 USD, AR5; BEA GDP implicit price deflator from FRED) joins the register map; categories 1 and 2 by
spend (and the spend-based fallback for 3, 4, 5, 6 and 9): amount x published factor x round12(I2022 / I(dollar year));
categories 1 and 2 from a supplier's own product factor or allocated emissions (supplier-specific), or from a secondary
factor the company typed in (average data), with the hybrid boundary "supplier scope 1 and 2 only". The aggregate fixes
the activity-data origin by method type (A19) and picks the unverified default data quality for unverified supplier or
partner data (A20).

Scope 3 completion I-05 (energy, commuting, leased assets, partner data; DESIGN 4.3, 4.4, 4.6, A15, A28): register R3 (Hub
2025 Table 1 stationary combustion, Tables 11 and 12 AR5 GWPs; eGRID2023 rev2 U.S. rates, subregion net generation and
plant heat input) joins the register map, its constants routed by the `supplement_const.` prefix. Category 3D (energy
bought and resold: combustion of its generation, eGRID subregion or U.S. rates; partial until its upstream line is
loaded), category 7 average-data commuting (headcount x mode share x one-way distance x 2 x working days) and teleworking
(incremental home electricity or natural gas), asset-specific energy and refrigerant use for categories 4, 8, 9, 10, 13
and 14 (area allocation rounded once), and partner-reported scope 1 and 2 totals with an allocated share (as reported).
The aggregate's category profiles add the deflation effect, the share of the known-source total and the largest single
result's share of the category.

Scope 3 completion I-12u (category 3 upstream from US free sources; DESIGN 13): register R5 (hand transcriptions, two
agreeing verbatim reads each: NETL DOE/NETL-2024/4862 natural gas supply chain, HHV, IPCC AR6 as published; CA-GREET3.0
Lookup Table TSD upstream carbon intensities and CARB LCFS energy densities, both LHV, GWP inferred AR4) joins the register
map. 3A: Scope 1 natural gas energy (the Scope 1 engine's own rules) x NETL production-through-distribution, and liquid fuels
as gallons x energy density x upstream carbon intensity. 3B, 3C upstream and 3D upstream: MWh (consumed, lost as in 3C, or
resold) x U(s), the eGRID2023 heat input per MWh generated of each fuel with a verified upstream factor (natural gas: NETL
production through transmission); fuels without one leave the line partial and are named. The aggregate pairs each 3C and
3D combustion line with its upstream line (`boundaryClosures`); a closed line is no longer a partial-boundary result.

Round 2, lane A (ROUND2.md owner decisions 1-4; ACC-5, ACC-7, ACC-14, ACC-17, ENG-7, ENG-8, ENG-12): one declarative method
registry (METHOD_REGISTRY: kind, calculator, methods) checked at import, with no runtime patching; every calculation and
aggregate in a context that traps Inexact, so the only roundings are the listed ROUNDING_STEPS. The envelope is 2025-2026 (a
later period discloses `factor_vintage_precedes_period`; a dollar year without a published deflator uses the latest published
one, disclosed). Oil-fired generation is mapped with the CA-GREET3.0 ULSD upstream converted to HHV; coal stays unmapped (no
free source prints a value with a stated basis; round-3 transcriptions reviewed) and every upstream electricity line memos the
fossil heat input not mapped; a subregion with fossil heat input but nothing mapped is held, one without fossil heat input is a
stated zero; OTHF is an unmapped other fuel, not fossil; the nuclear, biomass and renewable note is static. Buildings by floor
area are partial; natural gas products take therms; pipeline natural gas sold is not a transport fuel, propane is.
"""
from __future__ import annotations

import csv
import datetime
import hashlib
import io
import json
import re
import sys
from decimal import Context, Decimal, DivisionByZero, Inexact, InvalidOperation, Overflow, ROUND_HALF_EVEN, localcontext
from fractions import Fraction
from pathlib import Path

REGISTER_SHA256 = '5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2'
REFERENCE_DIR = Path(__file__).resolve().parents[4] / 'packages' / 'neuvetra-database' / 'src' / 'method-reference'
REGISTER_PATH = REFERENCE_DIR / 'verified-scope3-register-2025.json'
ZIP_PATH = REFERENCE_DIR / 'egrid2023-zip-subregion-utility.csv'
ZIP_SHA256 = '7c661b453465ed6a0c456e30ea16604e52ab648c106ace1ec4b2e1e39092426e'  # same EPA Power Profiler table as Scope 2
# R2 (I-03): built by tools/method-reference/build_scope3_spend_register.py from the official EPA v1.3 CO2e CSV and the
# FRED A191RD3A086NBEA transcription; read and verified on first use only.
SPEND_REGISTER_PATH = REFERENCE_DIR / 'verified-scope3-spend-register-epa-scghg-v1.3.json'
SPEND_REGISTER_SHA256 = '24d59c826e23b72b41a2a22db5f1c51c793c00a94e14ebe391e3982d76d1088c'
# R3 (I-05): built by tools/method-reference/build_scope3_supplement_register.py from the Hub 2025 xlsx (cross-checked with its
# PDF) and the eGRID2023 rev2 xlsx; read and verified on first use only.
SUPPLEMENT_REGISTER_PATH = REFERENCE_DIR / 'verified-scope3-supplement-register-2025.json'
SUPPLEMENT_REGISTER_SHA256 = 'b9d3c4b9676c539eeb0caece70a81d1713be4646673115033649fed031c8176b'
# R5 (I-12u): built by tools/method-reference/build_scope3_us_upstream_register.py from the committed transcription files
# (tools/method-reference/sources/us-upstream-transcriptions*.json); read and verified on first use only.
US_UPSTREAM_REGISTER_PATH = REFERENCE_DIR / 'verified-scope3-us-upstream-register-2025.json'
US_UPSTREAM_REGISTER_SHA256 = '66e9658a6743a3eabe460211dbaa6842082d4459666a80076ef795caa89b7d7c'
# R6 (I-12h): built by tools/method-reference/build_scope3_us_building_hotel_register.py from the committed transcription files
# (EIA CBECS 2018 C14/C24; EPA events and conferences guidance 2018 Table 5); read and verified on first use only.
BUILDING_HOTEL_REGISTER_PATH = REFERENCE_DIR / 'verified-scope3-us-building-hotel-register-2025.json'
BUILDING_HOTEL_REGISTER_SHA256 = '0902516554d063eb5cb3f3491a277ddb7ae0767180c335cbca52e7b714fe20e7'
ENGINE_PATH = 'apps/site-api/src/calculation/scope3_engine.py'
ENGINE_PROFILE = 'neuvetra.scope3-engine.v1'
# Round 2, owner decision 1: the Scope 3 envelope is 2025-01-01 to 2027-01-01 (FY2026 and fiscal years spanning two calendar years);
# factors stay the latest published vintage (Hub 2025, eGRID2023, SC v1.3, R5, R6), so a line whose period ends after 2025-12-31
# discloses `factor_vintage_precedes_period`. The refusal code for periods outside the envelope is unchanged.
PERIOD = ('2025-01-01', '2027-01-01')
FACTOR_VINTAGE_PERIOD_END = '2026-01-01'  # a period ending after this (exclusive end later) is later than the factor vintages
QUANTITY = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?')
FACTOR_TEXT = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,20})?')
DIVISION_PLACES = 12
GASES = (('co2', 'CO2'), ('ch4', 'CH4'), ('n2o', 'N2O'))
# Round 2b integration (DESIGN 13.7): 64 MiB, the same bound as the bridge (`SCOPE3_ENGINE_MAX_BYTES`), and smaller than
# 0030's report text limit, which round 2c raised to 128 MiB per text (DESIGN 13.8; round 3 corrected this comment).
# `aggregate` receives every calculated result of a run in one request; measured at the results route's line cap (3,000
# lines) with the largest results the engine produces (ten-mode average commuting profiles: 12,877 bytes each; 3D/3C/3B
# upstream lines with coal and every memo field: up to 11,911 in round 2), the worst-case aggregate request, annotations
# included, is 39,208,022 bytes (37.4 MiB), and 1,000 worst-case electricity records (3,000 lines) 26,216,121 bytes. 16 MiB
# refused results from about 880 electricity records. scope3_engine_batch_test checks the cap and the worst case at the cap.
MAX_REQUEST_BYTES = 64 * 1024 * 1024
MAX_BATCH = 2000
MAX_AGGREGATE = 6000
# Method types (GHG Protocol Scope 3 calculation methods), in the order that breaks a tie for the dominant type.
METHOD_TYPES = ('supplier_specific', 'partner_reported', 'activity_average_data', 'proxy', 'spend_based')
FIXED_ORIGIN_TYPES = ('supplier_specific', 'partner_reported')  # their activity data always comes from value-chain partners
# A19: the activity-data origin of every method type except activity/average data is fixed; an annotation cannot change it
# (spend lines are the company's own ledger; a proxy is an estimate), so the "% from value-chain data" is never inflated.
FIXED_ORIGINS = {'supplier_specific': 'value_chain_partner', 'partner_reported': 'value_chain_partner', 'spend_based': 'company_records', 'proxy': 'estimate'}
# A20: a result carrying one of these notes is rated with its method's `defaultDataQualityUnverified` (I-07: investee data too).
UNVERIFIED_NOTES = ('supplier_data_unverified', 'partner_data_unverified', 'investee_data_unverified')
ORIGINS = ('company_records', 'value_chain_partner', 'estimate')
# Data-quality indicators (Scope 3 Standard Table 7.6) and the product's 1-4 scale (very good = 1).
DQ_INDICATORS = ('technological', 'temporal', 'geographical', 'completeness', 'reliability')
DQ_SCORES = {'very_good': 1, 'good': 2, 'fair': 3, 'poor': 4}
BIOGENIC_TREATMENTS = ('quantified', 'not_in_factor', 'none_expected', 'as_reported')
RESULT_EXTRAS = ('additionalRegisters', 'biogenicCo2', 'memoItems')


class Refused(ValueError):
    """Input the engine will not calculate. The code is safe to show to the user."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def canonical(v) -> str:
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(v) -> str:
    return hashlib.sha256(canonical(v).encode('utf-8')).hexdigest()


def exact(v: Decimal) -> str:
    t = format(v, 'f')
    return t.rstrip('0').rstrip('.') if '.' in t else t


# Round 2 (ENG-12): exactness is enforced, not only argued. Every calculation, total and aggregate runs in EXACT (precision 96,
# Inexact trapped), so an operation that would round raises (the CLI answers "scope3_engine_unavailable", never a figure)
# instead of rounding silently. The only roundings are the steps listed in ROUNDING_STEPS, each made explicitly: `divide` and
# the aggregate ratios round an exact Fraction with Python's half-even `round`, and `display` quantizes in ROUNDING_STEP.
EXACT = Context(prec=96, rounding=ROUND_HALF_EVEN, traps=[InvalidOperation, DivisionByZero, Overflow, Inexact])
ROUNDING_STEP = Context(prec=96, rounding=ROUND_HALF_EVEN, traps=[InvalidOperation, DivisionByZero, Overflow])
ROUNDING_STEPS = ('divide: an exact rational quotient rounded once, half-even, to 12 dp, and listed in the result conversions',
                  'display: a total rounded once, half-even, to 4 dp kg CO2e for display; the unrounded value is kept beside it',
                  'aggregate ratios: an exact Fraction quotient rounded once, half-even, to 12 dp (value) and to its display places')


def _exact():
    """The arithmetic context of every calculation and aggregate (ENG-12): precision 96 with Inexact trapped."""
    return localcontext(EXACT)


def display(v: Decimal) -> str:
    """Listed rounding step: half-even to 4 dp (ROUNDING_STEPS), the only quantize the engine makes."""
    with localcontext(ROUNDING_STEP):
        return format(v.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN), '.4f')


_ENGINE_SHA256: str | None = None


def engine_sha256() -> str:
    """The SHA-256 of this file, read once per process (audit D15): a batch or aggregate of thousands of results no
    longer re-reads and re-hashes the engine for every result."""
    global _ENGINE_SHA256
    if _ENGINE_SHA256 is None:
        _ENGINE_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return _ENGINE_SHA256


# Pinned register files, declared once (round 2, ENG-7): R1 ('main'), since I-03 R2 ('spend'), since I-05 R3 ('supplement'),
# since I-12u R5 ('us_upstream') and since I-12h R6 ('building_hotel') (DESIGN A4, section 4.3; revision 3, section 13.1).
REGISTERS = {'main': {'path': REGISTER_PATH, 'sha256': REGISTER_SHA256},
             'spend': {'path': SPEND_REGISTER_PATH, 'sha256': SPEND_REGISTER_SHA256},
             'supplement': {'path': SUPPLEMENT_REGISTER_PATH, 'sha256': SUPPLEMENT_REGISTER_SHA256},
             'us_upstream': {'path': US_UPSTREAM_REGISTER_PATH, 'sha256': US_UPSTREAM_REGISTER_SHA256},
             'building_hotel': {'path': BUILDING_HOTEL_REGISTER_PATH, 'sha256': BUILDING_HOTEL_REGISTER_SHA256}}
# A factor or constant key is read from the register its prefix names; every other key is R1's. R3's constants carry the
# `supplement_const.` prefix (I-01 follow-up), so `constant()` routes them like factors.
REGISTER_PREFIXES = (('epa_scghg_v130.', 'spend'), ('price_index.', 'spend'),
                     ('hub2025_t1.', 'supplement'), ('hub2025_gwp.', 'supplement'), ('egrid2023_us.', 'supplement'),
                     ('egrid2023_hi.', 'supplement'), ('egrid2023_gen.', 'supplement'), ('supplement_const.', 'supplement'),
                     ('netl2024_4862.', 'us_upstream'), ('cagreet3_lut2018.', 'us_upstream'), ('cagreet3.', 'us_upstream'), ('carb_lcfs.', 'us_upstream'),
                     ('egrid2023_tg.', 'us_upstream'), ('cfr40_72_2.', 'us_upstream'), ('eia_glossary.', 'us_upstream'), ('us_upstream_const.', 'us_upstream'),
                     ('epa_ghgi.', 'us_upstream'), ('eia.', 'us_upstream'),  # round 2, lane F: the coal methane-only inputs (DESIGN 13.6)
                     ('coal_upstream.', 'us_upstream'),  # round 3, lane A: the coal screening-range inputs (owner decision 2), memo only
                     ('cbecs2018.', 'building_hotel'), ('epa_events2018.', 'building_hotel'))


def register_for_key(key: str) -> str:
    for prefix, name in REGISTER_PREFIXES:
        if key.startswith(prefix):
            return name
    return 'main'


def _read_register(name: str) -> dict:
    """Reads one pinned register: its bytes must match the pinned SHA-256 and no id may repeat."""
    spec = REGISTERS.get(name)
    if spec is None:
        raise RuntimeError('register not available in this engine: ' + name)
    raw = spec['path'].read_bytes()
    if hashlib.sha256(raw).hexdigest() != spec['sha256']:
        raise RuntimeError(f'verified Scope 3 register {name} bytes do not match the pinned digest')
    reg = json.loads(raw.decode('utf-8'))
    entries = {e['id']: e for e in reg['entries']}
    constants = {c['id']: c for c in reg['constants']}
    if len(entries) != len(reg['entries']) or len(constants) != len(reg['constants']):
        raise RuntimeError('duplicate register key')
    return {'entries': entries, 'constants': constants}


def load_register() -> dict:
    return _read_register('main')


try:
    REGISTER = load_register()
except Exception:  # reported by every entry point; never calculate without the pinned register
    REGISTER = None
_LOADED_REGISTERS: dict = {}


def require_register() -> dict:
    if REGISTER is None:
        raise RuntimeError('verified Scope 3 register unavailable')
    return REGISTER


def _register(name: str) -> dict:
    """R1 is read eagerly at start-up (as before); any other register is read, verified and cached on first use."""
    if name == 'main':
        return require_register()
    if name not in _LOADED_REGISTERS:
        _LOADED_REGISTERS[name] = _read_register(name)
    return _LOADED_REGISTERS[name]


_ZIPS: dict | None = None


def zip_table() -> dict:
    """The EPA Power Profiler ZIP table, read and verified only by the methods that need it (DESIGN 4.1)."""
    global _ZIPS
    if _ZIPS is None:
        zraw = ZIP_PATH.read_bytes()
        if hashlib.sha256(zraw).hexdigest() != ZIP_SHA256:
            raise RuntimeError('ZIP lookup bytes do not match the pinned digest')
        zips: dict = {}
        for row in csv.DictReader(io.StringIO(zraw.decode('utf-8-sig'))):
            zips.setdefault(row['zip'], []).append((row['SUBRGN'], row['eiaid']))
        _ZIPS = zips
    return _ZIPS


def factor(key: str, used: dict) -> Decimal:
    e = _register(register_for_key(key))['entries'].get(key)
    if e is None or not FACTOR_TEXT.fullmatch(e['value']):
        raise RuntimeError('register factor missing: ' + key)
    used[key] = e
    return Decimal(e['value'])


def constant(key: str, used: dict) -> Decimal:
    c = _register(register_for_key(key))['constants'][key]
    used['constant:' + key] = c
    return Decimal(c['value'])


def quantity(v, code: str) -> Decimal:
    if not isinstance(v, str) or not QUANTITY.fullmatch(v):
        raise Refused(code)
    return Decimal(v)


def integer(v, low: int, high: int, code: str) -> int:
    if isinstance(v, bool) or not isinstance(v, int) or not low <= v <= high:
        raise Refused(code)
    return v


def require_keys(v, required: set, optional=frozenset()) -> None:
    if not isinstance(v, dict) or not required.issubset(v) or not set(v).issubset(set(required) | set(optional)):
        raise Refused('invalid_input_shape')


def calendar_date(v) -> datetime.date:
    if not isinstance(v, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', v):
        raise Refused('invalid_date')
    try:
        return datetime.date.fromisoformat(v)
    except ValueError:
        raise Refused('invalid_date') from None


def require_period(v) -> None:
    """Real calendar dates (2025-02-30 is refused), start before end, inside the envelope (2025 and 2026, owner decision 1)."""
    require_keys(v, {'start', 'endExclusive'})
    start, end = calendar_date(v['start']), calendar_date(v['endExclusive'])
    if not (datetime.date.fromisoformat(PERIOD[0]) <= start < end <= datetime.date.fromisoformat(PERIOD[1])):
        raise Refused('period_outside_2025_method_envelope')


def divide(numerator: Decimal, denominator: Decimal, what: str, conversions: list) -> Decimal:
    """Exact rational quotient rounded once, half-even, to 12 decimal places, and recorded."""
    q = Fraction(numerator) / Fraction(denominator)
    rounded = Decimal(round(q * 10 ** DIVISION_PLACES)).scaleb(-DIVISION_PLACES)
    conversions.append({'quantity': what, 'numerator': exact(numerator), 'denominator': exact(denominator), 'result': exact(rounded),
                        'rounded': Fraction(rounded) != q, 'places': DIVISION_PLACES, 'rounding': 'half_even'})
    return rounded


def distance_miles(v, allowed: dict, what: str, used: dict, conversions: list) -> tuple[Decimal, str]:
    """allowed maps an input unit to (hub unit, needs km conversion)."""
    require_keys(v, {'value', 'unit'})
    q = quantity(v['value'], 'invalid_quantity')
    if v['unit'] not in allowed:
        raise Refused('unsupported_unit')
    hub_unit, from_km = allowed[v['unit']]
    if from_km:
        q = divide(q, constant('km_per_mile', used), what, conversions)
    return q, hub_unit


# ---------------------------------------------------------------------------
# Catalogue: the options the collection screens offer, mapped to register rows.
# ---------------------------------------------------------------------------

TRAVEL_MODES = {
    'passenger_car': ('travel.passenger_car.vehicle_mile', 'vehicle'),
    'light_duty_truck': ('travel.light_duty_truck.vehicle_mile', 'vehicle'),
    'motorcycle': ('travel.motorcycle.vehicle_mile', 'vehicle'),
    'intercity_rail_northeast_corridor': ('travel.intercity_rail_northeast_corridor.passenger_mile', 'passenger'),
    'intercity_rail_other_routes': ('travel.intercity_rail_other_routes.passenger_mile', 'passenger'),
    'intercity_rail_national_average': ('travel.intercity_rail_national_average.passenger_mile', 'passenger'),
    'commuter_rail': ('travel.commuter_rail.passenger_mile', 'passenger'),
    'transit_rail': ('travel.transit_rail_i_e_subway_tram.passenger_mile', 'passenger'),
    'bus': ('travel.bus.passenger_mile', 'passenger'),
    'air_short_haul': ('travel.air_travel_short_haul_300_miles.passenger_mile', 'passenger'),
    'air_medium_haul': ('travel.air_travel_medium_haul_300_miles_2300_miles.passenger_mile', 'passenger'),
    'air_long_haul': ('travel.air_travel_long_haul_2300_miles.passenger_mile', 'passenger'),
}
AIR_MODES = ('air_short_haul', 'air_medium_haul', 'air_long_haul')
COMMUTING_MODES = tuple(m for m in TRAVEL_MODES if m not in AIR_MODES)
TRANSPORT_VEHICLES = {
    'medium_and_heavy_duty_truck': {'vehicle': 'transport.medium_and_heavy_duty_truck.vehicle_mile', 'ton': 'transport.medium_and_heavy_duty_truck.short_ton_mile'},
    'passenger_car': {'vehicle': 'transport.passenger_car.vehicle_mile'},
    'light_duty_truck': {'vehicle': 'transport.light_duty_truck.vehicle_mile'},
    'rail': {'ton': 'transport.rail.short_ton_mile'},
    'waterborne_craft': {'ton': 'transport.waterborne_craft.short_ton_mile'},
    'aircraft': {'ton': 'transport.aircraft.short_ton_mile'},
}
WASTE_TREATMENTS = ('recycled', 'landfilled', 'combusted', 'composted', 'anaerobic_digestion_dry', 'anaerobic_digestion_wet')
WASTE_UNITS = ('short_ton', 'lb', 'kg', 'metric_ton')
INTERCONNECT = {
    'western': ('AZNM', 'CAMX', 'NWPP', 'RMPA'),
    'ercot': ('ERCT',),
    'alaska': ('AKGD', 'AKMS'),
    'hawaii': ('HIMS', 'HIOA'),
    'u_s': ('PRMS',),  # EPA Power Profiler applies the national grid gross loss to Puerto Rico
    'eastern': ('FRCC', 'MROE', 'MROW', 'NEWE', 'NYCW', 'NYLI', 'NYUP', 'RFCE', 'RFCM', 'RFCW', 'SPNO', 'SPSO', 'SRMV', 'SRMW', 'SRSO', 'SRTV', 'SRVC'),
}
SUBREGION_INTERCONNECT = {s: ic for ic, subs in INTERCONNECT.items() for s in subs}


def _keys(prefix) -> list[str]:
    return [] if REGISTER is None else sorted(k for k in REGISTER['entries'] if k.startswith(prefix))


def _gas_keys(bases) -> list[str]:
    return sorted(f'{b}.{g}' for b in bases for g, _ in GASES)


def _waste_materials() -> dict:
    out: dict = {}
    for k in _keys('waste.'):
        _, material, treatment = k.split('.')
        out.setdefault(material, []).append(treatment)
    return out


GWP_KEYS = ['gwp_ar5.CO2', 'gwp_ar5.CH4', 'gwp_ar5.N2O']
DISTANCE_RULES = ['Distance-based method (GHG Protocol Scope 3 technical guidance); use a fuel-based method instead when the carrier or traveller fuel data are available (Hub Tables 8 and 10 note)',
                  'Distances in miles, or km converted exactly (1 mile = 1.609344 km, quotient rounded half-even to 12 dp and listed)',
                  'Boundary: tank-to-wheel combustion of the carrier or vehicle (the Scope 3 minimum boundary); upstream fuel production is optional and not included']

_CORE_METHOD_FACTS = {
    'scope3.cat3.td_losses.egrid2023.v1': {
        'profileId': 'scope3.cat3.td_losses', 'family': 'fuel_energy_related', 'kind': 'td_losses', 'gwpSetId': 'AR5-100',
        'title': 'Category 3 activity C: generation of electricity lost in transmission and distribution (eGRID2023 rev2)',
        'formula': 'loss MWh = consumed MWh x GGL / (1 - GGL) (interconnect grid gross loss, eGRID GGL23; quotient rounded half-even to 12 dp); '
                   'kg gas = loss MWh x subregion total output rate (lb/MWh) x 0.45359237; kg CO2e = CO2 + CH4 x 28 + N2O x 265',
        'factorKeys': lambda: _keys('egrid2023.') + _keys('egrid2023_ggl.') + GWP_KEYS,
        'constantIds': ['kwh_to_mwh', 'lb_to_kg'],
        'admissionRules': ['The same metered electricity record as Scope 2 (kWh or MWh, site ZIP, eGRID subregion listed for the ZIP, and the utility EIA id when the ZIP has more than one subregion; 2025 period)',
                           'Interconnect per EPA Power Profiler: Western AZNM CAMX NWPP RMPA; ERCOT ERCT; Alaska AKGD AKMS; Hawaii HIMS HIOA; Puerto Rico PRMS uses the U.S. value; all other subregions Eastern',
                           'Location-based grid rates only; contractual instruments do not change losses',
                           'Boundary partial: combustion emissions of the lost generation only; the Scope 3 minimum boundary also includes the cradle-to-gate upstream of that energy, which no EPA source here covers'],
        'estimateRules': ['us_average_grid_loss: Puerto Rico (PRMS) has no interconnect value; the U.S. grid gross loss is used, as in EPA Power Profiler'],
    },
    'scope3.cat4_9.transport_distance.v1': {
        'profileId': 'scope3.cat4_9.transport_distance', 'family': 'transportation_distribution', 'kind': 'transport', 'gwpSetId': 'AR5-100',
        'title': 'Categories 4 and 9: upstream and downstream transportation, distance-based (Hub Table 8)',
        'formula': 'kg CO2 = activity x CO2 factor (kg/unit); kg CH4 and N2O = activity x factor (g/unit) x 0.001; kg CO2e = CO2 + CH4 x 28 + N2O x 265. '
                   'activity = vehicle-miles for a dedicated vehicle, short ton-miles for a shared vehicle (tonne-km x 1000 / (0.45359237 x 2000 x 1.609344), rounded half-even to 12 dp)',
        'factorKeys': lambda: _keys('transport.') + GWP_KEYS,
        'constantIds': ['g_to_kg', 'km_per_mile', 'lb_per_short_ton', 'lb_to_kg', 'metric_ton_to_kg'],
        'admissionRules': ['Category 4 (paid by the company, inbound or between own sites) or 9 (outbound, not paid by the company) must be stated',
                           'Dedicated vehicle: vehicle-miles or vehicle-km (truck, passenger car, light-duty truck). Shared vehicle: short ton-miles or tonne-km (truck, rail, waterborne craft, aircraft)']
                          + DISTANCE_RULES + ['Third-party warehousing and distribution centres are not calculated by this method: each record states thirdPartyFacilities; only "none" meets the category 4/9 minimum boundary, otherwise the result is partial'],
        'estimateRules': [],
    },
    'scope3.cat5_12.waste.v1': {
        'profileId': 'scope3.cat5_12.waste', 'family': 'waste', 'kind': 'waste', 'gwpSetId': 'AR4-100',
        'title': 'Categories 5 and 12: waste generated in operations and end-of-life of sold products (Hub Table 9)',
        'formula': 'short tons = short tons, lb / 2000, kg / (0.45359237 x 2000), or metric tons x 1000 / (0.45359237 x 2000) (quotient rounded half-even to 12 dp); '
                   'kg CO2e = short tons x factor (metric tons CO2e per short ton) x 1000',
        'factorKeys': lambda: _keys('waste.'),
        'constantIds': ['lb_per_short_ton', 'lb_to_kg', 'metric_ton_to_kg'],
        'admissionRules': ['Category 5 (waste from own operations) or 12 (end-of-life of sold products) must be stated',
                           'Material and treatment from Hub Table 9; use a mixed material (e.g. mixed MSW) for the average-data method',
                           'A treatment EPA marks NA for the material is not calculated and is never counted as zero',
                           'Factors are CO2e computed by EPA with AR4 GWPs and cannot be split by gas or restated in AR5; results carry gwpSetId AR4-100',
                           'Boundary: disposal or treatment emissions (minimum boundary) plus transport to the facility (optional; EPA includes it); avoided emissions are excluded'],
        'estimateRules': [],
    },
    'scope3.cat6.business_travel_distance.v1': {
        'profileId': 'scope3.cat6.business_travel_distance', 'family': 'business_travel', 'kind': 'business_travel', 'gwpSetId': 'AR5-100',
        'title': 'Category 6: business travel, distance-based (Hub Table 10)',
        'formula': 'kg CO2 = activity x CO2 factor (kg/unit); kg CH4 and N2O = activity x factor (g/unit) x 0.001; kg CO2e = CO2 + CH4 x 28 + N2O x 265. '
                   'Cars and motorcycles per vehicle-mile; rail, bus and air per passenger-mile; air haul from the one-way segment distance (< 300, 300 to < 2300, >= 2300 miles)',
        'factorKeys': lambda: _gas_keys(v[0] for v in TRAVEL_MODES.values()) + GWP_KEYS,
        'constantIds': ['g_to_kg', 'km_per_mile'],
        'admissionRules': ['Air: one record per group of passenger segments of one distance (a return trip is two segments), or passenger-miles already split by haul with the basis stated',
                           'Air factors are EPA\'s adoption of DEFRA 2022 average-passenger factors; cabin class is not differentiated and non-CO2 effects (radiative forcing) are not included',
                           'Hotel stays are not covered (optional in the Scope 3 minimum boundary)'] + DISTANCE_RULES,
        'estimateRules': ['air_haul_declared: haul class taken from the stated basis (e.g. a travel agency report), not from a segment distance',
                          'intercity_rail_route_average: Amtrak national average used because the route is not known'],
    },
    'scope3.cat7.employee_commuting_distance.v1': {
        'profileId': 'scope3.cat7.employee_commuting_distance', 'family': 'employee_commuting', 'kind': 'employee_commuting', 'gwpSetId': 'AR5-100',
        'title': 'Category 7: employee commuting, distance-based (Hub Table 10)',
        'formula': 'kg CO2 = activity x CO2 factor (kg/unit); kg CH4 and N2O = activity x factor (g/unit) x 0.001; kg CO2e = CO2 + CH4 x 28 + N2O x 265. '
                   'Cars and motorcycles per vehicle-mile (a shared car counts once); rail and bus per passenger-mile',
        'factorKeys': lambda: _gas_keys(TRAVEL_MODES[m][0] for m in COMMUTING_MODES) + GWP_KEYS,
        'constantIds': ['g_to_kg', 'km_per_mile'],
        'admissionRules': ['Annual commuting distance per mode for the reporting period; survey extrapolation must be labelled estimated by the collection step',
                           'Teleworking emissions are not covered (optional in the Scope 3 minimum boundary)'] + DISTANCE_RULES,
        'estimateRules': ['intercity_rail_route_average: Amtrak national average used because the route is not known'],
    },
}


def _data_quality(ratings: tuple, rationale: tuple) -> dict:
    return {'indicators': dict(zip(DQ_INDICATORS, ratings)), 'rationale': dict(zip(DQ_INDICATORS, rationale))}


# Static metadata per method (DESIGN A2, section 4.4 "Default data quality" and "Biogenic treatment"). It describes the
# method, never one result, so the bytes of existing results do not change (A1). The aggregate reads it for the
# per-category profiles; `resultExtras` lists the optional result keys a method may emit (none for these five).
_DISTANCE_DQ = _data_quality(('fair', 'very_good', 'good', 'good', 'good'), (
    'Average vehicle or passenger factors by mode (Hub Tables 8 and 10), not the carrier\'s or traveller\'s own fuel use',
    'Hub 2025 factors applied to 2025 activity',
    'U.S. national average factors for U.S. activity',
    'Distances recorded per trip, lane or commuting mode by the company',
    'EPA-published factors applied to the company\'s own distance records'))
METHOD_METADATA = {
    'scope3.cat3.td_losses.egrid2023.v1': _data_quality(('good', 'very_good', 'good', 'good', 'good'), (
        'Subregion emission rates and the interconnect grid gross loss for the metered electricity',
        'eGRID2023 revision 2, the latest eGRID edition available for 2025 reporting',
        'eGRID subregion of the site\'s ZIP code (and utility where the ZIP spans subregions)',
        'The same metered electricity records as Scope 2',
        'Metered utility data with EPA-published rates')),
    'scope3.cat4_9.transport_distance.v1': _DISTANCE_DQ,
    'scope3.cat5_12.waste.v1': _data_quality(('fair', 'good', 'good', 'fair', 'good'), (
        'Material and treatment specific, but average facilities (Hub Table 9, from EPA WARM)',
        'Hub 2025 edition of WARM-based factors whose underlying data years vary',
        'U.S. national average factors',
        'Waste records often cover only some streams or sites; transport to the facility is included by EPA',
        'EPA-published factors applied to the company\'s waste records')),
    'scope3.cat6.business_travel_distance.v1': _DISTANCE_DQ,
    'scope3.cat7.employee_commuting_distance.v1': _DISTANCE_DQ,
}
_CORE_METHODS = {mid: dict(m, methodType='activity_average_data', activityDataOrigin='company_records', defaultDataQuality=METHOD_METADATA[mid],
                           biogenicTreatment='not_in_factor' if m['kind'] == 'waste' else 'none_expected', additionalRegisters=[], resultExtras=())
                 for mid, m in _CORE_METHOD_FACTS.items()}

# --- I-03 --- Purchases (DESIGN 4.4): spend-based (EPA SC v1.3), supplier-specific and company-typed secondary factors.
SPEND_CATEGORIES = (1, 2, 3, 4, 5, 6, 9)
SPEND_IMPORT_CATEGORIES = (1, 2, 3, 4, 5, 6)  # a ledger import or mapping never assigns category 9 (A23)
SPEND_FALLBACK_CATEGORIES = (3, 4, 5, 6, 9)  # activity methods are preferred; spend is the fallback (CG [4.7])
SPEND_YEARS = (2012, 2035)  # A25: any year in range is accepted; one without a registered index is held
SPEND_MARGIN_NOTES = {'with_margins': 'cradle_to_shelf_including_margins', 'without_margins': 'cradle_to_gate_factory_price'}
NAICS6 = re.compile(r'[0-9]{6}')
# DESIGN 3.3 code sets (2017 NAICS-6; each present in the v1.3 CSV, which the purchases test checks). The adapter holds a
# line outside its category's set or inside a confirmation set; the engine calculates any code it has a factor for.
SPEND_NAICS_SETS = {
    'freight': ('481112', '481212', '482111', '482112', '483111', '483113', '483211', '484110', '484121', '484122', '484210', '484220', '484230', '486110',
                '486210', '486910', '486990', '488111', '488119', '488190', '488210', '488310', '488320', '488330', '488390', '488410', '488490', '488510',
                '491110', '492110', '492210', '493110', '493120', '493130', '493190'),
    'passenger': ('481111', '481211', '482111', '483112', '483114', '483212', '485111', '485112', '485113', '485119', '485210', '485310', '485320', '485510',
                  '485999', '532111', '721110', '721120', '721191', '721199'),
    'waste': ('221320', '562111', '562112', '562119', '562211', '562212', '562213', '562219', '562910', '562920', '562991', '562998'),
    'fuel_proxy': ('212111', '212112', '212113', '221210', '324110'),
    'energy_confirm': ('211120', '211130', '212111', '212112', '212113', '221210', '221330', '324110', '324199', '447110', '447190', '454310', '486110',
                       '486210', '486910', '486990'),
}
SPEND_CATEGORY_CODE_SET = {3: 'fuel_proxy', 4: 'freight', 5: 'waste', 6: 'passenger', 9: 'freight'}
SPEND_TRADE_PREFIXES = ('42', '44', '45')
SPEND_ABSENT_CODES = ('221100',)
SUPPLIER_ORIGIN_METHODS = {'supplier_primary': 'scope3.cat1_2.supplier_specific.v1', 'secondary_database': 'scope3.cat1_2.average_data_user_factor.v1'}
SUPPLIER_BASES = ('product_factor', 'allocated_total')
SUPPLIER_PRODUCT_UNITS = ('kg', 'metric_ton', 'short_ton', 'lb', 'unit', 'kWh', 'MWh', 'liter', 'm3', 'US_gallon')
SUPPLIER_TOTAL_UNITS = ('kg CO2e', 'metric_ton CO2e')
SUPPLIER_BOUNDARIES = ('cradle_to_gate', 'other', 'supplier_scope1_2_only')
SUPPLIER_HYBRID_UPSTREAM = ('other_records', 'none')
GWP_BASES = ('AR4', 'AR5', 'AR6', 'unknown')
VERIFICATION = ('third_party_verified', 'unverified')
SUPPLIER_FACTOR = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?')  # A10: supplier factors up to 6 dp


def _spend_constant_ids() -> list:
    return sorted(_register('spend')['constants'])


_SUPPLIER_RULES = ['Supplier figure and its evidence on the record: the product, the supplier\'s method and boundary, the GWP basis it declares and whether it was verified',
                   'Product factor: quantity bought x the supplier\'s kg CO2e per unit of exactly that quantity unit (no unit conversion); allocated total: the supplier\'s '
                   'kg CO2e (or metric tons x 1000) x the reporting company\'s share (numerator / denominator, rounded half-even to 12 dp and listed), or as allocated by the supplier',
                   'A share above one is never calculated; a zero denominator needs input',
                   'Supplier CO2e is used as reported, in the GWP set the supplier declares (AS-REPORTED), never restated or split by gas',
                   'Hybrid (scope 1 and 2 of the supplier only, calculation guidance [1.2]/[1.3]): the boundary is met only when the upstream inputs are covered by other records; '
                   'otherwise the result is partial']
_PURCHASE_METHODS = {
    'scope3.spend.epa_scghg_v1_3.v1': {
        'profileId': 'scope3.spend.epa_scghg_v1_3', 'family': 'spend_based', 'kind': 'purchase_spend', 'gwpSetId': 'AR5-100',
        'title': 'Categories 1 and 2, and the spend-based fallback for 3, 4, 5, 6 and 9: EPA Supply Chain GHG Emission Factors v1.3 (2022 USD)',
        'formula': 'kg CO2e = amount (USD) x factor (kg CO2e per 2022 USD, purchaser price, published with or without margins for the 2017 NAICS-6 code) x r; '
                   'r = I2022 / I(dollar year) of the BEA GDP implicit price deflator (FRED A191RD3A086NBEA), rounded half-even to 12 dp and listed; no r for 2022 dollars',
        'factorKeys': lambda: sorted(_register('spend')['entries']),
        'constantIds': _spend_constant_ids,
        'admissionRules': ['One line per purchase: the amount in USD (other currencies are held before the engine), its 2017 NAICS-6 code and the dollar year of the amount',
                           'With margins (purchaser price, cradle to shelf) for goods bought from a distributor or retailer; without margins (cradle to factory gate) only for goods '
                           'bought at the factory gate (EPA/600/R-20/001 p.13)',
                           'The published with-margins value is used as printed; the without-margins and margin values are never added (About v1.3)',
                           'Category 2 capital goods: the full acquisition cost in the year of acquisition, never depreciation (Scope 3 Standard Box 5.4; calculation guidance Box 2.1)',
                           'Categories 3, 4, 5, 6 and 9 by spend are a fallback for when activity data are not available (calculation guidance [4.7], p.65); category 9 spend is '
                           'the company\'s estimate of transport it does not pay for',
                           'Electricity (221100) is not in v1.3; a code without a factor, or a dollar year without a registered index, is held and never counted as zero',
                           'Factors use U.S. GHG data for 2022 and IPCC AR5 100-year GWPs applied by EPA (CO2e only, not split by gas); biogenic CO2 is not in the factors'],
        'estimateRules': ['economy_wide_price_index: the dollar year is not 2022, so the BEA GDP implicit price deflator (economy-wide) stands in for EPA\'s commodity-specific price indexes',
                          'downstream_spend_estimated_by_company: category 9 spend is the company\'s estimate of what others paid for downstream transport'],
        'methodType': 'spend_based', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'not_in_factor', 'additionalRegisters': ['spend'],
        'resultExtras': ('additionalRegisters',),
        'defaultDataQuality': _data_quality(('poor', 'good', 'good', 'fair', 'fair'), (
            'Economic sector average per dollar (EEIO), not the product or the supplier',
            'U.S. GHG data for 2022 in 2022 dollars, deflated to the spend year with an economy-wide index',
            'U.S. national sector averages for purchases from the U.S. economy',
            'Spend lines from the company\'s ledger; coverage depends on the spend recorded and mapped',
            'EPA-published factors applied to the company\'s own spend records; the NAICS mapping is the company\'s')),
    },
    'scope3.cat1_2.supplier_specific.v1': {
        'profileId': 'scope3.cat1_2.supplier_specific', 'family': 'purchased_goods_services', 'kind': 'purchase_supplier', 'gwpSetId': 'AS-REPORTED',
        'title': 'Categories 1 and 2: supplier-specific product emission factors and supplier-allocated emissions',
        'formula': 'product factor: kg CO2e = quantity bought x supplier factor (kg CO2e per unit); allocated total: kg CO2e = supplier kg CO2e (metric tons x 1000) '
                   'x numerator / denominator (rounded half-even to 12 dp), or x 1 when the supplier allocated it',
        'factorKeys': lambda: [], 'constantIds': ['metric_ton_to_kg'],
        'admissionRules': ['Supplier-primary data only: the supplier\'s own cradle-to-gate product inventory (calculation guidance [1.1]) or its allocated scope 1 and 2 (hybrid)']
                          + _SUPPLIER_RULES,
        'estimateRules': [],
        'methodType': 'supplier_specific', 'activityDataOrigin': 'value_chain_partner', 'biogenicTreatment': 'as_reported', 'additionalRegisters': [], 'resultExtras': (),
        'defaultDataQuality': _data_quality(('very_good', 'good', 'very_good', 'good', 'very_good'), (
            'The supplier\'s own product or company inventory',
            'Supplier data for or near the reporting year',
            'The supplier\'s own sites',
            'The supplier\'s inventory boundary as declared on the record',
            'Third-party verified supplier data')),
        'defaultDataQualityUnverified': _data_quality(('very_good', 'good', 'very_good', 'good', 'fair'), (
            'The supplier\'s own product or company inventory',
            'Supplier data for or near the reporting year',
            'The supplier\'s own sites',
            'The supplier\'s inventory boundary as declared on the record',
            'Supplier data that no third party has verified')),
    },
    'scope3.cat1_2.average_data_user_factor.v1': {
        'profileId': 'scope3.cat1_2.average_data_user_factor', 'family': 'purchased_goods_services', 'kind': 'purchase_supplier', 'gwpSetId': 'AS-REPORTED',
        'title': 'Categories 1 and 2: average-data method with a secondary emission factor entered by the company',
        'formula': 'kg CO2e = quantity bought x secondary factor (kg CO2e per unit) entered by the company; or a secondary kg CO2e total x numerator / denominator '
                   '(rounded half-even to 12 dp)',
        'factorKeys': lambda: [], 'constantIds': ['metric_ton_to_kg'],
        'admissionRules': ['Secondary (database or industry-average) cradle-to-gate factors typed in by the company (calculation guidance [1.4]); they are not supplier data '
                           'and are not in a verified register, so the result is labelled user_supplied_secondary_factor_not_verified']
                          + _SUPPLIER_RULES[1:4] + ['A secondary factor must be cradle-to-gate; any other boundary is held for review'],
        'estimateRules': [],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'as_reported', 'additionalRegisters': [], 'resultExtras': (),
        'defaultDataQuality': _data_quality(('fair', 'good', 'fair', 'fair', 'fair'), (
            'An average factor for the product type, not the supplier\'s product',
            'Database factor near the reporting year',
            'Database geography may differ from the supplier\'s',
            'Quantities from the company\'s records for the products listed',
            'A secondary factor entered by the company and not verified by Neuvetra')),
    },
}
# --- I-05 --- Energy resold (3D), average-data commuting and teleworking (7), asset-specific energy (4, 8, 9, 10, 13, 14) and
# partner-reported scope 1 and 2 (4, 5, 8, 9, 10, 12, 13, 14) (DESIGN 4.3, 4.4).
GRID_BASES = ('subregion', 'us_average')
COMMUTING_AVG_MODES = COMMUTING_MODES + ('non_motorized',)  # walking and cycling: a known zero
COMMUTE_DISTANCE_UNITS = ('mile', 'km')
ELECTRICITY_UNITS = ('kWh', 'MWh')
TELEWORK_GAS_UNITS = ('therm', 'MMBtu', 'scf')
ASSET_CATEGORIES = (4, 8, 9, 10, 13, 14)
ASSET_CARRIERS = ('electricity', 'natural_gas', 'refrigerant')
ASSET_GAS_UNITS = ('therm', 'MMBtu', 'scf', 'ccf', 'mcf')
REFRIGERANT_UNITS = ('kg', 'lb')
AREA_UNITS = ('sqft', 'm2')
PARTNER_CATEGORIES = (4, 5, 8, 9, 10, 12, 13, 14)
PARTNER_ALLOCATION_BASES = ('area', 'volume', 'count', 'revenue', 'mass', 'exclusive', 'other')
SCOPE2_BASES = ('location', 'market', 'unknown')
WAREHOUSE_CATEGORIES = (4, 9)  # third-party warehouses and distribution centres (calculation guidance [4.5])


def _supplement_keys(prefix: str) -> list:
    return sorted(k for k in _register('supplement')['entries'] if k.startswith(prefix))


_NATURAL_GAS_KEYS = lambda: _supplement_keys('hub2025_t1.natural_gas.')
_GRID_RULES = ['Location-based eGRID2023 rev2 total output emission rates: the subregion of the site ZIP (EPA Power Profiler table, the utility EIA id when the ZIP '
               'spans subregions), as for category 3C, or the U.S. rate (US23 U3:W3) where stated; contractual instruments do not change these figures']
_GAS_RULES = ['Natural gas: MMBtu (HHV) = therms x 0.1, MMBtu as stated, or scf x 0.001026 (Hub Table 1 default heat content; ccf = 100 scf, mcf = 1,000 scf); '
              'kg gas = MMBtu x Hub Table 1 factor (CO2 kg, CH4 and N2O g per MMBtu); kg CO2e = CO2 + CH4 x 28 + N2O x 265']
_ENERGY_PARTNER_METHODS = {
    'scope3.cat3d.energy_resold.egrid2023.v1': {
        'profileId': 'scope3.cat3d.energy_resold.egrid2023', 'family': 'fuel_energy_related', 'kind': 'energy_resold', 'gwpSetId': 'AR5-100',
        'title': 'Category 3 activity D: generation of purchased electricity sold to end users (eGRID2023 rev2 output emission rates)',
        'formula': 'MWh resold (kWh x 0.001) x eGRID total output emission rate per gas (lb/MWh; subregion SRL23 or U.S. US23) x 0.45359237; kg CO2e = CO2 + CH4 x 28 + N2O x 265',
        'factorKeys': lambda: _keys('egrid2023.') + _supplement_keys('egrid2023_us.') + GWP_KEYS,
        'constantIds': ['kwh_to_mwh', 'lb_to_kg'],
        'admissionRules': ['Only electricity the company buys and resells to end users (utilities and energy retailers, calculation guidance [3.4]); power the company generates '
                           'and exports is not category 3D. The record states that the resold energy is kept out of the company\'s scope 2 inventory'] + _GRID_RULES
                          + ['Boundary: the combustion emissions of generating the resold electricity; the upstream (cradle-to-gate) part of the life-cycle factor is the '
                             'separate 3D upstream line of the same record (scope3.cat3d.energy_resold_upstream), which closes this line\'s partial note in the aggregate '
                             '(boundaryClosures) when category 3 is included'],
        'estimateRules': ['us_average_grid_rate: the origin of the purchased power is not known, so the U.S. average output emission rate is used'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement'],
        'resultExtras': ('additionalRegisters',),
        'defaultDataQuality': _data_quality(('good', 'very_good', 'good', 'good', 'good'), (
            'Grid-average output emission rates for the origin of the resold electricity',
            'eGRID2023 revision 2, the latest eGRID edition available for 2025 reporting',
            'eGRID subregion of the point of purchase, or the U.S. average when it is not known',
            'The company\'s own purchase-for-resale records',
            'Metered energy records with EPA-published rates')),
    },
    'scope3.cat7.commuting_average.v1': {
        'profileId': 'scope3.cat7.commuting_average', 'family': 'employee_commuting', 'kind': 'commuting_average', 'gwpSetId': 'AR5-100',
        'title': 'Category 7: employee commuting, average data (headcount, mode shares, one-way distances and working days; Hub Table 10)',
        'formula': 'per mode: person-miles = employees x share / 100 x one-way distance (miles, or km / 1.609344 rounded half-even to 12 dp) x 2 x working days; cars, '
                   'light-duty trucks and motorcycles per vehicle-mile = person-miles / occupancy (rounded half-even to 12 dp); rail and bus per passenger-mile; walking '
                   'and cycling a known zero; kg gas = activity x Hub Table 10 factor; kg CO2e = CO2 + CH4 x 28 + N2O x 265 (calculation guidance formula 7.2)',
        'factorKeys': lambda: _gas_keys(TRAVEL_MODES[m][0] for m in COMMUTING_MODES) + GWP_KEYS,
        'constantIds': ['g_to_kg', 'km_per_mile'],
        'admissionRules': ['Average-data method for when commuting distances per employee are not known (calculation guidance [7.2], formula 7.2): headcount, the share '
                           'of employees using each mode (shares total 100%), the typical one-way distance per mode and the working days on site',
                           'Working days exclude weekends, holidays, leave, business travel and days worked from home; they are entered, never defaulted',
                           'A vehicle mode takes the average occupancy (at least 1; drove alone when not given); rail and bus are per passenger and take none',
                           'The company confirms the profile does not overlap distance-based commuting records for the same employees']
                          + DISTANCE_RULES[2:],
        'estimateRules': ['commute_vehicle_occupancy_one: no occupancy was given for a vehicle mode, so each commuter is assumed to drive alone',
                          'intercity_rail_route_average: Amtrak national average used because the route is not known'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': [], 'resultExtras': (),
        'defaultDataQuality': _data_quality(('poor', 'good', 'fair', 'fair', 'poor'), (
            'Average passenger and vehicle factors by mode applied to an average commuting profile',
            'Hub 2025 factors applied to the reporting year\'s profile',
            'U.S. national average factors; distances from a survey or estimate',
            'A survey or estimate of the whole workforce, extrapolated by mode share',
            'Survey responses and assumptions rather than measured distances')),
    },
    'scope3.cat7.teleworking.v1': {
        'profileId': 'scope3.cat7.teleworking', 'family': 'employee_commuting', 'kind': 'teleworking', 'gwpSetId': 'AR5-100',
        'title': 'Category 7 (optional): teleworking, incremental home electricity or natural gas (eGRID2023 rev2; Hub Table 1)',
        'formula': 'electricity: MWh (kWh x 0.001) x eGRID subregion total output rate per gas (lb/MWh) x 0.45359237; ' + _GAS_RULES[0],
        'factorKeys': lambda: _keys('egrid2023.') + _NATURAL_GAS_KEYS() + GWP_KEYS,
        'constantIds': ['g_to_kg', 'kwh_to_mwh', 'lb_to_kg', 'supplement_const.therm_to_mmbtu'],
        'admissionRules': ['Optional activity (Scope 3 Standard Table 5.4; calculation guidance formula 7.1): only the energy used for working from home above the '
                           'household baseline, with the basis stated; no per-employee default is used',
                           'Electricity by the home ZIP\'s eGRID subregion (as for category 3C); natural gas in therms, MMBtu or scf'] + _GAS_RULES,
        'estimateRules': ['default_heat_content: natural gas in scf is converted with the Hub Table 1 default heat content (0.001026 MMBtu per scf)'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'estimate', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement'],
        'resultExtras': ('additionalRegisters',),
        'defaultDataQuality': _data_quality(('good', 'very_good', 'good', 'good', 'good'), (
            'Energy-carrier-specific grid and combustion factors',
            'eGRID2023 revision 2 and Hub 2025 factors for 2025 energy use',
            'eGRID subregion of the home location; U.S. natural gas factors',
            'Incremental home energy above a stated baseline',
            'Company estimates of home energy with EPA-published factors')),
    },
    'scope3.asset_energy.v1': {
        'profileId': 'scope3.asset_energy', 'family': 'leased_assets_franchises_processing', 'kind': 'asset_energy', 'gwpSetId': 'AR5-100',
        'title': 'Categories 4, 8, 9, 10, 13 and 14: asset-specific energy and refrigerant use (eGRID2023 rev2; Hub Tables 1, 11 and 12)',
        'formula': 'share = reporting area / (building area x occupancy / 100), rounded half-even to 12 dp, or 1 when sub-metered (calculation guidance formula 8.2); '
                   'electricity: MWh x share x eGRID total output rate per gas (lb/MWh) x 0.45359237; natural gas: MMBtu x share x Hub Table 1 factor per gas; '
                   'kg CO2e = CO2 + CH4 x 28 + N2O x 265; refrigerant released: kg (lb x 0.45359237) x share x AR5 GWP (Hub Table 11, or Table 12 for a blend)',
        'factorKeys': lambda: _keys('egrid2023.') + _NATURAL_GAS_KEYS() + _supplement_keys('hub2025_gwp.') + GWP_KEYS,
        'constantIds': ['g_to_kg', 'kwh_to_mwh', 'lb_to_kg', 'supplement_const.scf_per_ccf', 'supplement_const.scf_per_mcf', 'supplement_const.therm_to_mmbtu'],
        'admissionRules': ['Asset-specific method (calculation guidance formulas 8.1, 8.2, 14.2; [4.5] for third-party warehouses): the energy and refrigerant use of one asset '
                           'leased in (8) or out (13), a franchise (14), a site processing sold products (10), or a third-party warehouse or distribution centre (4, 9)',
                           'Not sub-metered: the building\'s energy is allocated by floor area, reporting area / (building area x occupancy), both areas in one unit; '
                           'a share above one is never calculated',
                           'Leases follow the company\'s consolidation approach (Scope 3 Standard Tables A.1 and A.2): a lease whose asset belongs in the company\'s own '
                           'scope 1 and 2 is held before calculation'] + _GRID_RULES + _GAS_RULES
                          + ['Refrigerant released (leaked or recharged) in kg or lb of a Hub Table 11 gas or Table 12 blend; a blend\'s GWP counts only its HFC and PFC constituents',
                             'The life cycle (construction or manufacture) of the asset is optional and not included'],
        'estimateRules': ['default_heat_content: natural gas in scf, ccf or mcf is converted with the Hub Table 1 default heat content (0.001026 MMBtu per scf)',
                          'area_allocated_not_submetered: the building\'s energy is allocated to the asset by floor area and occupancy'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'value_chain_partner', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement'],
        'resultExtras': ('additionalRegisters',),
        'defaultDataQuality': _data_quality(('good', 'very_good', 'good', 'good', 'good'), (
            'The asset\'s own metered energy and refrigerant use with carrier-specific factors',
            'eGRID2023 revision 2 and Hub 2025 factors for 2025 energy use',
            'eGRID subregion of the asset; U.S. fuel factors',
            'The asset\'s energy records for the period, allocated by area where not sub-metered',
            'Utility or meter data from the lessor, lessee, franchisee or processor with EPA-published factors')),
    },
    'scope3.partner_reported.v1': {
        'profileId': 'scope3.partner_reported', 'family': 'leased_assets_franchises_processing', 'kind': 'partner_reported', 'gwpSetId': 'AS-REPORTED',
        'title': 'Categories 4, 5, 8, 9, 10, 12, 13 and 14: partner-reported scope 1 and 2 emissions, allocated to the reporting company',
        'formula': 'kg CO2e = partner scope 1 and 2 kg CO2e (metric tons x 1000) x numerator / denominator (rounded half-even to 12 dp), or x 1 for an asset used '
                   'only by the reporting company (calculation guidance formulas 8.3, 14.1)',
        'factorKeys': lambda: [], 'constantIds': ['metric_ton_to_kg'],
        'admissionRules': ['The partner\'s own scope 1 and 2 total (lessor, lessee, franchisee, processor, carrier, warehouse or waste contractor), with its evidence, '
                           'its scope 2 basis (location or market), the GWP basis it declares and whether it was verified',
                           'Allocated by area, volume, count, revenue, mass or another stated basis (numerator / denominator, rounded half-even to 12 dp and listed); '
                           'exclusive when the asset serves only the reporting company; a share above one is never calculated and a zero denominator needs input',
                           'A partner figure for another period than the reporting period is held for review',
                           'Partner CO2e is used as reported, in the GWP set the partner declares (AS-REPORTED), never restated or split by gas',
                           'Leases follow the company\'s consolidation approach (Scope 3 Standard Tables A.1 and A.2), as for asset energy'],
        'estimateRules': [],
        'methodType': 'partner_reported', 'activityDataOrigin': 'value_chain_partner', 'biogenicTreatment': 'as_reported', 'additionalRegisters': [], 'resultExtras': (),
        'defaultDataQuality': _data_quality(('very_good', 'good', 'very_good', 'good', 'very_good'), (
            'The partner\'s own scope 1 and 2 inventory',
            'Partner data for the reporting period',
            'The partner\'s own sites',
            'The partner\'s inventory boundary, allocated to the reporting company',
            'Third-party verified partner data')),
        'defaultDataQualityUnverified': _data_quality(('very_good', 'good', 'very_good', 'good', 'fair'), (
            'The partner\'s own scope 1 and 2 inventory',
            'Partner data for the reporting period',
            'The partner\'s own sites',
            'The partner\'s inventory boundary, allocated to the reporting company',
            'Partner data that no third party has verified')),
    },
}
# --- I-07 --- Use of sold products (11: fuels sold, energy-using products, products containing greenhouse gases), end of life of
# sold products (12, by treatment split) and investments (15: investee- or project-reported, or revenue x EEIO) (DESIGN 4.4).
SOLD_FUEL_USES = ('yes', 'no_feedstock')
# Hub 2025 Table 1 heat-content units -> the collection's normalized unit of the fuel (the other accepted unit is MMBtu).
FUEL_UNITS = {'mmBtu per gallon (HHV)': 'US_gallon', 'mmBtu per scf (HHV)': 'scf', 'mmBtu per short ton (HHV)': 'short_ton'}
# Fuels EPA Hub 2025 Table 2 (Mobile Combustion CO2, rows 104-113) also lists as transport fuels, as Table 1 rows: Aviation
# Gasoline, Biodiesel (100%), Diesel Fuel (distillate No. 2), Ethanol (100%), Kerosene-Type Jet Fuel, LPG (and propane, its main
# component, sold as autogas or in cylinders), Motor Gasoline, Residual Fuel Oil (No. 6: 0.150 x 75.10 = 11.265, Table 2's
# 11.27). Their CH4 and N2O use Table 1's stationary factors as a proxy: mobile CH4 and N2O depend on the vehicle, which the
# seller does not know (disclosed). Round 2 (ACC-17, r4.1 C4-170/C4-172): Table 1 natural gas is pipeline gas, burned in
# stationary equipment (CNG has no Table 1 row of its own), so it no longer carries the note; propane does.
TRANSPORT_FUELS = ('aviation_gasoline', 'biodiesel_100', 'distillate_fuel_oil_no_2', 'ethanol_100', 'kerosene_type_jet_fuel', 'liquefied_petroleum_gases_lpg',
                   'motor_gasoline', 'propane', 'residual_fuel_oil_no_6')
LIFETIME_BASES = ('years', 'uses')
USE_REGION_US, USE_REGION_NON_US = 'US', 'non_US'
EOL_BASES = ('sold_products', 'packaging')
CHARGE_UNITS = ('kg', 'lb')
HOLDING_TYPES = ('equity_listed', 'equity_unlisted', 'jv_associate', 'debt_known_use', 'project_finance', 'debt_general', 'other')
# Calculation guidance Table 15.2 (p.139): general corporate debt and other investments are optional; the others are required (Table 15.1).
OPTIONAL_HOLDING_TYPES = ('debt_general', 'other')
INVESTMENT_PATHS = {'investee_reported': 'scope3.cat15.investment_reported.v1', 'project_reported': 'scope3.cat15.investment_reported.v1',
                    'revenue_eeio': 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1'}
ATTRIBUTION_DENOMINATORS = ('evic', 'total_equity_plus_debt', 'total_project_cost')
LIFETIME_YEARS_CHECK = 30  # research methods-downstream R7: plausibility flags, never holds
ANNUAL_KWH_CHECK = 50000


def _sold_fuels() -> dict:
    """R3's Hub 2025 Table 1 fuels: token -> (normalized unit, biomass?)."""
    sup = _register('supplement')['entries']
    return {k.split('.')[1]: (FUEL_UNITS[e['unit']], 'Biomass' in sup[k.replace('.heat_content', '.co2')]['table'])
            for k, e in sorted(sup.items()) if k.startswith('hub2025_t1.') and k.endswith('.heat_content')}


_FUEL_RULES = ['Fuel energy: MMBtu (HHV) as stated, or the quantity in the fuel\'s Hub 2025 Table 1 unit (gallon, scf or short ton) x its default heat content; '
               'kg CO2 = MMBtu x Table 1 kg CO2 per MMBtu; kg CH4 and N2O = MMBtu x Table 1 g per MMBtu x 0.001; kg CO2e = CO2 + CH4 x 28 + N2O x 265',
               'Biomass fuels (Table 1 sections "Biomass Fuels", peat included as EPA lists it): CO2 is biogenic and reported separately, outside every total; '
               'their CH4 and N2O are counted (Scope 3 Standard 6.2, p.60)',
               'Transport fuels (those Hub Table 2 lists) use Table 1 stationary CH4 and N2O factors as a proxy: mobile CH4 and N2O depend on the vehicle, which the '
               'seller does not know']
_DOWNSTREAM_METHODS = {
    'scope3.cat11.sold_fuel.hub2025.v1': {
        'profileId': 'scope3.cat11.sold_fuel.hub2025', 'family': 'use_of_sold_products', 'kind': 'sold_fuel', 'gwpSetId': 'AR5-100',
        'title': 'Category 11: fuels sold, combusted by their users (Hub 2025 Table 1; biogenic CO2 of biomass fuels reported separately)',
        'formula': 'MMBtu = quantity x Hub Table 1 default heat content (or MMBtu as stated); kg CO2 = MMBtu x kg CO2 per MMBtu (biomass fuels: biogenic CO2, '
                   'reported separately and never in the total); kg CH4 and N2O = MMBtu x g per MMBtu x 0.001; kg CO2e = CO2 + CH4 x 28 + N2O x 265; a feedstock '
                   'not combusted in use is a known zero (calculation guidance formula 11.2)',
        'factorKeys': lambda: _supplement_keys('hub2025_t1.') + GWP_KEYS,
        'constantIds': ['g_to_kg'],
        'admissionRules': ['Fuels and feedstocks sold in the reporting year (calculation guidance [11.2], p.118): the combustion of the fuel by its users, the '
                           'minimum boundary; the fuel\'s upstream emissions are not included',
                           'A fuel sold as a feedstock and not combusted in use is a known zero, with that reason, never left out'] + _FUEL_RULES,
        'estimateRules': ['fuel_default_heat_content: a quantity in the fuel\'s physical unit is converted with the Hub 2025 Table 1 default heat content, not a supplier-stated value'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'quantified', 'additionalRegisters': ['supplement'],
        'resultExtras': ('additionalRegisters', 'biogenicCo2'),
        'defaultDataQuality': _data_quality(('fair', 'very_good', 'good', 'fair', 'fair'), (
            'Fuel-specific combustion factors, but the users\' combustion technology is not known (stationary CH4 and N2O factors)',
            'Hub 2025 factors for fuel sold in the reporting year',
            'U.S. fuel properties for fuel sold to U.S. users',
            'The company\'s sales records by fuel; how users burn the fuel is assumed',
            'EPA-published factors applied to the company\'s sales records')),
    },
    'scope3.cat11.sold_energy_product.v1': {
        'profileId': 'scope3.cat11.sold_energy_product', 'family': 'use_of_sold_products', 'kind': 'sold_energy_product', 'gwpSetId': 'AR5-100',
        'title': 'Category 11: products that use electricity or fuel directly, over their expected lifetime (eGRID2023 rev2; Hub 2025 Table 1)',
        'formula': 'lifetime energy = units sold x lifetime (years or uses) x energy per year or use; electricity: MWh (kWh x 0.001) x eGRID2023 rev2 output '
                   'emission rate of the region of use (subregion SRL23, or U.S. US23) x 0.45359237 per gas; fuel: as fuels sold (Hub Table 1); '
                   'kg CO2e = CO2 + CH4 x 28 + N2O x 265 (calculation guidance formula 11.1)',
        'factorKeys': lambda: _keys('egrid2023.') + _supplement_keys('egrid2023_us.') + _supplement_keys('hub2025_t1.') + GWP_KEYS,
        'constantIds': ['g_to_kg', 'kwh_to_mwh', 'lb_to_kg', 'supplement_const.therm_to_mmbtu'],
        'admissionRules': ['Products that directly consume energy in use, sold in the reporting year (Scope 3 Standard Table 5.8): their expected lifetime use-phase '
                           'emissions, the minimum boundary; indirect use-phase emissions are optional and not included',
                           'The lifetime and the energy per year or per use need a stated source (product specification or test standard); there is no default',
                           'Electricity in the U.S.: the reporting year\'s eGRID2023 rev2 rate of the region of use (an eGRID subregion, or the U.S. average), '
                           'with no projected change over the product\'s lifetime (calculation guidance p.120); use outside the U.S. has no verified grid factor '
                           'here and is held, never counted as zero'] + _FUEL_RULES
                          + ['Natural gas may also be stated in therms: MMBtu = therms x 0.1 exactly (Hub Table 1 footnote; no default heat content is involved)'],
        'estimateRules': ['lifetime_over_30_years_check: a lifetime above 30 years is flagged for review (plausibility, never a hold)',
                          'annual_kwh_over_50000_check: more than 50,000 kWh a year per unit is flagged for review (plausibility, never a hold)',
                          'fuel_default_heat_content: a fuel quantity in its physical unit is converted with the Hub 2025 Table 1 default heat content'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'quantified', 'additionalRegisters': ['supplement'],
        'resultExtras': ('additionalRegisters', 'biogenicCo2'),
        'defaultDataQuality': _data_quality(('fair', 'very_good', 'good', 'fair', 'fair'), (
            'Product energy use from specifications or test standards, not measured in the field',
            'Reporting-year grid and fuel factors for products sold in the reporting year',
            'eGRID subregion or U.S. average of the region of use',
            'Units sold from sales records; lifetime and use profile assumed',
            'Manufacturer or test-standard energy data with EPA-published factors')),
    },
    'scope3.cat11.sold_ghg_product.hub2025.v1': {
        'profileId': 'scope3.cat11.sold_ghg_product.hub2025', 'family': 'use_of_sold_products', 'kind': 'sold_ghg_product', 'gwpSetId': 'AR5-100',
        'title': 'Category 11: products that contain greenhouse gases released during use (Hub 2025 Tables 11 and 12, AR5)',
        'formula': 'kg gas released = units sold x charge per unit (kg, or lb x 0.45359237) x use-phase release percent / 100; kg CO2e = kg released x AR5 '
                   '100-year GWP (Hub Table 11, or Table 12 for a blend) (calculation guidance formula 11.3); memo (outside totals, an upper bound): the charge '
                   'left at end of life = units sold x charge per unit x (100 - use-phase release percent) / 100 x the same GWP',
        'factorKeys': lambda: _supplement_keys('hub2025_gwp.'),
        'constantIds': ['lb_to_kg'],
        'admissionRules': ['Products that contain greenhouse gases released during use (calculation guidance [11.3]): the share released during use is required '
                           'with its basis; there is no 100% default, because release at end of life belongs in category 12',
                           'Gases of Hub Table 11 and blends of Table 12; a blend\'s GWP counts only its HFC and PFC constituents (Table 12 note); HCFCs are not listed',
                           'Round 3 (owner decision 3): the charge left at end of life is memoed outside every total as an upper bound of its release (no '
                           'recovery assumed); category 12 discloses that this release is not quantified there'],
        'estimateRules': [],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement'],
        'resultExtras': ('additionalRegisters', 'memoItems'),
        'defaultDataQuality': _data_quality(('fair', 'very_good', 'good', 'fair', 'fair'), (
            'Charge from product specifications; the use-phase release share is an assumption with a stated basis',
            'AR5 GWPs and products sold in the reporting year',
            'Global GWPs; release depends on where and how the product is used',
            'Units sold from sales records; release share assumed',
            'Manufacturer charge data and a stated release basis with EPA-published GWPs')),
    },
    'scope3.cat12.end_of_life_split.v1': {
        'profileId': 'scope3.cat12.end_of_life_split', 'family': 'waste', 'kind': 'end_of_life_split', 'gwpSetId': 'AR4-100',
        'title': 'Category 12: end of life of sold products and their packaging, by treatment split (Hub Table 9)',
        'formula': 'short tons = mass as for waste (lb / 2000, kg / (0.45359237 x 2000) or metric tons x 1000 / (0.45359237 x 2000), rounded half-even to 12 dp); per '
                   'treatment: short tons x share / 100 x factor (metric tons CO2e per short ton) x 1000; kg CO2e = sum over the treatments (calculation guidance formula 12.1)',
        'factorKeys': lambda: _keys('waste.'),
        'constantIds': ['lb_per_short_ton', 'lb_to_kg', 'metric_ton_to_kg'],
        'admissionRules': ['The mass of products (or their packaging) sold in the reporting year, by the share of each end-of-life treatment (recycled, landfilled, '
                           'combusted, composted, anaerobic digestion), with the basis of the split; the shares total exactly 100%',
                           'An unknown split is held, never assumed; a treatment EPA marks NA for the material with a share above zero is held',
                           'Factors are Hub Table 9 CO2e computed by EPA with AR4 GWPs (results carry AR4-100); avoided emissions are excluded'],
        'estimateRules': [],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'not_in_factor', 'additionalRegisters': [], 'resultExtras': (),
        'defaultDataQuality': _data_quality(('fair', 'good', 'good', 'fair', 'good'), (
            'Material and treatment specific, but average facilities (Hub Table 9, from EPA WARM)',
            'Hub 2025 edition of WARM-based factors whose underlying data years vary',
            'U.S. national average factors',
            'Product and packaging mass from sales records; the treatment split is assumed with a stated basis',
            'EPA-published factors applied to the company\'s records')),
    },
    'scope3.cat15.investment_reported.v1': {
        'profileId': 'scope3.cat15.investment_reported', 'family': 'investments', 'kind': 'investment', 'gwpSetId': 'AS-REPORTED',
        'title': 'Category 15: investments and project finance, investee- or project-reported scope 1 and 2 x the investment-specific attribution share',
        'formula': 'attribution share = outstanding amount / denominator (EVIC, total equity plus debt, or total project cost; rounded half-even to 12 dp), or equity '
                   'share percent / 100; kg CO2e = reported scope 1 and 2 (metric tons CO2e x 1000) x share (calculation guidance formulas 15.1 and 15.3); '
                   'projected lifetime emissions of a project (annual x years x share) are a memo item, reported separately and never in the total',
        'factorKeys': lambda: [], 'constantIds': ['metric_ton_to_kg'],
        'admissionRules': ['Required investments (Scope 3 Standard Table 5.9; calculation guidance Table 15.1): equity not in the company\'s scope 1 and 2, debt with '
                           'known use of proceeds and project finance; general corporate debt and other investments are optional (Table 15.2) and disclosed when included',
                           'The investee\'s or project\'s own scope 1 and 2 in metric tons CO2e, with its GWP basis and whether it was verified; investee scope 3 is not included',
                           'Attribution PCAF-style: the outstanding amount over EVIC (listed companies), total equity plus debt, or total project cost; or the equity share; '
                           'a share above one is never calculated',
                           'Data-quality score PCAF-style from the input path: 1 for verified, 2 for unverified reported emissions (PCAF Part A, as summarised in the '
                           'research; the PCAF factor database is not used)',
                           'Initial sponsors and lenders of a project report its projected lifetime scope 1 and 2 separately from the scope 3 total (calculation guidance p.151)'],
        'estimateRules': [],
        'methodType': 'partner_reported', 'activityDataOrigin': 'value_chain_partner', 'biogenicTreatment': 'as_reported', 'additionalRegisters': [], 'resultExtras': ('memoItems',),
        'defaultDataQuality': _data_quality(('very_good', 'good', 'very_good', 'good', 'very_good'), (
            'The investee\'s or project\'s own scope 1 and 2 inventory',
            'Investee data for the reporting period',
            'The investee\'s own operations',
            'The investee\'s scope 1 and 2 boundary, attributed by the investment share',
            'Third-party verified investee data')),
        'defaultDataQualityUnverified': _data_quality(('very_good', 'good', 'very_good', 'good', 'fair'), (
            'The investee\'s or project\'s own scope 1 and 2 inventory',
            'Investee data for the reporting period',
            'The investee\'s own operations',
            'The investee\'s scope 1 and 2 boundary, attributed by the investment share',
            'Investee data that no third party has verified')),
    },
    'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1': {
        'profileId': 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3', 'family': 'investments', 'kind': 'investment', 'gwpSetId': 'AR5-100',
        'title': 'Category 15: investments, investee revenue x EPA Supply Chain GHG Emission Factors v1.3 without margins x attribution share (an upper-bound proxy)',
        'formula': 'kg CO2e = investee revenue (USD) x factor without margins (kg CO2e per 2022 USD, NAICS-6 of the investee) x r x attribution share; r = I2022 / '
                   'I(revenue year) of the BEA GDP implicit price deflator, rounded half-even to 12 dp (none for 2022 dollars); share as for reported investments '
                   '(calculation guidance formula 15.2)',
        'factorKeys': lambda: sorted(k for k in _register('spend')['entries'] if k.endswith('.without_margins')),
        'constantIds': lambda: _spend_constant_ids() + ['metric_ton_to_kg'],
        'admissionRules': ['Average-data method for an investment whose emissions the investee does not report: its revenue x a sector factor (calculation guidance '
                           '[15.2], p.143-144)',
                           'The EPA v1.3 factor is cradle to factory gate per dollar of the sector\'s output, so it includes the investee\'s upstream emissions: the result is '
                           'an upper-bound proxy for the investee\'s scope 1 and 2, disclosed as such (calculation guidance p.143)',
                           'Revenue not in 2022 dollars is converted with the BEA GDP implicit price deflator (an economy-wide index); a year without a registered index is held',
                           'Data-quality score PCAF-style 4 (revenue with a sector emission factor)'],
        'estimateRules': ['revenue_economy_wide_price_index: the revenue year is not 2022, so the BEA GDP implicit price deflator stands in for commodity-specific indexes'],
        'methodType': 'proxy', 'activityDataOrigin': 'estimate', 'biogenicTreatment': 'not_in_factor', 'additionalRegisters': ['spend'],
        'resultExtras': ('additionalRegisters', 'memoItems'),
        'defaultDataQuality': _data_quality(('poor', 'good', 'fair', 'fair', 'fair'), (
            'Economic sector average per dollar of revenue, including the investee\'s upstream (not its own scope 1 and 2)',
            'U.S. GHG data for 2022 in 2022 dollars, deflated with an economy-wide index',
            'U.S. national sector averages, whatever the investee\'s location',
            'Revenue of the investee from its accounts; the sector mapping is the company\'s',
            'EPA-published factors applied to the investee\'s revenue')),
    },
}
# --- I-12u --- Category 3 upstream from US free sources (DESIGN 13.1-13.3): 3A upstream of purchased fuels, 3B upstream of
# purchased electricity, 3C upstream of electricity lost in transmission and distribution, 3D upstream of energy resold.
UPSTREAM_SOURCES = ('natural_gas', 'distillate_no2', 'vehicle')  # the Scope 1 record kinds a 3A line follows
# The Scope 1 engine's vehicle fuels (scope1_engine.vehicle: gasoline and diesel only) mapped to the CA-GREET3.0 pathway, and
# stationary No. 2 distillate to ULSD (a proxy, disclosed). Propane is registered but no Scope 1 record of it reaches 3A.
VEHICLE_UPSTREAM_FUELS = {'gasoline': 'carbob', 'diesel': 'ulsd'}
LIQUID_UPSTREAM = {'carbob': ('carb_lcfs.energy_density.carbob', 'cagreet3_lut2018.carbob.upstream'),
                   'ulsd': ('carb_lcfs.energy_density.ulsd', 'cagreet3_lut2018.ulsd.upstream'),
                   'propane': ('carb_lcfs.energy_density.propane', 'cagreet3_lut2018.propane_weighted.upstream')}
NG_HEAT_CONTENT_UNITS = ('MMBtu per scf', 'MMBtu per ccf', 'MMBtu per mcf', 'therm per ccf')  # scope1_engine.natural_gas
SCOPE1_FACTOR_TEXT = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?')  # scope1_engine.FACTOR_TEXT (stated heat content)
# eGRID2023 plant primary fuel categories (PLFUELCT). Round 2 (ACC-14): fossil = coal, gas, other fossil and oil; OTHF ("other
# fuel": waste heat, purchased steam, tyres, hydrogen and the like) is not assumed fossil and is disclosed apart as an unmapped
# other fuel; nuclear, biomass and renewable-primary plants have no fossil upstream counted here (a static, excludable note).
POWER_FOSSIL_FUELS = ('COAL', 'GAS', 'OFSL', 'OIL')
POWER_OTHER_FUELS = ('OTHF',)
POWER_NON_FOSSIL_FUELS = ('BIOMASS', 'HYDRO', 'NUCLEAR', 'SOLAR', 'WIND')
# Fossil fuels with an upstream factor (kg CO2e per MMBtu HHV). Natural gas: NETL production through transmission (R5 exact
# constant). Oil (round 2, owner decision 2): the CA-GREET3.0 ULSD upstream converted to HHV, kg/MMBtu = UP_ulsd (g/MJ LHV) x
# ED_ulsd (MJ/gal LHV) / 1000 / Hub 2025 distillate No. 2 heat content (MMBtu/gal HHV), rounded 12 dp and listed; disclosed
# `oil_fired_upstream_proxied_by_ulsd` (conservative: residual oil needs less refining). Coal (round 2, lane F; DESIGN 13.6,
# owner decision): a derived, methane-only term, F_COAL = round12(EPA GHGI 2022 coal mining CH4 (MMT CO2e, AR5) x 10^9 kg/MMT /
# (EIA 2022 coal production (thousand short tons) x 1000 x EIA 2022 coal production heat content (MMBtu/short ton, HHV))),
# rounded once, listed per line and checked against R5's constant; every line with coal heat input stays partial
# (`coal_upstream_mine_methane_only`: mining energy and transport CO2 not included). Other fossil (OFSL) stays unmapped (no
# free source prints a value) and is memoed, never zero.
OIL_HHV_KEY = 'hub2025_t1.distillate_fuel_oil_no_2.heat_content'
COAL_NOTE = 'coal_upstream_mine_methane_only'
POWER_FUEL_UPSTREAM = {'GAS': ('netl2024_4862.ng_upstream.prod_through_transmission', 'us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv'),
                       'OIL': ('carb_lcfs.energy_density.ulsd', 'cagreet3_lut2018.ulsd.upstream', OIL_HHV_KEY),
                       'COAL': ('epa_ghgi.2022.coal_mining_ch4_total', 'eia.2022.coal_production_short_tons', 'eia.2022.coal_heat_content_production',
                                'us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv')}
COAL_UNIT_CONSTANTS = ('us_upstream_const.kg_per_million_metric_tons', 'us_upstream_const.short_tons_per_thousand_short_tons')
NG_DISTRIBUTION = ('netl2024_4862.ng_upstream.prod_through_distribution', 'us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv')
UPSTREAM_GWP_SET = 'AS-PUBLISHED'
# Round 3, lane A (ROUND3.md owner decision 2, AC-1): every line with coal heat input memos the coal mining energy and transport
# CO2 it omits as a SCREENING RANGE, outside every total: low = coal MMBtu x NPC 2011 Table 7 coal upstream combustion (5.0 lb
# CO2e/MMBtu, AR4) x 0.45359237 kg/lb; high = coal MMBtu x (Abrahams et al. 2015 Table S7 coal upstream 12.2 g CO2e/MJ x
# 1055.05585262 MJ/MMBtu x 0.001 - F_COAL, the mine methane already counted). Older vintages, heating value not stated,
# a non-IPCC methane GWP in Abrahams: disclosed (`coal_upstream_omitted_screening_range_memo`), never a figure.
COAL_SCREENING = ('coal_upstream.npc2011.us_average.upstream_combustion', 'coal_upstream.abrahams2015_cmu.us_average')
COAL_SCREENING_MEMO = ('coal_upstream_omitted_screening_low', 'coal_upstream_omitted_screening_high')
COAL_SCREENING_NOTE = 'coal_upstream_omitted_screening_range_memo'
# Round 3 (AC-7): the coal term's GWP basis has its own note code, and each line lists the GWP basis of every mapped term.
COAL_GWP_NOTE = 'upstream_gwp_ar5_coal_mine_methane'
POWER_FUEL_GWP_BASIS = {'COAL': 'IPCC AR5 100-year (EPA GHGI coal mine methane)', 'GAS': 'IPCC AR6 100-year (NETL, as published)',
                        'OIL': 'IPCC AR4 100-year, inferred (CA-GREET3.0; CARB states none)'}
# Round 3 (AC-6): heat input at solar-primary plants is gas co-fired at solar-thermal plants (fossil); its upstream is not
# counted, so the line memos it (MMBtu) and is partial (`solar_thermal_cofiring_upstream_not_counted`, not excludable).
SOLAR_NOTE = 'solar_thermal_cofiring_upstream_not_counted'
# DESIGN 4.6: a combustion-only line closed by its upstream line (identical input), with the partial note the closure removes.
CLOSURE_PAIRS = {'scope3.cat3.td_losses.egrid2023.v1': ('scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', 'combustion_only_upstream_of_lost_energy_excluded'),
                 'scope3.cat3d.energy_resold.egrid2023.v1': ('scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1', 'upstream_of_resold_energy_excluded')}


def _us_upstream_keys(prefix: str) -> list:
    return sorted(k for k in _register('us_upstream')['entries'] if k.startswith(prefix))


_UPSTREAM_DQ = _data_quality(('fair', 'good', 'very_good', 'fair', 'good'), (
    'Average U.S. supply-chain intensities by fuel (NETL natural gas; CA-GREET3.0 ULSD as a proxy for oil), not the supplier\'s own chain; electricity by the subregion\'s heat-input mix',
    'NETL 2020 supply-chain data (published January 2025) and eGRID2023 rev2 for 2025 energy use',
    'U.S. natural gas supply chain and the eGRID subregion of the site (U.S. average where stated)',
    'Fossil fuels without an upstream factor (other fossil) and other fuels are not counted; each line names them and memos their heat input',
    'Government-published factors (two agreeing verbatim transcriptions) applied to the company\'s metered energy records'))
# Round 2, lane F (DESIGN 13.6): an upstream electricity line with coal heat input (note `coal_upstream_mine_methane_only`).
# Round 3 (AC-9): geography good, not very good: the coal term is a national average of mine methane (surface and underground
# basins differ several-fold), not the mines that supply the subregion's plants.
_UPSTREAM_COAL_DQ = _data_quality(('fair', 'good', 'good', 'poor', 'good'), (
    'Average U.S. supply-chain intensities by fuel; coal by U.S. coal mine methane per MMBtu of U.S. coal production, not the supplying mines',
    'EPA GHGI 2022 coal mine methane and EIA 2022 coal production; NETL 2020 natural gas; eGRID2023 rev2 for 2025 energy use',
    'U.S. national averages of coal mine methane and the natural gas supply chain, not the basins that supply the subregion\'s plants (eGRID subregion heat input)',
    'Coal upstream counts mine methane only: coal mining energy and coal transport CO2 are not included; other fossil and other fuels are not counted',
    'Government-published values (two agreeing verbatim transcriptions) combined in one listed division and applied to the company\'s metered energy records'))
_UPSTREAM_LIQUID_DQ = _data_quality(('fair', 'fair', 'fair', 'good', 'good'), (
    'California pathway carbon intensities (CA-GREET3.0) for petroleum fuels, a proxy for the fuel actually bought',
    'CA-GREET3.0 lookup values of 2018 applied to 2025 fuel use',
    'California crude slate and refineries, not necessarily the fuel\'s own origin',
    'The fuel quantities of the same Scope 1 records',
    'CARB-published values (two agreeing verbatim transcriptions) applied to the company\'s fuel records'))
_UPSTREAM_ELECTRICITY_RULES = [
    'U(s) = sum over fuels with an upstream factor of round12(eGRID2023 plant heat input from combustion of that primary fuel in the subregion (PLNT23 PLHTIAN, '
    'MMBtu) / subregion annual net generation (SRL23 SRNGENAN, MWh)) x the fuel\'s upstream factor (kg CO2e per MMBtu); natural gas: NETL production through '
    'transmission 7.8 g CO2e/MJ = 8.229435650436 kg CO2e per MMBtu (power plants take gas from the transmission system)',
    'Oil-fired generation: CA-GREET3.0 ULSD upstream (Total - Tailpipe, g CO2e/MJ LHV) x the CARB LCFS diesel energy density (MJ/gal LHV) x 0.001 / the Hub 2025 '
    'distillate No. 2 heat content (MMBtu/gal HHV), rounded half-even to 12 dp and listed: a proxy for residual and distillate oil burned at power plants '
    '(conservative, since residual oil needs less refining)',
    'Heat input is HHV (40 CFR 72.2 gross calorific value and the EIA gross heat content convention behind eGRID; the eGRID Technical Guide states no basis), '
    'matching NETL\'s HHV basis and the HHV conversion of the oil factor; heat input is allocated by plant primary fuel',
    'Coal-fired generation (round 2, DESIGN 13.6): coal mine methane only, F_COAL = round12(EPA GHGI 1990-2022 Table 3-1 coal mining CH4 2022 (43.6 MMT CO2e, '
    'AR5) x 10^9 kg / (EIA MER Table 6.1 2022 coal production (594,155 thousand short tons) x 1000 x EIA MER Table A5 2022 coal production heat content (20.100 '
    'MMBtu per short ton, gross)) = 3.650822140444 kg CO2e per MMBtu (HHV), listed; coal mining energy and coal transport CO2 are not included, so every line '
    'with coal heat input is partial (not excludable) and memos its coal heat input (MMBtu)',
    'Other fossil fuels (eGRID OFSL; no free source prints an upstream value) and other fuels (eGRID OTHF) leave the line partial, never zero: each line lists them '
    'with the share of fossil heat input not mapped and the heat input not mapped attributable to the line (MMBtu), a memo outside every total',
    'A subregion with fossil heat input but no fuel with an upstream factor is held (no_upstream_factor_for_subregion_fuels); one without fossil heat input is a '
    'stated zero (no_fossil_generation_in_subregion); the upstream of nuclear, biomass and renewable-primary plants is never counted (a static, excludable note)',
    'CO2e as published: NETL IPCC AR6 100-year GWPs, CA-GREET3.0 inferred AR4, EPA GHGI coal mine methane AR5; category 3 mixes GWP bases (disclosed); '
    'each line lists the GWP basis of every mapped term (gwpBasisByFuel)',
    'Round 3 (owner decision 2): a line with coal heat input memos, outside every total, a screening range of the coal mining energy and transport CO2 it '
    'omits: low = coal MMBtu x NPC 2011 Table 7 coal upstream combustion 5.0 lb CO2e/MMBtu x 0.45359237 kg/lb (AR4); high = coal MMBtu x (Abrahams et al. '
    '2015 Table S7 coal upstream 12.2 g CO2e/MJ x 1055.05585262 MJ/MMBtu x 0.001 - the counted mine methane factor); older vintages, heating value not '
    'stated, a non-IPCC methane GWP in Abrahams; a screening estimate, never a figure',
    'Heat input at solar-primary plants (gas co-fired at solar-thermal plants) is fossil but has no upstream counted: memoed (MMBtu) and the line is partial']
_ELECTRICITY_UPSTREAM_KEYS = lambda: (_supplement_keys('egrid2023_hi.') + _supplement_keys('egrid2023_gen.') + [POWER_FUEL_UPSTREAM['GAS'][0]]
                                      + list(POWER_FUEL_UPSTREAM['OIL']) + list(POWER_FUEL_UPSTREAM['COAL'][:3]) + list(COAL_SCREENING))
_ELECTRICITY_UPSTREAM_CONSTANTS = ['g_to_kg', 'kwh_to_mwh', 'us_upstream_const.mj_per_mmbtu', POWER_FUEL_UPSTREAM['GAS'][1], POWER_FUEL_UPSTREAM['COAL'][3], *COAL_UNIT_CONSTANTS,
                                   'lb_to_kg']  # round 3: the low end of the coal screening memo (lb CO2e -> kg CO2e)
# Round 2, lane F: the default data quality of a line that carries the coal methane-only term (DESIGN 13.6).
_UPSTREAM_ELECTRICITY_DQ_BY_NOTE = {COAL_NOTE: _UPSTREAM_COAL_DQ}
_UPSTREAM_METHODS = {
    'scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1': {
        'profileId': 'scope3.cat3a.upstream_fuels.us_netl2024_cagreet3', 'family': 'fuel_energy_related', 'kind': 'fuel_upstream', 'gwpSetId': UPSTREAM_GWP_SET,
        'title': 'Category 3 activity A: upstream (cradle-to-gate) of purchased fuels (NETL 2024 natural gas supply chain; CA-GREET3.0 petroleum and propane pathways)',
        'formula': 'natural gas: kg CO2e = MMBtu (HHV; the Scope 1 engine\'s rules: therms x 0.1, MMBtu as stated, or volume x the heat content stated on the bill, '
                   'a division by 100 or 1,000 listed) x 9.284491503056 (NETL production through distribution 8.8 g CO2e/MJ x 1055.05585262 MJ/MMBtu / 1000); '
                   'liquid fuels: kg CO2e = gallons (as Scope 1: measured, or purchases + opening - closing tank) x CARB LCFS energy density (MJ/gal, LHV) x '
                   'CA-GREET3.0 upstream carbon intensity (Total - Tailpipe, g CO2e/MJ, LHV) x 0.001',
        'factorKeys': lambda: [NG_DISTRIBUTION[0]] + sorted(k for pair in LIQUID_UPSTREAM.values() for k in pair if k not in ('carb_lcfs.energy_density.propane', 'cagreet3_lut2018.propane_weighted.upstream')),
        'constantIds': ['g_to_kg', 'supplement_const.scf_per_ccf', 'supplement_const.scf_per_mcf', 'supplement_const.therm_to_mmbtu', 'us_upstream_const.mj_per_mmbtu', NG_DISTRIBUTION[1]],
        'admissionRules': ['One line per Scope 1 natural gas, stationary No. 2 distillate or vehicle record when category 3 is included (it inherits that record\'s 2025 '
                           'period; Scope 1 and 2 for later periods are a separate package); a Scope 1 record held for input '
                           'holds its line with the same reasons, and a fuel without a verified upstream factor waits for one (never zero)',
                           'Natural gas energy follows the Scope 1 engine exactly (a volume needs the heat content stated on the bill); the NETL production-through-'
                           'distribution intensity covers extraction, processing, transmission, storage and distribution (U.S. 2020, HHV)',
                           'Vehicle fuels as Scope 1 resolves them: gasoline -> CA-GREET3.0 CARBOB, diesel -> ULSD; stationary No. 2 distillate -> ULSD (a proxy); '
                           'energy density and carbon intensity are both lower heating value, so the MJ cancel',
                           'CA-GREET3.0 values are California pathways (a proxy for U.S. fuel), their GWP set is not stated by CARB and is inferred AR4; NETL publishes '
                           'IPCC AR6 100-year CO2e. Both are used as published (GWP set AS-PUBLISHED) and disclosed; the biofuel share of blended fuels is not modelled'],
        'estimateRules': [],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement', 'us_upstream'],
        'resultExtras': ('additionalRegisters',), 'defaultDataQuality': _UPSTREAM_DQ,
        # DESIGN 13.2: liquid-fuel lines (CA-GREET3.0) carry `california_pathway_proxy` and take their own default.
        'defaultDataQualityByNote': {'california_pathway_proxy': _UPSTREAM_LIQUID_DQ},
    },
    'scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1': {
        'profileId': 'scope3.cat3b.upstream_electricity.egrid2023_netl2024', 'family': 'fuel_energy_related', 'kind': 'electricity_upstream', 'gwpSetId': UPSTREAM_GWP_SET,
        'title': 'Category 3 activity B: upstream (cradle-to-gate) of fuels used to generate purchased electricity (eGRID2023 rev2 heat input; NETL 2024 natural gas)',
        'formula': 'kg CO2e = consumed MWh (kWh x 0.001) x U(s); U(s) = sum over mapped fuels f of round12(heat input(s, f) MMBtu / net generation(s) MWh) x upstream '
                   'factor(f) kg CO2e per MMBtu (HHV); gas 8.229435650436; oil round12(UP_ulsd x ED_ulsd x 0.001 / 0.138); coal (mine methane only) round12(43.6 x '
                   '10^9 / (594,155 x 1000 x 20.100)) = 3.650822140444; memo: unmapped fossil MMBtu = MWh x round12(unmapped fossil heat input / net generation); '
                   'coal MMBtu = MWh x round12(coal heat input / net generation); screening memo (outside totals): coal MMBtu x 5.0 x 0.45359237 to coal MMBtu x '
                   '(12.2 x 1055.05585262 x 0.001 - 3.650822140444) kg CO2e of omitted coal mining energy and transport CO2',
        'factorKeys': _ELECTRICITY_UPSTREAM_KEYS,
        'constantIds': _ELECTRICITY_UPSTREAM_CONSTANTS,
        'admissionRules': ['One line per Scope 2 electricity record when category 3 is included: the same metered quantity, site ZIP, subregion and utility as Scope 2 '
                           'and category 3C, with the same location findings'] + _UPSTREAM_ELECTRICITY_RULES,
        'estimateRules': [],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement', 'us_upstream'],
        'resultExtras': ('additionalRegisters', 'memoItems'), 'defaultDataQuality': _UPSTREAM_DQ, 'defaultDataQualityByNote': _UPSTREAM_ELECTRICITY_DQ_BY_NOTE,
    },
    'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1': {
        'profileId': 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024', 'family': 'fuel_energy_related', 'kind': 'td_losses_upstream', 'gwpSetId': UPSTREAM_GWP_SET,
        'title': 'Category 3 activity C, upstream part: upstream (cradle-to-gate) of fuels used to generate electricity lost in transmission and distribution (eGRID2023 rev2; NETL 2024)',
        'formula': 'loss MWh = consumed MWh x GGL / (1 - GGL) exactly as category 3C (quotient rounded half-even to 12 dp); kg CO2e = loss MWh x U(s), U(s) as category 3B',
        'factorKeys': lambda: _keys('egrid2023_ggl.') + _ELECTRICITY_UPSTREAM_KEYS(),
        'constantIds': _ELECTRICITY_UPSTREAM_CONSTANTS,
        'admissionRules': ['One line per Scope 2 electricity record beside its category 3C combustion line, with exactly the 3C input; together they cover the life '
                           'cycle of the lost electricity, so the aggregate closes the 3C line\'s "upstream excluded" note (boundaryClosures)'] + _UPSTREAM_ELECTRICITY_RULES,
        'estimateRules': ['us_average_grid_loss: Puerto Rico (PRMS) has no interconnect value; the U.S. grid gross loss is used, as in EPA Power Profiler'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement', 'us_upstream'],
        'resultExtras': ('additionalRegisters', 'memoItems'), 'defaultDataQuality': _UPSTREAM_DQ, 'defaultDataQualityByNote': _UPSTREAM_ELECTRICITY_DQ_BY_NOTE,
    },
    'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1': {
        'profileId': 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024', 'family': 'fuel_energy_related', 'kind': 'energy_resold_upstream', 'gwpSetId': UPSTREAM_GWP_SET,
        'title': 'Category 3 activity D, upstream part: upstream (cradle-to-gate) of fuels used to generate electricity bought and resold (eGRID2023 rev2; NETL 2024)',
        'formula': 'kg CO2e = resold MWh (kWh x 0.001) x U(s); U(s) as category 3B for the subregion, or with U.S. heat input and net generation (US23) for the U.S. average',
        'factorKeys': _ELECTRICITY_UPSTREAM_KEYS,
        'constantIds': _ELECTRICITY_UPSTREAM_CONSTANTS,
        'admissionRules': ['One line per energy-resold record beside its category 3D combustion line, with exactly its input; the aggregate closes the 3D line\'s '
                           '"upstream excluded" note (boundaryClosures)'] + _UPSTREAM_ELECTRICITY_RULES,
        'estimateRules': ['us_average_upstream_intensity: the origin of the resold power is not known, so U.S. heat input and net generation are used'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['supplement', 'us_upstream'],
        'resultExtras': ('additionalRegisters', 'memoItems'), 'defaultDataQuality': _UPSTREAM_DQ, 'defaultDataQualityByNote': _UPSTREAM_ELECTRICITY_DQ_BY_NOTE,
    },
}


def method_metadata(mid: str) -> dict:
    m = METHODS[mid]
    out = {'methodType': m['methodType'], 'activityDataOrigin': m['activityDataOrigin'], 'defaultDataQuality': m['defaultDataQuality'],
           'biogenicTreatment': m['biogenicTreatment'], 'additionalRegisters': sorted(m['additionalRegisters'])}
    if 'defaultDataQualityUnverified' in m:  # A20 (I-03); absent for methods without a verification flag
        out['defaultDataQualityUnverified'] = m['defaultDataQualityUnverified']
    if 'defaultDataQualityByNote' in m:  # I-12u (DESIGN 13.2): a default selected by a boundary note (3A liquid fuels)
        out['defaultDataQualityByNote'] = m['defaultDataQualityByNote']
    return out


def additional_register_sha256s() -> dict:
    return {name: spec['sha256'] for name, spec in sorted(REGISTERS.items()) if name != 'main'}


def describe() -> dict:
    """The method facts. Each method object keeps exactly the keys the release contract registers (0024
    register_method_version, plus factorValues, factorCells and constantValues); the static metadata of each method is
    listed beside them in `methodMetadata` so a release can still register this description unchanged."""
    sha = engine_sha256()
    out = []
    for mid, m in sorted(METHODS.items()):
        keys = sorted(m['factorKeys']())
        used: dict = {}
        values = {k: exact(factor(k, used)) for k in keys}
        ids = m['constantIds']() if callable(m['constantIds']) else m['constantIds']  # R2's price-index years come from the register (I-03)
        consts = {c: {'value': exact(constant(c, used)), 'unit': used['constant:' + c]['unit']} for c in sorted(ids)}
        out.append({'id': mid, 'profileId': m['profileId'], 'scope': 3, 'family': m['family'], 'title': m['title'], 'formula': m['formula'],
                    'enginePath': ENGINE_PATH, 'engineSha256': sha, 'registerSha256': REGISTER_SHA256, 'gwpSetId': m['gwpSetId'],
                    'admissionRules': m['admissionRules'], 'estimateRules': m['estimateRules'],
                    'reportingPeriod': {'start': PERIOD[0], 'endExclusive': PERIOD[1]},
                    'factorKeys': keys, 'constantIds': sorted(ids), 'factorValues': values,
                    'factorCells': {k: used[k]['valueCell'] for k in keys}, 'constantValues': consts})
    return {'profile': ENGINE_PROFILE, 'engineSha256': sha, 'registerSha256': REGISTER_SHA256, 'methods': out,
            'methodMetadata': {mid: method_metadata(mid) for mid in sorted(METHODS)}, 'additionalRegisterSha256s': additional_register_sha256s()}


def catalog() -> dict:
    reg = require_register()['entries']
    label = lambda k: reg[k + '.co2']['label']
    return {
        'travelModes': [{'id': m, 'label': label(k), 'activity': u + '-mile', 'businessTravel': True, 'employeeCommuting': m in COMMUTING_MODES} for m, (k, u) in TRAVEL_MODES.items()],
        'transportVehicles': [{'id': v, 'label': label(ks.get('vehicle') or ks['ton']).rsplit(' (', 1)[0], 'dedicatedVehicle': 'vehicle' in ks, 'sharedVehicle': 'ton' in ks} for v, ks in TRANSPORT_VEHICLES.items()],
        'wasteMaterials': [{'id': m, 'label': reg[f'waste.{m}.{t[0]}']['label'].rsplit(', ', 1)[0], 'treatments': t} for m, t in _waste_materials().items()],
        'wasteUnits': list(WASTE_UNITS),
        'subregionInterconnect': dict(sorted(SUBREGION_INTERCONNECT.items())),
        **_purchases_catalog(),
        **_energy_partner_catalog(),
        **_downstream_catalog(),
        **_us_upstream_catalog(),
        **_building_hotel_catalog(),  # I-12h
    }


def _purchases_catalog() -> dict:
    """I-03 token lists and the DESIGN 3.3 spend code sets, which the contract's constants are compared with."""
    spend = _register('spend')
    codes = sorted({k.split('.')[1] for k in spend['entries']})
    sets = {name: sorted(c) for name, c in SPEND_NAICS_SETS.items()}
    sets['overlap_confirm'] = sorted(set(SPEND_NAICS_SETS['freight']) | set(SPEND_NAICS_SETS['passenger']) | set(SPEND_NAICS_SETS['waste']))
    sets['trade_sector'] = [c for c in codes if c.startswith(SPEND_TRADE_PREFIXES) and c not in SPEND_NAICS_SETS['energy_confirm']]
    sets['absent'] = list(SPEND_ABSENT_CODES)
    return {
        'spendCategories': list(SPEND_CATEGORIES), 'spendImportCategories': list(SPEND_IMPORT_CATEGORIES),
        'spendCategoryCodeSet': {str(c): s for c, s in sorted(SPEND_CATEGORY_CODE_SET.items())},
        'spendMarginChoices': list(SPEND_MARGIN_NOTES), 'spendCurrencies': ['USD'],
        'spendDollarYears': {'min': SPEND_YEARS[0], 'max': SPEND_YEARS[1],
                             'indexed': sorted(int(k.rsplit('.', 1)[1]) for k in spend['constants'] if k.startswith('price_index.gdp_deflator.'))},
        'spendNaicsCodes': len(codes), 'spendNaicsSets': sets,
        'supplierFactorOrigins': list(SUPPLIER_ORIGIN_METHODS), 'supplierBases': list(SUPPLIER_BASES), 'supplierProductUnits': list(SUPPLIER_PRODUCT_UNITS),
        'supplierTotalUnits': list(SUPPLIER_TOTAL_UNITS), 'supplierBoundaries': list(SUPPLIER_BOUNDARIES), 'supplierHybridUpstreamCoveredBy': list(SUPPLIER_HYBRID_UPSTREAM),
        'gwpBases': list(GWP_BASES), 'verification': list(VERIFICATION),
    }


def _energy_partner_catalog() -> dict:
    """I-05 token lists, compared with the contract's constants: R3's Table 1 fuels and Table 11/12 gases (the contract's
    SCOPE3_SOLD_FUELS and SCOPE3_GHG_GASES), the average-commuting modes, carriers, units and partner allocation tokens."""
    sup = _register('supplement')['entries']
    return {
        'gridBases': list(GRID_BASES), 'commutingAverageModes': list(COMMUTING_AVG_MODES), 'commuteDistanceUnits': list(COMMUTE_DISTANCE_UNITS),
        'teleworkingCarriers': ['electricity', 'natural_gas'], 'teleworkingGasUnits': list(TELEWORK_GAS_UNITS), 'electricityUnits': list(ELECTRICITY_UNITS),
        'assetCategories': list(ASSET_CATEGORIES), 'assetCarriers': list(ASSET_CARRIERS), 'assetGasUnits': list(ASSET_GAS_UNITS), 'refrigerantUnits': list(REFRIGERANT_UNITS),
        'areaUnits': list(AREA_UNITS), 'partnerCategories': list(PARTNER_CATEGORIES), 'partnerAllocationBases': list(PARTNER_ALLOCATION_BASES),
        'scope2Bases': list(SCOPE2_BASES), 'partnerUnits': list(SUPPLIER_TOTAL_UNITS),
        'soldFuels': sorted({k.split('.')[1] for k in sup if k.startswith('hub2025_t1.')}),
        'ghgGases': sorted(k.split('.', 1)[1] for k in sup if k.startswith('hub2025_gwp.')),
        'biomassFuels': sorted({k.split('.')[1] for k, e in sup.items() if k.startswith('hub2025_t1.') and 'Biomass' in e['table']}),
    }


def _liquids_verified() -> bool:
    """I-12u: liquid fuels calculate only when R5 states the CA-GREET3.0 heating-value basis and registers every energy density
    on that same basis (the builder asserts it; the engine re-checks the pinned register)."""
    entries = _register('us_upstream')['entries']
    basis = entries.get('cagreet3.heating_value_basis')
    return basis is not None and basis['value'] in ('LHV', 'HHV') and all(
        ed in entries and up in entries and f"({basis['value']})" in entries[ed]['unit'] for ed, up in LIQUID_UPSTREAM.values())


def _us_upstream_catalog() -> dict:
    """I-12u token lists, compared with the collection adapter's constants: the Scope 1 kinds a 3A line follows, the vehicle
    fuels with an upstream pathway, whether liquids are verified, the eGRID fuel categories and which have an upstream factor."""
    return {
        'upstreamSources': list(UPSTREAM_SOURCES), 'upstreamVehicleFuels': dict(sorted(VEHICLE_UPSTREAM_FUELS.items())), 'upstreamLiquidsVerified': _liquids_verified(),
        'powerFossilFuels': list(POWER_FOSSIL_FUELS), 'powerOtherFuels': list(POWER_OTHER_FUELS), 'powerNonFossilFuels': list(POWER_NON_FOSSIL_FUELS),
        'powerFuelsMapped': list(_mapped_power_fuels()), 'upstreamSubregionsWithoutMappedFossil': _subregions_without_mapped_fossil(),
        'boundaryClosurePairs': {k: v[0] for k, v in sorted(CLOSURE_PAIRS.items())},
    }


def _subregions_without_mapped_fossil() -> list:
    """Owner decision 3: the eGRID regions with fossil heat input but none of it mapped (their lines are held; the adapter holds
    them as waiting for a factor source before the engine). Empty while oil and gas are mapped."""
    hi: dict = {}
    for k, entry in _register('supplement')['entries'].items():
        if k.startswith('egrid2023_hi.') and k.split('.')[2] in POWER_FOSSIL_FUELS and Decimal(entry['value']) > 0:
            hi.setdefault(k.split('.')[1], set()).add(k.split('.')[2])
    mapped = set(_mapped_power_fuels())
    return sorted(region for region, fuels in hi.items() if not fuels & mapped)


def _downstream_catalog() -> dict:
    """I-07 token lists, compared with the collection adapter's constants: each Table 1 fuel's unit, the transport fuels, the
    lifetime bases, use regions, charge units, end-of-life bases and the investment holding types, paths and denominators."""
    fuels = _sold_fuels()
    return {
        'soldFuelUses': list(SOLD_FUEL_USES), 'soldFuelUnits': {fuel: unit for fuel, (unit, _) in fuels.items()}, 'transportFuels': list(TRANSPORT_FUELS),
        'lifetimeBases': list(LIFETIME_BASES), 'productElectricityUnits': list(ELECTRICITY_UNITS),
        'useRegions': [USE_REGION_US, USE_REGION_NON_US] + sorted(SUBREGION_INTERCONNECT), 'chargeUnits': list(CHARGE_UNITS),
        'endOfLifeBases': list(EOL_BASES), 'endOfLifeTreatments': list(WASTE_TREATMENTS),
        'holdingTypes': list(HOLDING_TYPES), 'optionalHoldingTypes': list(OPTIONAL_HOLDING_TYPES), 'investmentPaths': dict(sorted(INVESTMENT_PATHS.items())),
        'attributionDenominators': list(ATTRIBUTION_DENOMINATORS),
    }


# ---------------------------------------------------------------------------
# Calculations
# ---------------------------------------------------------------------------

def _per_gas(activity: Decimal, base: str, used: dict) -> dict:
    """Hub Tables 8 and 10: CO2 in kg per unit, CH4 and N2O in g per unit."""
    g_to_kg = constant('g_to_kg', used)
    out = {}
    for gas, name in GASES:
        f = factor(f'{base}.{gas}', used)
        kg = activity * f if gas == 'co2' else activity * f * g_to_kg
        out[gas] = {'mass': exact(kg), 'massUnit': 'kg ' + name, 'co2e': exact(kg * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
    return out


def _additional_registers(used: dict, consulted=()) -> list:
    names = ({register_for_key(k.split(':', 1)[1] if k.startswith('constant:') else k) for k in used} | set(consulted)) - {'main'}
    return [{'name': n, 'sha256': REGISTERS[n]['sha256']} for n in sorted(names)]


def _result(method_id: str, category: int, inp: dict, used: dict, *, status: str, gases=None, co2e_only=None, activity=None,
            estimates=(), findings=(), conversions=(), boundary='met', boundary_notes=(), biogenic_co2=None, memo_items=None, consulted=()) -> dict:
    # Optional keys (DESIGN 4.1) exist only on results of methods whose metadata declares them; the five existing methods
    # declare none, so their results keep exactly the keys and bytes of engine 969027f6 (A1).
    extras = METHODS[method_id].get('resultExtras', ())
    if (biogenic_co2 is not None and 'biogenicCo2' not in extras) or (memo_items is not None and 'memoItems' not in extras):
        raise RuntimeError('result key not declared by the method: ' + method_id)
    optional = {}
    if 'additionalRegisters' in extras:
        # `consulted`: registers a held result was decided from without using a value (e.g. a NAICS code not in R2).
        optional['additionalRegisters'] = _additional_registers(used, consulted)
    if biogenic_co2 is not None:
        optional['biogenicCo2'] = biogenic_co2
    if memo_items is not None:
        optional['memoItems'] = list(memo_items)
    return _result_body(method_id, category, inp, used, optional, status=status, gases=gases, co2e_only=co2e_only, activity=activity, estimates=estimates,
                        findings=findings, conversions=conversions, boundary=boundary, boundary_notes=boundary_notes)


def _result_body(method_id: str, category: int, inp: dict, used: dict, optional: dict, *, status: str, gases=None, co2e_only=None, activity=None,
                 estimates=(), findings=(), conversions=(), boundary='met', boundary_notes=()) -> dict:
    factors = sorted(({'key': k, 'value': e['value'], 'unit': e['unit'], 'cell': e['valueCell'], 'label': e['label']}
                      for k, e in used.items() if not k.startswith('constant:')), key=lambda f: f['key'])
    constants = sorted(({'id': k.split(':', 1)[1], 'value': c['value'], 'unit': c['unit']} for k, c in used.items() if k.startswith('constant:')), key=lambda c: c['id'])
    gases = gases or {}
    period = inp.get('period') if isinstance(inp, dict) else None
    if isinstance(period, dict) and isinstance(period.get('endExclusive'), str) and period['endExclusive'] > FACTOR_VINTAGE_PERIOD_END:
        boundary_notes = list(boundary_notes) + ['factor_vintage_precedes_period']  # owner decision 1 (round 2)
    total = None
    if status == 'complete':
        # S3A-01 (Codex review, 25 October 2026): the total is summed in the engine's own precision-96 context, so a
        # result is identical whichever Decimal context calls the calculator; aggregate recomputes inside precision 96.
        with _exact():
            t = sum((Decimal(g['co2e']) for g in gases.values()), Decimal(0)) + (Decimal(co2e_only['co2e']) if co2e_only else Decimal(0))
            total = {'unrounded': exact(t), 'display': display(t), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp'}
    out = {'profile': ENGINE_PROFILE, 'methodVersionId': method_id, 'profileId': METHODS[method_id]['profileId'], 'category': category,
           'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256, 'gwpSetId': METHODS[method_id]['gwpSetId'],
           'input': inp, 'inputSha256': digest(inp), 'status': status, 'activity': activity or {}, 'gases': gases, 'co2eWithoutGasSplit': co2e_only,
           'estimates': sorted(set(estimates)), 'findings': sorted(set(findings)), 'conversions': list(conversions),
           'boundary': {'minimumBoundary': boundary, 'notes': sorted(set(boundary_notes))},
           'factorsUsed': factors, 'constantsUsed': constants, 'total': total, **optional}
    return dict(out, resultSha256=digest(out))


def _grid_location(zip_code, sub, utility) -> tuple[str, str] | None:
    """The electricity location rules shared by 3C (td_losses) and, since I-05, every method that reads an eGRID subregion
    rate (DESIGN 4.4 "ZIP findings as td_losses"): refuses a subregion, ZIP or utility the engine does not know, and returns
    (status, finding) when the EPA Power Profiler ZIP table does not support the location, else None."""
    if not isinstance(sub, str) or sub not in SUBREGION_INTERCONNECT:
        raise Refused('unknown_subregion')
    if not isinstance(zip_code, str) or not re.fullmatch(r'[0-9]{5}', zip_code):
        raise Refused('invalid_zip')
    if utility is not None and (not isinstance(utility, str) or not re.fullmatch(r'[0-9]{1,7}', utility)):
        raise Refused('invalid_utility')
    rows = zip_table().get(zip_code, [])
    subs = {r[0] for r in rows}
    if not rows or sub not in subs:
        return 'review_required', 'zip_not_in_lookup' if not rows else 'subregion_not_listed_for_zip'
    if utility is not None and (sub, utility) not in rows:
        return 'review_required', 'utility_not_listed_for_zip_and_subregion'
    if utility is None and len(subs) > 1:
        return 'input_needed', 'utility_required_for_multi_subregion_zip'
    return None


def td_losses(inp: dict) -> dict:
    require_keys(inp, {'period', 'quantity', 'unit', 'subregion', 'zip'}, {'utilityEiaId'})
    require_period(inp['period'])
    sub = inp['subregion']
    held = _grid_location(inp['zip'], sub, inp.get('utilityEiaId'))
    mid = KIND_METHOD['td_losses']
    if held is not None:
        return _result(mid, 3, inp, {}, status=held[0], findings=[held[1]])
    used: dict = {}
    conversions: list = []
    with _exact():
        q = quantity(inp['quantity'], 'invalid_quantity')
        if inp['unit'] == 'kWh':
            mwh = q * constant('kwh_to_mwh', used)
        elif inp['unit'] == 'MWh':
            mwh = q
        else:
            raise Refused('unsupported_unit')
        ic = SUBREGION_INTERCONNECT[sub]
        ggl = factor(f'egrid2023_ggl.{ic}', used)
        loss = divide(mwh * ggl, 1 - ggl, 'loss MWh = consumed MWh x GGL / (1 - GGL)', conversions)
        lb = constant('lb_to_kg', used)
        gases = {}
        for gas, name in GASES:
            kg = loss * factor(f'egrid2023.{sub}.{gas}', used) * lb
            gases[gas] = {'mass': exact(kg), 'massUnit': 'kg ' + name, 'co2e': exact(kg * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
    return _result(mid, 3, inp, used, status='complete', gases=gases, conversions=conversions,
                   activity={'consumedMwh': exact(mwh), 'lossMwh': exact(loss), 'subregion': sub, 'interconnect': ic, 'gridGrossLoss': exact(ggl)},
                   estimates=['us_average_grid_loss'] if ic == 'u_s' else [], boundary='partial',
                   boundary_notes=['combustion_only_upstream_of_lost_energy_excluded', 'location_based_rates'])


def transport(inp: dict) -> dict:
    require_keys(inp, {'period', 'category', 'vehicle', 'loadBasis', 'activity', 'thirdPartyFacilities'})
    require_period(inp['period'])
    if isinstance(inp['category'], bool) or inp['category'] not in (4, 9):
        raise Refused('invalid_category')
    # v3 accounting review A04: the category 4/9 minimum boundary includes third-party storage and distribution facilities.
    facilities = {'none': None, 'present_not_included': 'third_party_facilities_not_included', 'unknown': 'third_party_facilities_not_assessed'}
    if not isinstance(inp['thirdPartyFacilities'], str) or inp['thirdPartyFacilities'] not in facilities:
        raise Refused('invalid_third_party_facilities')
    facility_note = facilities[inp['thirdPartyFacilities']]
    keys = TRANSPORT_VEHICLES.get(inp['vehicle']) if isinstance(inp['vehicle'], str) else None
    if keys is None:
        raise Refused('unsupported_vehicle')
    used: dict = {}
    conversions: list = []
    with _exact():
        act = inp['activity']
        require_keys(act, {'value', 'unit'})
        if inp['loadBasis'] == 'dedicated_vehicle':
            if 'vehicle' not in keys:
                raise Refused('load_basis_not_available_for_vehicle')
            amount, unit = distance_miles(act, {'vehicle-mile': ('vehicle-mile', False), 'vehicle-km': ('vehicle-mile', True)}, 'vehicle-miles = vehicle-km / 1.609344', used, conversions)
            base = keys['vehicle']
        elif inp['loadBasis'] == 'shared_vehicle':
            if 'ton' not in keys:
                raise Refused('load_basis_not_available_for_vehicle')
            if act['unit'] == 'short ton-mile':
                amount = quantity(act['value'], 'invalid_quantity')
            elif act['unit'] == 'tonne-km':
                t = quantity(act['value'], 'invalid_quantity')
                denominator = constant('lb_to_kg', used) * constant('lb_per_short_ton', used) * constant('km_per_mile', used)
                amount = divide(t * constant('metric_ton_to_kg', used), denominator, 'short ton-miles = tonne-km x 1000 / (0.45359237 x 2000 x 1.609344)', conversions)
            else:
                raise Refused('unsupported_unit')
            unit, base = 'short ton-mile', keys['ton']
        else:
            raise Refused('invalid_load_basis')
        gases = _per_gas(amount, base, used)
    return _result(KIND_METHOD['transport'], inp['category'], inp, used, status='complete', gases=gases, conversions=conversions,
                   activity={'amount': exact(amount), 'unit': unit, 'vehicle': inp['vehicle'], 'loadBasis': inp['loadBasis']},
                   boundary='partial' if facility_note else 'met', boundary_notes=['tank_to_wheel_only'] + ([facility_note] if facility_note else []))


def waste(inp: dict) -> dict:
    require_keys(inp, {'period', 'category', 'material', 'treatment', 'quantity', 'unit'})
    require_period(inp['period'])
    if isinstance(inp['category'], bool) or inp['category'] not in (5, 12):
        raise Refused('invalid_category')
    materials = _waste_materials()
    if not isinstance(inp['material'], str) or inp['material'] not in materials:
        raise Refused('unknown_material')
    if inp['treatment'] not in WASTE_TREATMENTS:
        raise Refused('unknown_treatment')
    if inp['unit'] not in WASTE_UNITS:
        raise Refused('unsupported_unit')
    mid = KIND_METHOD['waste']
    used: dict = {}
    conversions: list = []
    with _exact():
        q = quantity(inp['quantity'], 'invalid_quantity')
        if inp['treatment'] not in materials[inp['material']]:
            return _result(mid, inp['category'], inp, used, status='input_needed', findings=['no_published_factor_for_material_and_treatment'],
                           activity={'material': inp['material'], 'treatment': inp['treatment']})
        if inp['unit'] == 'short_ton':
            tons = q
        elif inp['unit'] == 'lb':
            tons = divide(q, constant('lb_per_short_ton', used), 'short tons = lb / 2000', conversions)
        else:
            per_ton = constant('lb_to_kg', used) * constant('lb_per_short_ton', used)
            kg = q if inp['unit'] == 'kg' else q * constant('metric_ton_to_kg', used)
            what = 'short tons = kg / (0.45359237 x 2000)' if inp['unit'] == 'kg' else 'short tons = metric tons x 1000 / (0.45359237 x 2000)'
            tons = divide(kg, per_ton, what, conversions)
        f = factor(f"waste.{inp['material']}.{inp['treatment']}", used)
        co2e = tons * f * constant('metric_ton_to_kg', used)
    notes = ['avoided_emissions_excluded', 'includes_transport_to_facility', 'ar4_gwp_embedded_in_factor']
    return _result(mid, inp['category'], inp, used, status='complete', conversions=conversions, boundary_notes=notes,
                   co2e_only={'co2e': exact(co2e), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR4-100', 'reason': 'EPA Hub Table 9 publishes CO2e only'},
                   activity={'shortTons': exact(tons), 'material': inp['material'], 'treatment': inp['treatment']})


def _travel(inp: dict, kind: str, category: int, modes) -> dict:
    require_keys(inp, {'period', 'mode'}, {'activity', 'segmentDistance', 'passengerSegments', 'haulBasis'})
    require_period(inp['period'])
    mode = inp['mode']
    if not isinstance(mode, str) or (mode not in modes and not (mode == 'air' and 'air_short_haul' in modes)):
        raise Refused('unsupported_mode')
    used: dict = {}
    conversions: list = []
    estimates: list = []
    notes = ['tank_to_wheel_only']
    with _exact():
        if mode == 'air':
            # One record per group of passenger segments of one one-way distance; the distance picks the haul.
            require_keys(inp, {'period', 'mode', 'segmentDistance', 'passengerSegments'})
            miles, _ = distance_miles(inp['segmentDistance'], {'mile': ('mile', False), 'km': ('mile', True)}, 'segment miles = segment km / 1.609344', used, conversions)
            if miles <= 0:
                raise Refused('invalid_quantity')
            segments = integer(inp['passengerSegments'], 1, 10_000_000, 'invalid_passenger_segments')
            resolved = 'air_short_haul' if miles < 300 else 'air_medium_haul' if miles < 2300 else 'air_long_haul'
            amount = miles * segments
            activity = {'amount': exact(amount), 'unit': 'passenger-mile', 'mode': resolved, 'segmentMiles': exact(miles), 'passengerSegments': segments}
        else:
            kind_of = TRAVEL_MODES[mode][1]
            allowed = {f'{kind_of}-mile': (f'{kind_of}-mile', False), f'{kind_of}-km': (f'{kind_of}-mile', True)}
            if mode in AIR_MODES:
                require_keys(inp, {'period', 'mode', 'activity', 'haulBasis'})
                if not isinstance(inp['haulBasis'], str) or not 1 <= len(inp['haulBasis'].strip()) <= 200:
                    raise Refused('haul_basis_required')
                estimates.append('air_haul_declared')
            else:
                require_keys(inp, {'period', 'mode', 'activity'})
            amount, unit = distance_miles(inp['activity'], allowed, f'{kind_of}-miles = {kind_of}-km / 1.609344', used, conversions)
            resolved = mode
            activity = {'amount': exact(amount), 'unit': unit, 'mode': mode}
            if mode == 'intercity_rail_national_average':
                estimates.append('intercity_rail_route_average')
        if resolved in AIR_MODES:
            notes += ['radiative_forcing_not_included', 'cabin_class_not_differentiated']
        gases = _per_gas(amount, TRAVEL_MODES[resolved][0], used)
    return _result(KIND_METHOD[kind], category, inp, used, status='complete', gases=gases, activity=activity, estimates=estimates,
                   conversions=conversions, boundary_notes=notes)


def business_travel(inp: dict) -> dict:
    return _travel(inp, 'business_travel', 6, tuple(TRAVEL_MODES))


def employee_commuting(inp: dict) -> dict:
    return _travel(inp, 'employee_commuting', 7, COMMUTING_MODES)


# --- I-03 --- Purchases.

def _choice(v, allowed, code: str):
    if not isinstance(v, str) or v not in allowed:
        raise Refused(code)
    return v


def _price_index_year(year: int, period: dict, spend: dict) -> int | None:
    """The deflator year for a dollar year (owner decision 1, round 2): its own when published and registered; for a year after
    the latest published one and not after the year the line's period ends in, the latest published year (disclosed
    `price_index_latest_published_year_used`); otherwise None, and the line is held."""
    if f'price_index.gdp_deflator.{year}' in spend['constants']:
        return year
    latest = max(int(k.rsplit('.', 1)[1]) for k in spend['constants'] if k.startswith('price_index.gdp_deflator.'))
    line_year = (calendar_date(period['endExclusive']) - datetime.timedelta(days=1)).year
    return latest if latest < year <= line_year else None


def purchase_spend(inp: dict) -> dict:
    """Categories 1 and 2 by spend, and the spend fallback for 3, 4, 5, 6 and 9 (DESIGN 4.4, A12): amount x published EPA SC
    v1.3 factor x round12(I2022 / I(dollar year)). The collection step resolves the dollar year (the reporting year when
    the record has none), holds non-USD lines and applies the category code sets before a line reaches the engine."""
    require_keys(inp, {'period', 'category', 'naicsCode', 'amount', 'currency', 'dollarYear', 'marginChoice', 'boughtAtFactoryGate', 'capitalFullCost'})
    require_period(inp['period'])
    category = inp['category']
    if type(category) is not int or category not in SPEND_CATEGORIES:
        raise Refused('invalid_category')
    if inp['currency'] != 'USD':
        raise Refused('unsupported_currency')
    naics = inp['naicsCode']
    if not isinstance(naics, str) or not NAICS6.fullmatch(naics):
        raise Refused('invalid_naics_code')
    year = integer(inp['dollarYear'], SPEND_YEARS[0], SPEND_YEARS[1], 'invalid_dollar_year')
    margin = _choice(inp['marginChoice'], SPEND_MARGIN_NOTES, 'invalid_margin_choice')
    if not isinstance(inp['boughtAtFactoryGate'], bool):
        raise Refused('invalid_factory_gate')
    if margin == 'without_margins' and not inp['boughtAtFactoryGate']:
        raise Refused('without_margins_requires_factory_gate')
    full_cost = inp['capitalFullCost']
    if full_cost is not None and not isinstance(full_cost, bool):
        raise Refused('invalid_capital_full_cost')
    if category == 2 and full_cost is not True:
        raise Refused('capital_goods_must_be_full_cost')
    amount = quantity(inp['amount'], 'invalid_quantity')  # every refusal comes before R2 is read
    mid = KIND_METHOD['purchase_spend']
    spend = _register('spend')
    key = f'epa_scghg_v130.{naics}.{margin}'
    with _exact():
        base = int(Decimal(spend['constants']['price_index.base_year']['value']))
        findings = []
        if key not in spend['entries']:
            findings.append('naics_code_not_in_factor_set')
        index_year = year if year == base else _price_index_year(year, inp['period'], spend)
        if index_year is None:
            findings.append('dollar_year_index_missing')
        if findings:
            # Held, never zero: the user maps the line to a code in the factor set, or the index for its year is registered.
            return _result(mid, category, inp, {}, status='input_needed', findings=findings, consulted=['spend'],
                           activity={'naicsCode': naics, 'dollarYear': year, 'marginChoice': margin})
        used: dict = {}
        conversions: list = []
        estimates = ['downstream_spend_estimated_by_company'] if category == 9 else []
        ef = factor(key, used)
        constant('price_index.base_year', used)
        nominal = amount * ef
        activity = {'amount': exact(amount), 'currency': 'USD', 'dollarYear': year, 'naicsCode': naics, 'marginChoice': margin, 'nominalCo2e': exact(nominal)}
        co2e = nominal
        if year != base:
            ratio = divide(constant(f'price_index.gdp_deflator.{base}', used), constant(f'price_index.gdp_deflator.{index_year}', used),
                           f'price ratio = I{base} / I{index_year} (BEA GDP implicit price deflator, FRED A191RD3A086NBEA; economy-wide, not commodity-specific)', conversions)
            co2e = amount * ef * ratio
            activity['priceRatio'] = exact(ratio)
            estimates.append('economy_wide_price_index')
            if index_year != year:
                activity['priceIndexYearUsed'] = index_year
    notes = [SPEND_MARGIN_NOTES[margin], 'us_national_sector_average', 'factor_ghg_year_2022'] + (['price_index_latest_published_year_used'] if index_year != year else [])
    if category == 2:
        notes.append('capital_goods_full_cost_in_acquisition_year')
    if category in SPEND_FALLBACK_CATEGORIES:
        notes.append('spend_based_fallback')
    return _result(mid, category, inp, used, status='complete', conversions=conversions, activity=activity, estimates=estimates, boundary_notes=notes,
                   co2e_only={'co2e': exact(co2e), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR5-100',
                              'reason': 'EPA Supply Chain GHG Emission Factors v1.3 publish CO2e only (AR5 100-year GWPs applied by EPA)'})


def purchase_supplier(inp: dict) -> dict:
    """Categories 1 and 2 from a figure the company holds (DESIGN 4.4, A21): `supplier_primary` -> supplier-specific
    (value-chain partner data); `secondary_database` -> average data with a secondary factor the company typed in. The CO2e is
    used as declared (GWP set AS-REPORTED, basis disclosed); a product factor needs exactly the quantity's unit."""
    require_keys(inp, {'period', 'category', 'factorOrigin', 'basis', 'quantity', 'unit', 'factorValue', 'factorUnit', 'allocationNumerator',
                       'allocationDenominator', 'boundary', 'hybridUpstreamCoveredBy', 'gwpBasis', 'verification'})
    require_period(inp['period'])
    category = inp['category']
    if type(category) is not int or category not in (1, 2):
        raise Refused('invalid_category')
    origin = _choice(inp['factorOrigin'], SUPPLIER_ORIGIN_METHODS, 'invalid_factor_origin')
    basis = _choice(inp['basis'], SUPPLIER_BASES, 'invalid_basis')
    boundary = _choice(inp['boundary'], SUPPLIER_BOUNDARIES, 'invalid_boundary')
    hybrid = inp['hybridUpstreamCoveredBy']
    if (boundary == 'supplier_scope1_2_only') != (hybrid is not None) or (hybrid is not None and hybrid not in SUPPLIER_HYBRID_UPSTREAM):
        raise Refused('invalid_hybrid_upstream')
    gwp_basis = _choice(inp['gwpBasis'], GWP_BASES, 'invalid_gwp_basis')
    verification = _choice(inp['verification'], VERIFICATION, 'invalid_verification')
    num, den = inp['allocationNumerator'], inp['allocationDenominator']
    if basis == 'product_factor':
        unit = _choice(inp['unit'], SUPPLIER_PRODUCT_UNITS, 'unsupported_unit')
        if not isinstance(inp['factorValue'], str) or not SUPPLIER_FACTOR.fullmatch(inp['factorValue']):
            raise Refused('invalid_factor_value')
        if inp['factorUnit'] != f'kg CO2e per {unit}':
            raise Refused('factor_unit_mismatch')
        if num is not None or den is not None:
            raise Refused('allocation_not_applicable_to_product_factor')
    else:
        unit = _choice(inp['unit'], SUPPLIER_TOTAL_UNITS, 'unsupported_unit')
        if inp['factorValue'] is not None or inp['factorUnit'] is not None:
            raise Refused('invalid_input_shape')
        if (num is None) != (den is None):
            raise Refused('invalid_allocation')
    mid = SUPPLIER_ORIGIN_METHODS[origin]
    used: dict = {}
    conversions: list = []
    findings: list = []
    if origin == 'supplier_primary' and boundary == 'other':
        findings.append('supplier_boundary_not_cradle_to_gate')
    if origin == 'secondary_database' and boundary != 'cradle_to_gate':
        findings.append('secondary_factor_boundary_not_cradle_to_gate')
    with _exact():
        q = quantity(inp['quantity'], 'invalid_quantity')
        activity = {'basis': basis, 'quantity': exact(q), 'unit': unit, 'factorOrigin': origin, 'gwpBasis': gwp_basis, 'verification': verification}
        share = None
        if basis == 'product_factor':
            fv = Decimal(inp['factorValue'])
            activity['factorValue'] = exact(fv)
            kg = q * fv
        else:
            if num is not None:
                n, d = quantity(num, 'invalid_allocation'), quantity(den, 'invalid_allocation')
                if d == 0:
                    findings.append('allocation_denominator_zero')
                elif n > d:
                    findings.append('allocation_share_exceeds_one')
            if not findings:
                total = q * constant('metric_ton_to_kg', used) if unit == 'metric_ton CO2e' else q
                if num is not None:
                    share = divide(n, d, 'allocation share = numerator / denominator', conversions)
                    activity['allocationShare'] = exact(share)
                kg = total * share if share is not None else total
    if findings:
        # Not calculated and never counted: a zero denominator needs input; a share above one, or a boundary that may miss
        # the supplier's upstream, needs review.
        status = 'input_needed' if findings == ['allocation_denominator_zero'] else 'review_required'
        return _result(mid, category, inp, {}, status=status, findings=findings, activity={'basis': basis, 'factorOrigin': origin, 'boundary': boundary})
    if origin == 'supplier_primary':
        notes = [f'supplier_gwp_basis_{gwp_basis.lower()}'] + (['supplier_data_unverified'] if verification == 'unverified' else [])
        reason = f'Supplier-reported CO2e, declared GWP basis {gwp_basis}; used as reported, not split by gas or restated'
    else:
        notes = ['user_supplied_secondary_factor_not_verified', f'factor_gwp_basis_{gwp_basis.lower()}']
        reason = f'Secondary CO2e factor entered by the company, declared GWP basis {gwp_basis}; used as entered, not split by gas or restated'
    met = True
    if boundary == 'supplier_scope1_2_only':
        notes.append('hybrid_upstream_from_other_records' if hybrid == 'other_records' else 'hybrid_upstream_missing')
        met = hybrid == 'other_records'
    return _result(mid, category, inp, used, status='complete', conversions=conversions, activity=activity, boundary='met' if met else 'partial',
                   boundary_notes=notes, co2e_only={'co2e': exact(kg), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AS-REPORTED', 'reason': reason})


# --- I-05 --- Energy, commuting, leased assets and partner data.

def _no_location(inp: dict) -> None:
    if inp['zip'] is not None or inp['subregion'] is not None or inp['utilityEiaId'] is not None:
        raise Refused('invalid_input_shape')


def _mwh(q: Decimal, unit, used: dict) -> Decimal:
    if unit == 'kWh':
        return q * constant('kwh_to_mwh', used)
    if unit == 'MWh':
        return q
    raise Refused('unsupported_unit')


def _grid_gases(mwh: Decimal, sub: str | None, used: dict) -> dict:
    """kg per gas = MWh x eGRID total output emission rate (lb/MWh; the subregion's SRL23 rate, or the U.S. US23 rate when
    `sub` is None) x 0.45359237, with AR5 GWPs (the same arithmetic as category 3C)."""
    lb = constant('lb_to_kg', used)
    prefix = 'egrid2023_us' if sub is None else f'egrid2023.{sub}'
    out = {}
    for gas, name in GASES:
        kg = mwh * factor(f'{prefix}.{gas}', used) * lb
        out[gas] = {'mass': exact(kg), 'massUnit': 'kg ' + name, 'co2e': exact(kg * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
    return out


def _natural_gas_mmbtu(q: Decimal, unit: str, used: dict, estimates: list) -> Decimal:
    """MMBtu (HHV) of natural gas: as stated, therms x 0.1, or a volume x the Hub Table 1 default heat content."""
    if unit == 'MMBtu':
        return q
    if unit == 'therm':
        return q * constant('supplement_const.therm_to_mmbtu', used)
    scf = q if unit == 'scf' else q * constant(f'supplement_const.scf_per_{unit}', used)
    estimates.append('default_heat_content')
    return scf * factor('hub2025_t1.natural_gas.heat_content', used)


def _fuel_gases(mmbtu: Decimal, fuel: str, used: dict) -> dict:
    """Hub Table 1: kg CO2, g CH4 and g N2O per MMBtu, with AR5 GWPs."""
    g_to_kg = constant('g_to_kg', used)
    out = {}
    for gas, name in GASES:
        f = factor(f'hub2025_t1.{fuel}.{gas}', used)
        kg = mmbtu * f if gas == 'co2' else mmbtu * f * g_to_kg
        out[gas] = {'mass': exact(kg), 'massUnit': 'kg ' + name, 'co2e': exact(kg * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
    return out


def energy_resold(inp: dict) -> dict:
    """Category 3D (DESIGN 4.4, A28): electricity bought and resold to end users x the grid output emission rate of its origin.
    Combustion only for now: the upstream part of the life-cycle factor is a separate line pending its factor source."""
    require_keys(inp, {'period', 'quantity', 'unit', 'gridBasis', 'zip', 'subregion', 'utilityEiaId'})
    require_period(inp['period'])
    basis = _choice(inp['gridBasis'], GRID_BASES, 'invalid_grid_basis')
    mid = KIND_METHOD['energy_resold']
    sub = None
    if basis == 'subregion':
        held = _grid_location(inp['zip'], inp['subregion'], inp['utilityEiaId'])
        if held is not None:
            return _result(mid, 3, inp, {}, status=held[0], findings=[held[1]])
        sub = inp['subregion']
    else:
        _no_location(inp)
    used: dict = {}
    with _exact():
        mwh = _mwh(quantity(inp['quantity'], 'invalid_quantity'), inp['unit'], used)
        gases = _grid_gases(mwh, sub, used)
    return _result(mid, 3, inp, used, status='complete', gases=gases, activity={'resoldMwh': exact(mwh), 'gridBasis': basis, 'subregion': sub},
                   estimates=['us_average_grid_rate'] if sub is None else [], boundary='partial',
                   boundary_notes=['upstream_of_resold_energy_excluded', 'location_based_grid_rates'])


def commuting_average(inp: dict) -> dict:
    """Category 7 average data (calculation guidance formula 7.2): per mode, employees x share x one-way distance x 2 x working
    days, per vehicle (divided by occupancy) or per passenger, x the Hub Table 10 factors; walking and cycling are a known zero."""
    require_keys(inp, {'period', 'headcount', 'workingDays', 'modes'})
    require_period(inp['period'])
    days = integer(inp['workingDays'], 1, 366, 'invalid_working_days')
    modes = inp['modes']
    if not isinstance(modes, list) or not 1 <= len(modes) <= 10:
        raise Refused('invalid_modes')
    rows = []
    for m in modes:
        require_keys(m, {'mode', 'sharePercent', 'oneWayDistance', 'distanceUnit', 'occupancy'})
        mode = _choice(m['mode'], COMMUTING_AVG_MODES, 'unsupported_mode')
        share = quantity(m['sharePercent'], 'invalid_share')
        if share > 100:
            raise Refused('invalid_share')
        distance = quantity(m['oneWayDistance'], 'invalid_quantity')
        unit = _choice(m['distanceUnit'], COMMUTE_DISTANCE_UNITS, 'unsupported_unit')
        vehicle = mode != 'non_motorized' and TRAVEL_MODES[mode][1] == 'vehicle'
        occupancy = None
        if m['occupancy'] is not None:
            if not vehicle:
                raise Refused('occupancy_not_applicable')
            occupancy = quantity(m['occupancy'], 'invalid_occupancy')
            if occupancy < 1:
                raise Refused('invalid_occupancy')
        rows.append((mode, share, distance, unit, vehicle, occupancy))
    headcount = quantity(inp['headcount'], 'invalid_quantity')
    mid = KIND_METHOD['commuting_average']
    total_share = sum((r[1] for r in rows), Decimal(0))
    if total_share != 100:
        # Never scaled: a profile whose shares do not add up to 100% is held until it is corrected.
        return _result(mid, 7, inp, {}, status='input_needed', findings=['mode_shares_must_total_100'], activity={'sharesTotalPercent': exact(total_share)})
    used: dict = {}
    conversions: list = []
    estimates: list = []
    notes = ['average_data_commuting_profile', 'tank_to_wheel_only']
    masses = {gas: Decimal(0) for gas, _ in GASES}
    activity_modes = []
    with _exact():
        for i, (mode, share, distance, unit, vehicle, occupancy) in enumerate(rows, start=1):
            miles = distance if unit == 'mile' else divide(distance, constant('km_per_mile', used), f'mode {i} one-way miles = one-way km / 1.609344', conversions)
            person_miles = headcount * share / 100 * miles * 2 * days
            row = {'mode': mode, 'sharePercent': exact(share), 'oneWayMiles': exact(miles), 'personMiles': exact(person_miles)}
            if mode == 'non_motorized':
                notes.append('non_motorized_known_zero')
                activity_modes.append(dict(row, amount='0', unit=None))
                continue
            if vehicle:
                if occupancy is None:
                    estimates.append('commute_vehicle_occupancy_one')
                    occupancy = Decimal(1)
                amount = person_miles if occupancy == 1 else divide(person_miles, occupancy, f'mode {i} vehicle-miles = person-miles / occupancy', conversions)
                row.update(occupancy=exact(occupancy))
            else:
                amount = person_miles
            if mode == 'intercity_rail_national_average':
                estimates.append('intercity_rail_route_average')
            for gas, part in _per_gas(amount, TRAVEL_MODES[mode][0], used).items():
                masses[gas] += Decimal(part['mass'])
            activity_modes.append(dict(row, amount=exact(amount), unit=TRAVEL_MODES[mode][1] + '-mile'))
        gases = {gas: {'mass': exact(masses[gas]), 'massUnit': 'kg ' + name, 'co2e': exact(masses[gas] * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
                 for gas, name in GASES}
    return _result(mid, 7, inp, used, status='complete', gases=gases, conversions=conversions, estimates=estimates, boundary_notes=notes,
                   activity={'headcount': exact(headcount), 'workingDays': days, 'modes': activity_modes})


def teleworking(inp: dict) -> dict:
    """Category 7, optional (calculation guidance formula 7.1): the incremental home electricity (eGRID subregion rate) or
    natural gas (Hub Table 1) of working from home, above the stated baseline."""
    require_keys(inp, {'period', 'carrier', 'quantity', 'unit', 'zip', 'subregion', 'utilityEiaId'})
    require_period(inp['period'])
    carrier = _choice(inp['carrier'], ('electricity', 'natural_gas'), 'invalid_carrier')
    mid = KIND_METHOD['teleworking']
    notes = ['optional_activity_included', 'incremental_above_baseline']
    estimates: list = []
    if carrier == 'electricity':
        held = _grid_location(inp['zip'], inp['subregion'], inp['utilityEiaId'])
        if held is not None:
            return _result(mid, 7, inp, {}, status=held[0], findings=[held[1]])
    else:
        _no_location(inp)
        if inp['unit'] not in TELEWORK_GAS_UNITS:
            raise Refused('unsupported_unit')
    used: dict = {}
    with _exact():
        q = quantity(inp['quantity'], 'invalid_quantity')
        if carrier == 'electricity':
            mwh = _mwh(q, inp['unit'], used)
            gases = _grid_gases(mwh, inp['subregion'], used)
            activity = {'carrier': carrier, 'mwh': exact(mwh), 'subregion': inp['subregion']}
            notes.append('location_based_grid_rates')
        else:
            mmbtu = _natural_gas_mmbtu(q, inp['unit'], used, estimates)
            gases = _fuel_gases(mmbtu, 'natural_gas', used)
            activity = {'carrier': carrier, 'mmbtuHhv': exact(mmbtu)}
    return _result(mid, 7, inp, used, status='complete', gases=gases, activity=activity, estimates=estimates, boundary_notes=notes)


def asset_energy(inp: dict) -> dict:
    """Categories 4, 8, 9, 10, 13 and 14, asset-specific (calculation guidance formulas 8.1 and 8.2): one asset's electricity,
    natural gas or refrigerant released, allocated by floor area when not sub-metered. The collection step applies the lease
    boundary of the company's consolidation approach (A15) before a record reaches the engine."""
    require_keys(inp, {'period', 'category', 'carrier', 'quantity', 'unit', 'zip', 'subregion', 'utilityEiaId', 'refrigerantGas', 'allocation'})
    require_period(inp['period'])
    category = inp['category']
    if type(category) is not int or category not in ASSET_CATEGORIES:
        raise Refused('invalid_category')
    carrier = _choice(inp['carrier'], ASSET_CARRIERS, 'invalid_carrier')
    allocation = inp['allocation']
    if allocation is not None:
        require_keys(allocation, {'reportingArea', 'buildingArea', 'occupancyPercent', 'areaUnit'})
        _choice(allocation['areaUnit'], AREA_UNITS, 'invalid_allocation')
        area, building, occupancy = (quantity(allocation[k], 'invalid_allocation') for k in ('reportingArea', 'buildingArea', 'occupancyPercent'))
        if occupancy > 100:
            raise Refused('invalid_allocation')
    gas_key = None
    if carrier == 'refrigerant':
        _no_location(inp)
        gas_key = f'hub2025_gwp.{inp["refrigerantGas"]}' if isinstance(inp['refrigerantGas'], str) else None
        if gas_key is None or gas_key not in _register('supplement')['entries']:
            raise Refused('unknown_refrigerant')
        if inp['unit'] not in REFRIGERANT_UNITS:
            raise Refused('unsupported_unit')
    else:
        if inp['refrigerantGas'] is not None:
            raise Refused('invalid_input_shape')
        if carrier == 'natural_gas':
            _no_location(inp)
            if inp['unit'] not in ASSET_GAS_UNITS:
                raise Refused('unsupported_unit')
        elif inp['unit'] not in ELECTRICITY_UNITS:
            raise Refused('unsupported_unit')
    q = quantity(inp['quantity'], 'invalid_quantity')
    mid = KIND_METHOD['asset_energy']
    if carrier == 'electricity':
        held = _grid_location(inp['zip'], inp['subregion'], inp['utilityEiaId'])
        if held is not None:
            return _result(mid, category, inp, {}, status=held[0], findings=[held[1]])
    used: dict = {}
    conversions: list = []
    estimates: list = []
    notes = ['asset_lifecycle_excluded'] + (['warehouse_site_specific'] if category in WAREHOUSE_CATEGORIES else [])
    with _exact():
        share = None
        if allocation is not None:
            occupied = building * occupancy / 100
            if occupied == 0:
                return _result(mid, category, inp, {}, status='input_needed', findings=['building_area_or_occupancy_zero'], activity={'carrier': carrier})
            if area > occupied:
                return _result(mid, category, inp, {}, status='review_required', findings=['allocated_share_exceeds_one'], activity={'carrier': carrier})
            share = divide(area, occupied, 'allocated share = reporting area / (building area x occupancy percent / 100)', conversions)
            estimates.append('area_allocated_not_submetered')
        apply = (lambda v: v * share) if share is not None else (lambda v: v)
        activity = {'carrier': carrier, 'allocationShare': exact(share) if share is not None else None}
        co2e_only = None
        gases = None
        if carrier == 'electricity':
            mwh = apply(_mwh(q, inp['unit'], used))
            gases = _grid_gases(mwh, inp['subregion'], used)
            activity.update(mwh=exact(mwh), subregion=inp['subregion'])
            notes.append('location_based_grid_rates')
        elif carrier == 'natural_gas':
            mmbtu = apply(_natural_gas_mmbtu(q, inp['unit'], used, estimates))
            gases = _fuel_gases(mmbtu, 'natural_gas', used)
            activity.update(mmbtuHhv=exact(mmbtu))
        else:
            kg = apply(q if inp['unit'] == 'kg' else q * constant('lb_to_kg', used))
            co2e = kg * factor(gas_key, used)
            activity.update(refrigerantKg=exact(kg), refrigerantGas=inp['refrigerantGas'])
            if inp['refrigerantGas'].startswith('R-'):
                notes.append('blend_gwp_hfc_pfc_constituents_only')
            co2e_only = {'co2e': exact(co2e), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR5-100',
                         'reason': 'Refrigerant released x AR5 100-year GWP (EPA Hub Table 11, or Table 12 for a blend); a blend is not split by gas'}
    return _result(mid, category, inp, used, status='complete', gases=gases, co2e_only=co2e_only, conversions=conversions, activity=activity,
                   estimates=estimates, boundary_notes=notes)


def partner_reported(inp: dict) -> dict:
    """Categories 4, 5, 8, 9, 10, 12, 13 and 14 from the partner's own scope 1 and 2 total (calculation guidance formulas 8.3,
    13, 14.1): the partner's kg CO2e x the reporting company's share, used as reported (GWP set AS-REPORTED, basis disclosed)."""
    require_keys(inp, {'period', 'category', 'quantity', 'unit', 'allocationBasis', 'allocationNumerator', 'allocationDenominator', 'scope2Basis', 'gwpBasis',
                       'verification', 'periodMatches'})
    require_period(inp['period'])
    category = inp['category']
    if type(category) is not int or category not in PARTNER_CATEGORIES:
        raise Refused('invalid_category')
    basis = _choice(inp['allocationBasis'], PARTNER_ALLOCATION_BASES, 'invalid_allocation_basis')
    num, den = inp['allocationNumerator'], inp['allocationDenominator']
    if (basis == 'exclusive') != (num is None) or (num is None) != (den is None):
        raise Refused('invalid_allocation')
    scope2 = _choice(inp['scope2Basis'], SCOPE2_BASES, 'invalid_scope2_basis')
    gwp_basis = _choice(inp['gwpBasis'], GWP_BASES, 'invalid_gwp_basis')
    verification = _choice(inp['verification'], VERIFICATION, 'invalid_verification')
    if not isinstance(inp['periodMatches'], bool):
        raise Refused('invalid_period_matches')
    unit = _choice(inp['unit'], SUPPLIER_TOTAL_UNITS, 'unsupported_unit')
    q = quantity(inp['quantity'], 'invalid_quantity')
    if num is not None:
        n, d = quantity(num, 'invalid_allocation'), quantity(den, 'invalid_allocation')
    mid = KIND_METHOD['partner_reported']
    findings = []
    if not inp['periodMatches']:
        findings.append('partner_period_mismatch')
    if num is not None and d == 0:
        findings.append('partner_share_denominator_zero')
    elif num is not None and n > d:
        findings.append('allocation_share_exceeds_one')
    if findings:
        # Never counted: a zero denominator needs input; a share above one, or a figure for another period, needs review.
        status = 'input_needed' if findings == ['partner_share_denominator_zero'] else 'review_required'
        return _result(mid, category, inp, {}, status=status, findings=findings, activity={'allocationBasis': basis})
    used: dict = {}
    conversions: list = []
    with _exact():
        total = q * constant('metric_ton_to_kg', used) if unit == 'metric_ton CO2e' else q
        share = divide(n, d, 'allocation share = numerator / denominator', conversions) if num is not None else None
        kg = total * share if share is not None else total
    notes = [f'partner_gwp_basis_{gwp_basis.lower()}', f'partner_scope2_{scope2}'] + (['partner_data_unverified'] if verification == 'unverified' else [])
    activity = {'partnerTotalKg': exact(total), 'unit': unit, 'allocationBasis': basis, 'allocationShare': exact(share) if share is not None else None,
                'scope2Basis': scope2, 'gwpBasis': gwp_basis, 'verification': verification}
    return _result(mid, category, inp, used, status='complete', conversions=conversions, activity=activity, boundary_notes=notes,
                   co2e_only={'co2e': exact(kg), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AS-REPORTED',
                              'reason': f'Partner-reported scope 1 and 2 CO2e (declared GWP basis {gwp_basis}, scope 2 {scope2}-based); used as reported, not split by gas or restated'})


# --- I-07 --- Use of sold products, end of life of sold products and investments.

def _fuel_energy(q: Decimal, unit, fuel: str, fuels: dict, used: dict, estimates: list) -> Decimal:
    """MMBtu (HHV) of a quantity of a Hub Table 1 fuel: as stated in MMBtu, or in the fuel's own Table 1 unit x its default heat content."""
    if unit == 'MMBtu':
        return q
    if unit != fuels[fuel][0]:
        raise Refused('unsupported_unit')
    estimates.append('fuel_default_heat_content')
    return q * factor(f'hub2025_t1.{fuel}.heat_content', used)


def _fuel_combustion(mmbtu: Decimal, fuel: str, fuels: dict, used: dict) -> tuple[dict, dict | None]:
    """Hub Table 1 combustion of `mmbtu` of `fuel`: (gases, biogenic CO2). A biomass fuel's CO2 is biogenic: it leaves the gases
    and is returned separately (outside every total); its CH4 and N2O stay in the gases and the total (DESIGN N-7)."""
    gases = _fuel_gases(mmbtu, fuel, used)
    if not fuels[fuel][1]:
        return gases, None
    co2 = gases.pop('co2')
    return gases, {'mass': co2['mass'], 'massUnit': 'kg CO2',
                   'basis': f'Biogenic CO2 of {fuel} (EPA Hub 2025 Table 1, {used[f"hub2025_t1.{fuel}.co2"]["table"].split(": ", 1)[-1]}), reported separately and never in a total'}


def _fuel_notes(fuel: str, fuels: dict) -> list:
    notes = ['stationary_ch4_n2o_proxy_for_transport_fuels'] if fuel in TRANSPORT_FUELS else []
    if fuels[fuel][1]:
        notes.append('biogenic_co2_reported_separately')
    if fuel == 'peat':
        notes.append('peat_classified_biomass_by_hub')
    return notes


def sold_fuel(inp: dict) -> dict:
    """Category 11, fuels sold (calculation guidance formula 11.2): the combustion of the fuel by its users, Hub 2025 Table 1. A
    feedstock not combusted in use is a known zero; a biomass fuel's CO2 is biogenic and reported separately."""
    require_keys(inp, {'period', 'fuel', 'quantity', 'unit', 'combustedInUse'})
    require_period(inp['period'])
    use = _choice(inp['combustedInUse'], SOLD_FUEL_USES, 'invalid_combusted_in_use')
    fuels = _sold_fuels()
    fuel = _choice(inp['fuel'], fuels, 'unknown_fuel')
    if inp['unit'] != 'MMBtu' and inp['unit'] != fuels[fuel][0]:
        raise Refused('unsupported_unit')
    q = quantity(inp['quantity'], 'invalid_quantity')
    mid = KIND_METHOD['sold_fuel']
    activity = {'fuel': fuel, 'quantity': exact(q), 'unit': inp['unit'], 'combustedInUse': use, 'biomass': fuels[fuel][1]}
    if use == 'no_feedstock':
        # A known zero with its reason (calculation guidance p.118): the fuel is a feedstock, so nothing of it is combusted in use.
        return _result(mid, 11, inp, {}, status='complete', activity=activity, boundary_notes=['feedstock_not_combusted'], consulted=['supplement'],
                       co2e_only={'co2e': '0', 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR5-100', 'reason': 'Sold as a feedstock and not combusted in use: a known zero (calculation guidance [11.2], p.118)'})
    used: dict = {}
    estimates: list = []
    with _exact():
        mmbtu = _fuel_energy(q, inp['unit'], fuel, fuels, used, estimates)
        gases, biogenic = _fuel_combustion(mmbtu, fuel, fuels, used)
    activity['mmbtuHhv'] = exact(mmbtu)
    return _result(mid, 11, inp, used, status='complete', gases=gases, activity=activity, estimates=estimates, biogenic_co2=biogenic,
                   boundary_notes=['combustion_only'] + _fuel_notes(fuel, fuels))


def sold_energy_product(inp: dict) -> dict:
    """Category 11, products that use energy directly (calculation guidance formula 11.1): units sold x lifetime x energy per year
    or use, x the reporting year's eGRID2023 rev2 rate of the U.S. region of use (or a Hub Table 1 fuel's combustion). Use outside the
    U.S. has no verified grid factor here and is held, never counted as zero."""
    require_keys(inp, {'period', 'quantity', 'lifetimeBasis', 'lifetimeQuantity', 'energyPerBasis', 'energyCarrier', 'energyUnit', 'useRegion'})
    require_period(inp['period'])
    basis = _choice(inp['lifetimeBasis'], LIFETIME_BASES, 'invalid_lifetime_basis')
    units = quantity(inp['quantity'], 'invalid_quantity')
    life = quantity(inp['lifetimeQuantity'], 'invalid_lifetime')
    per = quantity(inp['energyPerBasis'], 'invalid_energy_per_basis')
    carrier, unit, region = inp['energyCarrier'], inp['energyUnit'], inp['useRegion']
    fuels = _sold_fuels()
    electricity = carrier == 'electricity'
    if not electricity and (not isinstance(carrier, str) or carrier not in fuels):
        raise Refused('unknown_energy_carrier')
    therm = not electricity and carrier == 'natural_gas' and unit == 'therm'  # round 2 (ACC-5, DESIGN 13.5): therm x 0.1 exactly
    if electricity and unit not in ELECTRICITY_UNITS or not electricity and not therm and unit != 'MMBtu' and unit != fuels[carrier][0]:
        raise Refused('unsupported_unit')
    if not isinstance(region, str) or region not in (USE_REGION_US, USE_REGION_NON_US) and region not in SUBREGION_INTERCONNECT:
        raise Refused('unknown_use_region')
    mid = KIND_METHOD['sold_energy_product']
    activity = {'unitsSold': exact(units), 'lifetimeBasis': basis, 'lifetimeQuantity': exact(life), 'energyPerBasis': exact(per), 'energyCarrier': carrier,
                'energyUnit': unit, 'useRegion': region}
    if electricity and region == USE_REGION_NON_US:
        # Held, never zero: no verified grid factor for use outside the U.S. is loaded (DESIGN N-4).
        return _result(mid, 11, inp, {}, status='input_needed', findings=['use_region_outside_us'], activity=activity)
    used: dict = {}
    estimates: list = []
    notes = ['direct_use_phase_only', 'indirect_use_phase_excluded']
    biogenic = None
    with _exact():
        lifetime = units * life * per
        activity['lifetimeEnergy'] = exact(lifetime)
        if basis == 'years' and life > LIFETIME_YEARS_CHECK:
            estimates.append('lifetime_over_30_years_check')
        if electricity:
            if basis == 'years' and (per if unit == 'kWh' else per * 1000) > ANNUAL_KWH_CHECK:
                estimates.append('annual_kwh_over_50000_check')
            mwh = _mwh(lifetime, unit, used)
            gases = _grid_gases(mwh, None if region == USE_REGION_US else region, used)
            activity['mwh'] = exact(mwh)
            notes.append('reporting_year_grid_factor')
        else:
            mmbtu = lifetime * constant('supplement_const.therm_to_mmbtu', used) if therm else _fuel_energy(lifetime, unit, carrier, fuels, used, estimates)
            gases, biogenic = _fuel_combustion(mmbtu, carrier, fuels, used)
            activity['mmbtuHhv'] = exact(mmbtu)
            notes += _fuel_notes(carrier, fuels)
    return _result(mid, 11, inp, used, status='complete', gases=gases, activity=activity, estimates=estimates, biogenic_co2=biogenic, boundary_notes=notes)


def sold_ghg_product(inp: dict) -> dict:
    """Category 11, products containing greenhouse gases (calculation guidance formula 11.3): units sold x charge x the share released
    during use (required, no default) x AR5 GWP (Hub Tables 11 and 12). Release at end of life belongs in category 12."""
    require_keys(inp, {'period', 'quantity', 'gas', 'chargePerUnit', 'chargeUnit', 'useReleasePercent'})
    require_period(inp['period'])
    gas = inp['gas']
    gas_key = f'hub2025_gwp.{gas}' if isinstance(gas, str) else None
    if gas_key is None or gas_key not in _register('supplement')['entries']:
        raise Refused('unknown_gas')
    charge_unit = _choice(inp['chargeUnit'], CHARGE_UNITS, 'unsupported_unit')
    units = quantity(inp['quantity'], 'invalid_quantity')
    charge = quantity(inp['chargePerUnit'], 'invalid_charge')
    percent = quantity(inp['useReleasePercent'], 'invalid_release_percent')
    if percent > 100:
        raise Refused('invalid_release_percent')
    used: dict = {}
    with _exact():
        kg_per_unit = charge if charge_unit == 'kg' else charge * constant('lb_to_kg', used)
        released = units * kg_per_unit * percent / 100
        gwp = factor(gas_key, used)
        co2e = released * gwp
        # Round 3 (owner decision 3, AC-4): the charge left at end of life x the same GWP, an upper bound (no recovery), never in a total.
        remaining = units * kg_per_unit * (100 - percent) / 100
        memo = [{'code': 'ghg_product_end_of_life_remaining_charge', 'kg': exact(remaining * gwp), 'unit': 'kg CO2e', 'reportedSeparately': True}]
    notes = ['use_phase_release_only', 'end_of_life_remaining_charge_memo_upper_bound'] + (['blend_gwp_hfc_pfc_constituents_only'] if gas.startswith('R-') else [])
    return _result(KIND_METHOD['sold_ghg_product'], 11, inp, used, status='complete', boundary_notes=notes, memo_items=memo,
                   activity={'unitsSold': exact(units), 'gas': gas, 'chargeKgPerUnit': exact(kg_per_unit), 'useReleasePercent': exact(percent), 'releasedKg': exact(released),
                             'remainingAtEndOfLifeKg': exact(remaining)},
                   co2e_only={'co2e': exact(co2e), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR5-100',
                              'reason': 'Gas released during use x AR5 100-year GWP (EPA Hub Table 11, or Table 12 for a blend); not split by gas'})


def end_of_life_split(inp: dict) -> dict:
    """Category 12 by treatment split (calculation guidance formula 12.1): the mass of products or packaging sold x the share of each
    treatment x its Hub Table 9 factor, the waste arithmetic per treatment. An unknown split is held, never assumed."""
    require_keys(inp, {'period', 'material', 'basis', 'split', 'quantity', 'unit'})
    require_period(inp['period'])
    basis = _choice(inp['basis'], EOL_BASES, 'invalid_basis')
    materials = _waste_materials()
    material = _choice(inp['material'], materials, 'unknown_material')
    if inp['unit'] not in WASTE_UNITS:
        raise Refused('unsupported_unit')
    q = quantity(inp['quantity'], 'invalid_quantity')
    split = inp['split']
    mid = KIND_METHOD['end_of_life_split']
    activity = {'material': material, 'basis': basis}
    if split is None:
        return _result(mid, 12, inp, {}, status='input_needed', findings=['treatment_split_unknown'], activity=activity)
    require_keys(split, set(WASTE_TREATMENTS))
    shares = {t: quantity(split[t], 'invalid_split') for t in WASTE_TREATMENTS}
    if any(s > 100 for s in shares.values()):
        raise Refused('invalid_split')
    total_share = sum(shares.values(), Decimal(0))
    if total_share != 100:
        return _result(mid, 12, inp, {}, status='input_needed', findings=['treatment_split_must_total_100'], activity=dict(activity, sharesTotalPercent=exact(total_share)))
    missing = [t for t in WASTE_TREATMENTS if shares[t] > 0 and t not in materials[material]]
    if missing:
        return _result(mid, 12, inp, {}, status='input_needed', findings=['no_published_factor_for_material_and_treatment'], activity=dict(activity, treatmentsWithoutFactor=missing))
    used: dict = {}
    conversions: list = []
    with _exact():
        if inp['unit'] == 'short_ton':
            tons = q
        elif inp['unit'] == 'lb':
            tons = divide(q, constant('lb_per_short_ton', used), 'short tons = lb / 2000', conversions)
        else:
            per_ton = constant('lb_to_kg', used) * constant('lb_per_short_ton', used)
            kg = q if inp['unit'] == 'kg' else q * constant('metric_ton_to_kg', used)
            what = 'short tons = kg / (0.45359237 x 2000)' if inp['unit'] == 'kg' else 'short tons = metric tons x 1000 / (0.45359237 x 2000)'
            tons = divide(kg, per_ton, what, conversions)
        rows, co2e = [], Decimal(0)
        for t in WASTE_TREATMENTS:
            if shares[t] == 0:
                continue
            part = tons * shares[t] / 100
            kg_t = part * factor(f'waste.{material}.{t}', used) * constant('metric_ton_to_kg', used)
            co2e += kg_t
            rows.append({'treatment': t, 'sharePercent': exact(shares[t]), 'shortTons': exact(part), 'co2e': exact(kg_t)})
    notes = ['avoided_emissions_excluded', 'includes_transport_to_facility', 'ar4_gwp_embedded_in_factor', 'sold_product_end_of_life_assumed_split']
    return _result(mid, 12, inp, used, status='complete', conversions=conversions, boundary_notes=notes, activity=dict(activity, shortTons=exact(tons), treatments=rows),
                   co2e_only={'co2e': exact(co2e), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR4-100', 'reason': 'EPA Hub Table 9 publishes CO2e only'})


def investment(inp: dict) -> dict:
    """Category 15 (calculation guidance formulas 15.1-15.3; DESIGN 4.4, A13): investee- or project-reported scope 1 and 2 x the
    attribution share (`scope3.cat15.investment_reported.v1`), or the investee's revenue x the EPA v1.3 factor without margins x the
    price ratio x the share, an upper-bound proxy (`..._revenue_eeio...`). Projected lifetime emissions of a project are a memo item."""
    require_keys(inp, {'period', 'path', 'holdingType', 'outstandingAmount', 'attribution', 'investeeEmissions', 'emissionsVerified', 'gwpBasis', 'revenue',
                       'revenueYear', 'naicsCode', 'projectedAnnual', 'lifetimeYears'})
    require_period(inp['period'])
    path = _choice(inp['path'], INVESTMENT_PATHS, 'invalid_investment_path')
    holding = _choice(inp['holdingType'], HOLDING_TYPES, 'invalid_holding_type')
    amount = quantity(inp['outstandingAmount'], 'invalid_quantity')
    attribution = inp['attribution']
    if not isinstance(attribution, dict) or attribution.get('basis') not in ('outstanding_over_denominator', 'equity_share_percent'):
        raise Refused('invalid_attribution')
    if attribution['basis'] == 'outstanding_over_denominator':
        require_keys(attribution, {'basis', 'denominatorType', 'denominator'})
        _choice(attribution['denominatorType'], ATTRIBUTION_DENOMINATORS, 'invalid_attribution')
        denominator = quantity(attribution['denominator'], 'invalid_attribution')
    else:
        require_keys(attribution, {'basis', 'percent'})
        percent = quantity(attribution['percent'], 'invalid_attribution')
    reported = path != 'revenue_eeio'
    if reported:
        if inp['revenue'] is not None or inp['revenueYear'] is not None or inp['naicsCode'] is not None:
            raise Refused('invalid_input_shape')
        gwp_basis = _choice(inp['gwpBasis'], GWP_BASES, 'invalid_gwp_basis')
        if inp['emissionsVerified'] is not None and not isinstance(inp['emissionsVerified'], bool):
            raise Refused('invalid_verification')
        emissions = quantity(inp['investeeEmissions'], 'invalid_investee_emissions') if inp['investeeEmissions'] is not None else None
    else:
        if inp['investeeEmissions'] is not None or inp['emissionsVerified'] is not None or inp['gwpBasis'] is not None:
            raise Refused('invalid_input_shape')
        revenue = quantity(inp['revenue'], 'invalid_revenue')
        if not isinstance(inp['naicsCode'], str) or not NAICS6.fullmatch(inp['naicsCode']):
            raise Refused('invalid_naics_code')
        year = integer(inp['revenueYear'], SPEND_YEARS[0], SPEND_YEARS[1], 'invalid_revenue_year')
    projected, years = inp['projectedAnnual'], inp['lifetimeYears']
    if (projected is None) != (years is None):
        raise Refused('invalid_projection')
    if projected is not None:
        projected = quantity(projected, 'invalid_projection')
        years = integer(years, 1, 100, 'invalid_projection')
    mid = INVESTMENT_PATHS[path]
    findings: list = []
    if attribution['basis'] == 'outstanding_over_denominator':
        if denominator == 0:
            findings.append('attribution_denominator_zero')
        elif amount > denominator:
            findings.append('attribution_share_exceeds_one')
    elif percent > 100:
        findings.append('attribution_share_exceeds_one')
    consulted: list = []
    if reported and emissions is None:
        findings.append('investee_emissions_required')
    if not reported:
        spend = _register('spend')
        consulted = ['spend']
        key = f"epa_scghg_v130.{inp['naicsCode']}.without_margins"
        base_year = int(Decimal(spend['constants']['price_index.base_year']['value']))
        # The spend method's two findings, named for an investee's revenue (their texts say what to fix here).
        if key not in spend['entries']:
            findings.append('investee_naics_code_not_in_factor_set')
        index_year = year if year == base_year else _price_index_year(year, inp['period'], spend)
        if index_year is None:
            findings.append('revenue_year_index_missing')
    activity = {'path': path, 'holdingType': holding, 'attributionBasis': attribution['basis'], 'pcafScore': None}
    if findings:
        # Never counted: a zero denominator, missing investee emissions or an unmapped sector need input; a share above one needs review.
        status = 'review_required' if 'attribution_share_exceeds_one' in findings else 'input_needed'
        return _result(mid, 15, inp, {}, status=status, findings=findings, activity=activity, consulted=consulted)
    used: dict = {}
    conversions: list = []
    estimates: list = []
    notes = ['optional_investment_type_included'] if holding in OPTIONAL_HOLDING_TYPES else []
    with _exact():
        if attribution['basis'] == 'outstanding_over_denominator':
            share = divide(amount, denominator, f"attribution share = outstanding amount / {attribution['denominatorType'].replace('_', ' ')}", conversions)
        else:
            share = divide(percent, Decimal(100), 'attribution share = equity share percent / 100', conversions)
        activity['attributionShare'] = exact(share)
        if reported:
            verified = inp['emissionsVerified'] is True
            kg = emissions * constant('metric_ton_to_kg', used) * share
            activity.update(investeeEmissionsTonnes=exact(emissions), pcafScore=1 if verified else 2)
            notes += [f'investee_gwp_basis_{gwp_basis.lower()}', 'investee_scope3_excluded', 'pcaf_style_score_1' if verified else 'pcaf_style_score_2']
            if not verified:
                notes.append('investee_data_unverified')
            co2e_only = {'co2e': exact(kg), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AS-REPORTED',
                         'reason': f'Investee-reported scope 1 and 2 CO2e (declared GWP basis {gwp_basis}) x attribution share; used as reported, not split by gas or restated'}
        else:
            ef = factor(key, used)
            constant('price_index.base_year', used)
            nominal = revenue * ef * share
            kg = nominal
            activity.update(revenue=exact(revenue), revenueYear=year, naicsCode=inp['naicsCode'], nominalCo2e=exact(nominal), pcafScore=4)
            if year != base_year:
                ratio = divide(constant(f'price_index.gdp_deflator.{base_year}', used), constant(f'price_index.gdp_deflator.{index_year}', used),
                               f'price ratio = I{base_year} / I{index_year} (BEA GDP implicit price deflator, FRED A191RD3A086NBEA; economy-wide, not commodity-specific)', conversions)
                kg = revenue * ef * ratio * share
                activity['priceRatio'] = exact(ratio)
                estimates.append('revenue_economy_wide_price_index')
                if index_year != year:
                    activity['priceIndexYearUsed'] = index_year
                    notes.append('price_index_latest_published_year_used')
            notes += ['eeio_upper_bound_proxy_includes_investee_upstream', 'revenue_proxy', 'factor_ghg_year_2022', 'pcaf_style_score_4']
            co2e_only = {'co2e': exact(kg), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AR5-100',
                         'reason': 'EPA Supply Chain GHG Emission Factors v1.3 without margins publish CO2e only (AR5 100-year GWPs applied by EPA)'}
        memo = None
        if projected is not None:
            # Calculation guidance p.151-152: the project's projected lifetime scope 1 and 2 x the share, reported separately.
            lifetime_kg = projected * constant('metric_ton_to_kg', used) * years * share
            memo = [{'code': 'projected_lifetime_emissions', 'kg': exact(lifetime_kg), 'unit': 'kg CO2e', 'reportedSeparately': True}]
            activity.update(projectedAnnualTonnes=exact(projected), lifetimeYears=years)
            notes.append('projected_lifetime_emissions_reported_separately')
    return _result(mid, 15, inp, used, status='complete', conversions=conversions, activity=activity, estimates=estimates, boundary_notes=notes,
                   co2e_only=co2e_only, memo_items=memo, consulted=consulted)


# --- I-12u --- Category 3 upstream (3A, 3B, 3C upstream, 3D upstream).

def _upstream_co2e(kg: Decimal, reason: str) -> dict:
    return {'co2e': exact(kg), 'co2eUnit': 'kg CO2e', 'gwpSetId': UPSTREAM_GWP_SET, 'reason': reason}


def _ng_upstream_factor(pair: tuple, used: dict) -> Decimal:
    """The NETL intensity in kg CO2e per MMBtu (HHV): R5's exact derived constant, read with the published g/MJ value and the
    MJ per MMBtu definition it is derived from (all three listed on the result); they must agree exactly."""
    published, derived = factor(pair[0], used), constant(pair[1], used)
    if published * constant('us_upstream_const.mj_per_mmbtu', used) * constant('g_to_kg', used) != derived:
        raise RuntimeError('derived NETL constant does not match its published value')
    return derived


_NETL_REASON = 'NETL publishes supply-chain CO2e only (IPCC AR6 100-year GWPs, as published)'
_GREET_REASON = 'CA-GREET3.0 publishes carbon intensities as CO2e only (GWP set not stated by CARB; inferred AR4 100-year)'


def _scope1_gas_mmbtu(inp: dict, used: dict, conversions: list):
    """Natural gas MMBtu (HHV) by the Scope 1 engine's own rules (scope1_engine.natural_gas): MMBtu as stated, therms x 0.1, or
    scf/ccf/mcf x the heat content stated on the bill (none -> input needed; no default heat content is applied). A division
    by 100 or 1,000 is exact here and listed. Returns MMBtu, or None when Scope 1 would need input."""
    q = quantity(inp['quantity'], 'invalid_quantity')
    unit = inp['unit']
    if unit in ('MMBtu', 'therm'):
        if 'heatContent' in inp:
            raise Refused('invalid_input_shape')
        return q if unit == 'MMBtu' else q * constant('supplement_const.therm_to_mmbtu', used)
    if unit not in ('scf', 'ccf', 'mcf'):
        raise Refused('unsupported_unit')
    if 'heatContent' not in inp:
        return None
    hc = inp['heatContent']
    require_keys(hc, {'value', 'unit'})
    value = Decimal(hc['value']) if isinstance(hc['value'], str) and SCOPE1_FACTOR_TEXT.fullmatch(hc['value']) else None
    if value is None or value == 0 or hc['unit'] not in NG_HEAT_CONTENT_UNITS:
        raise Refused('invalid_heat_content')
    scf = q if unit == 'scf' else q * constant(f'supplement_const.scf_per_{unit}', used)
    if hc['unit'] == 'MMBtu per scf':
        return scf * value
    per = 'ccf' if hc['unit'] in ('MMBtu per ccf', 'therm per ccf') else 'mcf'
    mmbtu = divide(scf * value, constant(f'supplement_const.scf_per_{per}', used), f'MMBtu = scf x heat content per {per} / scf per {per}', conversions)
    return mmbtu * constant('supplement_const.therm_to_mmbtu', used) if hc['unit'] == 'therm per ccf' else mmbtu


def _scope1_gallons(inp: dict):
    """Gallons consumed by the Scope 1 rules (scope1_engine.distillate): measured, or purchases + opening - closing tank.
    Returns (gallons, None) or (None, (status, finding)) when Scope 1 would hold the record."""
    c = inp['consumption']
    if not isinstance(c, dict) or c.get('basis') not in ('measured', 'purchases_with_tank_levels', 'purchases_only'):
        raise Refused('invalid_consumption')
    if c['basis'] == 'purchases_only':
        require_keys(c, {'basis', 'purchasedGallons'})
        return None, ('input_needed', 'tank_levels_required_for_purchases')
    if c['basis'] == 'measured':
        require_keys(c, {'basis', 'gallons'})
        return quantity(c['gallons'], 'invalid_quantity'), None
    require_keys(c, {'basis', 'purchasedGallons', 'openingGallons', 'closingGallons'})
    gallons = quantity(c['purchasedGallons'], 'invalid_quantity') + quantity(c['openingGallons'], 'invalid_quantity') - quantity(c['closingGallons'], 'invalid_quantity')
    return (None, ('review_required', 'negative_consumption_from_tank_levels')) if gallons < 0 else (gallons, None)


def fuel_upstream(inp: dict) -> dict:
    """Category 3A (DESIGN 13.2): the upstream of a Scope 1 fuel record. Natural gas: MMBtu (Scope 1 rules) x NETL production
    through distribution; liquids: gallons x CARB LCFS energy density x CA-GREET3.0 upstream carbon intensity (both LHV)."""
    if not isinstance(inp, dict) or inp.get('source') not in UPSTREAM_SOURCES:
        raise Refused('invalid_input_shape')
    source = inp['source']
    mid = KIND_METHOD['fuel_upstream']
    used: dict = {}
    conversions: list = []
    with _exact():
        if source == 'natural_gas':
            require_keys(inp, {'period', 'source', 'quantity', 'unit'}, {'heatContent'})
            require_period(inp['period'])
            mmbtu = _scope1_gas_mmbtu(inp, used, conversions)
            if mmbtu is None:
                return _result(mid, 3, inp, {}, status='input_needed', findings=['heat_content_required_for_volume'])
            f = _ng_upstream_factor(NG_DISTRIBUTION, used)
            kg = mmbtu * f
            return _result(mid, 3, inp, used, status='complete', co2e_only=_upstream_co2e(kg, _NETL_REASON), conversions=conversions,
                           activity={'source': source, 'mmbtuHhv': exact(mmbtu), 'upstreamFactor': {'value': exact(f), 'unit': 'kg CO2e per MMBtu (HHV)'},
                                     'factorBoundary': 'production_through_distribution'},
                           boundary_notes=['natural_gas_upstream_hhv_basis', 'upstream_gwp_as_published_ar6'])
        if source == 'distillate_no2':
            require_keys(inp, {'period', 'source', 'consumption'})
            require_period(inp['period'])
            gallons, held = _scope1_gallons(inp)
            fuel, notes = 'ulsd', ['distillate_proxied_by_ulsd']
        else:
            require_keys(inp, {'period', 'source', 'fuel', 'gallons'})
            require_period(inp['period'])
            if not isinstance(inp['fuel'], str) or inp['fuel'] not in VEHICLE_UPSTREAM_FUELS:
                raise Refused('upstream_factor_not_available_for_fuel')
            gallons, held = quantity(inp['gallons'], 'invalid_quantity'), None
            fuel, notes = VEHICLE_UPSTREAM_FUELS[inp['fuel']], ['biofuel_share_not_modelled']
        if not _liquids_verified():
            raise Refused('upstream_factor_not_available_for_fuel')
        if held is not None:
            return _result(mid, 3, inp, {}, status=held[0], findings=[held[1]])
        ed_key, up_key = LIQUID_UPSTREAM[fuel]
        ed, up = factor(ed_key, used), factor(up_key, used)
        kg = gallons * ed * up * constant('g_to_kg', used)
    return _result(mid, 3, inp, used, status='complete', co2e_only=_upstream_co2e(kg, _GREET_REASON),
                   activity={'source': source, 'gallons': exact(gallons), 'pathway': fuel, 'megajoulesLhv': exact(gallons * ed)},
                   boundary_notes=notes + ['california_pathway_proxy', 'liquid_upstream_lhv_basis', 'upstream_gwp_inferred_ar4', 'cagreet3_vintage_superseded_by_cagreet4'])


def _mapped_power_fuels() -> tuple:
    """The fossil fuels with an upstream factor: natural gas, and oil while R5 states the CA-GREET3.0 basis and energy densities."""
    return tuple(f for f in sorted(POWER_FUEL_UPSTREAM) if f in POWER_FOSSIL_FUELS and (f != 'OIL' or _liquids_verified()))


def _oil_upstream_factor(used: dict, conversions: list) -> Decimal:
    """Owner decision 2 (round 2): kg CO2e per MMBtu (HHV) of oil-fired generation from the CA-GREET3.0 ULSD upstream, rounded once."""
    ed_key, up_key, hhv_key = POWER_FUEL_UPSTREAM['OIL']
    return divide(factor(up_key, used) * factor(ed_key, used) * constant('g_to_kg', used), factor(hhv_key, used),
                  'oil-fired upstream factor (kg CO2e per MMBtu HHV) = CA-GREET3.0 ULSD upstream (g CO2e/MJ LHV) x CARB diesel energy density (MJ/gal LHV) '
                  'x 0.001 / Hub 2025 distillate No. 2 heat content (MMBtu/gal HHV)', conversions)


def _coal_upstream_factor(used: dict, conversions: list) -> Decimal:
    """DESIGN 13.6 (round 2, lane F): kg CO2e per MMBtu (HHV) of coal, coal mine methane only, from the three printed R5 inputs in
    one division rounded half-even to 12 dp (listed); it must equal R5's derived constant (the builder's own division)."""
    ghgi, production, heat, derived = POWER_FUEL_UPSTREAM['COAL']
    kg_per_mmt, st_per_thousand = (constant(c, used) for c in COAL_UNIT_CONSTANTS)
    f = divide(factor(ghgi, used) * kg_per_mmt, factor(production, used) * st_per_thousand * factor(heat, used),
               'coal upstream factor, coal mine methane only (kg CO2e per MMBtu HHV) = EPA GHGI 2022 coal mining CH4 (MMT CO2e, AR5) x kg per MMT / '
               '(EIA 2022 coal production (thousand short tons) x 1000 x EIA 2022 coal production heat content (MMBtu per short ton, gross))', conversions)
    if f != constant(derived, used):
        raise RuntimeError('derived coal constant does not match its printed inputs')
    return f


def _power_fuel_factor(fuel: str, used: dict, conversions: list) -> Decimal:
    if fuel == 'COAL':
        return _coal_upstream_factor(used, conversions)
    return _ng_upstream_factor(POWER_FUEL_UPSTREAM['GAS'], used) if fuel == 'GAS' else _oil_upstream_factor(used, conversions)


_INTENSITY_CACHE: dict = {}


def _upstream_intensity(region: str, mwh: Decimal, used: dict, conversions: list) -> tuple[Decimal | None, dict, list, list | None]:
    """U(region) in kg CO2e per MWh generated (DESIGN 13.2; round 2 decisions 2 and 3, ACC-14): the sum over fossil fuels with an
    upstream factor of round12(heat input / net generation) x the factor; the activity facts with the gap memo for `mwh` (the
    unmapped fossil and other heat input attributable to the line, outside every total) and the boundary notes. U is None when
    the subregion has fossil heat input but none of it is mapped (the line is held, never zero). The region's facts are worked
    out once per process and fuel classification (the same factors, conversions and order every time); only the memo's
    multiplication by `mwh` is per line."""
    key = (region, _mapped_power_fuels(), POWER_FOSSIL_FUELS, POWER_OTHER_FUELS, POWER_NON_FOSSIL_FUELS, tuple(sorted(POWER_FUEL_UPSTREAM.items())))
    if key not in _INTENSITY_CACHE:
        region_used: dict = {}
        region_conversions: list = []
        _INTENSITY_CACHE[key] = (_region_intensity(region, region_used, region_conversions), region_used, region_conversions)
    (u, activity, notes, unmapped_ratio, other_ratio, coal_ratio, solar_ratio, screening), region_used, region_conversions = _INTENSITY_CACHE[key]
    used.update(region_used)
    conversions.extend(dict(c) for c in region_conversions)
    coal_mmbtu = mwh * coal_ratio
    activity = dict(activity, unmappedFossilHeatInputMmbtu=exact(mwh * unmapped_ratio),
                    otherFuelHeatInputMmbtu=None if other_ratio is None else exact(mwh * other_ratio),
                    coalHeatInputMmbtu=exact(coal_mmbtu),  # round 2, lane F: the coal heat input counted for mine methane only
                    solarThermalHeatInputMmbtu=None if solar_ratio is None else exact(mwh * solar_ratio))
    # Round 3 (owner decision 2): the omitted coal mining energy and transport CO2, a screening range outside every total.
    memo = None if screening is None else [{'code': code, 'kg': exact(coal_mmbtu * per), 'unit': 'kg CO2e', 'reportedSeparately': True}
                                           for code, per in zip(COAL_SCREENING_MEMO, screening)]
    return u, activity, list(notes), memo


def _region_intensity(region: str, used: dict, conversions: list) -> tuple:
    gen = factor(f'egrid2023_gen.{region}', used)
    fuels = sorted(k.rsplit('.', 1)[1] for k in _register('supplement')['entries'] if k.startswith(f'egrid2023_hi.{region}.'))
    mapped_fuels = _mapped_power_fuels()
    u, mapped_hi, fossil_hi, unmapped_hi, other_hi = Decimal(0), Decimal(0), Decimal(0), Decimal(0), Decimal(0)
    coal_hi, coal_ratio, coal_factor, solar_hi = Decimal(0), Decimal(0), None, Decimal(0)
    mapped, unmapped, other = [], [], []
    for f in fuels:
        hi = factor(f'egrid2023_hi.{region}.{f}', used)
        if f in POWER_FOSSIL_FUELS:
            fossil_hi += hi
            if f in mapped_fuels:
                ratio = divide(hi, gen, f'{f} heat input per MWh generated in {region} (MMBtu/MWh) = heat input / net generation', conversions)
                fuel_factor = _power_fuel_factor(f, used, conversions)
                u += ratio * fuel_factor
                mapped_hi += hi
                mapped.append(f)
                if f == 'COAL':
                    coal_hi, coal_ratio, coal_factor = hi, ratio, fuel_factor
            else:
                unmapped_hi += hi
                unmapped.append(f)
        elif f in POWER_OTHER_FUELS:
            other_hi += hi
            other.append(f)
        elif f not in POWER_NON_FOSSIL_FUELS:
            raise RuntimeError('unknown eGRID fuel category: ' + f)
        elif f == 'SOLAR':
            solar_hi = hi  # round 3 (AC-6): gas co-fired at solar-thermal plants, fossil but without an upstream term
    share = divide(mapped_hi, fossil_hi, f'mapped fossil heat input share in {region} = mapped / all fossil heat input', conversions) if fossil_hi else None
    unmapped_share = divide(unmapped_hi, fossil_hi, f'unmapped fossil heat input share in {region} = unmapped / all fossil heat input', conversions) if fossil_hi else None
    unmapped_ratio = divide(unmapped_hi, gen, f'unmapped fossil heat input per MWh generated in {region} (MMBtu/MWh) = unmapped heat input / net generation',
                            conversions) if unmapped_hi else Decimal(0)
    other_ratio = divide(other_hi, gen, f'other-fuel (OTHF) heat input per MWh generated in {region} (MMBtu/MWh) = heat input / net generation',
                         conversions) if other else None
    coal_share = (divide(coal_hi, fossil_hi, f'coal share of the fossil heat input in {region} (mine methane only) = coal / all fossil heat input', conversions)
                  if coal_hi else Decimal(0)) if fossil_hi else None
    solar_ratio = divide(solar_hi, gen, f'heat input at solar-primary plants per MWh generated in {region} (MMBtu/MWh; gas co-fired at solar-thermal plants) = '
                         'heat input / net generation', conversions) if solar_hi else None
    screening = None
    if coal_factor is not None:
        # Round 3 (owner decision 2): the per-MMBtu ends of the coal screening range; exact products, no division.
        low_key, high_key = COAL_SCREENING
        screening = (factor(low_key, used) * constant('lb_to_kg', used),
                     factor(high_key, used) * constant('us_upstream_const.mj_per_mmbtu', used) * constant('g_to_kg', used) - coal_factor)
    notes = ['plant_primary_fuel_allocation', 'upstream_heat_input_hhv_basis', 'nuclear_biomass_byproduct_fuels_upstream_excluded']
    if 'GAS' in mapped:
        notes.append('upstream_gwp_as_published_ar6')
    if 'OIL' in mapped:
        notes += ['oil_fired_upstream_proxied_by_ulsd', 'upstream_gwp_inferred_ar4', 'cagreet3_vintage_superseded_by_cagreet4']
    if 'COAL' in mapped:
        notes += [COAL_NOTE, COAL_GWP_NOTE, COAL_SCREENING_NOTE]
    if solar_hi:
        notes.append(SOLAR_NOTE)
    if unmapped:
        notes.append('fossil_fuel_upstream_not_mapped')
    if other:
        notes.append('other_fuel_upstream_not_mapped')
    if not fossil_hi:
        notes.append('no_fossil_generation_in_subregion')
    activity = {'upstreamIntensity': {'value': exact(u), 'unit': 'kg CO2e per MWh generated'}, 'mappedFuels': mapped, 'unmappedFuels': unmapped,
                'otherFuelsNotMapped': other, 'nonFossilFuelsExcluded': list(POWER_NON_FOSSIL_FUELS),
                'mappedFossilHeatInputShare': None if share is None else exact(share), 'unmappedFossilHeatInputShare': None if unmapped_share is None else exact(unmapped_share),
                'unmappedFossilHeatInputMmbtu': None, 'otherFuelHeatInputMmbtu': None,
                'coalHeatInputShare': None if coal_share is None else exact(coal_share), 'coalHeatInputMmbtu': None,
                # Round 3 (AC-7, AC-6): the GWP basis of each mapped term; the solar-thermal co-firing memo (set per line).
                'gwpBasisByFuel': {f: POWER_FUEL_GWP_BASIS[f] for f in mapped}, 'solarThermalHeatInputMmbtu': None}
    return (None if fossil_hi and not mapped_hi else u), activity, tuple(notes), unmapped_ratio, other_ratio, coal_ratio, solar_ratio, screening


_UPSTREAM_REASONS = {('GAS',): _NETL_REASON, ('OIL',): 'CA-GREET3.0 publishes carbon intensities as CO2e only (oil-fired generation, ULSD proxy; GWP set not stated by CARB; inferred AR4 100-year)',
                     ('GAS', 'OIL'): 'NETL (natural gas, IPCC AR6 100-year GWPs) and CA-GREET3.0 (oil-fired generation, ULSD proxy; GWP set not stated by CARB, inferred AR4 '
                                     '100-year) publish upstream CO2e only; used as published', (): _NETL_REASON}
# Round 2, lane F (DESIGN 13.6): a region with coal adds the EPA GHGI coal mine methane term (AR5) to the reason of its other fuels.
_COAL_REASON = 'EPA GHGI publishes coal mine methane as CO2e only (IPCC AR5 100-year GWPs; mine methane only, per MMBtu of EIA 2022 coal production)'


def _upstream_reason(mapped: list) -> str:
    rest = tuple(f for f in mapped if f != 'COAL')
    if 'COAL' not in mapped:
        return _UPSTREAM_REASONS[rest]
    return _COAL_REASON if not rest else _COAL_REASON + '; ' + _UPSTREAM_REASONS[rest]


def _upstream_line(kind: str, inp: dict, mwh_key: str, mwh: Decimal, region: str, used: dict, conversions: list, extra: dict, estimates=()) -> dict:
    with _exact():
        u, activity, notes, memo = _upstream_intensity(region, mwh, used, conversions)
        if u is None:
            # Owner decision 3 (round 2): fossil heat input with no mapped fuel is a factor gap, held whatever the input; never zero.
            return _result(KIND_METHOD[kind], 3, inp, used, status='input_needed', findings=['no_upstream_factor_for_subregion_fuels'], conversions=conversions,
                           activity={mwh_key: exact(mwh), **extra, **activity}, estimates=estimates, boundary='partial', boundary_notes=notes)
        kg = mwh * u
    return _result(KIND_METHOD[kind], 3, inp, used, status='complete', co2e_only=_upstream_co2e(kg, _upstream_reason(activity['mappedFuels'])),
                   conversions=conversions, activity={mwh_key: exact(mwh), **extra, **activity}, estimates=estimates,
                   boundary='partial' if any(n in notes for n in ('fossil_fuel_upstream_not_mapped', 'other_fuel_upstream_not_mapped', COAL_NOTE, SOLAR_NOTE,
                                                                  'nuclear_biomass_byproduct_fuels_upstream_excluded')) else 'met',
                   boundary_notes=notes, memo_items=memo)


def _grid_upstream(kind: str, inp: dict, losses: bool) -> dict:
    """3B (losses False) and 3C upstream (losses True): the input, location findings and MWh of category 3C, x U(subregion)."""
    require_keys(inp, {'period', 'quantity', 'unit', 'subregion', 'zip'}, {'utilityEiaId'})
    require_period(inp['period'])
    sub = inp['subregion']
    held = _grid_location(inp['zip'], sub, inp.get('utilityEiaId'))
    if held is not None:
        return _result(KIND_METHOD[kind], 3, inp, {}, status=held[0], findings=[held[1]])
    used: dict = {}
    conversions: list = []
    with _exact():
        mwh = _mwh(quantity(inp['quantity'], 'invalid_quantity'), inp['unit'], used)
        if not losses:
            return _upstream_line(kind, inp, 'consumedMwh', mwh, sub, used, conversions, {'subregion': sub})
        ic = SUBREGION_INTERCONNECT[sub]
        ggl = factor(f'egrid2023_ggl.{ic}', used)
        loss = divide(mwh * ggl, 1 - ggl, 'loss MWh = consumed MWh x GGL / (1 - GGL)', conversions)
    return _upstream_line(kind, inp, 'lossMwh', loss, sub, used, conversions, {'consumedMwh': exact(mwh), 'subregion': sub, 'interconnect': ic, 'gridGrossLoss': exact(ggl)},
                          estimates=['us_average_grid_loss'] if ic == 'u_s' else [])


def electricity_upstream(inp: dict) -> dict:
    return _grid_upstream('electricity_upstream', inp, False)


def td_losses_upstream(inp: dict) -> dict:
    return _grid_upstream('td_losses_upstream', inp, True)


def energy_resold_upstream(inp: dict) -> dict:
    """3D upstream: the input and location rules of category 3D (energy_resold), resold MWh x U(subregion), or x U(US) for the
    U.S. average."""
    require_keys(inp, {'period', 'quantity', 'unit', 'gridBasis', 'zip', 'subregion', 'utilityEiaId'})
    require_period(inp['period'])
    basis = _choice(inp['gridBasis'], GRID_BASES, 'invalid_grid_basis')
    sub = None
    if basis == 'subregion':
        held = _grid_location(inp['zip'], inp['subregion'], inp['utilityEiaId'])
        if held is not None:
            return _result(KIND_METHOD['energy_resold_upstream'], 3, inp, {}, status=held[0], findings=[held[1]])
        sub = inp['subregion']
    else:
        _no_location(inp)
    used: dict = {}
    with _exact():
        mwh = _mwh(quantity(inp['quantity'], 'invalid_quantity'), inp['unit'], used)
    return _upstream_line('energy_resold_upstream', inp, 'resoldMwh', mwh, sub or 'US', used, [], {'gridBasis': basis, 'subregion': sub},
                          estimates=['us_average_upstream_intensity'] if sub is None else [])


# --- I-12h --- Hotel stays (category 6) and buildings by floor area (categories 8, 13 and 14) from U.S. free sources (DESIGN
# 13.1, 13.2, A14, A27). Register R6 (`building_hotel`), built by tools/method-reference/build_scope3_us_building_hotel_register.py
# from the committed double-read transcriptions: EIA CBECS 2018 Tables C14 (kWh per sq ft) and C24 (cubic feet of natural gas per
# sq ft, conditional on using gas) and EPA's events and conferences guidance (December 2018) Table 5 (kWh and MMBtu per available
# room-night by hotel class, from the EPA CHP Partnership hotel report of 2005). Electricity uses eGRID2023 rev2 rates (R1 subregion
# or R3 U.S.), natural gas Hub 2025 Table 1 (R3), GWPs AR5 (R1). One block, appended, so lane A's category 3 block merges beside it.
# R6 (`building_hotel`, declared with the other registers at the top) replaces the planned CBECS xlsx register; the `cbecs`
# register name of DESIGN 4.1 is retired (round 2, ENG-7: no dead prefix).
HOTEL_COUNTRIES = ('US',)  # Table 5 is U.S. hotel data; any other country is held by the collection step (method_pending)
HOTEL_COUNTRY_BASES = ('stated', 'reporting_location')
HOTEL_CLASS_USED = 'upper_upscale'  # class is not collected, so the highest-intensity class of Table 5 is used (DESIGN 13.2)
# DESIGN 13.2 CBECS token map: the collection token -> the CBECS 2018 row of R6 (a token whose row is not registered is held).
CBECS_ACTIVITY_ROWS = {'all_buildings': 'all_buildings', 'office': 'office', 'retail_non_mall': 'retail_other_than_mall', 'enclosed_strip_mall': 'enclosed_and_strip_malls',
                       'mercantile': 'mercantile', 'warehouse_storage': 'warehouse_and_storage', 'food_service': 'food_service', 'food_sales': 'food_sales',
                       'lodging': 'lodging', 'education': 'education', 'healthcare_outpatient': 'health_care_outpatient', 'service': 'service'}
BUILDING_CATEGORIES = (8, 13, 14)
BUILDING_GAS_USE = ('yes', 'no', 'unknown')


def _building_hotel_keys(prefix: str) -> list:
    return sorted(k for k in _register('building_hotel')['entries'] if k.startswith(prefix))


def _cbecs_loaded() -> list:
    """Collection tokens whose CBECS row has both an electricity (C14) and a natural gas (C24) intensity in R6."""
    keys = _register('building_hotel')['entries']
    return sorted(t for t, row in CBECS_ACTIVITY_ROWS.items()
                  if f'cbecs2018.electricity_kwh_per_sqft.{row}' in keys and f'cbecs2018.natural_gas_cf_per_sqft.{row}' in keys)


def _days_in_year(period: dict) -> int:
    """365 or 366: the calendar year of the reporting period (the year in which it ends, DESIGN A24)."""
    year = (calendar_date(period['endExclusive']) - datetime.timedelta(days=1)).year
    return 366 if datetime.date(year, 12, 31).timetuple().tm_yday == 366 else 365


_HOTEL_DQ = _data_quality(('poor', 'poor', 'good', 'fair', 'fair'), (
    'Average hotel energy per room-night of the highest-intensity class (class is not collected), not the hotel\'s own energy use',
    '2005-vintage hotel energy data (CHP Partnership report) applied to the reporting year with 2023 grid rates',
    'U.S. average hotel data and the U.S. average grid rate for stays in the U.S.',
    'Room-nights from the company\'s travel records; per available (not occupied) room-night',
    'EPA guidance values transcribed by hand (two agreeing reads) with EPA-published grid and fuel factors'))
_BUILDING_DQ = _data_quality(('poor', 'fair', 'good', 'fair', 'fair'), (
    'U.S. national average energy intensity of the building activity, not the building\'s own energy use',
    'CBECS 2018 intensities applied to the reporting year',
    'U.S. national averages; the grid rate of the building\'s eGRID subregion or the U.S. average',
    'Floor area and covered days from the company\'s records; electricity and natural gas only',
    'EIA survey values transcribed by hand (two agreeing reads) with EPA-published grid and fuel factors'))
_BUILDING_HOTEL_METHODS = {
    'scope3.cat6.hotel_stay.epa2018_events.v1': {
        'profileId': 'scope3.cat6.hotel_stay.epa2018_events', 'family': 'business_travel', 'kind': 'hotel_stay', 'gwpSetId': 'AR5-100',
        'title': 'Category 6 (optional): hotel stays, energy per room-night (EPA events and conferences guidance 2018, Table 5; eGRID2023 rev2 U.S.; Hub 2025 Table 1)',
        'formula': 'MWh = room-nights x kWh per room-night (upper upscale) x 0.001; kg gas = MWh x eGRID U.S. output emission rate (lb/MWh, US23) x 0.45359237; '
                   'MMBtu = room-nights x MMBtu per room-night (upper upscale); kg CO2 = MMBtu x 53.06; kg CH4 and N2O = MMBtu x g per MMBtu x 0.001 (Hub Table 1 natural gas); '
                   'per gas the two parts are added; kg CO2e = CO2 + CH4 x 28 + N2O x 265',
        'factorKeys': lambda: _building_hotel_keys(f'epa_events2018.hotel.{HOTEL_CLASS_USED}.') + _supplement_keys('egrid2023_us.') + _NATURAL_GAS_KEYS() + GWP_KEYS,
        'constantIds': ['g_to_kg', 'kwh_to_mwh', 'lb_to_kg'],
        'admissionRules': ['Hotel stays are optional (Scope 3 Standard, category 6: "Companies may optionally include emissions from business travelers staying in hotels"); when included they are counted in category 6 per room-night',
                           'EPA events guidance Table 5: electricity (kWh) and natural gas (MMBtu) per available room-night by hotel class, from the CHP Partnership report '
                           '(2005 data): annual intensity per square foot x square feet per room / 365, with no occupancy adjustment',
                           'The hotel class is not collected, so the highest-intensity class (upper upscale: 45 kWh and 0.122 MMBtu per room-night) is used',
                           'Hotels in the U.S. only (the hotel\'s country, or the reporting location\'s country when none is given); other countries have no verified factor here',
                           'Electricity at the eGRID2023 rev2 U.S. average output emission rate; natural gas with Hub 2025 Table 1 factors; AR5 GWPs'],
        'estimateRules': ['hotel_country_from_reporting_location: the stay has no hotel country, so the country of the reporting location (U.S.) is used'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'company_records', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['building_hotel', 'supplement'],
        'resultExtras': ('additionalRegisters',), 'defaultDataQuality': _HOTEL_DQ,
    },
    'scope3.cat8_13_14.building_average.cbecs2018.v1': {
        'profileId': 'scope3.cat8_13_14.building_average.cbecs2018', 'family': 'leased_assets_franchises_processing', 'kind': 'building_average', 'gwpSetId': 'AR5-100',
        'title': 'Categories 8, 13 and 14: buildings by floor area and CBECS 2018 average energy intensity (eGRID2023 rev2; Hub 2025 Table 1)',
        'formula': 'sq ft = area (sq ft, or m2 x 10.76391041670972230833); d = covered days / days in the reporting year (365 or 366), rounded half-even to 12 dp; '
                   'MWh = sq ft x d x CBECS C14 kWh per sq ft x 0.001; kg gas = MWh x eGRID output emission rate (lb/MWh; subregion SRL23 or U.S. US23) x 0.45359237; '
                   'when the building uses natural gas: MMBtu = sq ft x d x CBECS C24 cubic feet per sq ft x 0.001026 (Hub Table 1 default heat content per scf); '
                   'kg gas = MMBtu x Hub Table 1 natural gas factors; per gas the parts are added; kg CO2e = CO2 + CH4 x 28 + N2O x 265 (calculation guidance formula 8.4)',
        'factorKeys': lambda: _building_hotel_keys('cbecs2018.') + _keys('egrid2023.') + _supplement_keys('egrid2023_us.') + _NATURAL_GAS_KEYS() + GWP_KEYS,
        'constantIds': ['g_to_kg', 'kwh_to_mwh', 'lb_to_kg', 'supplement_const.sqft_per_m2'],
        'admissionRules': ['Average-data method for a leased or franchised building whose energy use is not known (calculation guidance [8.1] and [14], average-data '
                           'method): floor area x the U.S. average energy intensity of its principal activity (EIA CBECS 2018)',
                           'Leases follow the company\'s consolidation approach (Scope 3 Standard Tables A.1 and A.2), as for asset energy',
                           'CBECS intensities are conditional: the natural gas intensity (C24) averages only buildings that use natural gas, so it is applied only when the '
                           'record says the building uses natural gas; "not known" is held',
                           'CBECS cubic feet are treated as standard cubic feet at the Hub Table 1 default heat content (0.001026 MMBtu per scf); EIA does not print a conversion',
                           'Only electricity and natural gas are estimated; fuel oil, district heat, propane and refrigerant use of the building are not included, so the '
                           'result is partial (a documented within-category exclusion when the company states why it is not significant)'] + _GRID_RULES,
        'estimateRules': ['building_us_average_grid_rate: the building\'s location is given as U.S. average, so the U.S. average output emission rate is used',
                          'cbecs_activity_average_intensity: the building\'s energy is estimated from the U.S. average intensity of its activity'],
        'methodType': 'activity_average_data', 'activityDataOrigin': 'estimate', 'biogenicTreatment': 'none_expected', 'additionalRegisters': ['building_hotel', 'supplement'],
        'resultExtras': ('additionalRegisters',), 'defaultDataQuality': _BUILDING_DQ,
    },
}


def _building_hotel_catalog() -> dict:
    """I-12h token lists, compared with the collection adapter's constants: hotel countries and the class used, the CBECS
    tokens of the contract and those whose row is registered, and the building categories and natural gas answers."""
    return {'hotelCountries': list(HOTEL_COUNTRIES), 'hotelCountryBases': list(HOTEL_COUNTRY_BASES), 'hotelClassUsed': HOTEL_CLASS_USED,
            'cbecsActivities': sorted(CBECS_ACTIVITY_ROWS), 'cbecsActivitiesLoaded': _cbecs_loaded(), 'buildingCategories': list(BUILDING_CATEGORIES),
            'buildingGasUse': list(BUILDING_GAS_USE)}


def hotel_stay(inp: dict) -> dict:
    """Category 6, optional (DESIGN 13.2, A14, A27): room-nights x the energy per available room-night of the highest-intensity
    hotel class (EPA events guidance Table 5), electricity at the eGRID U.S. rate and natural gas with Hub Table 1 factors."""
    require_keys(inp, {'period', 'roomNights', 'country', 'countryBasis'})
    require_period(inp['period'])
    country = _choice(inp['country'], HOTEL_COUNTRIES, 'hotel_country_not_in_factor_set')
    basis = _choice(inp['countryBasis'], HOTEL_COUNTRY_BASES, 'invalid_country_basis')
    nights = quantity(inp['roomNights'], 'invalid_quantity')
    used: dict = {}
    with _exact():
        kwh = factor(f'epa_events2018.hotel.{HOTEL_CLASS_USED}.electricity_kwh_per_room_night', used)
        per_night = factor(f'epa_events2018.hotel.{HOTEL_CLASS_USED}.natural_gas_mmbtu_per_room_night', used)
        mwh = nights * kwh * constant('kwh_to_mwh', used)
        mmbtu = nights * per_night
        electricity = _grid_gases(mwh, None, used)
        gas = _fuel_gases(mmbtu, 'natural_gas', used)
        gases = {}
        for g, name in GASES:
            mass = Decimal(electricity[g]['mass']) + Decimal(gas[g]['mass'])
            gases[g] = {'mass': exact(mass), 'massUnit': 'kg ' + name, 'co2e': exact(mass * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
    notes = ['optional_hotel_stays_included', 'hotel_class_not_collected_highest_intensity_used', 'available_room_night_basis_no_occupancy_adjustment',
             'hotel_energy_data_2005_vintage', 'hotel_us_average_grid_rate']
    return _result(KIND_METHOD['hotel_stay'], 6, inp, used, status='complete', gases=gases, boundary_notes=notes,
                   estimates=['hotel_country_from_reporting_location'] if basis == 'reporting_location' else [],
                   activity={'roomNights': exact(nights), 'hotelClass': HOTEL_CLASS_USED, 'country': country, 'electricityMwh': exact(mwh), 'naturalGasMmbtu': exact(mmbtu)})


def building_average(inp: dict) -> dict:
    """Categories 8, 13 and 14 by floor area (DESIGN 13.2): area x covered share of the year x the CBECS 2018 electricity
    intensity of the activity at the grid rate, plus, for a building that uses natural gas, its conditional gas intensity."""
    require_keys(inp, {'period', 'category', 'cbecsActivity', 'usesNaturalGas', 'area', 'areaUnit', 'coveredDays', 'gridBasis', 'zip', 'subregion', 'utilityEiaId'})
    require_period(inp['period'])
    category = inp['category']
    if type(category) is not int or category not in BUILDING_CATEGORIES:
        raise Refused('invalid_category')
    token = _choice(inp['cbecsActivity'], CBECS_ACTIVITY_ROWS, 'unknown_cbecs_activity')
    gas_use = _choice(inp['usesNaturalGas'], BUILDING_GAS_USE, 'invalid_natural_gas_use')
    unit = _choice(inp['areaUnit'], AREA_UNITS, 'unsupported_unit')
    basis = _choice(inp['gridBasis'], GRID_BASES, 'invalid_grid_basis')
    area = quantity(inp['area'], 'invalid_quantity')
    covered = integer(inp['coveredDays'], 1, 366, 'invalid_covered_days')
    days = _days_in_year(inp['period'])
    if covered > days:
        raise Refused('invalid_covered_days')
    mid = KIND_METHOD['building_average']
    sub = None
    if basis == 'subregion':
        held = _grid_location(inp['zip'], inp['subregion'], inp['utilityEiaId'])
        if held is not None:
            return _result(mid, category, inp, {}, status=held[0], findings=[held[1]])
        sub = inp['subregion']
    else:
        _no_location(inp)
    row = CBECS_ACTIVITY_ROWS[token]
    if token not in _cbecs_loaded():
        # A contract token whose CBECS row is not registered: never a figure (the collection step holds it method_pending).
        return _result(mid, category, inp, {}, status='input_needed', findings=['cbecs_activity_not_loaded'], activity={'cbecsActivity': token}, consulted=['building_hotel'])
    if gas_use == 'unknown':
        # C24 is conditional on using natural gas: applying it to every building would overstate; leaving it out would understate.
        return _result(mid, category, inp, {}, status='input_needed', findings=['natural_gas_use_unknown'], activity={'cbecsActivity': token}, consulted=['building_hotel'])
    used: dict = {}
    conversions: list = []
    estimates = ['cbecs_activity_average_intensity'] + (['building_us_average_grid_rate'] if sub is None else [])
    # Round 2, owner decision 4: fuel oil, propane, district heat and refrigerants are not counted, so the line is partial; the company
    # may document `building_other_energy_sources_not_included` as a within-category exclusion (A26).
    notes = ['cbecs_2018_us_national_average', 'location_based_grid_rates', 'building_other_energy_sources_not_included']
    with _exact():
        sqft = area if unit == 'sqft' else area * constant('supplement_const.sqft_per_m2', used)
        share = divide(Decimal(covered), Decimal(days), f'share of the year = covered days / {days} days in the reporting year', conversions)
        mwh = sqft * share * factor(f'cbecs2018.electricity_kwh_per_sqft.{row}', used) * constant('kwh_to_mwh', used)
        parts = [_grid_gases(mwh, sub, used)]
        activity = {'cbecsActivity': token, 'cbecsRow': row, 'areaSqft': exact(sqft), 'coveredDays': covered, 'daysInYear': days, 'yearShare': exact(share),
                    'electricityMwh': exact(mwh), 'gridBasis': basis, 'subregion': sub, 'usesNaturalGas': gas_use, 'naturalGasMmbtu': None}
        if gas_use == 'yes':
            scf = sqft * share * factor(f'cbecs2018.natural_gas_cf_per_sqft.{row}', used)
            mmbtu = scf * factor('hub2025_t1.natural_gas.heat_content', used)
            parts.append(_fuel_gases(mmbtu, 'natural_gas', used))
            activity['naturalGasMmbtu'] = exact(mmbtu)
            notes += ['conditional_gas_intensity', 'cbecs_cubic_feet_treated_as_standard_scf']
        else:
            notes.append('building_uses_no_natural_gas')
        gases = {}
        for g, name in GASES:
            mass = sum((Decimal(p[g]['mass']) for p in parts), Decimal(0))
            gases[g] = {'mass': exact(mass), 'massUnit': 'kg ' + name, 'co2e': exact(mass * factor('gwp_ar5.' + name, used)), 'co2eUnit': 'kg CO2e'}
    return _result(mid, category, inp, used, status='complete', gases=gases, conversions=conversions, activity=activity, estimates=estimates, boundary='partial',
                   boundary_notes=notes)


# --- end I-12h ---


# ---------------------------------------------------------------------------
# Method registry (round 2, ENG-7): the one place that declares every kind, the calculator that serves it and the methods it
# can produce (the first is the kind's method when it has one only; purchase_supplier and investment choose by their input).
# METHODS, KIND_METHOD and CALCULATORS are derived from it once, nothing patches them later, and `_check_registry` asserts at
# import that the declaration, the method tables and the register map agree, so reordering blocks cannot change behaviour.
# ---------------------------------------------------------------------------
METHOD_REGISTRY = (
    ('td_losses', td_losses, ('scope3.cat3.td_losses.egrid2023.v1',)),
    ('transport', transport, ('scope3.cat4_9.transport_distance.v1',)),
    ('waste', waste, ('scope3.cat5_12.waste.v1',)),
    ('business_travel', business_travel, ('scope3.cat6.business_travel_distance.v1',)),
    ('employee_commuting', employee_commuting, ('scope3.cat7.employee_commuting_distance.v1',)),
    ('purchase_spend', purchase_spend, ('scope3.spend.epa_scghg_v1_3.v1',)),
    ('purchase_supplier', purchase_supplier, ('scope3.cat1_2.supplier_specific.v1', 'scope3.cat1_2.average_data_user_factor.v1')),
    ('energy_resold', energy_resold, ('scope3.cat3d.energy_resold.egrid2023.v1',)),
    ('commuting_average', commuting_average, ('scope3.cat7.commuting_average.v1',)),
    ('teleworking', teleworking, ('scope3.cat7.teleworking.v1',)),
    ('asset_energy', asset_energy, ('scope3.asset_energy.v1',)),
    ('partner_reported', partner_reported, ('scope3.partner_reported.v1',)),
    ('sold_fuel', sold_fuel, ('scope3.cat11.sold_fuel.hub2025.v1',)),
    ('sold_energy_product', sold_energy_product, ('scope3.cat11.sold_energy_product.v1',)),
    ('sold_ghg_product', sold_ghg_product, ('scope3.cat11.sold_ghg_product.hub2025.v1',)),
    ('end_of_life_split', end_of_life_split, ('scope3.cat12.end_of_life_split.v1',)),
    ('investment', investment, ('scope3.cat15.investment_reported.v1', 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1')),
    ('fuel_upstream', fuel_upstream, ('scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1',)),
    ('electricity_upstream', electricity_upstream, ('scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1',)),
    ('td_losses_upstream', td_losses_upstream, ('scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1',)),
    ('energy_resold_upstream', energy_resold_upstream, ('scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1',)),
    ('hotel_stay', hotel_stay, ('scope3.cat6.hotel_stay.epa2018_events.v1',)),
    ('building_average', building_average, ('scope3.cat8_13_14.building_average.cbecs2018.v1',)),
)
_METHOD_TABLES = (_CORE_METHODS, _PURCHASE_METHODS, _ENERGY_PARTNER_METHODS, _DOWNSTREAM_METHODS, _UPSTREAM_METHODS, _BUILDING_HOTEL_METHODS)
METHODS = {mid: spec for table in _METHOD_TABLES for mid, spec in table.items()}
CALCULATORS = {kind: fn for kind, fn, _ in METHOD_REGISTRY}
KIND_METHOD = {kind: ids[0] for kind, _, ids in METHOD_REGISTRY if len(ids) == 1}
_METHOD_KEYS = {'profileId', 'family', 'kind', 'gwpSetId', 'title', 'formula', 'factorKeys', 'constantIds', 'admissionRules', 'estimateRules', 'methodType',
                'activityDataOrigin', 'defaultDataQuality', 'biogenicTreatment', 'additionalRegisters', 'resultExtras'}
_METHOD_OPTIONAL_KEYS = {'defaultDataQualityUnverified', 'defaultDataQualityByNote'}


def _check_registry() -> None:
    """Start-up consistency of the declarations (ENG-7): every method declared exactly once with its kind; every metadata key
    present and every token one the engine knows; each register prefix names a pinned register and none shadows a later one;
    the methods other tables name exist with the right kind."""
    declared = [mid for _, _, ids in METHOD_REGISTRY for mid in ids]
    if sum(len(t) for t in _METHOD_TABLES) != len(METHODS) or sorted(declared) != sorted(METHODS) or len(set(declared)) != len(declared):
        raise RuntimeError('method registry and method tables disagree')
    if len(CALCULATORS) != len(METHOD_REGISTRY):
        raise RuntimeError('a kind is declared twice')
    for kind, fn, ids in METHOD_REGISTRY:
        for mid in ids:
            m = METHODS[mid]
            if m['kind'] != kind or not callable(fn) or not _METHOD_KEYS <= set(m) or not set(m) <= _METHOD_KEYS | _METHOD_OPTIONAL_KEYS:
                raise RuntimeError('method declaration incomplete: ' + mid)
            if (m['methodType'] not in METHOD_TYPES or m['activityDataOrigin'] not in ORIGINS or m['biogenicTreatment'] not in BIOGENIC_TREATMENTS
                    or not set(m['resultExtras']) <= set(RESULT_EXTRAS) or not set(m['additionalRegisters']) <= set(REGISTERS) - {'main'}):
                raise RuntimeError('method metadata token unknown: ' + mid)
    for i, (prefix, name) in enumerate(REGISTER_PREFIXES):
        if name not in REGISTERS or any(prefix.startswith(earlier) for earlier, _ in REGISTER_PREFIXES[:i]):
            raise RuntimeError('register prefix not routable: ' + prefix)
    named = {**{mid: 'purchase_supplier' for mid in SUPPLIER_ORIGIN_METHODS.values()}, **{mid: 'investment' for mid in INVESTMENT_PATHS.values()},
             **{a: METHODS.get(a, {}).get('kind') for a in CLOSURE_PAIRS}, **{up: METHODS.get(up, {}).get('kind') for up, _ in CLOSURE_PAIRS.values()}}
    if any(mid not in METHODS or METHODS[mid]['kind'] != kind for mid, kind in named.items()):
        raise RuntimeError('a method named by another table is not declared')


_check_registry()


def calculate(request: dict) -> dict:
    require_keys(request, {'kind', 'input'})
    fn = CALCULATORS.get(request['kind']) if isinstance(request['kind'], str) else None
    if fn is None:
        raise Refused('unsupported_kind')
    if not isinstance(request['input'], dict):
        raise Refused('invalid_input_shape')
    with _exact():
        return fn(request['input'])


def recompute(r) -> None:
    """A result is accepted only if this engine, run again on its echoed input, produces it exactly."""
    try:
        fresh = calculate({'kind': METHODS[r['methodVersionId']]['kind'], 'input': r['input']})
    except (Refused, KeyError, TypeError):
        raise Refused('result_integrity') from None
    if canonical(fresh) != canonical(r):
        raise Refused('result_integrity')


def calculate_many(requests) -> list:
    """Many records from one engine process (DESIGN 4.1, D10). Each item is exactly what `calculate` returns for it, in
    order; a refused item carries its code and never stops the others; an item the engine cannot process at all is an
    error item (the single call would fail with "scope3_engine_unavailable"), never a figure."""
    if not isinstance(requests, list) or not 1 <= len(requests) <= MAX_BATCH:
        raise Refused('invalid_request')
    out = []
    for request in requests:
        try:
            out.append({'status': 'ok', 'result': calculate(request)})
        except Refused as x:
            out.append({'status': 'refused', 'code': x.code})
        except Exception:  # noqa: BLE001 - the same input fails the single-call CLI with exit 2
            out.append({'status': 'error', 'code': 'scope3_engine_unavailable'})
    return out


def _annotation(a) -> dict:
    """One aggregate annotation (DESIGN A3): the record's data-quality overrides (each indicator a rating, or null for the
    method default) and its activity-data origin (null for the method default). Never part of a calculation input."""
    if not isinstance(a, dict) or set(a) != {'dataQuality', 'activityDataOrigin'}:
        raise Refused('invalid_annotation')
    dq, origin = a['dataQuality'], a['activityDataOrigin']
    if dq is not None and (not isinstance(dq, dict) or set(dq) != set(DQ_INDICATORS)
                           or any(x is not None and (not isinstance(x, str) or x not in DQ_SCORES) for x in dq.values())):
        raise Refused('invalid_annotation')
    if origin is not None and (not isinstance(origin, str) or origin not in ORIGINS):
        raise Refused('invalid_annotation')
    return a


def _round_fraction(q: Fraction, places: int) -> Decimal:
    """Half-even rounding of an exact quotient, once, to `places` decimal places."""
    with _exact():
        return Decimal(round(q * 10 ** places)).scaleb(-places)


def _fixed(q: Fraction, places: int) -> str:
    return format(_round_fraction(q, places), f'.{places}f')


def _ratio(q: Fraction, display_places: int) -> dict:
    """An aggregate ratio: `value` rounded once to 12 dp, `display` rounded once from the exact quotient."""
    return {'value': exact(_round_fraction(q, DIVISION_PLACES)), 'display': _fixed(q, display_places)}


def dq_label(score: Fraction) -> str:
    """Product convention for the overall data-quality label (disclosed): <= 1.5 very good, <= 2.5 good, <= 3.5 fair, else poor."""
    return 'very_good' if score <= Fraction(3, 2) else 'good' if score <= Fraction(5, 2) else 'fair' if score <= Fraction(7, 2) else 'poor'


def effective_origin(r: dict, note: dict | None) -> str:
    """A19: supplier and partner data are value-chain data, spend lines company records and proxies estimates, whatever an
    annotation says (an override on a fixed type is ignored, never refused); only activity/average data take the
    annotation's origin, else the method default."""
    m = METHODS[r['methodVersionId']]
    fixed = FIXED_ORIGINS.get(m['methodType'])
    if fixed is not None:
        return fixed
    return (note['activityDataOrigin'] if note else None) or m['activityDataOrigin']


def default_data_quality(r: dict) -> dict:
    """A20: the method's unverified default when the result says its supplier or partner data are unverified."""
    m = METHODS[r['methodVersionId']]
    if 'defaultDataQualityUnverified' in m and any(n in r['boundary']['notes'] for n in UNVERIFIED_NOTES):
        return m['defaultDataQualityUnverified']
    # I-12u (DESIGN 13.2): the first note (in code order) with its own default, e.g. a CA-GREET3.0 liquid-fuel line on 3A.
    for note, dq in sorted(m.get('defaultDataQualityByNote', {}).items()):
        if note in r['boundary']['notes']:
            return dq
    return m['defaultDataQuality']


def effective_rating(r: dict, note: dict | None, indicator: str) -> str:
    override = note['dataQuality'][indicator] if note and note['dataQuality'] else None
    return override or default_data_quality(r)['indicators'][indicator]


def _kg(v: Decimal, unit: str = 'kg CO2e') -> dict:
    # S3A-01: rounding for display also runs in precision 96, not in the caller's context.
    with _exact():
        return {'unrounded': exact(v), 'display': display(v), 'unit': unit, 'rounding': 'half_even_4dp_once'}


def _category_profile(pairs: list, known: Decimal) -> dict:
    """D3, D4, D6 for one category, from its complete results and their annotations (DESIGN 4.6). Sums are exact; each
    ratio is one exact quotient rounded once; a result whose total is 0 is counted but carries no weight. `known` is the
    known-source subtotal of every category (I-05: the category's share of it)."""
    with _exact():
        totals = [(r, note, Decimal(r['total']['unrounded'])) for r, note in pairs]
        sub = sum((t for _, _, t in totals), Decimal(0))
        by_type: dict = {}
        for r, _, t in totals:
            mt = METHODS[r['methodVersionId']]['methodType']
            by_type[mt] = by_type.get(mt, Decimal(0)) + t
        dominant = max(by_type, key=lambda mt: (by_type[mt], -METHOD_TYPES.index(mt)))
        partner = sum((t for r, note, t in totals if effective_origin(r, note) == 'value_chain_partner'), Decimal(0))
        indicators, scores = {}, []
        for ind in DQ_INDICATORS:
            rating_kg: dict = {}
            weighted = Fraction(0)
            for r, note, t in totals:
                rating = effective_rating(r, note, ind)
                rating_kg[rating] = rating_kg.get(rating, Decimal(0)) + t
                weighted += Fraction(t) * DQ_SCORES[rating]
            score = weighted / Fraction(sub) if sub else None
            scores.append(score)
            indicators[ind] = {'ratingKg': {k: _kg(v) for k, v in sorted(rating_kg.items())}, 'score': _ratio(score, 2) if score is not None else None}
        mean = sum(scores) / len(scores) if all(s is not None for s in scores) else None
        overrides = sum(1 for _, note, _ in totals if note and note['dataQuality'] and any(v is not None for v in note['dataQuality'].values()))
        biogenic = [Decimal(r['biogenicCo2']['mass']) for r, _, _ in totals if r.get('biogenicCo2')]
        memo: dict = {}
        for r, _, _ in totals:
            for item in r.get('memoItems') or []:
                memo[item['code']] = memo.get(item['code'], Decimal(0)) + Decimal(item['kg'])
        # I-05 (DESIGN 4.6, critique I-8 and I-9): how much deflating spend to 2022 dollars changed the category (nominal minus
        # deflated, over spend-based and proxy results with a price ratio; null when none has one), the category's share of
        # the known-source total and the largest single result's share of the category (percent ratios; null when the
        # denominator is 0).
        deflated = [Decimal(r['activity']['nominalCo2e']) - t for r, _, t in totals
                    if METHODS[r['methodVersionId']]['methodType'] in ('spend_based', 'proxy') and 'priceRatio' in r['activity']]
        largest = max(t for _, _, t in totals)
        return {
            'results': len(pairs),
            'subtotalTonnes': {'display': _fixed(Fraction(sub) / 1000, 3), 'unit': 't CO2e', 'rounding': 'half_even_3dp_once'},
            'deflationEffect': _kg(sum(deflated, Decimal(0))) if deflated else None,
            'shareOfKnownTotal': _ratio(Fraction(sub) * 100 / Fraction(known), 1) if known else None,
            'largestResultShare': _ratio(Fraction(largest) * 100 / Fraction(sub), 1) if sub else None,
            'methodTypes': {mt: _kg(v) for mt, v in sorted(by_type.items())}, 'dominantMethodType': dominant,
            'valueChain': {'numerator': _kg(partner), 'denominator': _kg(sub), 'percent': _ratio(Fraction(partner) * 100 / Fraction(sub), 1) if sub else None},
            'dataQuality': {'indicators': indicators, 'overrides': overrides,
                            'overall': {'score': _ratio(mean, 2), 'label': dq_label(mean)} if mean is not None else {'score': None, 'label': None}},
            'biogenicCo2': _kg(sum(biogenic, Decimal(0)), 'kg CO2') if biogenic else None,
            'memoItems': {code: _kg(v) for code, v in sorted(memo.items())},
        }


def boundary_closures(results: list) -> tuple[list, set]:
    """DESIGN 4.6 (I-12u): a complete 3C (td_losses) or 3D (energy_resold) result whose boundary is partial for its "upstream
    excluded" note is closed by a complete upstream result of the paired method with an identical input, each closer used once,
    in list order. Returns the sorted closures [{resultSha256, closedBy}] and the list positions of the closed results."""
    closers: dict = {}
    for r in results:
        if r['status'] == 'complete' and any(r['methodVersionId'] == up for up, _ in CLOSURE_PAIRS.values()):
            closers.setdefault((r['methodVersionId'], canonical(r['input'])), []).append(r['resultSha256'])
    out, closed = [], set()
    for i, r in enumerate(results):
        pair = CLOSURE_PAIRS.get(r['methodVersionId'])
        if pair is None or r['status'] != 'complete' or r['boundary']['minimumBoundary'] == 'met' or pair[1] not in r['boundary']['notes']:
            continue
        queue = closers.get((pair[0], canonical(r['input'])))
        if queue:
            out.append({'resultSha256': r['resultSha256'], 'closedBy': queue.pop(0)})
            closed.add(i)
    return sorted(out, key=lambda c: (c['resultSha256'], c['closedBy'])), closed


def aggregate(results: list, annotations=None) -> dict:
    """Recomputes every result; per-category, per-GWP-set and overall subtotals of complete results, each
    summed unrounded and rounded once. complete needs every result calculated, every minimum boundary met
    and a single GWP set; an empty list is never complete. `annotations` (optional, one per result) carry each
    record's data-quality overrides and activity-data origin into the per-category profiles."""
    if not isinstance(results, list) or len(results) > MAX_AGGREGATE:
        raise Refused('invalid_aggregate')
    if annotations is not None and (not isinstance(annotations, list) or len(annotations) != len(results)):
        raise Refused('invalid_annotation')
    notes = [_annotation(a) for a in annotations] if annotations is not None else [None] * len(results)
    by_category: dict = {}
    by_gwp: dict = {}
    pairs: dict = {}
    included, not_calculated, partial, partial_index = [], [], [], []
    with _exact():
        for position, (r, note) in enumerate(zip(results, notes)):
            body = {k: v for k, v in r.items() if k != 'resultSha256'} if isinstance(r, dict) else None
            if body is None or digest(body) != r.get('resultSha256') or r.get('engineSha256') != engine_sha256():
                raise Refused('result_integrity')
            recompute(r)
            if r['status'] == 'complete':
                by_category[r['category']] = by_category.get(r['category'], Decimal(0)) + Decimal(r['total']['unrounded'])
                by_gwp[r['gwpSetId']] = by_gwp.get(r['gwpSetId'], Decimal(0)) + Decimal(r['total']['unrounded'])
                pairs.setdefault(r['category'], []).append((r, note))
                included.append(r['resultSha256'])
                if r['boundary']['minimumBoundary'] != 'met':
                    partial.append({'resultSha256': r['resultSha256'], 'category': r['category'], 'notes': r['boundary']['notes']})
                    partial_index.append(position)
            else:
                not_calculated.append({'resultSha256': r['resultSha256'], 'category': r['category'], 'status': r['status'], 'findings': r['findings']})
        overall = sum(by_category.values(), Decimal(0))
    # I-12u (DESIGN 4.6): each 3C or 3D combustion line closed by its upstream line leaves the partial-boundary list.
    closures, closed_ids = boundary_closures(results)
    partial = [p for p, position in zip(partial, partial_index) if position not in closed_ids]
    total = _kg
    out = {'profile': ENGINE_PROFILE + '.aggregate', 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256,
           'categorySubtotals': {str(c): total(v) for c, v in sorted(by_category.items())}, 'knownSourceSubtotal': total(overall),
           'includedResults': sorted(included), 'notCalculated': not_calculated, 'partialBoundaryResults': partial,
           'gwpSetSubtotals': {g: total(v) for g, v in sorted(by_gwp.items())}, 'gwpSetsUsed': sorted(by_gwp), 'mixedGwpSets': len(by_gwp) > 1,
           'resultCount': len(results), 'allCalculated': bool(results) and not not_calculated,
           # complete also needs every minimum boundary met and one GWP set (re-review P3-3)
           'complete': bool(results) and not not_calculated and not partial and len(by_gwp) == 1,
           # Aggregate v2 (DESIGN 4.6): the other pinned registers, and one profile per category with a complete result.
           'additionalRegisterSha256s': additional_register_sha256s(),
           'categoryProfiles': {str(c): _category_profile(p, overall) for c, p in sorted(pairs.items())},
           # I-12u: the 3C/3D combustion lines closed by their upstream lines (identical input), sorted.
           'boundaryClosures': closures}
    return dict(out, aggregateSha256=digest(out))


def handle(v) -> dict:
    require_register()
    if not isinstance(v, dict) or 'action' not in v:
        raise Refused('invalid_request')
    if v['action'] == 'describe':
        require_keys(v, {'action'})
        return {'status': 'ok', 'description': describe()}
    if v['action'] == 'catalog':
        require_keys(v, {'action'})
        return {'status': 'ok', 'catalog': catalog()}
    if v['action'] == 'calculate':
        require_keys(v, {'action', 'request'})
        return {'status': 'ok', 'result': calculate(v['request'])}
    if v['action'] == 'calculate_many':
        if set(v) != {'action', 'requests'}:
            raise Refused('invalid_request')
        return {'status': 'ok', 'results': calculate_many(v['requests'])}
    if v['action'] == 'aggregate':
        require_keys(v, {'action', 'results'}, {'annotations'})
        if 'annotations' in v and not isinstance(v['annotations'], list):
            raise Refused('invalid_annotation')
        return {'status': 'ok', 'aggregate': aggregate(v['results'], v.get('annotations'))}
    raise Refused('invalid_request')


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            raise Refused('request_too_large')
        print(canonical(handle(json.loads(raw))))
    except Refused as e:
        print(canonical({'status': 'refused', 'code': e.code}))
        sys.exit(1)
    except Exception:
        print('{"status":"error","code":"scope3_engine_unavailable"}')
        sys.exit(2)
