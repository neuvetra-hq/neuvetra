"""Builds verified-scope3-us-upstream-register-2025.json (R5; Scope 3 completion I-12u, DESIGN 13.1) from the committed
transcription files.

Usage: python3 build_scope3_us_upstream_register.py <out.json> [<sources dir>]
(default sources dir: tools/method-reference/sources next to this file; also writes <out>.provenance.json beside <out>.json:
the record of every derived constant, round 2 lane F)

The sources are byte copies of the research transcriptions (`$S/s3/sources-extra/upstream-transcriptions*.json`): every
value there was read twice, verbatim, with WebFetch from the free official document (NETL, CARB, eCFR, EIA, EPA) because
the files themselves cannot be read programmatically in this environment (BRIEF: hand transcription allowed, citing page,
table and row). The builder pins both files by SHA-256 and, for every value it registers:
- asserts `agreed` (both reads printed the same value);
- asserts the printed text (the value, or for a statement its key phrase) appears in BOTH stored quotes, whitespace-normalised;
- keeps the source, URL, page/table/row, both quotes and the transcription method (`webfetch_double_read`) in the entry,
  using only the 0024 loader keys: `table` = publisher, title and edition; `sheet` = URL; `valueCell` = page/table/row and
  the transcription method; `labelCells` = the two quotes; `sourceSha256` = the transcription file read.
Derived values are computed with exact Decimal arithmetic and asserted:
- CA-GREET3.0 upstream (well-to-tank) per fuel = printed Total - printed Tailpipe; the printed component rows must sum to it
  within 0.01 (the table's own rounding: propane rows sum to 18.15, Total - Tailpipe = 18.16).
- NETL natural gas: F_dist = 8.8 g/MJ x 1055.05585262 MJ/MMBtu / 1000 = 9.284491503056 and F_trans = 7.8 x ... = 8.229435650436
  kg CO2e per MMBtu (HHV), exact (1 MMBtu = 10^6 International Table Btu = 1055.05585262 MJ).
- The CA-GREET3.0 GWP set is not stated by CARB; the builder repeats the research inference: the printed CA-GREET3.0
  supplemental Table 10/6 CH4+N2O CO2e values (2.56, 5.97, 0.93 g/MJ) are reproduced by AR4 (25, 298) and not by AR5 (28, 265).
- Liquids are registered for calculation only when the CA-GREET3.0 heating-value basis is a verified statement and every
  CARB LCFS energy density used is stated on that same basis (both LHV here: the MJ cancel, gallons x MJ/gal x g/MJ).
- Round 2, lane F (DESIGN 13.6, owner decision): coal upstream is a DERIVED, methane-only term from three printed official
  values of the same year (us-upstream-transcriptions-3.json): F_COAL = round12(EPA GHGI 1990-2022 coal mining CH4 2022
  (43.6 MMT CO2e, AR5) x 10^9 kg/MMT / (EIA 2022 coal production (594,155 thousand short tons) x 1000 x EIA 2022 coal
  production heat content (20.100 MMBtu/short ton, gross = HHV))) kg CO2e per MMBtu HHV, one half-even division to 12 dp.
  The register keeps 0024 loader keys only: the three inputs are entries, F_COAL and its two unit definitions are constants,
  and the derivation record (derived: true, inputs, formula, the division) goes to the provenance sidecar the register names
  (source.provenanceSidecar). No printed coal upstream factor and no oil-fired upstream value are registered (none exists in
  the transcriptions; oil-fired generation uses the ULSD proxy in the engine).
- Round 3, lane A (ROUND3.md owner decision 2): the two printed coal upstream cross-checks of -3.json (NPC 2011 Table 7 coal
  upstream combustion 5.0 lb CO2e/MMBtu, AR4; Abrahams et al. 2015 Table S7 coal upstream 12.2 g CO2e/MJ) are registered as
  entries for the engine's screening-range memo of the omitted coal mining energy and transport CO2 only (outside every
  total; older vintages, heating value not stated, a non-IPCC GWP in Abrahams). They never enter a figure.
The output is sorted, uses only the 0024 loader keys and is byte-reproducible from the same inputs.
"""
import hashlib
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction
from pathlib import Path

