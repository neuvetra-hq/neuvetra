"""Reproducible extraction from the unmodified U.S. Census source workbook."""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as E
import hashlib, json, re

base = Path(__file__).parent
source = base / '2022_NAICS_Structure.xlsx'
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with ZipFile(source) as archive:
    strings = []
    for item in E.fromstring(archive.read('xl/sharedStrings.xml')):
        runs = item.findall('s:r', ns)
        if runs:
            value = ''.join(r.findtext('s:t', '', ns) for r in runs
                            if r.find('s:rPr/s:vertAlign[@val="superscript"]', ns) is None)
        else:
            value = item.findtext('s:t', '', ns)
        strings.append(value.strip())
    rows = []
    sector = None
    for row in E.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('.//s:row', ns):
        cells = {}
        for cell in row:
            value = cell.findtext('s:v', '', ns)
            cells[re.sub(r'\d', '', cell.attrib['r'])] = strings[int(value)] if cell.attrib.get('t') == 's' else value
        code, title = cells.get('B', ''), cells.get('C', '')
        if re.fullmatch(r'\d{2}(?:-\d{2})?', code):
            sector = code
        if re.fullmatch(r'\d{2,6}|\d{2}-\d{2}', code):
            rows.append({'code':code, 'title':title, 'sector':sector})
assert len({r['code'] for r in rows}) == len(rows)
assert len([r for r in rows if r['code'] == r['sector']]) == 20
assert len([r for r in rows if len(r['code']) == 6]) == 1012
(base/'naics-2022.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
manifest = {'source':'https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx',
            'retrieved':'2026-09-25', 'vintage':'2022 United States NAICS',
            'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'rows':len(rows), 'six_digit_industries':1012, 'sectors':20,
            'transformation':'Strip whitespace and superscript trilateral-agreement T markers only; retain official codes and titles.'}
(base/'source-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(manifest))
