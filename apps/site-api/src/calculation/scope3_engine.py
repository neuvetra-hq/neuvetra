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
"""
from __future__ import annotations

import csv
import datetime
import hashlib
import io
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction
from pathlib import Path

REGISTER_SHA256 = '5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2'
REFERENCE_DIR = Path(__file__).resolve().parents[4] / 'packages' / 'neuvetra-database' / 'src' / 'method-reference'
REGISTER_PATH = REFERENCE_DIR / 'verified-scope3-register-2025.json'
ZIP_PATH = REFERENCE_DIR / 'egrid2023-zip-subregion-utility.csv'
ZIP_SHA256 = '7c661b453465ed6a0c456e30ea16604e52ab648c106ace1ec4b2e1e39092426e'  # same EPA Power Profiler table as Scope 2
ENGINE_PATH = 'apps/site-api/src/calculation/scope3_engine.py'
ENGINE_PROFILE = 'neuvetra.scope3-engine.v1'
PERIOD = ('2025-01-01', '2026-01-01')
QUANTITY = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?')
FACTOR_TEXT = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,20})?')
DIVISION_PLACES = 12
GASES = (('co2', 'CO2'), ('ch4', 'CH4'), ('n2o', 'N2O'))


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


def display(v: Decimal) -> str:
    return format(v.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN), '.4f')


def engine_sha256() -> str:
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def load_register() -> dict:
    raw = REGISTER_PATH.read_bytes()
    if hashlib.sha256(raw).hexdigest() != REGISTER_SHA256:
        raise RuntimeError('verified Scope 3 register bytes do not match the pinned digest')
    reg = json.loads(raw.decode('utf-8'))
    entries = {e['id']: e for e in reg['entries']}
    constants = {c['id']: c for c in reg['constants']}
    if len(entries) != len(reg['entries']) or len(constants) != len(reg['constants']):
        raise RuntimeError('duplicate register key')
    zraw = ZIP_PATH.read_bytes()
    if hashlib.sha256(zraw).hexdigest() != ZIP_SHA256:
        raise RuntimeError('ZIP lookup bytes do not match the pinned digest')
    zips: dict = {}
    for row in csv.DictReader(io.StringIO(zraw.decode('utf-8-sig'))):
        zips.setdefault(row['zip'], []).append((row['SUBRGN'], row['eiaid']))
    return {'entries': entries, 'constants': constants, 'zips': zips}


try:
    REGISTER = load_register()
except Exception:  # reported by every entry point; never calculate without the pinned register
    REGISTER = None


def require_register() -> dict:
    if REGISTER is None:
        raise RuntimeError('verified Scope 3 register unavailable')
    return REGISTER


def factor(key: str, used: dict) -> Decimal:
    e = require_register()['entries'].get(key)
    if e is None or not FACTOR_TEXT.fullmatch(e['value']):
        raise RuntimeError('register factor missing: ' + key)
    used[key] = e
    return Decimal(e['value'])


def constant(key: str, used: dict) -> Decimal:
    c = require_register()['constants'][key]
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
    """Real calendar dates (2025-02-30 is refused), start before end, inside the 2025 envelope."""
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

METHODS = {
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
KIND_METHOD = {m['kind']: mid for mid, m in METHODS.items()}


def describe() -> dict:
    sha = engine_sha256()
    reg = require_register()
    out = []
    for mid, m in sorted(METHODS.items()):
        keys = sorted(m['factorKeys']())
        used: dict = {}
        values = {k: exact(factor(k, used)) for k in keys}
        consts = {c: {'value': exact(constant(c, used)), 'unit': reg['constants'][c]['unit']} for c in sorted(m['constantIds'])}
        out.append({'id': mid, 'profileId': m['profileId'], 'scope': 3, 'family': m['family'], 'title': m['title'], 'formula': m['formula'],
                    'enginePath': ENGINE_PATH, 'engineSha256': sha, 'registerSha256': REGISTER_SHA256, 'gwpSetId': m['gwpSetId'],
                    'admissionRules': m['admissionRules'], 'estimateRules': m['estimateRules'],
                    'reportingPeriod': {'start': PERIOD[0], 'endExclusive': PERIOD[1]},
                    'factorKeys': keys, 'constantIds': sorted(m['constantIds']), 'factorValues': values,
                    'factorCells': {k: reg['entries'][k]['valueCell'] for k in keys}, 'constantValues': consts})
    return {'profile': ENGINE_PROFILE, 'engineSha256': sha, 'registerSha256': REGISTER_SHA256, 'methods': out}


def catalog() -> dict:
    reg = require_register()['entries']
    label = lambda k: reg[k + '.co2']['label']
    return {
        'travelModes': [{'id': m, 'label': label(k), 'activity': u + '-mile', 'businessTravel': True, 'employeeCommuting': m in COMMUTING_MODES} for m, (k, u) in TRAVEL_MODES.items()],
        'transportVehicles': [{'id': v, 'label': label(ks.get('vehicle') or ks['ton']).rsplit(' (', 1)[0], 'dedicatedVehicle': 'vehicle' in ks, 'sharedVehicle': 'ton' in ks} for v, ks in TRANSPORT_VEHICLES.items()],
        'wasteMaterials': [{'id': m, 'label': reg[f'waste.{m}.{t[0]}']['label'].rsplit(', ', 1)[0], 'treatments': t} for m, t in _waste_materials().items()],
        'wasteUnits': list(WASTE_UNITS),
        'subregionInterconnect': dict(sorted(SUBREGION_INTERCONNECT.items())),
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


def _result(method_id: str, category: int, inp: dict, used: dict, *, status: str, gases=None, co2e_only=None, activity=None,
            estimates=(), findings=(), conversions=(), boundary='met', boundary_notes=()) -> dict:
    factors = sorted(({'key': k, 'value': e['value'], 'unit': e['unit'], 'cell': e['valueCell'], 'label': e['label']}
                      for k, e in used.items() if not k.startswith('constant:')), key=lambda f: f['key'])
    constants = sorted(({'id': k.split(':', 1)[1], 'value': c['value'], 'unit': c['unit']} for k, c in used.items() if k.startswith('constant:')), key=lambda c: c['id'])
    gases = gases or {}
    total = None
    if status == 'complete':
        t = sum((Decimal(g['co2e']) for g in gases.values()), Decimal(0)) + (Decimal(co2e_only['co2e']) if co2e_only else Decimal(0))
        total = {'unrounded': exact(t), 'display': display(t), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp'}
    out = {'profile': ENGINE_PROFILE, 'methodVersionId': method_id, 'profileId': METHODS[method_id]['profileId'], 'category': category,
           'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256, 'gwpSetId': METHODS[method_id]['gwpSetId'],
           'input': inp, 'inputSha256': digest(inp), 'status': status, 'activity': activity or {}, 'gases': gases, 'co2eWithoutGasSplit': co2e_only,
           'estimates': sorted(set(estimates)), 'findings': sorted(set(findings)), 'conversions': list(conversions),
           'boundary': {'minimumBoundary': boundary, 'notes': sorted(set(boundary_notes))},
           'factorsUsed': factors, 'constantsUsed': constants, 'total': total}
    return dict(out, resultSha256=digest(out))


def td_losses(inp: dict) -> dict:
    require_keys(inp, {'period', 'quantity', 'unit', 'subregion', 'zip'}, {'utilityEiaId'})
    require_period(inp['period'])
    sub = inp['subregion']
    if not isinstance(sub, str) or sub not in SUBREGION_INTERCONNECT:
        raise Refused('unknown_subregion')
    if not isinstance(inp['zip'], str) or not re.fullmatch(r'[0-9]{5}', inp['zip']):
        raise Refused('invalid_zip')
    utility = inp.get('utilityEiaId')
    if utility is not None and (not isinstance(utility, str) or not re.fullmatch(r'[0-9]{1,7}', utility)):
        raise Refused('invalid_utility')
    mid = KIND_METHOD['td_losses']
    rows = require_register()['zips'].get(inp['zip'], [])
    subs = {r[0] for r in rows}
    if not rows or sub not in subs:
        return _result(mid, 3, inp, {}, status='review_required', findings=['zip_not_in_lookup' if not rows else 'subregion_not_listed_for_zip'])
    if utility is not None and (sub, utility) not in rows:
        return _result(mid, 3, inp, {}, status='review_required', findings=['utility_not_listed_for_zip_and_subregion'])
    if utility is None and len(subs) > 1:
        return _result(mid, 3, inp, {}, status='input_needed', findings=['utility_required_for_multi_subregion_zip'])
    used: dict = {}
    conversions: list = []
    with localcontext() as ctx:
        ctx.prec = 96
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
    with localcontext() as ctx:
        ctx.prec = 96
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
    with localcontext() as ctx:
        ctx.prec = 96
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
    with localcontext() as ctx:
        ctx.prec = 96
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


CALCULATORS = {'td_losses': td_losses, 'transport': transport, 'waste': waste, 'business_travel': business_travel, 'employee_commuting': employee_commuting}


def calculate(request: dict) -> dict:
    require_keys(request, {'kind', 'input'})
    fn = CALCULATORS.get(request['kind']) if isinstance(request['kind'], str) else None
    if fn is None:
        raise Refused('unsupported_kind')
    if not isinstance(request['input'], dict):
        raise Refused('invalid_input_shape')
    return fn(request['input'])


def recompute(r) -> None:
    """A result is accepted only if this engine, run again on its echoed input, produces it exactly."""
    try:
        fresh = calculate({'kind': METHODS[r['methodVersionId']]['kind'], 'input': r['input']})
    except (Refused, KeyError, TypeError):
        raise Refused('result_integrity') from None
    if canonical(fresh) != canonical(r):
        raise Refused('result_integrity')


def aggregate(results: list) -> dict:
    """Recomputes every result; per-category, per-GWP-set and overall subtotals of complete results, each
    summed unrounded and rounded once. complete needs every result calculated, every minimum boundary met
    and a single GWP set; an empty list is never complete."""
    if not isinstance(results, list) or len(results) > 5000:
        raise Refused('invalid_aggregate')
    by_category: dict = {}
    by_gwp: dict = {}
    included, not_calculated, partial = [], [], []
    with localcontext() as ctx:
        ctx.prec = 96
        for r in results:
            body = {k: v for k, v in r.items() if k != 'resultSha256'} if isinstance(r, dict) else None
            if body is None or digest(body) != r.get('resultSha256') or r.get('engineSha256') != engine_sha256():
                raise Refused('result_integrity')
            recompute(r)
            if r['status'] == 'complete':
                by_category[r['category']] = by_category.get(r['category'], Decimal(0)) + Decimal(r['total']['unrounded'])
                by_gwp[r['gwpSetId']] = by_gwp.get(r['gwpSetId'], Decimal(0)) + Decimal(r['total']['unrounded'])
                included.append(r['resultSha256'])
                if r['boundary']['minimumBoundary'] != 'met':
                    partial.append({'resultSha256': r['resultSha256'], 'category': r['category'], 'notes': r['boundary']['notes']})
            else:
                not_calculated.append({'resultSha256': r['resultSha256'], 'category': r['category'], 'status': r['status'], 'findings': r['findings']})
        overall = sum(by_category.values(), Decimal(0))
    total = lambda v: {'unrounded': exact(v), 'display': display(v), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'}
    out = {'profile': ENGINE_PROFILE + '.aggregate', 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256,
           'categorySubtotals': {str(c): total(v) for c, v in sorted(by_category.items())}, 'knownSourceSubtotal': total(overall),
           'includedResults': sorted(included), 'notCalculated': not_calculated, 'partialBoundaryResults': partial,
           'gwpSetSubtotals': {g: total(v) for g, v in sorted(by_gwp.items())}, 'gwpSetsUsed': sorted(by_gwp), 'mixedGwpSets': len(by_gwp) > 1,
           'resultCount': len(results), 'allCalculated': bool(results) and not not_calculated,
           # complete also needs every minimum boundary met and one GWP set (re-review P3-3)
           'complete': bool(results) and not not_calculated and not partial and len(by_gwp) == 1}
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
    if v['action'] == 'aggregate':
        require_keys(v, {'action', 'results'})
        return {'status': 'ok', 'aggregate': aggregate(v['results'])}
    raise Refused('invalid_request')


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(4194305)
        if len(raw) > 4194304:
            raise Refused('request_too_large')
        print(canonical(handle(json.loads(raw))))
    except Refused as e:
        print(canonical({'status': 'refused', 'code': e.code}))
        sys.exit(1)
    except Exception:
        print('{"status":"error","code":"scope3_engine_unavailable"}')
        sys.exit(2)