OUT = sys.argv[1]
SOURCES = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent / 'sources'
FILES = {
    'us-upstream-transcriptions.json': '1774e71e0b2cc7d2d29df9ca153956254b96e3f733ea35a34312ea03b4accaeb',
    'us-upstream-transcriptions-2.json': '0415bd7da90544ddf843161bddfba59cc225f2b6beecb21995052081318e0701',
    'us-upstream-transcriptions-3.json': 'fe96dddc44e7bda8cfa39f386b0b072c333d435d7e6c5e61fda4eeb9bc9a6aeb',  # round 2, lane F (coal, DESIGN 13.6)
}
TRANSCRIPTION = 'webfetch_double_read'
MJ_PER_MMBTU = Decimal('1055.05585262')  # International Table Btu = 1055.05585262 J (exact definition)

values: dict = {}
for name, sha in FILES.items():
    raw = (SOURCES / name).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == sha, name
    doc = json.loads(raw.decode('utf-8'))
    assert doc['schema'] == 'neuvetra.sources-extra.upstream-transcriptions/v1', name
    for v in doc['values']:
        assert v['id'] not in values, 'duplicate transcription id ' + v['id']
        values[v['id']] = dict(v, _file=name, _sha=sha, _bytes=len(raw))


def norm(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def checked(tid: str, printed: str | None = None) -> dict:
    """A transcription both reads agreed on, whose printed text is in both quotes."""
    v = values[tid]
    assert v['agreed'] is True, tid + ' not agreed'
    printed = v['value'] if printed is None else printed
    for q in ('quote1', 'quote2'):
        assert norm(printed) in norm(v[q]), f'{tid}: "{printed}" not in {q}'
    return v


entries: list = []


def add(rid: str, v: dict, value: str, unit: str, label: str, cell_extra: str = '', quotes=None) -> None:
    q = quotes if quotes is not None else [f"quote1: {v['quote1']}", f"quote2: {v['quote2']}"]
    entries.append({
        'id': rid,
        'table': f"{v['publisher']}: {v['source_title']} ({v['edition_date']}); licence: {v['licence']}",
        'sheet': v['url'],
        'valueCell': f"{v['locator']}{cell_extra} [transcription: {TRANSCRIPTION}; {v['_file']} id {v['id']}]",
        'value': value, 'unit': unit, 'labelCells': q, 'label': label, 'sourceSha256': v['_sha'],
    })


def plain(d: Decimal) -> str:
    t = format(d, 'f')
    return t.rstrip('0').rstrip('.') if '.' in t else t


# ---- NETL DOE/NETL-2024/4862: natural gas supply chain, HHV, IPCC AR6 100-year (as published). ----
netl = {}
for boundary in ('prod_through_distribution', 'prod_through_transmission'):
    tid = f'netl2024_4862.ng_upstream.{boundary}'
    v = checked(tid)
    assert v['basis']['heating_value'] == 'HHV' and 'AR6' in v['basis']['gwp_set'] and all('HHV' in v[q] and 'AR6' in v[q] for q in ('quote1', 'quote2')), tid
    netl[boundary] = Decimal(v['value'])
    add(tid, v, v['value'], 'g CO2e per MJ of natural gas (HHV; IPCC AR6 100-year GWPs, as published)',
        f"U.S. natural gas supply chain 2020, {v['basis']['boundary']} (95% CI {v['ci95']} g CO2e/MJ)")
assert netl == {'prod_through_distribution': Decimal('8.8'), 'prod_through_transmission': Decimal('7.8')}

# ---- CA-GREET3.0 Lookup Table TSD (2018): well-to-tank = Total - Tailpipe, components summed and compared. ----
GREET = {  # register fuel -> (transcription fuel, table, component rows)
    'carbob': ('carbob', 'Table A.1', ['crude_recovery_and_transport', 'refining', 'fuel_transport']),
    'ulsd': ('ulsd', 'Table B.1', ['crude_recovery_and_transport', 'refining', 'fuel_transport']),
    'propane': ('propane_weighted', 'Table D.1', ['ng_recovery', 'ng_processing', 'ng_transmission', 'crude_recovery', 'crude_transport', 'refining_from_ng',
                                                  'refining_from_crude', 'non_combustion', 'propane_transport', 'propane_storage']),
}
upstream = {}
for fuel, (src, table, rows) in GREET.items():
    total, tail = checked(f'cagreet3_lut2018.{src}.total'), checked(f'cagreet3_lut2018.{src}.tailpipe')
    parts = [checked(f'cagreet3_lut2018.{src}.{row}') for row in rows]
    for p in parts + [total, tail]:
        assert p['unit'] == 'g CO2e/MJ', p['id']
        add(p['id'], p, p['value'], 'g CO2e per MJ (CA-GREET3.0; LHV per cagreet3.heating_value_basis; GWP not stated, inferred AR4-100)',
            f"CA-GREET3.0 {table} {src} row {p['id'].rsplit('.', 1)[1]} (California pathway)")
    wtt = Decimal(total['value']) - Decimal(tail['value'])
    component_sum = sum((Decimal(p['value']) for p in parts), Decimal(0))
    assert abs(component_sum - wtt) <= Decimal('0.01'), (fuel, wtt, component_sum)
    upstream[fuel] = wtt
    add(f'cagreet3_lut2018.{src}.upstream', total, plain(wtt), 'g CO2e per MJ (well-to-tank; LHV; GWP inferred AR4-100)',
        f'CA-GREET3.0 {table} {src}: upstream (well-to-tank) carbon intensity = Total - Tailpipe',
        cell_extra=f"; derived: Total {total['value']} - Tailpipe {tail['value']} = {plain(wtt)}; the {len(parts)} component rows sum to {plain(component_sum)} "
                   f"(|difference| {plain(abs(component_sum - wtt))} <= 0.01, the table's rounding)",
        quotes=[f"Total quote1: {total['quote1']}", f"Total quote2: {total['quote2']}", f"Tailpipe quote1: {tail['quote1']}", f"Tailpipe quote2: {tail['quote2']}"])
assert upstream == {'carbob': Decimal('26.88'), 'ulsd': Decimal('25.59'), 'propane': Decimal('18.16')}, upstream

# ---- CA-GREET3.0 GWP set: inferred AR4 by recomputing printed Table 10/6 values (the research inference, repeated here). ----
g = checked('cagreet3.gwp_inferred', '108 0.102 0.004 3.45E-06 2.56')
rows = [(Decimal('108'), Decimal('0.004'), Decimal('2.56')), (Decimal('252'), Decimal('0.006'), Decimal('5.97')), (Decimal('19.08'), Decimal('1.682'), Decimal('0.93'))]
for printed in ('252 0.239 0.006 5.73E-06 5.97', '19.08 0.018 1.682 1.59E-03 0.93'):
    checked('cagreet3.gwp_inferred', printed)


def reproduces(ch4: int, n2o: int) -> bool:
    with localcontext() as ctx:
        ctx.prec = 50
        return all(((c * ch4 + n * n2o) / MJ_PER_MMBTU).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN) == p for c, n, p in rows)


