"""Scope 3 completion I-01: engine foundation and throughput (DESIGN sections 4.1, 4.5, 4.6, 8.1 "Batch" and "Aggregate v2").

Covers: `calculate_many` (each item identical to `calculate`, refusals and failures in place, envelope and count caps),
the 16 MiB request cap, the engine hash computed once per process, the lazy ZIP table, the register map, the static
method metadata (method type, activity-data origin, default data quality, biogenic treatment) and the aggregate's
annotations and per-category profiles. Expected profile values are worked out here with exact fractions from the
register cells, independently of the engine's code path. Run: python -m unittest scope3_engine_batch_test
"""
import contextlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction as F
from pathlib import Path

import scope3_engine as e

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent
REF = HERE.parents[3] / 'packages/neuvetra-database/src/method-reference'
REG = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
V = {x['id']: F(x['value']) for x in REG['entries']}
GOLDEN = json.loads((HERE / 'testdata' / 'scope3-v1-golden.json').read_text('utf-8'))
ENGINE = str(HERE / 'scope3_engine.py')

BUS = {'kind': 'business_travel', 'input': {'period': P, 'mode': 'bus', 'activity': {'value': '1000', 'unit': 'passenger-mile'}}}
AIR = {'kind': 'business_travel', 'input': {'period': P, 'mode': 'air', 'segmentDistance': {'value': '2475', 'unit': 'mile'}, 'passengerSegments': 2}}
LANDFILL = {'kind': 'waste', 'input': {'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '2', 'unit': 'short_ton'}}
NA_WASTE = {'kind': 'waste', 'input': {'period': P, 'category': 5, 'material': 'mixed_msw', 'treatment': 'recycled', 'quantity': '2', 'unit': 'short_ton'}}
ZERO_WASTE = {'kind': 'waste', 'input': {'period': P, 'category': 12, 'material': 'mixed_msw', 'treatment': 'landfilled', 'quantity': '0', 'unit': 'short_ton'}}
LOSSES = {'kind': 'td_losses', 'input': {'period': P, 'quantity': '10000', 'unit': 'kWh', 'subregion': 'CAMX', 'zip': '94105'}}
NONE = {'dataQuality': None, 'activityDataOrigin': None}


def cli(payload, raw: bytes | None = None, engine: str = ENGINE):
    p = subprocess.run([sys.executable, engine], input=raw if raw is not None else json.dumps(payload).encode('utf-8'), capture_output=True)
    return p.returncode, json.loads(p.stdout)


def r12(q: F) -> F:
    return F(round(q * 10 ** 12), 10 ** 12)


def hub_co2e(activity: F, base: str) -> F:
    """Hub Table 10: CO2 kg/unit, CH4 and N2O g/unit, AR5 GWPs 28 and 265."""
    return activity * (V[base + '.co2'] + V[base + '.ch4'] / 1000 * 28 + V[base + '.n2o'] / 1000 * 265)


def text(q: F) -> str:
    d = Decimal(q.numerator) / Decimal(q.denominator)
    t = format(d, 'f')
    return t.rstrip('0').rstrip('.') if '.' in t else t


def fixed(q: F, places: int) -> str:
    """Half-even rounding of an exact fraction to a fixed number of places."""
    with __import__('decimal').localcontext() as ctx:
        ctx.prec = 100
        d = Decimal(q.numerator) / Decimal(q.denominator)
        return format(d.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_EVEN), f'.{places}f')


def kg(q: F) -> dict:
    return {'unrounded': text(q), 'display': fixed(q, 4), 'unit': 'kg CO2e', 'rounding': 'half_even_4dp_once'}


def calc(req):
    return e.calculate(req)


class CalculateMany(unittest.TestCase):
    def test_every_item_is_identical_to_calculate_including_refusals_and_failures(self):
        # All golden requests (6,411: every existing kind, the r3 inputs, refusals and one failure) in chunks of 2,000.
        reqs = [c['request'] if 'request' in c else {'kind': c['kind'], 'input': c['result']['input']} for c in GOLDEN['cases']]
        seen = {'ok': 0, 'refused': 0, 'error': 0}
        for i in range(0, len(reqs), 2000):
            chunk = reqs[i:i + 2000]
            code, out = cli({'action': 'calculate_many', 'requests': chunk})
            self.assertEqual((code, out['status'], len(out['results'])), (0, 'ok', len(chunk)))
            for req, item in zip(chunk, out['results']):
                try:
                    expected = {'status': 'ok', 'result': e.calculate(req)}
                except e.Refused as x:
                    expected = {'status': 'refused', 'code': x.code}
                except Exception:  # noqa: BLE001
                    expected = {'status': 'error', 'code': 'scope3_engine_unavailable'}
                self.assertEqual(e.canonical(item), e.canonical(expected), req)
                seen[item['status']] += 1
        # Round 2, owner decision 1: the golden's January 2026 commuting case calculates now (6372 + 1 ok, 38 - 1 refused).
        self.assertEqual(seen, {'ok': 6373, 'refused': 37, 'error': 1})

    def test_order_is_kept_and_one_bad_item_never_stops_the_others(self):
        bad_unit = {'kind': 'transport', 'input': {'period': P, 'category': 4, 'vehicle': 'passenger_car', 'loadBasis': 'dedicated_vehicle', 'activity': {'value': '1', 'unit': []}, 'thirdPartyFacilities': 'none'}}
        out = e.handle({'action': 'calculate_many', 'requests': [BUS, {'kind': 'hotel', 'input': {}}, 'not a request', bad_unit, LANDFILL]})
        self.assertEqual([i['status'] for i in out['results']], ['ok', 'refused', 'refused', 'error', 'ok'])
        self.assertEqual([i.get('code') for i in out['results']], [None, 'unsupported_kind', 'invalid_input_shape', 'scope3_engine_unavailable', None])
        self.assertEqual(out['results'][0]['result'], e.calculate(BUS))
        self.assertEqual(out['results'][4]['result']['total']['display'], '1160.0000')
        # The single-call CLI fails the same input outright (exit 2), never with a figure.
        code, single = cli({'action': 'calculate', 'request': bad_unit})
        self.assertEqual((code, single), (2, {'status': 'error', 'code': 'scope3_engine_unavailable'}))

    def test_malformed_envelope_and_counts(self):
        for bad in ({'action': 'calculate_many'}, {'action': 'calculate_many', 'requests': {}}, {'action': 'calculate_many', 'requests': []},
                    {'action': 'calculate_many', 'requests': [BUS] * 2001}, {'action': 'calculate_many', 'requests': [BUS], 'extra': 1},
                    {'action': 'calculate_many', 'requests': None}):
            with self.assertRaises(e.Refused) as ctx:
                e.handle(bad)
            self.assertEqual(ctx.exception.code, 'invalid_request')
        self.assertEqual(len(e.handle({'action': 'calculate_many', 'requests': [BUS] * 2000})['results']), 2000)
        self.assertEqual(cli({'action': 'calculate_many', 'requests': []}), (1, {'status': 'refused', 'code': 'invalid_request'}))

    def test_request_cap_is_64_mib(self):
        # 5 MB was over the old 4 MiB cap and 17 MiB over the round-1 16 MiB cap; both now reach the request check (an
        # unknown key). Round 2b (DESIGN 13.7): the cap is 64 MiB, so exactly 64 MiB is read and 64 MiB + 1 byte is not.
        self.assertEqual(e.MAX_REQUEST_BYTES, 64 * 1024 * 1024)
        for size in (5_000_000, 17 * 1024 * 1024):
            padded = b'{"action":"describe","pad":"' + b'x' * size + b'"}'
            self.assertEqual(cli(None, raw=padded), (1, {'status': 'refused', 'code': 'invalid_input_shape'}))
        envelope = b'{"action":"describe","pad":""}'
        at_cap = envelope[:-2] + b'x' * (e.MAX_REQUEST_BYTES - len(envelope)) + b'"}'
        self.assertEqual(len(at_cap), e.MAX_REQUEST_BYTES)
        self.assertEqual(cli(None, raw=at_cap), (1, {'status': 'refused', 'code': 'invalid_input_shape'}))
        self.assertEqual(cli(None, raw=at_cap + b' '), (1, {'status': 'refused', 'code': 'request_too_large'}))


class Foundation(unittest.TestCase):
    def test_engine_hash_is_computed_once_per_process(self):
        first = e.engine_sha256()
        original = pathlib.Path.read_bytes

        def refuse(self):
            raise OSError('read after start-up')
        pathlib.Path.read_bytes = refuse
        try:
            self.assertEqual(e.engine_sha256(), first)
            self.assertEqual(e.calculate(BUS)['engineSha256'], first)
        finally:
            pathlib.Path.read_bytes = original

    def test_zip_table_is_loaded_only_by_methods_that_need_it(self):
        code = ('import json, scope3_engine as e;'
                f'w = e.calculate({LANDFILL!r}); a = e._ZIPS is None;'
                f't = e.calculate({LOSSES!r}); print(json.dumps([a, e._ZIPS is None, w["status"], t["status"]]))')
        p = subprocess.run([sys.executable, '-c', code], cwd=HERE, capture_output=True)
        self.assertEqual(json.loads(p.stdout), [True, False, 'complete', 'complete'])

    def test_a_bad_zip_table_stops_only_the_methods_that_need_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'apps/site-api/src/calculation').mkdir(parents=True)
            shutil.copytree(REF, root / 'packages/neuvetra-database/src/method-reference')
            engine = root / 'apps/site-api/src/calculation/scope3_engine.py'
            shutil.copy(HERE / 'scope3_engine.py', engine)
            z = root / 'packages/neuvetra-database/src/method-reference/egrid2023-zip-subregion-utility.csv'
            z.write_bytes(z.read_bytes().replace(b'94105', b'94106', 1))
            self.assertEqual(cli({'action': 'describe'}, engine=str(engine))[0], 0)
            self.assertEqual(cli({'action': 'catalog'}, engine=str(engine))[0], 0)
            code, out = cli({'action': 'calculate', 'request': LANDFILL}, engine=str(engine))
            self.assertEqual((code, out['result']['total']['display']), (0, '1160.0000'))
            self.assertEqual(cli({'action': 'calculate', 'request': LOSSES}, engine=str(engine)), (2, {'status': 'error', 'code': 'scope3_engine_unavailable'}))
            code, out = cli({'action': 'calculate_many', 'requests': [LANDFILL, LOSSES]}, engine=str(engine))
            self.assertEqual([i['status'] for i in out['results']], ['ok', 'error'])

    def test_register_map(self):
        # I-03 adds R2 ('spend'), I-05 R3 ('supplement'); their own checks are in scope3_engine_purchases_test and
        # scope3_engine_energy_partner_test.
        self.assertEqual(sorted(e.REGISTERS), ['building_hotel', 'main', 'spend', 'supplement', 'us_upstream'])  # I-12u: R5; I-12h: R6
        self.assertEqual((e.REGISTERS['main']['sha256'], e.REGISTERS['main']['path'].name), (e.REGISTER_SHA256, 'verified-scope3-register-2025.json'))
        # Every R1 key and constant resolves to the main register; later registers are chosen by key prefix.
        self.assertEqual({e.register_for_key(x['id']) for x in REG['entries'] + REG['constants']}, {'main'})
        for key, name in (('epa_scghg_v130.111130.with_margins', 'spend'), ('price_index.gdp_deflator.2024', 'spend'), ('hub2025_t1.propane.co2', 'supplement'),
                          ('hub2025_gwp.r_410a', 'supplement'), ('egrid2023_us.co2', 'supplement'), ('egrid2023_hi.CAMX.GAS', 'supplement'),
                          ('egrid2023_gen.CAMX', 'supplement'), ('supplement_const.therm_to_mmbtu', 'supplement'), ('netl2024_4862.ng_upstream.prod_through_transmission', 'us_upstream'),
                          ('cagreet3_lut2018.ulsd.upstream', 'us_upstream'), ('carb_lcfs.energy_density.ulsd', 'us_upstream'), ('us_upstream_const.mj_per_mmbtu', 'us_upstream'),
                          ('cbecs2018.electricity_kwh_per_sqft.office', 'building_hotel'), ('epa_events2018.hotel.upscale.electricity_kwh_per_room_night', 'building_hotel'),
                          ('egrid2023.CAMX.co2', 'main'), ('egrid2023_ggl.western', 'main')):
            self.assertEqual(e.register_for_key(key), name, key)
        # Every later register is pinned (R2 since I-03, R3 since I-05, R5 since I-12u, R6 since I-12h) and read by its key
        # prefix, and R3's constants are routed by their prefix (I-01 follow-up).
        self.assertEqual(e.factor('epa_scghg_v130.111130.with_margins', {}), Decimal('0.848'))
        self.assertEqual(e.factor('hub2025_t1.propane.co2', {}), Decimal('62.87'))
        self.assertEqual(e.constant('supplement_const.therm_to_mmbtu', {}), Decimal('0.1'))
        self.assertEqual(e.factor('netl2024_4862.ng_upstream.prod_through_transmission', {}), Decimal('7.8'))  # I-12u: R5 is pinned
        self.assertEqual(e.factor('cbecs2018.electricity_kwh_per_sqft.office', {}), Decimal('13.6'))  # I-12h: R6 pinned

    def test_duplicate_register_ids_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'r.json'
            reg = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
            reg['entries'].append(dict(reg['entries'][0]))
            raw = json.dumps(reg).encode('utf-8')
            path.write_bytes(raw)
            import hashlib
            with patched(e.REGISTERS, {'dup': {'path': path, 'sha256': hashlib.sha256(raw).hexdigest()}}):
                with self.assertRaises(RuntimeError):
                    e._read_register('dup')
            with patched(e.REGISTERS, {'dup': {'path': path, 'sha256': '0' * 64}}):
                with self.assertRaises(RuntimeError):
                    e._read_register('dup')

    def test_method_metadata(self):
        d = e.describe()
        # The release contract (0024 register_method_version) takes exactly these keys, so the metadata sits beside them.
        for m in d['methods']:
            self.assertEqual(set(m) - {'factorValues', 'factorCells', 'constantValues'}, {'id', 'profileId', 'scope', 'family', 'title', 'formula', 'enginePath', 'engineSha256', 'registerSha256',
                                                                       'gwpSetId', 'admissionRules', 'estimateRules', 'reportingPeriod', 'factorKeys', 'constantIds'})
        meta = d['methodMetadata']
        dist = {'technological': 'fair', 'temporal': 'very_good', 'geographical': 'good', 'completeness': 'good', 'reliability': 'good'}
        expected = {
            'scope3.cat3.td_losses.egrid2023.v1': {'technological': 'good', 'temporal': 'very_good', 'geographical': 'good', 'completeness': 'good', 'reliability': 'good'},
            'scope3.cat4_9.transport_distance.v1': dist, 'scope3.cat6.business_travel_distance.v1': dist, 'scope3.cat7.employee_commuting_distance.v1': dist,
            'scope3.cat5_12.waste.v1': {'technological': 'fair', 'temporal': 'good', 'geographical': 'good', 'completeness': 'fair', 'reliability': 'good'},
        }
        # The five existing methods (I-01); the I-03 methods are checked in scope3_engine_purchases_test, the I-05 methods in
        # scope3_engine_energy_partner_test, the I-07 methods in scope3_engine_downstream_test.
        self.assertEqual(sorted(meta), sorted(list(expected) + ['scope3.spend.epa_scghg_v1_3.v1', 'scope3.cat1_2.supplier_specific.v1', 'scope3.cat1_2.average_data_user_factor.v1',
                                                                'scope3.cat3d.energy_resold.egrid2023.v1', 'scope3.cat7.commuting_average.v1', 'scope3.cat7.teleworking.v1',
                                                                'scope3.asset_energy.v1', 'scope3.partner_reported.v1',
                                                                'scope3.cat11.sold_fuel.hub2025.v1', 'scope3.cat11.sold_energy_product.v1', 'scope3.cat11.sold_ghg_product.hub2025.v1',
                                                                'scope3.cat12.end_of_life_split.v1', 'scope3.cat15.investment_reported.v1',
                                                                'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1',
                                                                # I-12u (checked in scope3_engine_upstream_us_test)
                                                                'scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1', 'scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1',
                                                                'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1',
                                                                # I-12h (checked in scope3_engine_hotel_building_test).
                                                                'scope3.cat6.hotel_stay.epa2018_events.v1', 'scope3.cat8_13_14.building_average.cbecs2018.v1']))
        for mid, dq in expected.items():
            m = meta[mid]
            self.assertEqual((m['methodType'], m['activityDataOrigin'], m['defaultDataQuality']['indicators'], m['additionalRegisters']),
                             ('activity_average_data', 'company_records', dq, []), mid)
            self.assertEqual(sorted(m['defaultDataQuality']['rationale']), sorted(dq))
            self.assertTrue(all(len(t) > 20 for t in m['defaultDataQuality']['rationale'].values()))
            self.assertEqual(m['biogenicTreatment'], 'not_in_factor' if mid == 'scope3.cat5_12.waste.v1' else 'none_expected')
        self.assertEqual(d['additionalRegisterSha256s'], {'building_hotel': e.BUILDING_HOTEL_REGISTER_SHA256, 'spend': e.SPEND_REGISTER_SHA256, 'supplement': e.SUPPLEMENT_REGISTER_SHA256, 'us_upstream': e.US_UPSTREAM_REGISTER_SHA256})


