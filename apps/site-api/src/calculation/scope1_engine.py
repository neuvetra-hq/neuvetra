"""Scope 1 beta calculation engine (board decision 2026-09-26, section 2).

One file so one SHA-256 identifies the engine in method_versions. Every factor, GWP and
constant is read from the verified register whose exact bytes are pinned below; nothing is
typed in by hand. Legacy M73-M77 engines are untouched and keep verifying their stored records.

Rules applied everywhere:
- quantities are plain decimals with up to 3 decimal places; unknown is never zero;
- exact Decimal arithmetic, unrounded gas results, one half-even rounding to 4 dp kg CO2e;
- estimates and proxies are labelled; missing gases are listed, never filled with zero.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from pathlib import Path

REGISTER_SHA256 = 'f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02'
REGISTER_PATH = Path(__file__).resolve().parents[4] / 'packages' / 'neuvetra-database' / 'src' / 'method-reference' / 'verified-factor-register-2025.json'
GWP_SET = 'AR5-100'
PERIOD = ('2025-01-01', '2026-01-01')
ENGINE_PROFILE = 'neuvetra.scope1-engine.v2'
QUANTITY = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?')
FACTOR_TEXT = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?')


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
        raise RuntimeError('verified register bytes do not match the pinned digest')
    reg = json.loads(raw.decode('utf-8'))
    entries = {e['id']: e for e in reg['entries']}
    constants = {c['id']: c for c in reg['constants']}
    if len(entries) != len(reg['entries']) or len(constants) != len(reg['constants']):
        raise RuntimeError('duplicate register key')
    return {'entries': entries, 'constants': constants}


try:
    REGISTER = load_register()
except Exception:  # reported by every entry point below; never calculate without the pinned register
    REGISTER = None


def require_register() -> dict:
    if REGISTER is None:
        raise RuntimeError('verified register unavailable')
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


def gwp(gas: str, used: dict) -> Decimal:
    return factor('gwp_ar5.' + gas, used)


def quantity(v, code: str) -> Decimal:
    if not isinstance(v, str) or not QUANTITY.fullmatch(v):
        raise Refused(code)
    return Decimal(v)


def require_keys(v, required: set, optional: set = frozenset()) -> None:
    if not isinstance(v, dict) or not required.issubset(v) or not set(v).issubset(required | set(optional)):
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


def tri_state(v) -> bool | None:
    """An explicit yes/no answer, or None when the answer is not known. Anything else is malformed."""
    if v is None or isinstance(v, bool):
        return v
    raise Refused('invalid_input_shape')


# ---------------------------------------------------------------------------
# Method definitions: the describe action returns exactly these, so registration
# in the database always copies the engine's own statement of what it uses.
# ---------------------------------------------------------------------------

def _keys(prefix: str) -> list[str]:
    return [] if REGISTER is None else sorted(k for k in REGISTER['entries'] if k.startswith(prefix))


COMBUSTION_GWP = ['gwp_ar5.CO2', 'gwp_ar5.CH4', 'gwp_ar5.N2O']
REFRIGERANT_GWP = ['HFC-134a', 'HFC-227ea', 'R-404A', 'R-407C', 'R-410A', 'R-507A']
REPORTED_OUTSIDE_SCOPES = {'HCFC-22': 'HCFC-22', 'R-22': 'HCFC-22', 'CFC-12': 'CFC-12', 'R-12': 'CFC-12', 'R-502': 'R-502'}
GASOLINE_TYPES = {
    'gasoline_passenger_car': 'Gasoline Passenger Cars',
    'gasoline_light_duty_truck': 'Gasoline Light-Duty Trucks',
    'gasoline_heavy_duty': 'Gasoline Heavy-Duty Vehicles',
    'gasoline_motorcycle': 'Gasoline Motorcycles',
}
DIESEL_TYPES = {
    'diesel_passenger_car': 'Passenger Cars',
    'diesel_light_duty_truck': 'Light-Duty Trucks',
    'diesel_medium_heavy_duty': 'Medium- and Heavy-Duty Vehicles',
}

METHODS = {
    'scope1.stationary.natural_gas.v2': {
        'profileId': 'scope1.stationary.natural_gas', 'scope': 1, 'family': 'stationary_combustion',
        'title': 'Stationary combustion: natural gas (HHV)',
        'formula': 'MMBtu = therms x 0.1, or stated MMBtu, or volume x stated heat content; kg CO2e = MMBtu x 53.06 + MMBtu x 1 g/1000 x 28 + MMBtu x 0.1 g/1000 x 265',
        'factorKeys': ['stationary.Natural Gas.co2', 'stationary.Natural Gas.ch4', 'stationary.Natural Gas.n2o'] + COMBUSTION_GWP,
        'constantIds': ['g_to_kg', 'therm_to_mmbtu'],
        'admissionRules': ['Units: MMBtu (HHV), therm, or ccf/mcf/scf only with the heat content stated on the bill (EPA Equation 2)',
                           'Volume without a stated heat content is held as input needed; no default heat content is applied',
                           'Up to 3 decimal places; original quantity and unit are kept'],
        'estimateRules': [],
    },
    'scope1.stationary.distillate_no2.v2': {
        'profileId': 'scope1.stationary.distillate_no2', 'scope': 1, 'family': 'stationary_combustion',
        'title': 'Stationary combustion: distillate fuel oil No. 2 (e.g. diesel emergency generator)',
        'formula': 'gallons consumed = measured, or purchases + opening tank - closing tank; MMBtu = gallons x HHV (stated, else 0.138 default); kg CO2e = MMBtu x 73.96 + MMBtu x 3 g/1000 x 28 + MMBtu x 0.6 g/1000 x 265',
        'factorKeys': ['stationary.Distillate Fuel Oil No. 2.hhv', 'stationary.Distillate Fuel Oil No. 2.co2', 'stationary.Distillate Fuel Oil No. 2.ch4', 'stationary.Distillate Fuel Oil No. 2.n2o'] + COMBUSTION_GWP,
        'constantIds': ['g_to_kg'],
        'admissionRules': ['Consumption must be measured, or purchases with opening and closing tank levels; purchases alone are not consumption',
                           'Supplier-stated HHV (MMBtu per gallon) is used when provided (EPA Equation 2)'],
        'estimateRules': ['default_hhv: EPA default HHV 0.138 MMBtu/gal (cell D55) used because no supplier HHV was stated'],
    },
    'scope1.mobile.onroad_gasoline.v2': {
        'profileId': 'scope1.mobile.onroad_gasoline', 'scope': 1, 'family': 'mobile_combustion',
        'title': 'Mobile combustion: on-road gasoline vehicles',
        'formula': 'kg CO2 = gallons x 8.78; CH4/N2O kg = miles x g per mile (vehicle type, model year)/1000; kg CO2e = CO2 + CH4 x 28 + N2O x 265',
        'factorKeys': ['mobile_co2.Motor Gasoline'] + _keys('onroad_gasoline.') + COMBUSTION_GWP,
        'constantIds': ['g_to_kg'],
        'admissionRules': ['Vehicle type and model year required per vehicle or per group of identical vehicles',
                           'Gallons required; miles from odometer or trip records, else estimated from fuel economy'],
        'estimateRules': ['model_year_proxy: model year newer than the latest published band uses that latest band (EPA mobile guidance)',
                          'miles_estimated_from_fuel_economy: miles = gallons x mpg from vehicle or fleet records, else fueleconomy.gov',
                          'ch4_n2o_missing: no miles and no mpg; CO2 only, subtotal incomplete'],
    },
    'scope1.mobile.onroad_diesel.v2': {
        'profileId': 'scope1.mobile.onroad_diesel', 'scope': 1, 'family': 'mobile_combustion',
        'title': 'Mobile combustion: on-road diesel vehicles',
        'formula': 'kg CO2 = gallons x 10.21; CH4/N2O kg = miles x g per mile (vehicle type, model year)/1000; kg CO2e = CO2 + CH4 x 28 + N2O x 265',
        'factorKeys': ['mobile_co2.Diesel Fuel'] + _keys('onroad_diesel.') + COMBUSTION_GWP,
        'constantIds': ['g_to_kg'],
        'admissionRules': ['Vehicle type and model year required per vehicle or per group of identical vehicles',
                           'Gallons required; miles from odometer or trip records, else estimated from fuel economy',
                           'Fossil diesel only; biodiesel and renewable diesel blends are not supported'],
        'estimateRules': ['model_year_proxy: model year newer than the latest published band uses that latest band (EPA mobile guidance)',
                          'miles_estimated_from_fuel_economy: miles = gallons x mpg from vehicle or fleet records, else fueleconomy.gov',
                          'ch4_n2o_missing: no miles and no mpg; CO2 only, subtotal incomplete'],
    },
    'scope1.fugitive.material_balance.v2': {
        'profileId': 'scope1.fugitive', 'scope': 1, 'family': 'fugitive',
        'title': 'Fugitive: refrigeration, air conditioning and fire suppression (EPA Simplified Material Balance)',
        'formula': 'kg gas = (PN - CN) + PS + (CD - RD) (EPA fugitive guidance Equation 6); kg CO2e = kg gas x AR5 GWP; lb x 0.45359237 = kg',
        'factorKeys': ['gwp_ar5.' + g for g in REFRIGERANT_GWP],
        'constantIds': ['lb_to_kg'],
        'admissionRules': ['Equipment must be inside the declared organizational boundary (any U.S. state); unknown membership is input needed, never an exclusion',
                           'Applicability (EPA fugitive guidance, Dec 2023, printed p. 8): only for an entity that does not maintain and track a refrigerant stock and did not retrofit equipment to a different refrigerant in the period; unknown is input needed, tracked stock or a retrofit is review required (Material Balance Method not supported)',
                           'Complete contractor records and an event chronology are required',
                           'All five balance terms must be stated; zero only when that event did not occur',
                           'HCFC-22 (R-22) and other Montreal Protocol gases are reported separately, outside the Scope 1 total'],
        'estimateRules': [],
    },
}


def describe() -> dict:
    sha = engine_sha256()
    out = []
    for mid, m in sorted(METHODS.items()):
        used: dict = {}
        values = {k: exact(factor(k, used)) for k in m['factorKeys']}
        cells = {k: require_register()['entries'][k]['valueCell'] for k in m['factorKeys']}
        consts = {c: {'value': exact(constant(c, used)), 'unit': require_register()['constants'][c]['unit']} for c in m['constantIds']}
        out.append({'id': mid, 'profileId': m['profileId'], 'scope': m['scope'], 'family': m['family'], 'title': m['title'], 'formula': m['formula'],
                    'enginePath': 'apps/site-api/src/calculation/scope1_engine.py', 'engineSha256': sha, 'registerSha256': REGISTER_SHA256, 'gwpSetId': GWP_SET,
                    'admissionRules': m['admissionRules'], 'estimateRules': m['estimateRules'],
                    'reportingPeriod': {'start': PERIOD[0], 'endExclusive': PERIOD[1]},
                    'factorKeys': sorted(m['factorKeys']), 'constantIds': sorted(m['constantIds']), 'factorValues': values, 'factorCells': cells,
                    'constantValues': dict(sorted(consts.items()))})
    return {'profile': ENGINE_PROFILE, 'engineSha256': sha, 'registerSha256': REGISTER_SHA256, 'methods': out}


# ---------------------------------------------------------------------------
# Calculations
# ---------------------------------------------------------------------------

def _gas(mass_kg: Decimal, unit: str, co2e: Decimal) -> dict:
    return {'mass': exact(mass_kg), 'massUnit': unit, 'co2e': exact(co2e), 'co2eUnit': 'kg CO2e'}


def _result(method_id: str, inp: dict, used: dict, gases: dict, *, status: str, estimates=(), missing=(), findings=(), memo=None, activity=None) -> dict:
    total = sum((Decimal(g['co2e']) for g in gases.values()), Decimal(0))
    factors = sorted(({'key': k, 'value': e['value'], 'unit': e['unit'], 'cell': e['valueCell'], 'label': e['label']}
                      for k, e in used.items() if not k.startswith('constant:')), key=lambda f: f['key'])
    constants = sorted(({'id': k.split(':', 1)[1], 'value': c['value'], 'unit': c['unit']} for k, c in used.items() if k.startswith('constant:')), key=lambda c: c['id'])
    out = {'profile': ENGINE_PROFILE, 'methodVersionId': method_id, 'profileId': METHODS[method_id]['profileId'], 'engineSha256': engine_sha256(),
           'registerSha256': REGISTER_SHA256, 'gwpSetId': GWP_SET, 'input': inp, 'inputSha256': digest(inp), 'status': status,
           'activity': activity or {}, 'gases': gases, 'missingGases': sorted(missing), 'estimates': sorted(estimates), 'findings': sorted(findings),
           'memo': memo, 'factorsUsed': factors, 'constantsUsed': constants,
           'total': None if status in ('input_needed', 'excluded', 'review_required') or not gases else {'unrounded': exact(total), 'display': display(total), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp'}}
    return dict(out, resultSha256=digest(out))


def _not_calculated(method_id: str, inp: dict, status: str, findings: list) -> dict:
    return _result(method_id, inp, {}, {}, status=status, findings=findings)


def natural_gas(inp: dict) -> dict:
    mid = 'scope1.stationary.natural_gas.v2'
    require_keys(inp, {'period', 'quantity', 'unit'}, {'heatContent'})
    require_period(inp['period'])
    q = quantity(inp['quantity'], 'invalid_quantity')
    used: dict = {}
    unit = inp['unit']
    with localcontext() as ctx:
        ctx.prec = 96
        if unit == 'MMBtu':
            if 'heatContent' in inp:
                raise Refused('invalid_input_shape')
            mmbtu = q
        elif unit == 'therm':
            if 'heatContent' in inp:
                raise Refused('invalid_input_shape')
            mmbtu = q * constant('therm_to_mmbtu', used)
        elif unit in ('scf', 'ccf', 'mcf'):
            if 'heatContent' not in inp:
                return _not_calculated(mid, inp, 'input_needed', ['heat_content_required_for_volume'])
            hc = inp['heatContent']
            require_keys(hc, {'value', 'unit'})
            value = Decimal(hc['value']) if isinstance(hc['value'], str) and FACTOR_TEXT.fullmatch(hc['value']) else None
            if value is None or value == 0:
                raise Refused('invalid_heat_content')
            scf = q * {'scf': Decimal(1), 'ccf': Decimal(100), 'mcf': Decimal(1000)}[unit]
            if hc['unit'] == 'MMBtu per scf':
                mmbtu = scf * value
            elif hc['unit'] == 'MMBtu per ccf':
                mmbtu = scf / Decimal(100) * value
            elif hc['unit'] == 'MMBtu per mcf':
                mmbtu = scf / Decimal(1000) * value
            elif hc['unit'] == 'therm per ccf':
                mmbtu = scf / Decimal(100) * value * constant('therm_to_mmbtu', used)
            else:
                raise Refused('invalid_heat_content')
        else:
            raise Refused('unsupported_unit')
        g_kg = constant('g_to_kg', used)
        co2 = mmbtu * factor('stationary.Natural Gas.co2', used)
        ch4 = mmbtu * factor('stationary.Natural Gas.ch4', used) * g_kg
        n2o = mmbtu * factor('stationary.Natural Gas.n2o', used) * g_kg
        gases = {'co2': _gas(co2, 'kg CO2', co2 * gwp('CO2', used)), 'ch4': _gas(ch4, 'kg CH4', ch4 * gwp('CH4', used)), 'n2o': _gas(n2o, 'kg N2O', n2o * gwp('N2O', used))}
    return _result(mid, inp, used, gases, status='complete', activity={'mmbtuHhv': exact(mmbtu), 'originalQuantity': inp['quantity'], 'originalUnit': unit})


def distillate(inp: dict) -> dict:
    mid = 'scope1.stationary.distillate_no2.v2'
    require_keys(inp, {'period', 'consumption'}, {'statedHhvMmbtuPerGallon'})
    require_period(inp['period'])
    c = inp['consumption']
    if not isinstance(c, dict) or c.get('basis') not in ('measured', 'purchases_with_tank_levels', 'purchases_only'):
        raise Refused('invalid_consumption')
    if c['basis'] == 'purchases_only':
        require_keys(c, {'basis', 'purchasedGallons'})
        return _not_calculated(mid, inp, 'input_needed', ['tank_levels_required_for_purchases'])
    used: dict = {}
    estimates = []
    with localcontext() as ctx:
        ctx.prec = 96
        if c['basis'] == 'measured':
            require_keys(c, {'basis', 'gallons'})
            gallons = quantity(c['gallons'], 'invalid_quantity')
        else:
            require_keys(c, {'basis', 'purchasedGallons', 'openingGallons', 'closingGallons'})
            gallons = quantity(c['purchasedGallons'], 'invalid_quantity') + quantity(c['openingGallons'], 'invalid_quantity') - quantity(c['closingGallons'], 'invalid_quantity')
            if gallons < 0:
                return _not_calculated(mid, inp, 'review_required', ['negative_consumption_from_tank_levels'])
        if 'statedHhvMmbtuPerGallon' in inp:
            v = inp['statedHhvMmbtuPerGallon']
            if not isinstance(v, str) or not FACTOR_TEXT.fullmatch(v) or Decimal(v) == 0:
                raise Refused('invalid_heat_content')
            hhv = Decimal(v)
        else:
            hhv = factor('stationary.Distillate Fuel Oil No. 2.hhv', used)
            estimates.append('default_hhv')
        mmbtu = gallons * hhv
        g_kg = constant('g_to_kg', used)
        co2 = mmbtu * factor('stationary.Distillate Fuel Oil No. 2.co2', used)
        ch4 = mmbtu * factor('stationary.Distillate Fuel Oil No. 2.ch4', used) * g_kg
        n2o = mmbtu * factor('stationary.Distillate Fuel Oil No. 2.n2o', used) * g_kg
        gases = {'co2': _gas(co2, 'kg CO2', co2 * gwp('CO2', used)), 'ch4': _gas(ch4, 'kg CH4', ch4 * gwp('CH4', used)), 'n2o': _gas(n2o, 'kg N2O', n2o * gwp('N2O', used))}
    return _result(mid, inp, used, gases, status='complete', estimates=estimates, activity={'gallonsConsumed': exact(gallons), 'mmbtuHhv': exact(mmbtu)})


def _band(label: str) -> tuple[int, int]:
    if label.startswith('≤'):
        return 0, int(label[1:])
    lo, _, hi = label.partition('-')
    return int(lo), int(hi or lo)


def _vehicle_factor_band(prefix: str, vehicle: str, model_year: int) -> tuple[str, bool]:
    bands = sorted({k[len(prefix) + len(vehicle) + 1:].rsplit('.', 1)[0] for k in require_register()['entries'] if k.startswith(prefix + vehicle + '.')}, key=_band)
    for b in bands:
        lo, hi = _band(b)
        if lo <= model_year <= hi:
            return b, False
    latest = max(bands, key=lambda b: _band(b)[1])
    if model_year > _band(latest)[1]:
        return latest, True
    raise Refused('model_year_not_covered')


def vehicle(inp: dict) -> dict:
    require_keys(inp, {'period', 'fuel', 'vehicleType', 'modelYear', 'gallons'}, {'miles', 'fuelEconomy', 'vehicleCount'})
    require_period(inp['period'])
    fuel = inp['fuel']
    if fuel == 'gasoline':
        mid, types, prefix, co2_key = 'scope1.mobile.onroad_gasoline.v2', GASOLINE_TYPES, 'onroad_gasoline.', 'mobile_co2.Motor Gasoline'
    elif fuel == 'diesel':
        mid, types, prefix, co2_key = 'scope1.mobile.onroad_diesel.v2', DIESEL_TYPES, 'onroad_diesel.', 'mobile_co2.Diesel Fuel'
    else:
        raise Refused('unsupported_fuel')
    if inp['vehicleType'] not in types:
        raise Refused('unsupported_vehicle_type')
    my = inp['modelYear']
    if not isinstance(my, int) or isinstance(my, bool) or not 1960 <= my <= 2030:
        raise Refused('invalid_model_year')
    if 'vehicleCount' in inp and (not isinstance(inp['vehicleCount'], int) or isinstance(inp['vehicleCount'], bool) or not 1 <= inp['vehicleCount'] <= 10000):
        raise Refused('invalid_vehicle_count')
    used: dict = {}
    estimates, missing = [], []
    with localcontext() as ctx:
        ctx.prec = 96
        gallons = quantity(inp['gallons'], 'invalid_quantity')
        co2 = gallons * factor(co2_key, used)
        gases = {'co2': _gas(co2, 'kg CO2', co2 * gwp('CO2', used))}
        miles = None
        if 'miles' in inp:
            m = inp['miles']
            require_keys(m, {'value', 'basis'})
            if m['basis'] not in ('odometer', 'trip_log'):
                raise Refused('invalid_miles_basis')
            miles = quantity(m['value'], 'invalid_miles')
            if 'fuelEconomy' in inp:
                raise Refused('invalid_input_shape')
        elif 'fuelEconomy' in inp:
            f = inp['fuelEconomy']
            require_keys(f, {'mpg', 'source'})
            if f['source'] not in ('vehicle_record', 'fleet_record', 'fueleconomy_gov'):
                raise Refused('invalid_fuel_economy_source')
            mpg = quantity(f['mpg'], 'invalid_mpg')
            if mpg == 0:
                raise Refused('invalid_mpg')
            miles = gallons * mpg
            estimates.append('miles_estimated_from_fuel_economy:' + f['source'])
        band = None
        if miles is None:
            missing += ['ch4', 'n2o']
            estimates.append('ch4_n2o_missing')
        else:
            band, proxy = _vehicle_factor_band(prefix, types[inp['vehicleType']], my)
            if proxy:
                estimates.append('model_year_proxy:' + band)
            g_kg = constant('g_to_kg', used)
            base = prefix + types[inp['vehicleType']] + '.' + band
            ch4 = miles * factor(base + '.ch4', used) * g_kg
            n2o = miles * factor(base + '.n2o', used) * g_kg
            gases['ch4'] = _gas(ch4, 'kg CH4', ch4 * gwp('CH4', used))
            gases['n2o'] = _gas(n2o, 'kg N2O', n2o * gwp('N2O', used))
    activity = {'gallons': exact(gallons), 'miles': None if miles is None else exact(miles), 'modelYearBand': band}
    return _result(mid, inp, used, gases, status='partial' if missing else 'complete', estimates=estimates, missing=missing, activity=activity)


def fugitive(inp: dict) -> dict:
    mid = 'scope1.fugitive.material_balance.v2'
    require_keys(inp, {'period', 'gas', 'unit', 'terms', 'insideBoundary', 'maintainsRefrigerantStock', 'retrofitInPeriod', 'contractorRecordsComplete', 'eventChronologyComplete'})
    require_period(inp['period'])
    answers = {k: tri_state(inp[k]) for k in ('insideBoundary', 'maintainsRefrigerantStock', 'retrofitInPeriod', 'contractorRecordsComplete', 'eventChronologyComplete')}
    if answers['insideBoundary'] is None:
        return _not_calculated(mid, inp, 'input_needed', ['boundary_membership_unknown'])
    if answers['insideBoundary'] is False:
        return _not_calculated(mid, inp, 'excluded', ['outside_declared_boundary'])
    # A known yes is never weakened by an unknown other answer (v3 accounting review A03).
    if answers['maintainsRefrigerantStock'] is True or answers['retrofitInPeriod'] is True:
        return _not_calculated(mid, inp, 'review_required', ['simplified_method_not_applicable'])
    if answers['maintainsRefrigerantStock'] is None or answers['retrofitInPeriod'] is None:
        return _not_calculated(mid, inp, 'input_needed', ['simplified_method_applicability_unknown'])
    if answers['contractorRecordsComplete'] is not True or answers['eventChronologyComplete'] is not True:
        return _not_calculated(mid, inp, 'input_needed', ['contractor_records_and_chronology_required'])
    if inp['unit'] not in ('kg', 'lb'):
        raise Refused('unsupported_unit')
    t = inp['terms']
    require_keys(t, {'PN', 'CN', 'PS', 'CD', 'RD'})
    gas = inp['gas']
    used: dict = {}
    with localcontext() as ctx:
        ctx.prec = 96
        v = {k: quantity(t[k], 'invalid_quantity') for k in ('PN', 'CN', 'PS', 'CD', 'RD')}
        to_kg = constant('lb_to_kg', used) if inp['unit'] == 'lb' else Decimal(1)
        mass = ((v['PN'] - v['CN']) + v['PS'] + (v['CD'] - v['RD'])) * to_kg
        if mass < 0:
            return _not_calculated(mid, inp, 'review_required', ['negative_material_balance'])
        if gas in REPORTED_OUTSIDE_SCOPES:
            memo = {'gas': REPORTED_OUTSIDE_SCOPES[gas], 'massKg': exact(mass), 'treatment': 'reported_separately_outside_scope1_total'}
            return _result(mid, inp, used, {}, status='memo_only', memo=memo, activity={'massKg': exact(mass)})
        if gas not in REFRIGERANT_GWP:
            return _not_calculated(mid, inp, 'input_needed', ['unsupported_refrigerant'])
        gases = {'refrigerant': _gas(mass, 'kg ' + gas, mass * gwp(gas, used))}
    return _result(mid, inp, used, gases, status='complete', activity={'massKg': exact(mass), 'originalUnit': inp['unit']})


CALCULATORS = {'natural_gas': natural_gas, 'distillate_no2': distillate, 'vehicle': vehicle, 'fugitive': fugitive}


def calculate(request: dict) -> dict:
    require_keys(request, {'kind', 'input'})
    fn = CALCULATORS.get(request['kind'])
    if fn is None:
        raise Refused('unsupported_kind')
    if not isinstance(request['input'], dict):
        raise Refused('invalid_input_shape')
    return fn(request['input'])


KIND_OF_METHOD = {'scope1.stationary.natural_gas.v2': 'natural_gas', 'scope1.stationary.distillate_no2.v2': 'distillate_no2',
                  'scope1.mobile.onroad_gasoline.v2': 'vehicle', 'scope1.mobile.onroad_diesel.v2': 'vehicle', 'scope1.fugitive.material_balance.v2': 'fugitive'}


def recompute(r) -> None:
    """A result is accepted only if this engine, run again on its echoed input, produces it exactly."""
    try:
        fresh = calculate({'kind': KIND_OF_METHOD[r['methodVersionId']], 'input': r['input']})
    except (Refused, KeyError, TypeError):
        raise Refused('result_integrity') from None
    if canonical(fresh) != canonical(r):
        raise Refused('result_integrity')


def aggregate(results: list) -> dict:
    """Recomputes every result, sums unrounded CO2e of complete and partial results and rounds once.
    Everything else is listed. An empty list is never complete."""
    if not isinstance(results, list) or len(results) > 5000:
        raise Refused('invalid_aggregate')
    total = Decimal(0)
    included, incomplete, not_calculated, memo = [], [], [], []
    with localcontext() as ctx:
        ctx.prec = 96
        for r in results:
            body = {k: v for k, v in r.items() if k != 'resultSha256'} if isinstance(r, dict) else None
            if body is None or digest(body) != r.get('resultSha256') or r.get('engineSha256') != engine_sha256():
                raise Refused('result_integrity')
            recompute(r)
            if r['status'] in ('complete', 'partial'):
                total += Decimal(r['total']['unrounded'])
                included.append(r['resultSha256'])
                if r['status'] == 'partial':
                    incomplete.append({'resultSha256': r['resultSha256'], 'missingGases': r['missingGases']})
            elif r['status'] == 'memo_only':
                memo.append(r['memo'])
            else:
                not_calculated.append({'resultSha256': r['resultSha256'], 'status': r['status'], 'findings': r['findings']})
    out = {'profile': ENGINE_PROFILE + '.aggregate', 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256,
           'knownSourceSubtotal': {'unrounded': exact(total), 'display': display(total), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'},
           'includedResults': sorted(included), 'incompleteResults': incomplete, 'notCalculated': not_calculated, 'reportedOutsideScopes': memo,
           'resultCount': len(results), 'complete': bool(results) and not incomplete and not not_calculated}
    return dict(out, aggregateSha256=digest(out))


def handle(v: dict) -> dict:
    require_register()
    if not isinstance(v, dict) or 'action' not in v:
        raise Refused('invalid_request')
    if v['action'] == 'describe':
        require_keys(v, {'action'})
        return {'status': 'ok', 'description': describe()}
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
        print('{"status":"error","code":"scope1_engine_unavailable"}')
        sys.exit(2)