assert reproduces(25, 298) and not reproduces(28, 265)
add('cagreet3.gwp_inferred', g, 'AR4-100 (inferred)', 'GWP set (inferred; CARB states none)',
    'CA-GREET3.0 GWP set: not stated by CARB; AR4 100-year (CH4 25, N2O 298) reproduces the printed supplemental Table 10 and 6 CO2e values and AR5 (28, 265) does not',
    cell_extra='; recomputed here: (g CH4/MMBtu x 25 + g N2O/MMBtu x 298) / 1055.05585262 rounds to the printed 2.56, 5.97 and 0.93 g/MJ')

# ---- Heating-value basis of CA-GREET3.0 and the CARB LCFS energy densities (liquids calculate only on one stated basis). ----
LIQUIDS = {'carbob': 'carbob', 'ulsd': 'ulsd', 'propane': 'propane'}  # register fuel -> carb_lcfs.energy_density.<x>
basis = None
if 'cagreet3.heating_value_basis' in values:
    hv = checked('cagreet3.heating_value_basis', 'lower heating values of fuels in CA-GREET3.0')
    assert hv['value'] in ('LHV', 'HHV')
    basis = hv['value']
    add('cagreet3.heating_value_basis', hv, hv['value'], 'heating-value basis', 'CA-GREET3.0 carbon intensities and LCFS energy densities: lower heating value basis (LCFS Table 4 footnote 1)')
