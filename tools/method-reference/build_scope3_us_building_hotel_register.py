"""Builds verified-scope3-us-building-hotel-register-2025.json (R6; Scope 3 completion I-12h, DESIGN section 13.1).

Usage: python3 build_scope3_us_building_hotel_register.py <us-upstream-transcriptions.json> [<us-upstream-transcriptions-2.json>] <out.json>
(also writes <out>.provenance.json beside it: the quotes and document facts of every entry, round 2 ENG-8)

The primary files (EIA CBECS 2018 Tables C14 and C24, the EPA events and conferences guidance of December 2018 and the
EPA CHP Partnership hotel report of December 2005) cannot be read programmatically in this environment, so every value
comes from the committed byte copies of the double-read WebFetch transcriptions in tools/method-reference/sources/
(DESIGN 13: hand transcriptions are allowed; each entry cites document, table, row and column and stores both quotes,
with `transcription: "webfetch_double_read"`). The builder pins the SHA-256 of each transcription file and asserts, for
every value it uses:
- the transcription says `agreed: true` (the printed value was the same in both reads);
- the printed value appears in both quotes, as a whole number token (whitespace normalised);
- for CBECS rows, the parsed row's per-square-foot column equals the value.
Hotel Table 5 (kWh and MMBtu per room-night by hotel class): the extracted table header is scrambled, so the column
order is resolved by repeating the cited source's arithmetic: CHP 2005 Table 16 (square feet per room) x Table 17
(Total column: kWh per sq ft per year, kBtu per sq ft) / 365 (and / 1000 for MMBtu), computed exactly, must round to
every printed Table 5 value at its printed decimals (0 for kWh, 3 for MMBtu), and the swapped column order must not.
Content: `cbecs2018.electricity_kwh_per_sqft.<row>` (C14) and `cbecs2018.natural_gas_cf_per_sqft.<row>` (C24) for every
transcribed principal building activity (conditional intensities: C24 averages only buildings that use natural gas), and
`epa_events2018.hotel.<class>.electricity_kwh_per_room_night` / `.natural_gas_mmbtu_per_room_night` for the five classes.
No constant is added (the engine reads unit constants from R1 and R3). Output sorted, byte-reproducible.

Register shape (round 2, ENG-8 and ACC-7): the 0024 loader's six top-level keys and, per entry, only keys the 0024 loader
accepts; `sourceSha256` names the transcription file the value was read from (the original the loader would require). The
quotes, transcription ids and document facts of each entry move to a sidecar, `<register>.provenance.json`, whose SHA-256
the register names (`source.provenanceSidecar`). `source.sha256` is the transcription file's hash (0024 compares it with the
register's source document); `source.url` is that file and `source.sha256Of` says so, so it is never read as a hash of the
EIA or EPA documents (listed in `source.documents`, not staged).
"""
import hashlib
import json
import re
import sys
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

# SHA-256 pins of the committed transcription files (byte copies of $S/s3/sources-extra/*.json, 2026-10-30).
TRANSCRIPTION_SHA256 = {
    'us-upstream-transcriptions.json': '1774e71e0b2cc7d2d29df9ca153956254b96e3f733ea35a34312ea03b4accaeb',
    'us-upstream-transcriptions-2.json': '0415bd7da90544ddf843161bddfba59cc225f2b6beecb21995052081318e0701',
}
SCHEMA = 'neuvetra.sources-extra.upstream-transcriptions/v1'
CBECS_ROWS = ('all_buildings', 'education', 'enclosed_and_strip_malls', 'food_sales', 'food_service', 'health_care', 'health_care_inpatient', 'health_care_outpatient',
              'lodging', 'mercantile', 'office', 'retail_other_than_mall', 'service', 'warehouse_and_storage')
HOTEL_CLASSES = ('upper_upscale', 'upscale', 'midscale_with_fb', 'midscale_without_fb', 'economy_budget')
DAYS = 365  # the CHP report's annual intensities are divided by 365 days in the events guidance (no occupancy adjustment)
NUMBER = re.compile(r'(?<![0-9.])([0-9]+(?:\.[0-9]+)?)(?![0-9])')


