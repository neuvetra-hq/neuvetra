"""M76 independent arithmetic expectations; no production or author-test imports."""
from decimal import Decimal, localcontext, ROUND_HALF_EVEN
from fractions import Fraction
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
SOURCE = Path('C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx')
SOURCE_SHA = '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7'


def exact(value):
    denominator = value.denominator
    places = 0
    while denominator != 1:
        divisor = 2 if denominator % 2 == 0 else 5 if denominator % 5 == 0 else None
        assert divisor is not None
        denominator //= divisor
        places += 1
    integer = value.numerator * 10**places // value.denominator
    if places == 0:
        return str(integer)
    text = str(integer).zfill(places + 1)
    return (text[:-places] + '.' + text[-places:]).rstrip('0').rstrip('.')


def display(value):
    integer, remainder = divmod(value.numerator * 10000, value.denominator)
    if remainder * 2 > value.denominator or (remainder * 2 == value.denominator and integer % 2):
        integer += 1
    return str(integer // 10000) + '.' + str(integer % 10000).zfill(4)


def expected(quantity, family):
    # Rational transcription from the inspected source cells. Independent code
    # deliberately expands every gas before the separate Decimal cross-check.
    q = Fraction(quantity)
    hhv = q if family == 'natural_gas' else q * Fraction(138, 1000)
    co2 = hhv * (Fraction(5306, 100) if family == 'natural_gas' else Fraction(7396, 100))
    methane = hhv * (1 if family == 'natural_gas' else 3) / 1000
    nitrous = hhv * (Fraction(1, 10) if family == 'natural_gas' else Fraction(6, 10)) / 1000
    total = co2 + methane * 28 + nitrous * 265
    result = {
        'heatMmbtu': exact(hhv), 'co2MassKg': exact(co2),
        'ch4MassKg': exact(methane), 'n2oMassKg': exact(nitrous),
        'ch4Co2eKg': exact(methane * 28), 'n2oCo2eKg': exact(nitrous * 265),
        'totalExactKgCo2e': exact(total), 'totalDisplayKgCo2e': display(total),
    }
    with localcontext() as ctx:
        ctx.prec = 96
        qd = Decimal(quantity)
        hd = qd if family == 'natural_gas' else qd * Decimal('0.138')
        masses = [hd * Decimal('53.06' if family == 'natural_gas' else '73.96'),
                  hd * Decimal('1.0' if family == 'natural_gas' else '3.0') / 1000,
                  hd * Decimal('0.10' if family == 'natural_gas' else '0.60') / 1000]
        td = qd * Decimal('53.1145' if family == 'natural_gas' else '10.240014')
        independent = [hd, *masses, masses[1] * 28, masses[2] * 265, td]
        assert all(Fraction(result[key]) == Fraction(value)
                   for key, value in zip(list(result)[:-1], independent))
        assert result['totalDisplayKgCo2e'] == format(td.quantize(Decimal('.0001'), rounding=ROUND_HALF_EVEN), '.4f')
    return result


def source_evidence():
    content = SOURCE.read_bytes()
    assert hashlib.sha256(content).hexdigest() == SOURCE_SHA
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with ZipFile(SOURCE) as z:
        strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        cells = {c.attrib['r']: c for c in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:c', ns)}
        styles = ET.fromstring(z.read('xl/styles.xml'))
        formats = {f.attrib['numFmtId']: f.attrib['formatCode'] for f in styles.findall('s:numFmts/s:numFmt', ns)}
        xf = styles.find('s:cellXfs', ns)
        selected = []
        for key in ['F3', 'C38', 'E38', 'F38', 'G38', 'D14', 'D47', 'E47', 'F47', 'G47',
                    'C55', 'D55', 'E55', 'F55', 'G55', 'H55', 'I55', 'J55', 'C94', 'C95', 'C99',
                    'E523', 'E524', 'E525', 'E526']:
            cell = cells[key]
            raw = cell.find('s:v', ns).text
            fmt = xf[int(cell.attrib.get('s', 0))].attrib['numFmtId']
            selected.append({'cell': key, 'rawXml': raw,
                             'decoded': strings[int(raw)] if cell.attrib.get('t') == 's' else raw,
                             'numFmtId': fmt, 'customNumFmtCode': formats.get(fmt)})
        lookup = {s['cell']: s for s in selected}
        assert lookup['C55']['decoded'] == 'Distillate Fuel Oil No. 2'
        assert lookup['D55']['rawXml'] == '0.13800000000000001'
        assert '.000_' in lookup['D55']['customNumFmtCode']
        assert lookup['E55']['rawXml'] == '73.959999999999994' and lookup['E55']['numFmtId'] == '43'
        assert [lookup[c]['decoded'] for c in ['E524', 'E525', 'E526']] == ['1', '28', '265']
        return {'path': str(SOURCE), 'byteLength': len(content), 'sha256': SOURCE_SHA, 'cells': selected}


def fixtures():
    rows = []
    for family in ['natural_gas', 'stationary_diesel']:
        values = [('zero', '0.000'), ('minimum', '0.001'), ('unit', '1.000'),
                  ('irregular', '317.219'), ('midrange', '123456.789'),
                  ('maximum', '999999999999.999'), ('last_digit_successor', '317.220')]
        coefficient = Fraction('53.1145' if family == 'natural_gas' else '10.240014')
        # Choose previously unused exact ties algebraically. They are not copied
        # from the accounting contract's example inputs.
        for parity, label in [(0, 'new_tie_even_down'), (1, 'new_tie_odd_up')]:
            for milliquantity in range(80001, 400000):
                total = Fraction(milliquantity, 1000) * coefficient
                integer, remainder = divmod(total.numerator * 10000, total.denominator)
                if remainder * 2 == total.denominator and integer % 2 == parity:
                    values.append((label, format(Decimal(milliquantity) / 1000, '.3f')))
                    break
            else:
                raise AssertionError('tie not found')
        for label, q in values:
            rows.append({'id': family + '_' + label, 'family': family, 'quantity': q, 'expected': expected(q, family)})
    return rows


result = {
    'schemaVersion': 1, 'task': 'M76-INDEPENDENT-QA', 'executor': '/root/m76_accounting',
    'priorAuthorship': 'M76 accounting contract only; root separately selected the method. No M76 production or author-test authorship.',
    'applicationImports': False, 'authorTestsImported': False,
    'derivation': 'Source-cell rational gas expansion; integer quotient/remainder half-even; separate Decimal96 coefficient and gas comparison.',
    'source': source_evidence(), 'numericFixtures': fixtures(),
    'methodMixNegativeControl': {'quantityGallons': '1.000', 'chosenDefaultHhvTotal': '10.240014',
                                'roundedPerGallonRouteTotal': '10.24268', 'mustDiffer': True},
    'implementationAcceptance': 'pending',
}
target = HERE / 'm76-independent-expectations.json'
serialized = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
if target.exists():
    assert target.read_text(encoding='utf-8') == serialized, 'Frozen oracle differs; preserve previous result and create a new revision.'
else:
    target.write_text(serialized, encoding='utf-8', newline='\n')
print(json.dumps({'status': 'independent_oracle_prepared', 'vectors': len(result['numericFixtures']),
                  'exactComparisons': len(result['numericFixtures']) * 8,
                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'ties': [f for f in result['numericFixtures'] if 'tie' in f['id']]}))