liquids_ok = basis is not None
for fuel, ed in LIQUIDS.items():
    tid = f'carb_lcfs.energy_density.{ed}'
    if tid not in values:
        liquids_ok = False
        continue
    v = checked(tid)
    assert v['unit'].startswith('MJ/gal') and f'({basis or "?"}' in v['unit'] and v['basis']['heating_value'].startswith(basis or '?'), tid
    add(tid, v, v['value'], f'MJ per U.S. gallon ({basis})', f'CARB LCFS energy density of {fuel} (17 CCR 95486 Table 4; {basis}, from CA-GREET3.0)')
assert liquids_ok, 'liquids need the CA-GREET3.0 basis and every energy density on that basis'

# ---- eGRID heat input basis: HHV (40 CFR 72.2 gross calorific value; EIA gross heat content; eGRID TG silent). ----
for tid, phrase, label in (('egrid2023_tg.heat_input_definition', 'Heat input, in MMBtu', 'eGRID2023 heat input is in MMBtu; the Technical Guide states no heating-value basis'),
                           ('cfr40_72_2.heat_input_rate_gcv', 'gross calorific value of the fuel', 'Part 75 heat input (eGRID\'s first data source) uses the gross calorific value (HHV)'),
                           ('eia_glossary.gross_heat_content', 'typically uses gross heat content values', 'EIA (eGRID\'s other data source, EIA-923) uses gross heat content (HHV)')):
    v = checked(tid, phrase)
    add(tid, v, v['value'], v['unit'], label)

# ---- Constants (prefix us_upstream_const.). ----
with localcontext() as ctx:
    ctx.prec = 50
    f_dist = netl['prod_through_distribution'] * MJ_PER_MMBTU / 1000
    f_trans = netl['prod_through_transmission'] * MJ_PER_MMBTU / 1000
assert Fraction(f_dist) == Fraction(netl['prod_through_distribution']) * Fraction(MJ_PER_MMBTU) / 1000 and plain(f_dist) == '9.284491503056'
assert Fraction(f_trans) == Fraction(netl['prod_through_transmission']) * Fraction(MJ_PER_MMBTU) / 1000 and plain(f_trans) == '8.229435650436'
constants = [
    {'id': 'us_upstream_const.mj_per_mmbtu', 'value': '1055.05585262', 'unit': 'MJ per MMBtu',
     'basis': 'Definition: International Table Btu = 1055.05585262 J, so 1 MMBtu = 10^6 Btu = 1055.05585262 MJ exactly (the definition behind supplement_const.kwh_per_mmbtu)'},
    {'id': 'us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv', 'value': plain(f_dist), 'unit': 'kg CO2e per MMBtu (HHV; IPCC AR6 100-year, as published)',
     'basis': 'Derived exactly: NETL 8.8 g CO2e/MJ (entry netl2024_4862.ng_upstream.prod_through_distribution) x 1055.05585262 MJ/MMBtu / 1000 g/kg'},
    {'id': 'us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv', 'value': plain(f_trans), 'unit': 'kg CO2e per MMBtu (HHV; IPCC AR6 100-year, as published)',
     'basis': 'Derived exactly: NETL 7.8 g CO2e/MJ (entry netl2024_4862.ng_upstream.prod_through_transmission) x 1055.05585262 MJ/MMBtu / 1000 g/kg'},
]

# ---- Round 2, lane F (DESIGN 13.6): coal upstream, methane only, derived from three printed values of 2022. ----
COAL_INPUTS = (  # id, printed text (must be in both quotes), register value, register unit, label
    ('epa_ghgi.2022.coal_mining_ch4_total', '43.6', '43.6', 'MMT CO2e (million metric tons CO2-equivalent; IPCC AR5 100-year GWPs), calendar year 2022',
     'U.S. coal mining CH4 (GHGI category 1B1a: active underground mines net of methane recovered and used, surface mines, post-mining; abandoned mines '
     'excluded), 2022, IPCC AR5 100-year'),
    ('eia.2022.coal_production_short_tons', '594,155', '594155', 'thousand short tons (calendar year 2022 U.S. coal production)',
     'U.S. coal production 2022, all ranks (includes a small amount of refuse recovery and coal later exported)'),
    ('eia.2022.coal_heat_content_production', '20.100', '20.100', 'MMBtu per short ton (gross heat content, HHV; coal production 2022)',
     'Approximate heat content of U.S. coal production 2022 (gross, HHV)'),
)
coal = {}
for tid, printed, value, unit, label in COAL_INPUTS:
    v = checked(tid, printed)
    assert v['value'] == printed and v['_file'] == 'us-upstream-transcriptions-3.json' and '2022' in v['unit'], tid
    assert value.replace('.', '').isdigit() and Decimal(value) == Decimal(printed.replace(',', '')), tid
    coal[tid] = Decimal(value)
    add(tid, v, value, unit, label)
