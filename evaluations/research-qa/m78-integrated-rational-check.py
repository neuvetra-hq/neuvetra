"""Read-only challenge of the fictional frozen author receipt, using Fraction arithmetic."""
from pathlib import Path
from fractions import Fraction as F
from decimal import Decimal, localcontext
from collections import defaultdict
import hashlib
import json

receipt = Path('.superpowers/m78_author_native_1789617520395-result.json')
assert hashlib.sha256(receipt.read_bytes()).hexdigest() == '1b40bd77bdb795efbb3b10fca658211bb23e3033191dc27e59dd3f95dc259572'
r = json.loads(receipt.read_bytes())['final']
t = r['reconciliation']['totals']

def exact(v):
    with localcontext() as c:
        c.prec = 100
        s = format(Decimal(v.numerator) / Decimal(v.denominator), 'f')
        return s.rstrip('0').rstrip('.') if '.' in s else s

def display(v):
    scaled = v * 10000
    q, remainder = divmod(scaled.numerator, scaled.denominator)
    if remainder * 2 > scaled.denominator or remainder * 2 == scaled.denominator and q % 2:
        q += 1
    return f'{q // 10000}.{q % 10000:04d}'

sources, facilities, entities, gases = {}, defaultdict(F), defaultdict(F), defaultdict(lambda: [F(0), F(0)])
for x in r['proof']['sourceVersions']:
    a = x['version']['activity']
    family = x['family']
    if family == 'natural_gas':
        q = F(a['quantityMmbtu'])
        lines = [('CO2', q*F('53.06'), q*F('53.06')), ('CH4', q*F('0.001'), q*F('0.001')*28), ('N2O', q*F('0.0001'), q*F('0.0001')*265)]
    elif family == 'stationary_diesel':
        energy = F(a['quantityGallons'])*F('0.138')
        lines = [('CO2', energy*F('73.96'), energy*F('73.96')), ('CH4', energy*F('0.003'), energy*F('0.003')*28), ('N2O', energy*F('0.0006'), energy*F('0.0006')*265)]
    elif family == 'mobile_diesel':
        gallons, miles = F(a['quantityGallons']), F(a['distanceMiles'])
        lines = [('CO2', gallons*F('10.21'), gallons*F('10.21')), ('CH4', miles*F('0.0000095'), miles*F('0.0000095')*28), ('N2O', miles*F('0.0000431'), miles*F('0.0000431')*265)]
    else:
        i = a['calculatorInput']
        mass = sum((F(row['kg']) for row in i['refills']), F(0))
        # This fixture's recorded known release preceded its recorded refill:
        # do not add it again. Other event shapes are outside this receipt check.
        assert all(row['preceded_refill_verified'] and row['refill_id'] in {refill['id'] for refill in i['refills']} for row in i['releases'])
        gwp = {'R-410A': 1924, 'HFC-134a': 1300, 'HFC-227ea': 3350}[a['gas']]
        lines = [(a['gas'], mass, mass*gwp)]
    total = sum((v for _, _, v in lines), F(0))
    b = a['binding']
    assert b['sourceId'] not in sources
    sources[b['sourceId']] = total
    facilities[b['facilityId']] += total
    entities[b['entityId']] += total
    for gas, mass, co2e in lines:
        gases[gas][0] += mass
        gases[gas][1] += co2e

checks = 0
for name, expected in [('sourceRows', sources), ('facilityRows', facilities), ('entityRows', entities)]:
    rows = {row['id']: row for row in t[name]}
    assert set(rows) == set(expected), name
    for identity, value in expected.items():
        assert rows[identity]['kgCo2eExact'] == exact(value), (name, identity)
        assert rows[identity]['kgCo2eDisplay'] == display(value), (name, identity)
        checks += 2
company = sum(sources.values(), F(0))
assert t['company']['kgCo2eExact'] == exact(company) == '126850.17632025'
assert t['company']['kgCo2eDisplay'] == display(company) == '126850.1763'
checks += 2
actual_gases = {row['gas']: row for row in t['gasLines']}
assert set(actual_gases) == set(gases)
for gas, (mass, co2e) in gases.items():
    assert actual_gases[gas]['massKgExact'] == exact(mass)
    assert actual_gases[gas]['kgCo2eExact'] == exact(co2e)
    assert actual_gases[gas]['gasKind'] == ('blend' if gas == 'R-410A' else 'single_gas')
    checks += 3
print(json.dumps({'status': 'independent_rational_receipt_pass', 'sources': len(sources), 'facilities': len(facilities), 'entities': len(entities), 'gasGroups': len(gases), 'numericChecks': checks, 'companyExact': exact(company), 'companyDisplay': display(company), 'nativePersistenceAcceptance': False}))
