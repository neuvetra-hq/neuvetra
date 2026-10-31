"""Scope 3 completion I-12h: hotel stays (category 6) and buildings by floor area (categories 8, 13 and 14) from U.S. free
sources; register R6 and its builder (DESIGN 13.1, 13.2, A14, A27).

Expected values never come from the engine: every figure below is exact `Fraction` arithmetic on the register cells it
cites (R6 EPA events guidance 2018 Table 5 and CBECS 2018 C14/C24 rows, R3 eGRID2023 rev2 US23 U3:W3, Hub 2025 Table 1
row 38 natural gas and `supplement_const.sqft_per_m2`, R1 eGRID SRL23 rows and AR5 GWPs), read from the register JSON files
here, with the 12 dp half-even rounding of the one listed division done independently.
The builder test rebuilds R6 from the committed transcription files and compares bytes, and shows that a tampered quote, a
tampered file and swapped Table 5 columns each stop the build. Run: python -m unittest scope3_engine_hotel_building_test
"""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from decimal import Decimal, localcontext
from fractions import Fraction as F
from pathlib import Path

import scope3_engine as e

P = {'start': '2025-01-01', 'endExclusive': '2026-01-01'}
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
REF = ROOT / 'packages/neuvetra-database/src/method-reference'
R6_PATH = REF / 'verified-scope3-us-building-hotel-register-2025.json'
R6_RAW = R6_PATH.read_bytes()
V6 = {x['id']: x for x in json.loads(R6_RAW.decode('utf-8'))['entries']}
SIDECAR = json.loads((REF / 'verified-scope3-us-building-hotel-register-2025.provenance.json').read_text('utf-8'))  # round 2 (ENG-8)
R3 = json.loads((REF / 'verified-scope3-supplement-register-2025.json').read_text('utf-8'))
V3, C3 = {x['id']: x for x in R3['entries']}, {x['id']: x for x in R3['constants']}
R1 = json.loads((REF / 'verified-scope3-register-2025.json').read_text('utf-8'))
V1, C1 = {x['id']: x for x in R1['entries']}, {x['id']: x for x in R1['constants']}
SOURCES = ROOT / 'tools/method-reference/sources'
TRANSCRIPTIONS = [SOURCES / 'us-upstream-transcriptions.json', SOURCES / 'us-upstream-transcriptions-2.json']
BUILDER_PATH = ROOT / 'tools/method-reference/build_scope3_us_building_hotel_register.py'
HOTEL, BUILDING = 'scope3.cat6.hotel_stay.epa2018_events.v1', 'scope3.cat8_13_14.building_average.cbecs2018.v1'
GASES = ('co2', 'ch4', 'n2o')
GWP = {g: F(V1[f'gwp_ar5.{g.upper()}']['value']) for g in GASES}
LB, G_TO_KG, KWH_TO_MWH = F(C1['lb_to_kg']['value']), F(C1['g_to_kg']['value']), F(C1['kwh_to_mwh']['value'])


def cell(v: dict, key: str) -> F:
    return F(v[key]['value'])


