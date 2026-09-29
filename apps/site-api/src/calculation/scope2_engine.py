"""Scope 2 beta calculation engine: purchased electricity, location-based and market-based.

One file so one SHA-256 identifies the engine. Every rate, GWP and constant comes from the
verified register pinned below (eGRID2023 rev2 plus the Green-e 2025 residual mix); the ZIP lookup is
EPA's Power Profiler table.
The legacy M64-M68 CAMX-only worksheet engine is untouched.

Method (GHG Protocol Scope 2 Guidance; EPA eGRID total output emission rates, which exclude
grid losses; losses belong to Scope 3 category 3):
- location-based: MWh x subregion CO2, CH4 and N2O rates (lb/MWh) x 0.45359237 kg/lb, CO2e with AR5;
- market-based: MWh covered by contractual instruments use the instrument's stated rate, or zero only
  for a stated zero-emission generation technology (wind, solar PV, hydro, nuclear); bioenergy and
  instruments without a rate are not calculated. The rest uses the Green-e 2025 residual mix (CRS,
  2023 data, applied to 2025 reporting by decision), calculated per gas (notes/decisions/2026-09-28-scope2-residual-mix.md
  as amended 2026-09-29): eGRID CO2, CH4 and N2O rates x net generation / (net generation - Green-e
  certified voluntary MWh), Green-e's own adjustment. Green-e's published rate column is not used because
  the source labels it CO2 while its values follow eGRID CO2e (review finding A05).
  A subregion with no residual-mix inputs would fall back to the eGRID rate as provisional.
Location-based and market-based outcomes have separate statuses; one never discards the other.
v3 (collection review C08): an instrument MWh or stated rate that is blank or not a plain decimal is unknown, so it
holds only the market-based result as input needed; a wrong JSON type is still refused.
Unknown is never zero, one half-even rounding to 4 dp kg CO2e, estimates and proxies labelled.
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

REFERENCE_DIR = Path(__file__).resolve().parents[4] / 'packages' / 'neuvetra-database' / 'src' / 'method-reference'
REGISTER_PATH = REFERENCE_DIR / 'verified-electricity-register-egrid2023-greene2025.json'
REGISTER_SHA256 = '4873b8c08dbab395336a2273501724118661cf505ad19fa48a6f625661e3a14d'
ZIP_PATH = REFERENCE_DIR / 'egrid2023-zip-subregion-utility.csv'
ZIP_SHA256 = '7c661b453465ed6a0c456e30ea16604e52ab648c106ace1ec4b2e1e39092426e'  # LF copy of upstream 33d33352...
METHOD_ID = 'scope2.electricity.egrid2023_greene2025.v3'
PROFILE_ID = 'scope2.purchased_electricity'
ENGINE_PROFILE = 'neuvetra.scope2-engine.v2'
GWP_SET = 'AR5-100'
PERIOD = ('2025-01-01', '2026-01-01')
QUANTITY = re.compile(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?')
RATE = re.compile(r'(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,6})?')
INSTRUMENT_TYPES = ('energy_attribute_certificate', 'power_purchase_agreement', 'green_tariff', 'supplier_specific_rate')
ZERO_EMISSION_TECHNOLOGIES = ('wind', 'solar_photovoltaic', 'hydro', 'nuclear')
BIOENERGY_TECHNOLOGIES = ('biomass', 'biogas', 'landfill_gas')
TECHNOLOGIES = ZERO_EMISSION_TECHNOLOGIES + BIOENERGY_TECHNOLOGIES + ('geothermal', 'natural_gas', 'coal', 'oil', 'mixed', 'unknown')
SEVERITY = ('complete', 'provisional', 'input_needed', 'review_required')


class Refused(ValueError):
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


def _load():
    raw = REGISTER_PATH.read_bytes()
    if hashlib.sha256(raw).hexdigest() != REGISTER_SHA256:
        raise RuntimeError('electricity register bytes do not match the pinned digest')
    zraw = ZIP_PATH.read_bytes()
    if hashlib.sha256(zraw).hexdigest() != ZIP_SHA256:
        raise RuntimeError('ZIP lookup bytes do not match the pinned digest')
    reg = json.loads(raw.decode('utf-8'))
    entries = {e['id']: e for e in reg['entries']}
    constants = {c['id']: c for c in reg['constants']}
    subregions = {}
    for key, e in entries.items():
        m = re.fullmatch(r'egrid2023\.([A-Z]{4})\.(co2|ch4|n2o)', key)
        if m:
            subregions.setdefault(m.group(1), e['label'].rsplit(' (', 1)[0])
    residual = {}
    for key, e in entries.items():
        m = re.fullmatch(r'residual_mix_green_e_2025\.([A-Z]{4})\.(net_generation_mwh|voluntary_re_mwh)', key)
        if m:
            if m.group(1) not in subregions:
                raise RuntimeError('residual mix names an unknown subregion')
            residual.setdefault(m.group(1), {})[m.group(2)] = key
    if any(set(v) != {'net_generation_mwh', 'voluntary_re_mwh'} for v in residual.values()):
        raise RuntimeError('residual mix inputs incomplete')
    zips: dict[str, list] = {}
    for row in csv.DictReader(io.StringIO(zraw.decode('utf-8-sig'))):
        if row['SUBRGN'] not in subregions:
            raise RuntimeError('ZIP lookup names an unknown subregion')
        zips.setdefault(row['zip'], []).append({'subregion': row['SUBRGN'], 'utility': row['UtilName'], 'eiaId': row['eiaid'],
                                                 'state': row['state'], 'predominantUtility': row['Predominant Utility'] == '1'})
    return {'entries': entries, 'constants': constants, 'subregions': subregions, 'residual': residual, 'zips': zips}


try:
    DATA = _load()
except Exception:  # every entry point reports it; never calculate without the pinned data
    DATA = None


def data() -> dict:
    if DATA is None:
        raise RuntimeError('verified electricity data unavailable')
    return DATA


def factor(key: str, used: dict) -> Decimal:
    e = data()['entries'][key]
    used[key] = e
    return Decimal(e['value'])


def constant(key: str, used: dict) -> Decimal:
    c = data()['constants'][key]
    used['constant:' + key] = c
    return Decimal(c['value'])


def quantity(v, code: str) -> Decimal:
    if not isinstance(v, str) or not QUANTITY.fullmatch(v):
        raise Refused(code)
    return Decimal(v)


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


def worst(*statuses: str) -> str:
    return max(statuses, key=SEVERITY.index)


FORMULA = ('location-based kg gas = MWh x eGRID2023 subregion total output rate (lb/MWh) x 0.45359237; kg CO2e = CO2 + CH4 x 28 + N2O x 265. '
           'market-based: instrument MWh x the instrument\'s stated rate (lb/MWh), or 0 only for wind, solar PV, hydro or nuclear generation; '
           'remaining MWh: kg gas = MWh x eGRID subregion rate (lb/MWh) x net generation / (net generation - Green-e certified voluntary MWh) x 0.45359237, '
           'each gas rounded once half-even to 12 dp (Green-e 2025 residual mix adjustment applied per gas); '
           'a subregion without residual-mix inputs falls back to the eGRID rate and is provisional.')


def describe() -> dict:
    d = data()
    keys = sorted(d['entries'])
    used: dict = {}
    values = {k: exact(factor(k, used)) for k in keys}
    return {'profile': ENGINE_PROFILE, 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256, 'zipLookupSha256': ZIP_SHA256, 'methods': [{
        'id': METHOD_ID, 'profileId': PROFILE_ID, 'scope': 2, 'family': 'purchased_electricity',
        'title': 'Purchased electricity: location-based (eGRID2023 rev2) and market-based (instruments, Green-e 2025 residual mix)', 'formula': FORMULA,
        'enginePath': 'apps/site-api/src/calculation/scope2_engine.py', 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256, 'gwpSetId': GWP_SET,
        'admissionRules': ['Metered consumption in kWh or MWh for the reporting period (up to 3 decimals); estimates must be labelled by the collection step',
                           'The site ZIP and eGRID subregion are required; the subregion must be listed for the ZIP, and a ZIP served by more than one subregion needs the utility (EIA id) listed for that subregion',
                           'Location-based and market-based outcomes have separate statuses; an invalid market claim never removes the location-based result',
                           'An instrument whose MWh or stated rate is blank or not a plain decimal is unknown: it holds only the market-based result as input needed',
                           'Contractual instruments need a quality-criteria attestation, vintage year 2024-2026, evidence and the generation technology; covered MWh cannot exceed consumption',
                           'An instrument of any type counts at zero only for wind, solar PV, hydro or nuclear generation; any other technology needs the instrument\'s stated rate, and a zero CO2 rate for it is review required; bioenergy is not supported (biogenic CO2 and CH4/N2O treatment) and is held as input needed',
                           'Uncovered MWh use the Green-e 2025 residual mix (Center for Resource Solutions, 2023 data, released 2026-01-29; applied to 2025 reporting by Neuvetra decision 2026-09-28) calculated per gas from eGRID rates and Green-e net generation and certified voluntary MWh; Green-e and eGRID are cited on every market-based output',
                           'Transmission and distribution losses are excluded (Scope 3 category 3)'],
        'estimateRules': ['residual_mix_unavailable_location_rate_provisional: no residual-mix rate exists for the subregion; uncovered MWh use the eGRID subregion rate and the market-based result is provisional (no subregion is affected today)',
                          'instrument_rate_ch4_n2o_from_egrid: the instrument rate gave CO2 only; CH4 and N2O use the eGRID subregion rates',
                          'vintage_outside_reporting_year: instrument vintage is 2024 or 2026, not 2025'],
        'reportingPeriod': {'start': PERIOD[0], 'endExclusive': PERIOD[1]}, 'factorKeys': keys, 'constantIds': ['kwh_to_mwh', 'lb_to_kg'],
        'factorValues': values, 'factorCells': {k: d['entries'][k]['valueCell'] for k in keys},
        'constantValues': {c: {'value': exact(Decimal(d['constants'][c]['value'])), 'unit': d['constants'][c]['unit']} for c in ('kwh_to_mwh', 'lb_to_kg')}}]}


def lookup_zip(zip_code) -> dict:
    if not isinstance(zip_code, str) or not re.fullmatch(r'[0-9]{5}', zip_code):
        raise Refused('invalid_zip')
    rows = data()['zips'].get(zip_code, [])
    subregions = sorted({r['subregion'] for r in rows})
    return {'zip': zip_code, 'subregions': subregions, 'utilities': sorted(rows, key=lambda r: (not r['predominantUtility'], r['utility'])),
            'needsUtilityChoice': len(subregions) > 1, 'found': bool(rows), 'source': 'EPA Power Profiler zip.csv (eGRID2023)'}


def _gases(mwh: Decimal, rates: dict, used: dict) -> dict:
    lb = constant('lb_to_kg', used)
    out = {}
    for gas, gwp_key in (('co2', 'gwp_ar5.CO2'), ('ch4', 'gwp_ar5.CH4'), ('n2o', 'gwp_ar5.N2O')):
        kg = mwh * rates[gas] * lb
        out[gas] = {'mass': exact(kg), 'massUnit': 'kg ' + gas.upper(), 'co2e': exact(kg * factor(gwp_key, used)), 'co2eUnit': 'kg CO2e'}
    return out


def _total(gases: dict) -> dict:
    t = sum((Decimal(g['co2e']) for g in gases.values()), Decimal(0))
    return {'unrounded': exact(t), 'display': display(t), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp'}


def _add(a: dict, b: dict) -> dict:
    return {g: {'mass': exact(Decimal(a[g]['mass']) + Decimal(b[g]['mass'])), 'massUnit': a[g]['massUnit'],
                'co2e': exact(Decimal(a[g]['co2e']) + Decimal(b[g]['co2e'])), 'co2eUnit': 'kg CO2e'} for g in a}


def _location_check(inp: dict, sub: str, findings: list) -> str:
    """The subregion must be listed for the site ZIP; a multi-subregion ZIP needs the utility listed for it."""
    rows = data()['zips'].get(inp['zip'], [])
    if not rows:
        findings.append('zip_not_in_lookup')
        return 'review_required'
    if sub not in {r['subregion'] for r in rows}:
        findings.append('subregion_not_listed_for_zip')
        return 'review_required'
    utility = inp.get('utilityEiaId')
    if utility is not None:
        if not isinstance(utility, str) or not re.fullmatch(r'[0-9]{1,7}', utility):
            raise Refused('invalid_utility')
        if not any(r['eiaId'] == utility and r['subregion'] == sub for r in rows):
            findings.append('utility_not_listed_for_zip_and_subregion')
            return 'review_required'
    elif len({r['subregion'] for r in rows}) > 1:
        findings.append('utility_required_for_multi_subregion_zip')
        return 'input_needed'
    return 'complete'


def electricity(inp: dict) -> dict:
    require_keys(inp, {'period', 'quantity', 'unit', 'subregion', 'zip'}, {'utilityEiaId', 'instruments'})
    require_period(inp['period'])
    d = data()
    used: dict = {}
    loc_findings, mkt_findings, estimates, basis = [], [], [], []
    sub = inp['subregion']
    if not isinstance(sub, str) or sub not in d['subregions']:
        raise Refused('unknown_subregion')
    if not isinstance(inp['zip'], str) or not re.fullmatch(r'[0-9]{5}', inp['zip']):
        raise Refused('invalid_zip')
    location_status = _location_check(inp, sub, loc_findings)
    with localcontext() as ctx:
        ctx.prec = 96
        q = quantity(inp['quantity'], 'invalid_quantity')
        if inp['unit'] == 'kWh':
            mwh = q * constant('kwh_to_mwh', used)
        elif inp['unit'] == 'MWh':
            mwh = q
        else:
            raise Refused('unsupported_unit')
        grid = {g: factor(f'egrid2023.{sub}.{g}', used) for g in ('co2', 'ch4', 'n2o')}
        location = _gases(mwh, grid, used)
        covered = Decimal(0)
        covered_known = True  # False once any instrument MWh is unknown: the covered total is then unknown, not a sum
        market = None
        residual = None
        market_status = 'complete'
        instruments = inp.get('instruments', [])
        if not isinstance(instruments, list) or len(instruments) > 100:
            raise Refused('invalid_instruments')
        for i in instruments:
            # Malformed input is refused. A well-formed but inadmissible claim only holds the market-based
            # result; it never removes the location-based result (re-review P2-1).
            require_keys(i, {'type', 'mwh', 'qualityCriteriaMet', 'vintageYear', 'evidenceReference', 'generationTechnology'}, {'rateLbPerMwh'})
            if i['type'] not in INSTRUMENT_TYPES or i['generationTechnology'] not in TECHNOLOGIES or not isinstance(i['qualityCriteriaMet'], bool) \
                    or isinstance(i['vintageYear'], bool) or not isinstance(i['vintageYear'], int) or not isinstance(i['evidenceReference'], str) or len(i['evidenceReference']) > 200:
                raise Refused('invalid_instrument')
            # Collection review C08: a blank or non-decimal MWh or stated rate is unknown, not malformed. It holds only
            # the market-based result as input needed; a wrong JSON type is still refused.
            if not isinstance(i['mwh'], str):
                raise Refused('invalid_instrument_mwh')
            imwh = Decimal(i['mwh']) if QUANTITY.fullmatch(i['mwh']) else None
            tech = i['generationTechnology']
            rate_incomplete = False
            if 'rateLbPerMwh' in i:
                r = i['rateLbPerMwh']
                require_keys(r, {'co2'}, {'ch4', 'n2o'})
                if not all(isinstance(r[g], str) for g in r):
                    raise Refused('invalid_instrument_rate')
                parsed = {g: Decimal(r[g]) for g in r if RATE.fullmatch(r[g])}
                rate_incomplete = len(parsed) != len(r)
            else:
                parsed = None
            if imwh is not None:
                covered += imwh
            else:
                covered_known = False
            held = []
            if imwh is None:
                held.append(('instrument_mwh_required', 'input_needed'))
            if rate_incomplete:
                held.append(('instrument_rate_not_numeric', 'input_needed'))
            if i['qualityCriteriaMet'] is not True:
                held.append(('instrument_quality_criteria_not_met', 'review_required'))
            if i['vintageYear'] not in (2024, 2025, 2026):
                held.append(('instrument_vintage_not_admissible', 'review_required'))
            if not i['evidenceReference'].strip():
                held.append(('instrument_evidence_required', 'input_needed'))
            # v3 accounting review A01: only the four zero-emission technologies may carry a zero CO2 rate.
            if parsed is not None and 'co2' in parsed and tech not in ZERO_EMISSION_TECHNOLOGIES and tech not in BIOENERGY_TECHNOLOGIES and parsed['co2'] == 0:
                held.append(('instrument_rate_contradicts_technology', 'review_required'))
            if held:
                # Report every problem with this instrument at once, including the ones checked later for admissible claims.
                if tech in BIOENERGY_TECHNOLOGIES:
                    held.append(('bioenergy_instrument_not_supported', 'input_needed'))
                elif parsed is None and tech not in ZERO_EMISSION_TECHNOLOGIES:
                    held.append(('instrument_rate_required', 'input_needed'))
                for finding, status in held:
                    mkt_findings.append(finding)
                    market_status = worst(market_status, status)
                basis.append({'type': i['type'], 'mwh': exact(imwh) if imwh is not None else None, 'technology': tech,
                              'rateBasis': 'not_calculated' if imwh is None or rate_incomplete else 'not_admissible'})
                continue
            if i['vintageYear'] != 2025:
                estimates.append('vintage_outside_reporting_year')
            if tech in BIOENERGY_TECHNOLOGIES:
                mkt_findings.append('bioenergy_instrument_not_supported')
                market_status = worst(market_status, 'input_needed')
                basis.append({'type': i['type'], 'mwh': exact(imwh), 'technology': tech, 'rateBasis': 'not_calculated'})
                continue
            if parsed is not None:
                if 'ch4' not in parsed or 'n2o' not in parsed:
                    estimates.append('instrument_rate_ch4_n2o_from_egrid')
                rates = {g: parsed.get(g, grid[g]) for g in ('co2', 'ch4', 'n2o')}
                rate_basis = 'instrument_rate'
            elif tech in ZERO_EMISSION_TECHNOLOGIES:
                rates = {'co2': Decimal(0), 'ch4': Decimal(0), 'n2o': Decimal(0)}
                rate_basis = 'zero_emission_technology'
            else:
                mkt_findings.append('instrument_rate_required')
                market_status = worst(market_status, 'input_needed')
                basis.append({'type': i['type'], 'mwh': exact(imwh), 'technology': tech, 'rateBasis': 'not_calculated'})
                continue
            basis.append({'type': i['type'], 'mwh': exact(imwh), 'technology': tech, 'rateBasis': rate_basis})
            part = _gases(imwh, rates, used)
            market = part if market is None else _add(market, part)
        if covered > mwh:
            mkt_findings.append('instrument_mwh_exceed_consumption')
            market_status = worst(market_status, 'review_required')
        elif mwh - covered > 0 and sub in d['residual']:
            gen = factor(d['residual'][sub]['net_generation_mwh'], used)
            vol = factor(d['residual'][sub]['voluntary_re_mwh'], used)
            if not 0 <= vol < gen:
                raise RuntimeError('invalid residual mix inputs')
            lb = constant('lb_to_kg', used)
            gases, rounded = {}, False
            for gas, gwp_key in (('co2', 'gwp_ar5.CO2'), ('ch4', 'gwp_ar5.CH4'), ('n2o', 'gwp_ar5.N2O')):
                # Exact rational value, rounded once half-even to 12 dp of a kg.
                q = Fraction(mwh - covered) * Fraction(grid[gas]) * Fraction(lb) * Fraction(gen) / (Fraction(gen) - Fraction(vol))
                kg = Decimal(round(q * 10 ** 12)).scaleb(-12)
                rounded = rounded or Fraction(kg) != q
                gases[gas] = {'mass': exact(kg), 'massUnit': 'kg ' + gas.upper(), 'co2e': exact(kg * factor(gwp_key, used)), 'co2eUnit': 'kg CO2e'}
            residual = {'mwh': exact(mwh - covered), 'netGenerationMwh': exact(gen), 'voluntaryReMwh': exact(vol),
                        'method': 'eGRID2023 rev2 subregion rate per gas x net generation / (net generation - Green-e certified voluntary MWh)',
                        'gases': gases, 'rounding': {'places': 12, 'mode': 'half_even', 'unit': 'kg', 'applied': rounded},
                        'sources': ['Center for Resource Solutions, 2025 Green-e Residual Mix Emissions Rates (2023 data)', 'U.S. EPA eGRID2023 revision 2']}
            market = gases if market is None else _add(market, gases)
        elif mwh - covered > 0:
            remainder = _gases(mwh - covered, grid, used)
            estimates.append('residual_mix_unavailable_location_rate_provisional')
            market_status = worst(market_status, 'provisional')
            market = remainder if market is None else _add(market, remainder)
    # The market-based remainder and any CH4/N2O fallback use the same subregion, so it cannot be better than location.
    market_status = worst(market_status, location_status)
    return _result(inp, used, location, market, residual, location_status, market_status, loc_findings, mkt_findings, estimates, mwh, covered if covered_known else None, basis)


def _result(inp, used, location, market, residual, location_status, market_status, loc_findings, mkt_findings, estimates, mwh, covered, basis) -> dict:
    factors = sorted(({'key': k, 'value': e['value'], 'unit': e['unit'], 'cell': e['valueCell'], 'label': e['label']} for k, e in used.items() if not k.startswith('constant:')), key=lambda f: f['key'])
    constants = sorted(({'id': k.split(':', 1)[1], 'value': c['value'], 'unit': c['unit']} for k, c in used.items() if k.startswith('constant:')), key=lambda c: c['id'])
    shown = lambda status: status in ('complete', 'provisional')
    if not shown(market_status):
        estimates = [x for x in estimates if x != 'residual_mix_unavailable_location_rate_provisional']
    market_total = None
    if shown(market_status):
        t = sum((Decimal(g['co2e']) for g in (market or {}).values()), Decimal(0))
        market_total = {'unrounded': exact(t), 'display': display(t), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp'}
    out = {'profile': ENGINE_PROFILE, 'methodVersionId': METHOD_ID, 'profileId': PROFILE_ID, 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256,
           'gwpSetId': GWP_SET, 'input': inp, 'inputSha256': digest(inp), 'status': worst(location_status, market_status),
           'findings': sorted(set(loc_findings + mkt_findings)), 'estimates': sorted(set(estimates)),
           'activity': {'mwh': exact(mwh), 'instrumentMwh': exact(covered) if covered is not None else None, 'subregion': inp['subregion'], 'instruments': basis},
           'locationBased': {'status': location_status, 'findings': sorted(set(loc_findings)),
                             'gases': location if shown(location_status) else None, 'total': _total(location) if shown(location_status) else None},
           # gases: all market-based emissions per gas (instruments plus residual mix); residualMix: the uncovered part and its inputs.
           'marketBased': {'status': market_status, 'findings': sorted(set(mkt_findings + loc_findings)),
                           'gases': market if shown(market_status) and market is not None else None,
                           'residualMix': residual if shown(market_status) else None, 'total': market_total},
           'factorsUsed': factors, 'constantsUsed': constants}
    return dict(out, resultSha256=digest(out))


def recompute(r) -> None:
    """A result is accepted only if this engine, run again on its echoed input, produces it exactly."""
    try:
        fresh = electricity(r['input'])
    except (Refused, KeyError, TypeError):
        raise Refused('result_integrity') from None
    if canonical(fresh) != canonical(r):
        raise Refused('result_integrity')


def aggregate(results: list) -> dict:
    """Recomputes every result. Each basis is summed unrounded over its shown results and rounded once;
    the market-based subtotal is provisional if any part is. An empty list is never complete."""
    if not isinstance(results, list) or len(results) > 5000:
        raise Refused('invalid_aggregate')
    loc, mkt = Decimal(0), Decimal(0)
    included_loc, included_mkt, provisional, not_loc, not_mkt = [], [], [], [], []
    with localcontext() as ctx:
        ctx.prec = 96
        for r in results:
            body = {k: v for k, v in r.items() if k != 'resultSha256'} if isinstance(r, dict) else None
            if body is None or digest(body) != r.get('resultSha256') or r.get('engineSha256') != engine_sha256():
                raise Refused('result_integrity')
            recompute(r)
            lb, mb = r['locationBased'], r['marketBased']
            if lb['status'] == 'complete':
                loc += Decimal(lb['total']['unrounded'])
                included_loc.append(r['resultSha256'])
            else:
                not_loc.append({'resultSha256': r['resultSha256'], 'status': lb['status'], 'findings': lb['findings']})
            if mb['status'] in ('complete', 'provisional'):
                mkt += Decimal(mb['total']['unrounded'])
                included_mkt.append(r['resultSha256'])
                if mb['status'] == 'provisional':
                    provisional.append(r['resultSha256'])
            else:
                not_mkt.append({'resultSha256': r['resultSha256'], 'status': mb['status'], 'findings': mb['findings']})
    total = lambda v: {'unrounded': exact(v), 'display': display(v), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'}
    out = {'profile': ENGINE_PROFILE + '.aggregate', 'engineSha256': engine_sha256(), 'registerSha256': REGISTER_SHA256, 'resultCount': len(results),
           'locationBasedSubtotal': total(loc), 'locationBasedIncluded': sorted(included_loc), 'locationBasedNotCalculated': not_loc,
           'locationBasedComplete': bool(results) and not not_loc,
           'marketBasedSubtotal': total(mkt), 'marketBasedIncluded': sorted(included_mkt), 'marketBasedNotCalculated': not_mkt,
           'marketBasedProvisional': sorted(provisional), 'marketBasedComplete': bool(results) and not not_mkt and not provisional}
    return dict(out, aggregateSha256=digest(out))


def handle(v) -> dict:
    data()
    if not isinstance(v, dict) or 'action' not in v:
        raise Refused('invalid_request')
    if v['action'] == 'describe':
        require_keys(v, {'action'})
        return {'status': 'ok', 'description': describe()}
    if v['action'] == 'lookup_zip':
        require_keys(v, {'action', 'zip'})
        return {'status': 'ok', 'lookup': lookup_zip(v['zip'])}
    if v['action'] == 'calculate':
        require_keys(v, {'action', 'input'})
        if not isinstance(v['input'], dict):
            raise Refused('invalid_input_shape')
        return {'status': 'ok', 'result': electricity(v['input'])}
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
        print('{"status":"error","code":"scope2_engine_unavailable"}')
        sys.exit(2)