def tokens(text: str) -> list:
    return NUMBER.findall(' '.join(text.split()))


def check_value(v: dict, value: str) -> None:
    """Agreed in both reads; the printed value is a number token of both quotes."""
    assert v.get('agreed') is True, f"{v['id']}: the two reads did not agree"
    for q in ('quote1', 'quote2'):
        assert value in tokens(v[q]), f"{v['id']}: {value} does not appear in {q}"


def load(paths: list) -> tuple:
    values, files = {}, []
    for path in paths:
        raw = Path(path).read_bytes()
        name = Path(path).name
        sha = hashlib.sha256(raw).hexdigest()
        assert TRANSCRIPTION_SHA256.get(name) == sha, f'{name}: SHA-256 {sha} is not the pinned transcription file'
        doc = json.loads(raw.decode('utf-8'))
        assert doc['schema'] == SCHEMA, name
        for v in doc['values']:
            assert v['id'] not in values, 'duplicate transcription id ' + v['id']
            values[v['id']] = dict(v, _file=name, _sha=sha)
        files.append({'file': 'tools/method-reference/sources/' + name, 'sha256': sha, 'bytes': str(len(raw))})
    return values, files


def provenance(v: dict, ids: list) -> dict:
    return {'transcription': 'webfetch_double_read', 'transcriptionIds': ids, 'transcriptionFile': 'tools/method-reference/sources/' + v['_file'],
            'transcriptionSha256': v['_sha'], 'quote1': v['quote1'], 'quote2': v['quote2'], 'agreed': True, 'title': v['source_title'], 'publisher': v['publisher'],
            'edition': v['edition_date'], 'url': v['url'], 'licence': v['licence'], 'locator': v['locator']}


def fixed(q: Fraction, places: int) -> str:
    """Exact quotient rounded half-even to `places` decimals (Python's round on a Fraction is half-even)."""
    return format(Decimal(round(q * 10 ** places)).scaleb(-places), f'.{places}f')


def hotel_column_check(values: dict) -> list:
    """CHP 2005 Table 16 x Table 17 / 365 must reproduce every Table 5 value within its printed rounding, in the column
    order electricity (kWh) first, natural gas (MMBtu) second, and the swapped order must not."""
    out = []
    for c in HOTEL_CLASSES:
        t16 = values[f'chp2005_hotel.t16.{c}.sqft_per_room']
        t17 = values[f'chp2005_hotel.t17.{c}.total']
        sqft = t16['value']
        check_value(t16, sqft)
        m = re.fullmatch(r'Elec ([0-9.]+) kWh/sf/yr; Gas ([0-9.]+) kBtu/sf', t17['value'])
        assert m, t17['id']
        elec, gas = m.groups()
        check_value(t17, elec)
        check_value(t17, gas)
        e, g = values[f'epa_events2018_t5.{c}.electricity'], values[f'epa_events2018_t5.{c}.natural_gas']
        printed_kwh, printed_mmbtu = e['value'], g['value']
        check_value(e, printed_kwh)
        check_value(g, printed_mmbtu)
        kwh = Fraction(sqft) * Fraction(elec) / DAYS
        mmbtu = Fraction(sqft) * Fraction(gas) / 1000 / DAYS
        kwh_places = len(printed_kwh.split('.')[1]) if '.' in printed_kwh else 0
        mmbtu_places = len(printed_mmbtu.split('.')[1]) if '.' in printed_mmbtu else 0
        assert fixed(kwh, kwh_places) == printed_kwh, f'{c}: {fixed(kwh, 6)} kWh does not round to the printed {printed_kwh}'
        assert fixed(mmbtu, mmbtu_places) == printed_mmbtu, f'{c}: {fixed(mmbtu, 6)} MMBtu does not round to the printed {printed_mmbtu}'
        # The swapped reading (first column natural gas) is refuted by the same arithmetic.
        assert fixed(mmbtu, kwh_places) != printed_kwh and fixed(kwh, mmbtu_places) != printed_mmbtu, f'{c}: the swapped column order also fits'
        out.append({'class': c, 'sqftPerRoom': sqft, 'electricityKwhPerSqftYear': elec, 'naturalGasKbtuPerSqftYear': gas,
                    'recomputedKwhPerRoomNight': fixed(kwh, 12), 'printedKwhPerRoomNight': printed_kwh,
                    'recomputedMmbtuPerRoomNight': fixed(mmbtu, 12), 'printedMmbtuPerRoomNight': printed_mmbtu})
    return out