def builder():
    spec = importlib.util.spec_from_file_location('build_r6', BUILDER_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def round12(q: F) -> F:
    return F(round(q * 10 ** 12), 10 ** 12)  # Python rounds a Fraction half-even


def display(q: F) -> str:
    return format(Decimal(round(q * 10 ** 4)).scaleb(-4), '.4f')


def electricity_kg(mwh: F, rates: str) -> dict:
    """kg per gas of `mwh` at an eGRID rate set: 'US' (R3 US23 U3:W3) or a subregion (R1 SRL23)."""
    return {g: mwh * (cell(V3, f'egrid2023_us.{g}') if rates == 'US' else cell(V1, f'egrid2023.{rates}.{g}')) * LB for g in GASES}


def gas_kg(mmbtu: F) -> dict:
    """kg per gas of natural gas (Hub 2025 Table 1 row 38: kg CO2, g CH4 and g N2O per MMBtu)."""
    return {g: mmbtu * cell(V3, f'hub2025_t1.natural_gas.{g}') * (1 if g == 'co2' else G_TO_KG) for g in GASES}


def co2e(*parts: dict) -> F:
    return sum((sum(p[g] for p in parts) * GWP[g] for g in GASES), F(0))


def hotel(nights: str, basis: str = 'stated', country='US') -> dict:
    return {'kind': 'hotel_stay', 'input': {'period': P, 'roomNights': nights, 'country': country, 'countryBasis': basis}}


def building(**over) -> dict:
    inp = {'period': P, 'category': 8, 'cbecsActivity': 'office', 'usesNaturalGas': 'yes', 'area': '10000', 'areaUnit': 'sqft', 'coveredDays': 365,
           'gridBasis': 'us_average', 'zip': None, 'subregion': None, 'utilityEiaId': None}
    inp.update(over)
    return {'kind': 'building_average', 'input': inp}


class RegisterAndBuilder(unittest.TestCase):
    def test_builder_rebuilds_the_committed_register_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'r6.json'
            builder().main([str(p) for p in TRANSCRIPTIONS] + [str(out)])
            self.assertEqual(out.read_bytes(), R6_RAW)
            # Round 2 (ENG-8): the provenance sidecar is rebuilt byte for byte too.
            self.assertEqual((Path(tmp) / 'r6.provenance.json').read_bytes(), (REF / 'verified-scope3-us-building-hotel-register-2025.provenance.json').read_bytes())
        self.assertEqual(hashlib.sha256(R6_RAW).hexdigest(), e.BUILDING_HOTEL_REGISTER_SHA256)

    def test_a_tampered_quote_a_tampered_file_or_swapped_columns_stop_the_build(self):
        b = builder()
        values, files = b.load([str(p) for p in TRANSCRIPTIONS])
        b.build(values, files)  # the committed transcriptions build
        for tid, field, text in (('cbecs2018_c14.office.kwh_per_sqft', 'quote2', 'Office 234 13.5 6.9 6.1 10.1 15.7 $24.4 $1.42 $0.104'),
                                 ('epa_events2018_t5.upper_upscale.electricity', 'quote1', 'Upper upscale 44 0.122'),
                                 ('cbecs2018_c24.service.cf_per_sqft', 'agreed', False)):
            bad = dict(values, **{tid: dict(values[tid], **{field: text})})
            with self.assertRaises(AssertionError, msg=tid):
                b.build(bad, files)
        # Swapping Table 5's columns (electricity read as gas and the other way round) fails the CHP 2005 recomputation.
        swapped = dict(values)
        for c in b.HOTEL_CLASSES:
            el, ng = values[f'epa_events2018_t5.{c}.electricity'], values[f'epa_events2018_t5.{c}.natural_gas']
            swapped[el['id']], swapped[ng['id']] = dict(el, value=ng['value']), dict(ng, value=el['value'])
        with self.assertRaises(AssertionError):
            b.build(swapped, files)
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / TRANSCRIPTIONS[0].name
            copy.write_bytes(TRANSCRIPTIONS[0].read_bytes().replace(b'Office 234 13.6', b'Office 234 13.7', 1))
            with self.assertRaises(AssertionError):
                b.load([str(copy)])

    def test_register_shape_and_cells(self):
        reg = json.loads(R6_RAW.decode('utf-8'))
        self.assertEqual(sorted(reg), ['constants', 'entries', 'method', 'schema', 'source', 'verifiedBy'])
        self.assertEqual(len(reg['entries']), 38)  # 14 CBECS rows x 2 tables + 5 hotel classes x 2
        for x in reg['entries']:
            self.assertTrue({'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell'} <= set(x), x['id'])
            # Round 2 (ENG-8): the quotes are in the provenance sidecar, so every entry has 0024 keys only.
            self.assertNotIn('provenance', x)
            p = SIDECAR['entries'][x['id']]
            self.assertEqual((p['transcription'], p['transcriptionSha256']), ('webfetch_double_read', x['sourceSha256']))
            self.assertTrue(p['agreed'] and x['value'] in p['quote1'] and x['value'] in p['quote2'], x['id'])
            self.assertRegex(x['value'], e.FACTOR_TEXT)
        # Printed values (CBECS 2018 C14/C24 rows "Office" and "Service"; events guidance Table 5 "Upper upscale").
        self.assertEqual([V6[k]['value'] for k in ('cbecs2018.electricity_kwh_per_sqft.office', 'cbecs2018.natural_gas_cf_per_sqft.office',
                                                   'cbecs2018.electricity_kwh_per_sqft.service', 'cbecs2018.natural_gas_cf_per_sqft.service',
                                                   'epa_events2018.hotel.upper_upscale.electricity_kwh_per_room_night',
                                                   'epa_events2018.hotel.upper_upscale.natural_gas_mmbtu_per_room_night')],
                         ['13.6', '21.3', '7.2', '41.9', '45', '0.122'])
        check = {c['class']: c for c in reg['source']['hotelColumnCheck']}
        self.assertEqual((check['upper_upscale']['recomputedKwhPerRoomNight'], check['upper_upscale']['recomputedMmbtuPerRoomNight']), ('44.878082191781', '0.121517945205'))

    def test_engine_pins_and_routes_r6(self):
        self.assertEqual(e.REGISTERS['building_hotel'], {'path': R6_PATH, 'sha256': hashlib.sha256(R6_RAW).hexdigest()})
        for key in ('cbecs2018.electricity_kwh_per_sqft.office', 'epa_events2018.hotel.upscale.electricity_kwh_per_room_night'):
            self.assertEqual(e.register_for_key(key), 'building_hotel')
        self.assertEqual(e.factor('cbecs2018.natural_gas_cf_per_sqft.food_service', {}), Decimal('147.6'))
        self.assertEqual(e.describe()['additionalRegisterSha256s']['building_hotel'], e.BUILDING_HOTEL_REGISTER_SHA256)


class HotelStay(unittest.TestCase):
    def per_room_night(self) -> F:
        """kg CO2e of one available room-night of the upper-upscale class (R6 Table 5; R3 US23 and Hub row 38; R1 AR5)."""
        mwh = cell(V6, 'epa_events2018.hotel.upper_upscale.electricity_kwh_per_room_night') * KWH_TO_MWH
        mmbtu = cell(V6, 'epa_events2018.hotel.upper_upscale.natural_gas_mmbtu_per_room_night')
        return co2e(electricity_kg(mwh, 'US'), gas_kg(mmbtu))

    def test_r3_hotel_ten_room_nights_equal_ten_times_the_room_night_value(self):
        # The r3 feeds' hotel records: 10 room-nights, mode "hotel", no hotel country (the U.S. reporting location is used).
        r = e.calculate(hotel('10', 'reporting_location'))
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(F(r['total']['unrounded']), 10 * self.per_room_night())
        self.assertEqual(r['total']['display'], display(10 * self.per_room_night()))
        self.assertEqual(r['estimates'], ['hotel_country_from_reporting_location'])
        self.assertEqual(r['boundary'], {'minimumBoundary': 'met', 'notes': ['available_room_night_basis_no_occupancy_adjustment', 'hotel_class_not_collected_highest_intensity_used',
                                                                            'hotel_energy_data_2005_vintage', 'hotel_us_average_grid_rate', 'optional_hotel_stays_included']})
        self.assertEqual((r['methodVersionId'], r['category'], r['gwpSetId']), (HOTEL, 6, 'AR5-100'))
        self.assertEqual([x['name'] for x in r['additionalRegisters']], ['building_hotel', 'supplement'])

    def test_per_gas_and_stated_country(self):
        r = e.calculate(hotel('3.5'))
        mwh = F('3.5') * 45 * KWH_TO_MWH
        mmbtu = F('3.5') * F('0.122')
        el, ng = electricity_kg(mwh, 'US'), gas_kg(mmbtu)
        for g in GASES:
            self.assertEqual(F(r['gases'][g]['mass']), el[g] + ng[g], g)
            self.assertEqual(F(r['gases'][g]['co2e']), (el[g] + ng[g]) * GWP[g], g)
        self.assertEqual(r['estimates'], [])
        self.assertEqual(r['activity'], {'roomNights': '3.5', 'hotelClass': 'upper_upscale', 'country': 'US', 'electricityMwh': '0.1575', 'naturalGasMmbtu': '0.427'})
        self.assertEqual(r['conversions'], [])

    def test_refusals(self):
        for bad, code in ((hotel('10', country='GB'), 'hotel_country_not_in_factor_set'), (hotel('10', basis='guess'), 'invalid_country_basis'),
                          (hotel('-1'), 'invalid_quantity'), (hotel('1.2345'), 'invalid_quantity')):
            with self.assertRaises(e.Refused) as x:
                e.calculate(bad)
            self.assertEqual(x.exception.code, code)
        with self.assertRaises(e.Refused):
            e.calculate({'kind': 'hotel_stay', 'input': {'period': P, 'roomNights': '1', 'country': 'US'}})


class BuildingAverage(unittest.TestCase):
    def test_office_us_average_with_gas(self):
        r = e.calculate(building())
        sqft, share = F(10000), F(1)
        mwh = sqft * share * cell(V6, 'cbecs2018.electricity_kwh_per_sqft.office') * KWH_TO_MWH
        mmbtu = sqft * share * cell(V6, 'cbecs2018.natural_gas_cf_per_sqft.office') * cell(V3, 'hub2025_t1.natural_gas.heat_content')
        self.assertEqual(F(r['total']['unrounded']), co2e(electricity_kg(mwh, 'US'), gas_kg(mmbtu)))
        self.assertEqual(r['total']['display'], display(co2e(electricity_kg(mwh, 'US'), gas_kg(mmbtu))))
        self.assertEqual(r['estimates'], ['building_us_average_grid_rate', 'cbecs_activity_average_intensity'])
        self.assertEqual(r['boundary']['notes'], ['building_other_energy_sources_not_included', 'cbecs_2018_us_national_average', 'cbecs_cubic_feet_treated_as_standard_scf',
                                                  'conditional_gas_intensity', 'location_based_grid_rates'])

    def test_m2_part_year_subregion_without_gas(self):
        # 1,200.5 m2 of retail (other than mall) in CAMX (ZIP 94105), 200 of 365 days, no natural gas.
        r = e.calculate(building(category=13, cbecsActivity='retail_non_mall', usesNaturalGas='no', area='1200.5', areaUnit='m2', coveredDays=200,
                                 gridBasis='subregion', zip='94105', subregion='CAMX'))
        sqft = F('1200.5') * F(C3['supplement_const.sqft_per_m2']['value'])
        share = round12(F(200, 365))
        self.assertEqual(r['conversions'][0]['result'], '0.547945205479')
        mwh = sqft * share * cell(V6, 'cbecs2018.electricity_kwh_per_sqft.retail_other_than_mall') * KWH_TO_MWH
        expected = co2e(electricity_kg(mwh, 'CAMX'))
        self.assertEqual(F(r['total']['unrounded']), expected)
        self.assertEqual(r['total']['display'], display(expected))
        self.assertEqual((r['category'], r['activity']['naturalGasMmbtu'], r['estimates']), (13, None, ['cbecs_activity_average_intensity']))
        self.assertIn('building_uses_no_natural_gas', r['boundary']['notes'])
        self.assertNotIn('conditional_gas_intensity', r['boundary']['notes'])

    def test_every_contract_activity_maps_to_its_cbecs_row(self):
        for token, row in e.CBECS_ACTIVITY_ROWS.items():
            r = e.calculate(building(cbecsActivity=token, area='1000'))
            mwh = 1000 * cell(V6, f'cbecs2018.electricity_kwh_per_sqft.{row}') * KWH_TO_MWH
            mmbtu = 1000 * cell(V6, f'cbecs2018.natural_gas_cf_per_sqft.{row}') * cell(V3, 'hub2025_t1.natural_gas.heat_content')
            self.assertEqual(F(r['total']['unrounded']), co2e(electricity_kg(mwh, 'US'), gas_kg(mmbtu)), token)

    def test_holds_are_never_figures(self):
        r = e.calculate(building(usesNaturalGas='unknown'))
        self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['natural_gas_use_unknown'], None))
        r = e.calculate(building(gridBasis='subregion', zip='00000', subregion='CAMX'))
        self.assertEqual((r['status'], r['findings'], r['total']), ('review_required', ['zip_not_in_lookup'], None))
        # A contract token whose CBECS row is not registered (simulated by removing the service rows) is held, never zero.
        reg = e._register('building_hotel')
        trimmed = {'entries': {k: v for k, v in reg['entries'].items() if not k.endswith('.service')}, 'constants': reg['constants']}
        saved = e._LOADED_REGISTERS['building_hotel']
        e._LOADED_REGISTERS['building_hotel'] = trimmed
        try:
            r = e.calculate(building(cbecsActivity='service'))
            self.assertEqual((r['status'], r['findings'], r['total']), ('input_needed', ['cbecs_activity_not_loaded'], None))
            self.assertNotIn('service', e.catalog()['cbecsActivitiesLoaded'])
        finally:
            e._LOADED_REGISTERS['building_hotel'] = saved

    def test_refusals_and_days_in_year(self):
        for over, code in (({'category': 9}, 'invalid_category'), ({'cbecsActivity': 'church'}, 'unknown_cbecs_activity'), ({'usesNaturalGas': True}, 'invalid_natural_gas_use'),
                           ({'areaUnit': 'acre'}, 'unsupported_unit'), ({'coveredDays': 366}, 'invalid_covered_days'), ({'coveredDays': 0}, 'invalid_covered_days'),
                           ({'zip': '94105'}, 'invalid_input_shape'), ({'gridBasis': 'state'}, 'invalid_grid_basis')):
            with self.assertRaises(e.Refused, msg=over) as x:
                e.calculate(building(**over))
            self.assertEqual(x.exception.code, code)
        self.assertEqual([e._days_in_year({'start': f'{y}-01-01', 'endExclusive': f'{y + 1}-01-01'}) for y in (2024, 2025, 2028, 2100)], [366, 365, 366, 365])