@contextlib.contextmanager
def patched(target: dict, extra: dict):
    """Test-only: adds entries to an engine table for the duration of a test, then restores it exactly."""
    saved = dict(target)
    target.update(extra)
    try:
        yield
    finally:
        target.clear()
        target.update(saved)


def fake_method(mid: str, method_type: str, origin: str, extras=()):
    meta = {'profileId': mid, 'family': 'test', 'kind': mid, 'gwpSetId': 'AS-REPORTED', 'title': 'test only', 'formula': 'test only', 'factorKeys': lambda: [],
            'constantIds': [], 'admissionRules': [], 'estimateRules': [], 'methodType': method_type, 'activityDataOrigin': origin,
            'defaultDataQuality': {'indicators': {'technological': 'very_good', 'temporal': 'good', 'geographical': 'very_good', 'completeness': 'good', 'reliability': 'fair'},
                                   'rationale': {k: 'test only rationale, not a real method' for k in ('technological', 'temporal', 'geographical', 'completeness', 'reliability')}},
            'biogenicTreatment': 'as_reported', 'additionalRegisters': [], 'resultExtras': tuple(extras)}

    def calculator(inp):
        e.require_keys(inp, {'period', 'quantity'}, {'biogenic', 'memo'})
        q = e.quantity(inp['quantity'], 'invalid_quantity')
        kwargs = {}
        if 'biogenic' in inp:
            kwargs['biogenic_co2'] = {'mass': e.exact(e.quantity(inp['biogenic'], 'invalid_quantity')), 'massUnit': 'kg CO2', 'basis': 'test'}
        if 'memo' in inp:
            kwargs['memo_items'] = [{'code': 'projected_lifetime_emissions', 'kg': e.exact(e.quantity(inp['memo'], 'invalid_quantity')), 'unit': 'kg CO2e', 'reportedSeparately': True}]
        return e._result(mid, 1, inp, {}, status='complete', co2e_only={'co2e': e.exact(q), 'co2eUnit': 'kg CO2e', 'gwpSetId': 'AS-REPORTED', 'reason': 'test'}, **kwargs)
    return meta, calculator