CBECS_TABLES = {
    'c14': ('electricity_kwh_per_sqft', 'kwh_per_sqft', 'per_sqft_kwh', 'kWh per square foot per year (2018; conditional: buildings that use electricity)',
            'Per square foot (kWh)'),
    'c24': ('natural_gas_cf_per_sqft', 'cf_per_sqft', 'per_sqft_cf', 'cubic feet of natural gas per square foot per year (2018; conditional: only buildings that use natural gas)',
            'Per square foot (cubic feet)'),
}
HOTEL_COLUMNS = {
    'electricity': ('electricity_kwh_per_room_night', 'kWh per available room-night', 'Electricity consumption (kWh per room per night), first numeric column'),
    'natural_gas': ('natural_gas_mmbtu_per_room_night', 'MMBtu per available room-night', 'Natural gas consumption (mmBtu per room per night), second numeric column'),
}


def build(values: dict, files: list) -> dict:
    entries = []
    for table, (key, suffix, parsed, unit, column) in CBECS_TABLES.items():
        for row in CBECS_ROWS:
            tid = f'cbecs2018_{table}.{row}.{suffix}'
            if tid not in values:
                continue  # an activity not transcribed is not registered (the adapter holds it method_pending)
            v = values[tid]
            check_value(v, v['value'])
            assert v['row_parsed'][parsed] == v['value'], f'{tid}: parsed row column differs from the value'
            entries.append({'id': f'cbecs2018.{key}.{row}', 'table': v['source_title'], 'sheet': v['url'].rsplit('/', 1)[1], 'valueCell': v['locator'], 'value': v['value'],
                            'unit': unit, 'labelCells': [v['locator'].split(', column')[0], column], 'label': f'{row.replace("_", " ")} (CBECS 2018 {table.upper()})',
                            'sourceSha256': v['_sha'], 'provenance': provenance(v, [tid])})
    for c in HOTEL_CLASSES:
        for col, (key, unit, column) in HOTEL_COLUMNS.items():
            tid = f'epa_events2018_t5.{c}.{col}'
            v = values[tid]
            check_value(v, v['value'])
            entries.append({'id': f'epa_events2018.hotel.{c}.{key}', 'table': 'Table 5 (hotel energy use per room-night by hotel class)', 'sheet': v['url'].rsplit('/', 1)[1],
                            'valueCell': f'{v["locator"]}; column order resolved by the CHP 2005 Tables 16 and 17 recomputation (source.hotelColumnCheck)', 'value': v['value'],
                            'unit': unit, 'labelCells': [v['locator'].split(',')[0], column], 'label': f'{c.replace("_", " ")} hotel, {col.replace("_", " ")} per room-night (EPA events guidance 2018)',
                            'sourceSha256': v['_sha'], 'provenance': provenance(v, [tid, f'chp2005_hotel.t16.{c}.sqft_per_room', f'chp2005_hotel.t17.{c}.total'])})
    for e in entries:
        assert re.fullmatch(r'(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,20})?', e['value']), e['id']
    guide = values['cbecs2018_guide.conditional_intensity']
    assert guide['agreed'] is True and 'conditional energy intensity' in guide['quote1'] and 'conditional energy intensity' in guide['quote2']
    entries = sorted(entries, key=lambda e: e['id'])
    sidecar = {'schema': 'neuvetra.verified-factor-register-provenance.v1', 'register': 'verified-scope3-us-building-hotel-register-2025.json',
               'entries': {e['id']: e.pop('provenance') for e in entries}}
    sidecar_bytes = render(sidecar)
    return {
        'schema': 'neuvetra.verified-factor-register.v1',
        'verifiedBy': 'Claude (lane C engineer, Scope 3 completion I-12h), 2026-10-30; built by tools/method-reference/build_scope3_us_building_hotel_register.py from the committed transcription files',
        'method': ('Register R6 for Scope 3 categories 6 (hotel stays) and 8, 13 and 14 (buildings by floor area). Hand transcriptions (DESIGN 13): each value was read twice '
                   'with WebFetch from the official document and both quotes agree; the builder asserts agreement, that the printed value appears in both quotes and, for '
                   'CBECS rows, the parsed per-square-foot column. EIA CBECS 2018 Table C14 (kWh per sq ft) and Table C24 (cubic feet of natural gas per sq ft) are '
                   'conditional intensities (EIA guide: "If the table title does not specify, energy intensity should be interpreted as conditional energy intensity"; '
                   'neither title specifies), so C24 averages only buildings that use natural gas. EPA, Greenhouse Gas Inventory Guidance: Indirect Emissions from Events '
                   'and Conferences (December 2018), Table 5: kWh and MMBtu per available room-night by hotel class, from the EPA CHP Partnership report CHP in the Hotel '
                   'and Casino Market Sectors (December 2005; the guidance cites it as December 2015) Table 16 x Table 17 / 365; the column order of Table 5 is resolved '
                   'by repeating that arithmetic exactly (source.hotelColumnCheck): every printed value is reproduced within its printed rounding and the swapped '
                   'order is not. The data are 2005-vintage and per available (not occupied) room-night. No value is derived or typed by hand.'),
        'source': {
            'publisher': 'U.S. Energy Information Administration (CBECS 2018); U.S. EPA Center for Corporate Climate Leadership (events guidance 2018); EPA CHP Partnership (2005)',
            'title': '2018 CBECS Tables C14 and C24; Greenhouse Gas Inventory Guidance: Indirect Emissions from Events and Conferences, Table 5',
            'edition': 'CBECS 2018 preliminary release September 2022, revised December 2022; events guidance December 2018; CHP hotel report December 2005; licence: U.S. Government works, public domain',
            'url': files[0]['file'],
            'sha256': files[0]['sha256'], 'bytes': files[0]['bytes'],
            'sha256Of': 'the transcription file named in url (Neuvetra double-read transcriptions), not the EIA or EPA documents, which are not staged (see documents)',
            'provenanceSidecar': {'file': 'verified-scope3-us-building-hotel-register-2025.provenance.json', 'sha256': hashlib.sha256(sidecar_bytes).hexdigest(),
                                  'bytes': str(len(sidecar_bytes))},
            'transcription': 'webfetch_double_read',
            'transcriptionFiles': files,
            'documents': [{'title': t, 'url': u} for t, u in sorted({(v['source_title'], v['url']) for v in values.values() if v['id'].startswith(('cbecs2018', 'epa_events2018', 'chp2005'))})],
            'conditionalIntensity': {'quote1': guide['quote1'], 'quote2': guide['quote2'], 'url': guide['url'], 'locator': guide['locator']},
            'hotelColumnCheck': hotel_column_check(values),
        },
        'constants': [],
        'entries': entries,
    }, sidecar_bytes


def render(register: dict) -> bytes:
    return (json.dumps(register, ensure_ascii=False, indent=2, sort_keys=False) + '\n').encode('utf-8')


def main(argv: list) -> None:
    *inputs, out = argv
    assert 1 <= len(inputs) <= 2, __doc__
    values, files = load(inputs)
    register, sidecar = build(values, files)
    assert out.endswith('.json'), out
    Path(out[:-len('.json')] + '.provenance.json').write_bytes(sidecar)
    Path(out).write_bytes(render(register))


if __name__ == '__main__':
    main(sys.argv[1:])