class MetadataAndAggregate(unittest.TestCase):
    def test_metadata_catalog_and_aggregate(self):
        d = e.describe()
        meta = d['methodMetadata']
        self.assertEqual(meta[HOTEL]['defaultDataQuality']['indicators'], dict(zip(e.DQ_INDICATORS, ('poor', 'poor', 'good', 'fair', 'fair'))))
        self.assertEqual(meta[BUILDING]['defaultDataQuality']['indicators'], dict(zip(e.DQ_INDICATORS, ('poor', 'fair', 'good', 'fair', 'fair'))))
        self.assertEqual((meta[HOTEL]['activityDataOrigin'], meta[BUILDING]['activityDataOrigin']), ('company_records', 'estimate'))
        self.assertEqual(meta[BUILDING]['additionalRegisters'], ['building_hotel', 'supplement'])
        methods = {m['id']: m for m in d['methods']}
        self.assertEqual(methods[HOTEL]['factorValues']['epa_events2018.hotel.upper_upscale.electricity_kwh_per_room_night'], '45')
        self.assertIn('supplement_const.sqft_per_m2', methods[BUILDING]['constantIds'])
        cat = e.catalog()
        self.assertEqual((cat['hotelCountries'], cat['hotelClassUsed'], len(cat['cbecsActivitiesLoaded'])), (['US'], 'upper_upscale', 12))
        results = [e.calculate(hotel('10', 'reporting_location')), e.calculate(building()), e.calculate(building(category=14, usesNaturalGas='no'))]
        agg = e.aggregate(results)
        self.assertEqual(sorted(agg['categorySubtotals']), ['14', '6', '8'])
        # Round 2, owner decision 4: buildings by floor area are partial (other energy sources not counted), so not complete.
        self.assertFalse(agg['complete'])
        self.assertEqual(len(agg['partialBoundaryResults']), 2)
        self.assertEqual(agg['categoryProfiles']['8']['valueChain']['numerator']['unrounded'], '0')  # building origin defaults to estimate


if __name__ == '__main__':
    unittest.main()