ghgi, production, heat = (values[t] for t, *_ in COAL_INPUTS)
assert 'AR5' in ghgi['basis']['gwp_set'] and 'Fifth Assessment Report (AR5)' in ghgi['quote2'] and 'abandoned' in ghgi['basis']['boundary'].lower(), 'GHGI basis'
assert heat['basis']['heating_value'].startswith('HHV (gross)') and 'gross heat contents' in heat['basis']['heating_value'], 'EIA heat content basis'
KG_PER_MMT, ST_PER_THOUSAND = Decimal(10) ** 9, Decimal(1000)
numerator = coal['epa_ghgi.2022.coal_mining_ch4_total'] * KG_PER_MMT
denominator = coal['eia.2022.coal_production_short_tons'] * ST_PER_THOUSAND * coal['eia.2022.coal_heat_content_production']
exact_q = Fraction(numerator) / Fraction(denominator)
f_coal = Decimal(round(exact_q * 10 ** 12)).scaleb(-12)  # one division, half-even to 12 dp (Python rounds a Fraction half-even)
assert (plain(numerator), plain(denominator), plain(f_coal)) == ('43600000000', '11942515500', '3.650822140444'), (numerator, denominator, f_coal)
COAL_FORMULA = ('F_COAL = round12(epa_ghgi.2022.coal_mining_ch4_total (MMT CO2e) x us_upstream_const.kg_per_million_metric_tons / '
                '(eia.2022.coal_production_short_tons (thousand short tons) x us_upstream_const.short_tons_per_thousand_short_tons x '
                'eia.2022.coal_heat_content_production (MMBtu/short ton, HHV))) kg CO2e per MMBtu HHV')
constants += [
    {'id': 'us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv', 'value': plain(f_coal),
     'unit': 'kg CO2e per MMBtu of coal (HHV; IPCC AR5 100-year; coal mine methane only)',
     'basis': 'Derived, not a printed value (DESIGN 13.6; derivation record in the provenance sidecar): round12(43.6 MMT CO2e (EPA GHGI 1990-2022 Table 3-1, CH4, '
              'Coal Mining, 2022; AR5) x 10^9 kg/MMT / (594,155 thousand short tons (EIA MER Table 6.1, 2022 production) x 1000 x 20.100 MMBtu per short ton '
              '(EIA MER Table A5, 2022 coal production, gross heat content))) = 43,600,000,000 / 11,942,515,500, half-even to 12 dp. Methane only: coal mining '
              'energy and coal transport CO2 are not included; abandoned mines are excluded; the denominator is all U.S. production, exports included'},
    {'id': 'us_upstream_const.kg_per_million_metric_tons', 'value': '1000000000', 'unit': 'kg per million metric tons',
     'basis': 'Definition: 1 million metric tons (MMT) = 10^6 t x 1000 kg/t = 10^9 kg'},
    {'id': 'us_upstream_const.short_tons_per_thousand_short_tons', 'value': '1000', 'unit': 'short tons per thousand short tons',
     'basis': 'Definition: the EIA table unit "thousand short tons" = 1000 short tons'},
]
# ---- Round 3, lane A (ROUND3.md owner decision 2): the two printed coal upstream cross-checks, registered for the SCREENING
# range of the omitted coal mining energy and transport CO2 only (a memo outside every total, never a factor of a figure). ----
SCREENING_INPUTS = (  # id, printed text (in both quotes), register unit, label
    ('coal_upstream.npc2011.us_average.upstream_combustion', '5.0', 'lb CO2e per MMBtu of coal (IPCC AR4; heating value not stated; 1997 coal data)',
     'Screening only (memo, low end): NPC 2011 Table 7 coal upstream combustion (mining energy + transport), Coal/NPC'),
    ('coal_upstream.abrahams2015_cmu.us_average', '12.2', 'g CO2e per MJ of coal (CH4 GWP Normal(36, 8.5), not an IPCC set; heating value not stated)',
     'Screening only (memo, high end less the counted mine methane): Abrahams et al. 2015 SI Table S7 coal upstream, 100-year mean'),
)
for tid, printed_text, unit, label in SCREENING_INPUTS:
    v = checked(tid, printed_text)
    assert v['value'] == printed_text and v['_file'] == 'us-upstream-transcriptions-3.json', tid
    add(tid, v, printed_text, unit, label)
