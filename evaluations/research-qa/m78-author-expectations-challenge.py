"""Independently recompute the accounting author's serialized expectations.

Only the reviewer-owned integer/Fraction implementation is imported. Author
oracle/application code is not executed. This checks arithmetic, not admission.
"""
from fractions import Fraction as F
import json
from pathlib import Path
import hashlib
import sys
import zipfile
import xml.etree.ElementTree as ET
import importlib.util
spec = importlib.util.spec_from_file_location("reviewer_oracle", Path(__file__).with_name("m78-independent-rational-oracle.py"))
reviewer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviewer)
GWP, display, exact, gas, generator, vehicle = (getattr(reviewer, name) for name in ["GWP", "display", "exact", "gas", "generator", "vehicle"])


def masses(source):
    family = source['family']
    if family == 'natural_gas':
        return gas(source['quantity'])
    if family == 'stationary_diesel':
        return generator(source['quantity'])
    if family == 'mobile_diesel':
        return vehicle(source['quantity'], source['miles'])
    assert family == 'fugitive'
    name = source['gas'].replace('-', '')
    return {name: sum((F(q) for q in source['refillsKg']), F(0))}


def check(result, source_rows):
    combined = {}
    for r in source_rows:
        for name, mass in masses(r['source']).items():
            combined[name] = combined.get(name, F(0)) + mass
    expected_total = sum((q * GWP[k] for k, q in combined.items()), F(0))
    assert result['kgCo2eExact'] == exact(expected_total)
    assert result['kgCo2eDisplay'] == display(expected_total)
    lines = result['gasLines']
    assert len(lines) == len(combined)
    assert len({line['gas'] for line in lines}) == len(lines)
    for line in lines:
        name = line['gas'].replace('-', '')
        assert line['massKgExact'] == exact(combined[name])
        assert line['co2eKgExact'] == exact(combined[name] * GWP[name])
        assert line['gasKind'] == ('blend' if name == 'R410A' else 'single_gas')
    if 'displayRoundingDelta' in result:
        delta = F(display(expected_total)) - sum((F(r['kgCo2eDisplay']) for r in source_rows), F(0))
        assert F(result['displayRoundingDelta']) == delta
        assert result['roundingDeltaIsEmission'] is False


def source_observations(root):
    obs = json.loads((root / 'evaluations/calculation-specs/m78-source-observations.json').read_text(encoding='utf-8'))
    workbook = Path(obs['sourcePath'])
    assert len(workbook.read_bytes()) == obs['sourceBytes']
    assert hashlib.sha256(workbook.read_bytes()).hexdigest() == obs['sourceSha256']
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(workbook) as archive:
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        formats = {int(row.get('numFmtId')): row.get('formatCode') for row in styles.findall('m:numFmts/m:numFmt', ns)}
        xfs = styles.findall('m:cellXfs/m:xf', ns)
        observed = None
        for name in archive.namelist():
            if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
                cells = {row.get('r'): row for row in ET.fromstring(archive.read(name)).findall('.//m:c', ns)}
                if 'D575' in cells:
                    observed = cells
                    break
        assert observed is not None
        for claim in obs['factorCells']:
            cell = observed[claim['cell']]
            format_id = int(xfs[int(cell.get('s'))].get('numFmtId'))
            assert claim['rawXml'] == cell.find('m:v', ns).text
            assert claim['styleIndex'] == cell.get('s')
            assert claim['numberFormatId'] == format_id
            assert claim['customNumberFormat'] == formats[format_id]
        for claim in obs['pdfs']:
            assert hashlib.sha256(Path(claim['path']).read_bytes()).hexdigest() == claim['sha256']
        artifact = obs['fictionalBoundaryArtifact']
        assert hashlib.sha256(artifact['text'].encode()).hexdigest() == artifact['sha256']
    return len(obs['factorCells']) + len(obs['pdfs']) + 1


def snapshot(root):
    path = root / 'operations/agent-improvement/snapshots/M78-ACCOUNTING-01-CANDIDATE2.json'
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == '7fecc9a13c0d03ae64dcc64980e7dbea0218ae9a2decf7ea3c97a565cf9b8dd6'
    # JSON bytes decode according to JSON's UTF-8 contract, not Windows CP1252.
    bundle = json.loads(raw)
    entries = bundle['source_artifacts']
    assert len(entries) == 5 and len({r['path'] for r in entries}) == 5
    assert any(ord(c) > 127 for c in entries[0]['text']), 'Exercise non-ASCII contract text'
    for entry in entries:
        embedded = entry['text'].encode('utf-8')
        assert hashlib.sha256(embedded).hexdigest() == entry['sha256']
        assert (root / entry['path']).read_bytes() == embedded
    return len(entries)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    fixture = json.loads((root / 'evaluations/calculation-specs/m78-expectations.json').read_text(encoding='utf-8'))
    count = 0
    for row in fixture['sourceRows'] + fixture['sourceBoundaryCases']:
        check(row, [row])
        count += 1
    for dimension in ['facility', 'entity']:
        for name, result in fixture[dimension + 'Rows'].items():
            check(result, [r for r in fixture['sourceRows'] if r['source'][dimension] == name])
            count += 1
    check(fixture['company'], fixture['sourceRows'])
    count += 1
    for case in fixture['aggregateRoundingCases']:
        components = case['components']
        assert len({r['source']['id'] for r in components}) == len(components)
        check(case['aggregate'], components)
        count += 1
    for units in fixture['gasUnitChecks']:
        assert units['originalUnit'].split()[0] == 'g'
        assert units['massKgExact'] == exact(F(units['originalValue']) * F('0.001'))
        count += 1
    print('PASS independent recomputation: ' + str(count) + ' source/rollup/unit records; no author code executed')
    if '--sources' in sys.argv:
        print('PASS original source comparisons: ' + str(source_observations(root)) + ' cell/PDF/artifact records; workbook bytes/hash verified')
    if '--bundle' in sys.argv:
        print('PASS exact UTF-8 snapshot/current source agreement: ' + str(snapshot(root)) + ' frozen files including non-ASCII contract')