@contextlib.contextmanager
def fake_methods(*specs):
    methods, calculators, kinds = {}, {}, {}
    for mid, mt, origin, extras in specs:
        meta, fn = fake_method(mid, mt, origin, extras)
        methods[mid], calculators[mid], kinds[mid] = meta, fn, mid
    with patched(e.METHODS, methods), patched(e.CALCULATORS, calculators), patched(e.KIND_METHOD, kinds):
        yield


class AggregateV2(unittest.TestCase):
    def test_existing_keys_are_kept_and_profiles_are_added(self):
        results = [calc(r) for r in (LOSSES, BUS, AIR, LANDFILL, NA_WASTE)]
        a = e.aggregate(results)
        self.assertTrue({'categorySubtotals', 'knownSourceSubtotal', 'includedResults', 'notCalculated', 'partialBoundaryResults', 'gwpSetSubtotals', 'gwpSetsUsed',
                         'mixedGwpSets', 'resultCount', 'allCalculated', 'complete', 'profile', 'engineSha256', 'registerSha256'}.issubset(a))
        self.assertEqual(set(a) - {'categorySubtotals', 'knownSourceSubtotal', 'includedResults', 'notCalculated', 'partialBoundaryResults', 'gwpSetSubtotals', 'gwpSetsUsed',
                                   'mixedGwpSets', 'resultCount', 'allCalculated', 'complete', 'profile', 'engineSha256', 'registerSha256', 'aggregateSha256'},
                         {'additionalRegisterSha256s', 'categoryProfiles', 'boundaryClosures'})  # I-12u: boundaryClosures
        self.assertEqual(a['additionalRegisterSha256s'], {'building_hotel': e.BUILDING_HOTEL_REGISTER_SHA256, 'spend': e.SPEND_REGISTER_SHA256, 'supplement': e.SUPPLEMENT_REGISTER_SHA256, 'us_upstream': e.US_UPSTREAM_REGISTER_SHA256})  # every pinned register other than R1 (I-03: R2; I-05: R3; I-12u: R5; I-12h: R6)
        self.assertEqual(sorted(a['categoryProfiles']), ['3', '5', '6'])
        self.assertEqual(e.aggregate(results, [NONE] * 5), a)

    def test_category_profile_hand_computed(self):
        bus = hub_co2e(F(1000), 'travel.bus.passenger_mile')
        air = hub_co2e(F(4950), 'travel.air_travel_long_haul_2300_miles.passenger_mile')
        self.assertEqual((text(bus), text(air)), ('66.6323', '813.75426'))
        sub = bus + air
        results = [calc(BUS), calc(AIR), calc(LANDFILL), calc(NA_WASTE)]
        notes = [{'dataQuality': {'technological': 'poor', 'temporal': None, 'geographical': None, 'completeness': None, 'reliability': None}, 'activityDataOrigin': None},
                 {'dataQuality': None, 'activityDataOrigin': 'value_chain_partner'}, NONE, {'dataQuality': None, 'activityDataOrigin': 'estimate'}]
        p = e.aggregate(results, notes)['categoryProfiles']
        six = p['6']
        self.assertEqual(six['subtotalTonnes'], {'display': '0.880', 'unit': 't CO2e', 'rounding': 'half_even_3dp_once'})
        self.assertEqual((six['results'], six['methodTypes'], six['dominantMethodType']), (2, {'activity_average_data': kg(sub)}, 'activity_average_data'))
        share = air * 100 / sub
        self.assertEqual(six['valueChain'], {'numerator': kg(air), 'denominator': kg(sub), 'percent': {'value': text(r12(share)), 'display': fixed(share, 1)}})
        self.assertEqual(six['valueChain']['percent']['display'], '92.4')
        # Defaults for distance methods: T fair(3) Ti very_good(1) G good(2) C good(2) R good(2); the bus record overrides T to poor(4).
        t = (bus * 4 + air * 3) / sub
        dq = six['dataQuality']
        self.assertEqual(dq['indicators']['technological'], {'ratingKg': {'fair': kg(air), 'poor': kg(bus)}, 'score': {'value': text(r12(t)), 'display': fixed(t, 2)}})
        self.assertEqual(dq['indicators']['temporal'], {'ratingKg': {'very_good': kg(sub)}, 'score': {'value': '1', 'display': '1.00'}})
        for ind in ('geographical', 'completeness', 'reliability'):
            self.assertEqual(dq['indicators'][ind], {'ratingKg': {'good': kg(sub)}, 'score': {'value': '2', 'display': '2.00'}})
        overall = (t + 1 + 2 + 2 + 2) / 5
        self.assertEqual(dq['overall'], {'score': {'value': text(r12(overall)), 'display': fixed(overall, 2)}, 'label': 'good'})
        self.assertEqual(dq['overrides'], 1)
        self.assertEqual((six['biogenicCo2'], six['memoItems']), (None, {}))
        # Waste defaults T fair(3) Ti good(2) G good(2) C fair(3) R good(2): overall 12/5 = 2.4, good; nothing from partners.
        five = p['5']
        self.assertEqual((five['results'], five['dataQuality']['overall'], five['dataQuality']['overrides']), (1, {'score': {'value': '2.4', 'display': '2.40'}, 'label': 'good'}, 0))
        self.assertEqual(five['valueChain'], {'numerator': kg(F(0)), 'denominator': kg(F(1160)), 'percent': {'value': '0', 'display': '0.0'}})
        self.assertEqual(five['subtotalTonnes']['display'], '1.160')

    def test_zero_totals_are_counted_not_weighted(self):
        zero = calc(ZERO_WASTE)
        self.assertEqual(zero['total']['unrounded'], '0')
        p = e.aggregate([zero])['categoryProfiles']['12']
        self.assertEqual((p['results'], p['subtotalTonnes']['display'], p['valueChain']['percent']), (1, '0.000', None))
        self.assertEqual(p['dataQuality']['indicators']['technological'], {'ratingKg': {'fair': kg(F(0))}, 'score': None})
        self.assertEqual(p['dataQuality']['overall'], {'score': None, 'label': None})
        both = e.aggregate([zero, calc({'kind': 'waste', 'input': dict(ZERO_WASTE['input'], quantity='2')})])['categoryProfiles']['12']
        self.assertEqual((both['results'], both['dataQuality']['indicators']['completeness']['score']), (2, {'value': '3', 'display': '3.00'}))

    def test_method_types_origins_ties_biogenic_and_memo_items(self):
        with fake_methods(('test.sup', 'supplier_specific', 'value_chain_partner', ('biogenicCo2', 'memoItems')), ('test.spend', 'spend_based', 'company_records', ())):
            sup = e.calculate({'kind': 'test.sup', 'input': {'period': P, 'quantity': '100', 'biogenic': '5.5', 'memo': '7'}})
            sup2 = e.calculate({'kind': 'test.sup', 'input': {'period': P, 'quantity': '0.25', 'biogenic': '0.125'}})
            spend = e.calculate({'kind': 'test.spend', 'input': {'period': P, 'quantity': '100.25'}})
            self.assertEqual((sup['biogenicCo2'], sup['memoItems'][0]['kg'], 'biogenicCo2' in spend), ({'mass': '5.5', 'massUnit': 'kg CO2', 'basis': 'test'}, '7', False))
            # Supplier origin is fixed: an annotation cannot make it company data. Spend origin is fixed too (A19, I-03).
            a = e.aggregate([sup, sup2, spend], [{'dataQuality': None, 'activityDataOrigin': 'company_records'}, NONE, NONE])
            p = a['categoryProfiles']['1']
            self.assertEqual(p['methodTypes'], {'supplier_specific': kg(F('100.25')), 'spend_based': kg(F('100.25'))})
            self.assertEqual(p['dominantMethodType'], 'supplier_specific')  # a tie: SUP before SPEND
            self.assertEqual(p['valueChain']['percent'], {'value': '50', 'display': '50.0'})
            self.assertEqual(p['biogenicCo2'], {'unrounded': '5.625', 'display': '5.6250', 'unit': 'kg CO2', 'rounding': 'half_even_4dp_once'})
            self.assertEqual(p['memoItems'], {'projected_lifetime_emissions': kg(F(7))})
            b = e.aggregate([sup, spend], [NONE, {'dataQuality': None, 'activityDataOrigin': 'value_chain_partner'}])['categoryProfiles']['1']
            share = F(100) * 100 / F('200.25')  # A19: the spend line's value_chain_partner annotation is ignored
            self.assertEqual(b['valueChain']['percent'], {'value': text(r12(share)), 'display': fixed(share, 1)})
            self.assertEqual(b['valueChain']['percent']['display'], '49.9')
            self.assertEqual(e.aggregate([spend, sup2])['categoryProfiles']['1']['dominantMethodType'], 'spend_based')
            # Both test-only methods default reliability to fair (3).
            self.assertEqual(p['dataQuality']['indicators']['reliability']['score'], {'value': '3', 'display': '3.00'})
            # A method that does not declare an extra may not emit it.
            with self.assertRaises(RuntimeError):
                e.calculate({'kind': 'test.spend', 'input': {'period': P, 'quantity': '1', 'biogenic': '1'}})
            # The aggregate still recomputes every result: a tampered biogenic mass is refused.
            body = {k: v for k, v in sup.items() if k != 'resultSha256'}
            body['biogenicCo2'] = dict(body['biogenicCo2'], mass='0')
            with self.assertRaises(e.Refused):
                e.aggregate([dict(body, resultSha256=e.digest(body))])

    def test_label_thresholds(self):
        self.assertEqual([e.dq_label(F(x)) for x in ('1', '1.5', '1.500000000001', '2.5', '2.6', '3.5', '3.51', '4')],
                         ['very_good', 'very_good', 'good', 'good', 'fair', 'fair', 'poor', 'poor'])

    def test_annotations_are_validated(self):
        results = [calc(BUS), calc(LANDFILL)]
        good_dq = {'technological': 'good', 'temporal': None, 'geographical': 'poor', 'completeness': 'fair', 'reliability': 'very_good'}
        e.aggregate(results, [{'dataQuality': good_dq, 'activityDataOrigin': 'estimate'}, NONE])
        for bad in ([NONE], [NONE] * 3, 'x', [NONE, None], [NONE, {}], [NONE, {'dataQuality': None}],
                    [NONE, dict(NONE, extra=1)], [NONE, {'dataQuality': None, 'activityDataOrigin': 'supplier'}],
                    [NONE, {'dataQuality': dict(good_dq, technological='excellent'), 'activityDataOrigin': None}],
                    [NONE, {'dataQuality': {k: v for k, v in good_dq.items() if k != 'reliability'}, 'activityDataOrigin': None}],
                    [NONE, {'dataQuality': dict(good_dq, basis='x'), 'activityDataOrigin': None}], [NONE, {'dataQuality': [], 'activityDataOrigin': None}]):
            with self.assertRaises(e.Refused) as ctx:
                e.aggregate(results, bad)
            self.assertEqual(ctx.exception.code, 'invalid_annotation', bad)
        code, out = cli({'action': 'aggregate', 'results': results, 'annotations': [NONE, NONE]})
        self.assertEqual((code, out['aggregate']), (0, e.aggregate(results)))
        self.assertEqual(cli({'action': 'aggregate', 'results': results, 'annotations': [NONE]}), (1, {'status': 'refused', 'code': 'invalid_annotation'}))
        self.assertEqual(cli({'action': 'aggregate', 'results': results, 'annotations': None}), (1, {'status': 'refused', 'code': 'invalid_annotation'}))
        self.assertEqual(cli({'action': 'aggregate', 'results': results, 'notes': []}), (1, {'status': 'refused', 'code': 'invalid_input_shape'}))

    def test_worst_case_aggregate_at_the_line_cap_fits_the_request_cap(self):
        # Round 2b integration (DESIGN 13.7): the results route sends every calculated line of a run (at most
        # MAX_SCOPE3_LINES, read from the route) to `aggregate` in one request, with one annotation each. Until round 2 the
        # largest result was a ten-mode average commuting profile with every number at its longest. Round 3 (lane A, owner
        # decision 2) adds the coal screening memo (two memo items, its two registered inputs and lb_to_kg), the GWP basis per
        # term and the solar-thermal memo to the upstream grid lines, so the largest grid line in a coal region is now larger
        # than the commuting profile: the worst case at the cap is a run of whichever is larger. It must fit the 64 MiB cap
        # with headroom, while being over the old 16 MiB cap that made results unavailable from about 880 electricity records.
        routes = (HERE.parent / 'workspace' / 'scope3-results-routes.ts').read_text('utf-8')
        cap = int(re.search(r'^export const MAX_SCOPE3_LINES = (\d+)$', routes, re.M).group(1))
        self.assertEqual(cap, 3000)
        q = '999999999999.999'
        size = lambda v: len(json.dumps(v, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))
        vehicles = [m for m in e.COMMUTING_AVG_MODES if m != 'non_motorized' and e.TRAVEL_MODES[m][1] == 'vehicle']
        modes = (vehicles + [m for m in e.COMMUTING_AVG_MODES if m not in vehicles])[:10]

        def commuting(i):
            whole = str(999999999999 - i)
            profile = [{'mode': m, 'sharePercent': '10', 'oneWayDistance': q, 'distanceUnit': 'km', 'occupancy': '3.333' if m in vehicles else None} for m in modes]
            # A 2026 period adds the factor-vintage note (owner decision 1), so the line is a little larger than in 2025.
            return {'kind': 'commuting_average', 'input': {'period': {'start': '2026-01-01', 'endExclusive': '2027-01-01'}, 'headcount': whole + '.999', 'workingDays': 366, 'modes': profile}}
        largest = size(calc(commuting(0)))
        zips = e.zip_table()
        grid = {}  # per subregion, a ZIP that lists only it, with its longest utility id (none listed: no utility)
        for z, rows in sorted(zips.items()):
            for sub, utility in rows:
                utility = utility if re.fullmatch(r'[0-9]{1,7}', utility) else None
                if len({r[0] for r in rows}) == 1 and (sub not in grid or len(utility or '') > len(grid[sub][1] or '')):
                    grid[sub] = (z, utility)
        self.assertEqual(sorted(grid), sorted(e.SUBREGION_INTERCONNECT))
        worst_grid = None  # (size, kind, input) of the largest grid line
        for period in (P, {'start': '2026-01-01', 'endExclusive': '2027-01-01'}):
            us = {'period': period, 'quantity': q, 'unit': 'kWh', 'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None}
            requests = [{'kind': k, 'input': us} for k in ('energy_resold', 'energy_resold_upstream')]
            for sub, (z, utility) in grid.items():
                line = {'period': period, 'quantity': q, 'unit': 'kWh', 'subregion': sub, 'zip': z, 'utilityEiaId': utility}
                requests += [{'kind': k, 'input': line} for k in ('td_losses', 'td_losses_upstream', 'electricity_upstream')]
                requests.append({'kind': 'energy_resold_upstream', 'input': dict(us, gridBasis='subregion', zip=z, subregion=sub, utilityEiaId=utility)})
            other = [calc(r) for r in requests]
            self.assertTrue(all(r['status'] == 'complete' for r in other))
            for request, r in zip(requests, other):
                if worst_grid is None or size(r) > worst_grid[0]:
                    worst_grid = (size(r), request)
        print(f'\nlargest result: commuting profile {largest} bytes, grid line {worst_grid[0]} bytes ({worst_grid[1]["kind"]}, '
              f'{worst_grid[1]["input"].get("subregion") or "US"})', file=sys.stderr)
        if worst_grid[0] > largest:
            # 3,000 distinct grid lines of the largest kind and region, every quantity as long as the longest.
            results = [calc(dict(worst_grid[1], input=dict(worst_grid[1]['input'], quantity=str(999999999999 - i) + '.999'))) for i in range(cap)]
        else:
            results = [calc(commuting(i)) for i in range(cap)]
        self.assertEqual(len({r['resultSha256'] for r in results}), cap)
        note = {'dataQuality': {k: 'very_good' for k in e.DQ_INDICATORS}, 'activityDataOrigin': 'value_chain_partner'}
        raw = json.dumps({'action': 'aggregate', 'results': results, 'annotations': [note] * cap}, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        print(f'\nworst-case aggregate request at the line cap: {len(raw)} bytes', file=sys.stderr)
        self.assertGreater(len(raw), 16 * 1024 * 1024)
        self.assertLess(len(raw), e.MAX_REQUEST_BYTES * 2 // 3)  # headroom: at least a third of the cap is left
        code, out = cli(None, raw=raw)
        self.assertEqual((code, out['status'], out['aggregate']['resultCount'], len(out['aggregate']['includedResults'])), (0, 'ok', cap, cap))
        # The subtotal is the exact sum of the lines' unrounded totals, rounded once (independent of the engine's sum).
        with localcontext() as ctx:
            ctx.prec = 200
            exact = sum((Decimal(r['total']['unrounded']) for r in results), Decimal(0))
            category = str(results[0]['category'])
            self.assertEqual(out['aggregate']['categorySubtotals'][category]['display'], str(exact.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN)))

    def test_up_to_6000_results(self):
        bus = calc(BUS)
        self.assertEqual(e.aggregate([bus] * 5001)['resultCount'], 5001)
        with self.assertRaises(e.Refused) as ctx:
            e.aggregate([bus] * 6001)
        self.assertEqual(ctx.exception.code, 'invalid_aggregate')


if __name__ == '__main__':
    unittest.main()