assert 'AR4' in values[SCREENING_INPUTS[0][0]]['basis']['gwp_set'] and 'not stated' in values[SCREENING_INPUTS[0][0]]['basis']['heating_value']
assert 'Normal(36,8.5)' in values[SCREENING_INPUTS[1][0]]['basis']['gwp_set'] and values[SCREENING_INPUTS[1][0]]['basis']['heating_value'] == 'not stated'
derived = {
    'us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv': {
        'derived': True, 'design': 'DESIGN 13.6 (owner decision, round 2): coal upstream, methane-only term', 'formula': COAL_FORMULA,
        'inputs': [{'id': tid, 'printed': printed, 'value': value, 'unit': unit, 'file': values[tid]['_file'], 'fileSha256': values[tid]['_sha'],
                    'url': values[tid]['url'], 'locator': values[tid]['locator'], 'agreed': values[tid]['agreed']} for tid, printed, value, unit, _ in COAL_INPUTS],
        'constants': {'us_upstream_const.kg_per_million_metric_tons': '1000000000', 'us_upstream_const.short_tons_per_thousand_short_tons': '1000'},
        'division': {'numerator': plain(numerator), 'denominator': plain(denominator), 'exactQuotient': f'{exact_q.numerator}/{exact_q.denominator}',
                     'result': plain(f_coal), 'places': 12, 'rounding': 'half_even', 'rounded': Fraction(f_coal) != exact_q},
        'gwpSet': 'IPCC AR5 100-year (EPA GHGI CO2 Eq. values; the CH4 GWP number itself is not printed in the text read)',
        'heatingValue': 'HHV (EIA gross heat content), matching the eGRID heat input basis',
        'boundary': 'Coal mine methane only (active underground mines net of recovery and use, surface mines, post-mining); excludes abandoned mines, '
                    'mining energy CO2 and coal transport CO2; all U.S. coal production including exports, not only power-plant coal',
    },
    'us_upstream_const.ng_upstream_distribution_kg_per_mmbtu_hhv': {
        'derived': True, 'formula': 'netl2024_4862.ng_upstream.prod_through_distribution (g CO2e/MJ HHV) x us_upstream_const.mj_per_mmbtu / 1000 (exact, no rounding)',
        'inputs': [{'id': 'netl2024_4862.ng_upstream.prod_through_distribution', 'value': plain(netl['prod_through_distribution'])}]},
    'us_upstream_const.ng_upstream_transmission_kg_per_mmbtu_hhv': {
        'derived': True, 'formula': 'netl2024_4862.ng_upstream.prod_through_transmission (g CO2e/MJ HHV) x us_upstream_const.mj_per_mmbtu / 1000 (exact, no rounding)',
        'inputs': [{'id': 'netl2024_4862.ng_upstream.prod_through_transmission', 'value': plain(netl['prod_through_transmission'])}]},
}

entries.sort(key=lambda e: e['id'])
constants.sort(key=lambda c: c['id'])
ids = [e['id'] for e in entries]
assert len(ids) == len(set(ids)), 'duplicate id'
ALLOWED = {'id', 'label', 'labelCells', 'sheet', 'table', 'unit', 'value', 'valueCell', 'sourceSha256'}
assert all(set(e) <= ALLOWED and all(isinstance(e[k], str) for k in e if k != 'labelCells') and all(isinstance(x, str) for x in e['labelCells']) for e in entries)
assert all(set(c) <= {'id', 'value', 'unit', 'basis', 'sourceSha256'} and all(isinstance(x, str) for x in c.values()) for c in constants)  # 0024 constant keys
first = values['netl2024_4862.ng_upstream.prod_through_distribution']
SIDECAR_NAME = 'verified-scope3-us-upstream-register-2025.provenance.json'
sidecar_bytes = (json.dumps({'schema': 'neuvetra.verified-factor-register-provenance.v1', 'register': 'verified-scope3-us-upstream-register-2025.json',
                             'derived': derived}, ensure_ascii=False, indent=1) + '\n').encode('utf-8')
assert sorted(derived) == sorted(c['id'] for c in constants if c['basis'].startswith('Derived')), 'every derived constant has a derivation record'
register = {
    'schema': 'neuvetra.verified-factor-register.v1',
    'verifiedBy': 'Claude (lane A engineer, Scope 3 completion I-12u), 2026-10-30; built by tools/method-reference/build_scope3_us_upstream_register.py from the committed transcription files',
    'method': 'US upstream register R5 for Scope 3 category 3 activities A (upstream of purchased fuels), B (upstream of purchased electricity), C (upstream of '
              'electricity lost in transmission and distribution) and D (upstream of energy resold). Hand transcriptions (WebFetch, two verbatim reads that '
              'agreed; transcription webfetch_double_read) of free official documents, each entry citing publisher, title, edition, URL, page/table/row and '
              'both quotes: NETL DOE/NETL-2024/4862 natural gas supply chain (8.8 production through distribution, 7.8 production through transmission, g CO2e/MJ, '
              'HHV, IPCC AR6 100-year as published); CA-GREET3.0 Lookup Table TSD (2018) Tables A.1, B.1, D.1 (upstream = Total - Tailpipe, component rows asserted '
              'within 0.01; GWP set not stated, AR4 inferred and re-verified by arithmetic); CARB LCFS 17 CCR 95486 Table 4 energy densities (LHV, the basis of '
              'CA-GREET3.0); eGRID heat-input HHV basis (40 CFR 72.2, EIA). Derived constants are exact. No coal or oil upstream value is registered (none was '
              'verifiable). Upgrade each entry to a file read (pdftotext) with a document SHA-256 once the documents are staged. Round 2 (lane F, DESIGN 13.6): '
              'a derived, methane-only coal term from EPA GHGI 1990-2022 Table 3-1 (coal mining CH4 2022, AR5) and EIA MER Tables 6.1 and A5 (2022 coal '
              'production and its gross heat content), one division rounded half-even to 12 dp; its derivation record is in the provenance sidecar. Round 3 '
              '(lane A, owner decision 2): NPC 2011 Table 7 coal upstream combustion (5.0 lb CO2e/MMBtu, AR4) and Abrahams et al. 2015 Table S7 coal upstream '
              '(12.2 g CO2e/MJ, non-IPCC GWP) are registered as entries for a screening-range memo of the omitted coal mining energy and transport CO2 only '
              '(outside every total; older vintages, heating value not stated).',
    'source': {'publisher': 'Neuvetra research transcriptions (sources: U.S. DOE NETL; California Air Resources Board; U.S. EPA; eCFR; U.S. EIA)',
               'title': 'US upstream transcriptions (tools/method-reference/sources/us-upstream-transcriptions.json, -2.json and -3.json)',
               'edition': '2026-10-30; files: ' + '; '.join(f'{n} sha256 {s}' for n, s in FILES.items()) + '; every entry cites its own document URL in sheet and its transcription file in sourceSha256',
               'url': 'tools/method-reference/sources/us-upstream-transcriptions.json', 'sha256': first['_sha'], 'bytes': first['_bytes'],
               'provenanceSidecar': {'file': SIDECAR_NAME, 'sha256': hashlib.sha256(sidecar_bytes).hexdigest(), 'bytes': str(len(sidecar_bytes))}},
    'constants': constants,
    'entries': entries,
}
open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(register, ensure_ascii=False, indent=1) + '\n')
Path(OUT[:-len('.json')] + '.provenance.json' if OUT.endswith('.json') else OUT + '.provenance.json').write_bytes(sidecar_bytes)
print(hashlib.sha256(open(OUT, 'rb').read()).hexdigest(), len(entries), len(constants))
