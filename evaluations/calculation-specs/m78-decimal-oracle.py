"""Independent M78 candidate arithmetic oracle; no application imports or live inputs.

Decimal calculations are cross-checked against separately expanded Fraction
coefficients. Outputs are illustrative synthetic fixtures, not hosted totals.
"""
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from fractions import Fraction
from pathlib import Path
import hashlib
import json


def exact(value):
    text = format(value, 'f')
    return text.rstrip('0').rstrip('.') if '.' in text else text


def display(value):
    return format(value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN), '.4f')


GWP = {'CO2': Decimal('1'), 'CH4': Decimal('28'), 'N2O': Decimal('265'),
       'R-410A': Decimal('1924'), 'HFC-134a': Decimal('1300'), 'HFC-227ea': Decimal('3350')}


def contribution(source):
    family = source['family']
    q = Decimal(source.get('quantity', '0'))
    if family == 'natural_gas':
        masses = {'CO2': q * Decimal('53.06'), 'CH4': q * Decimal('1.0') / 1000,
                  'N2O': q * Decimal('0.10') / 1000}
        rational = Fraction(source['quantity']) * Fraction(106229, 2000)
    elif family == 'stationary_diesel':
        heat = q * Decimal('0.138')
        masses = {'CO2': heat * Decimal('73.96'), 'CH4': heat * Decimal('3.0') / 1000,
                  'N2O': heat * Decimal('0.60') / 1000}
        rational = Fraction(source['quantity']) * Fraction(5120007, 500000)
    elif family == 'mobile_diesel':
        miles = Decimal(source['miles'])
        masses = {'CO2': q * Decimal('10.21'), 'CH4': miles * Decimal('0.0095') / 1000,
                  'N2O': miles * Decimal('0.0431') / 1000}
        rational = Fraction(source['quantity']) * Fraction(1021, 100) + Fraction(source['miles']) * Fraction(187, 16000)
    elif family == 'fugitive':
        emitted = sum((Decimal(value) for value in source['refillsKg']), Decimal(0))
        # Linked known releases are reconciled facts, never another emission.
        assert sum((Decimal(value) for value in source.get('linkedReleaseKg', [])), Decimal(0)) <= emitted
        masses = {source['gas']: emitted}
        rational = sum((Fraction(value) for value in source['refillsKg']), Fraction(0)) * Fraction(GWP[source['gas']])
    else:
        raise AssertionError('Unsupported fixture family')
    rows = [{'gas': gas, 'gasKind': 'blend' if gas == 'R-410A' else 'single_gas',
             'massKgExact': exact(mass), 'co2eKgExact': exact(mass * GWP[gas])}
            for gas, mass in sorted(masses.items())]
    total = sum((Decimal(row['co2eKgExact']) for row in rows), Decimal(0))
    assert Fraction(total) == rational
    return {'source': source, 'gasLines': rows, 'kgCo2eExact': exact(total), 'kgCo2eDisplay': display(total)}


def rollup(rows):
    total = sum((Decimal(row['kgCo2eExact']) for row in rows), Decimal(0))
    gas_totals = {}
    for row in rows:
        for gas in row['gasLines']:
            values = gas_totals.setdefault(gas['gas'], [Decimal(0), Decimal(0), gas['gasKind']])
            values[0] += Decimal(gas['massKgExact'])
            values[1] += Decimal(gas['co2eKgExact'])
    assert sum((values[1] for values in gas_totals.values()), Decimal(0)) == total
    sum_displays = sum((Decimal(row['kgCo2eDisplay']) for row in rows), Decimal(0))
    return {'gasLines': [{'gas': gas, 'gasKind': values[2], 'massKgExact': exact(values[0]),
                        'co2eKgExact': exact(values[1])} for gas, values in sorted(gas_totals.items())],
            'kgCo2eExact': exact(total), 'kgCo2eDisplay': display(total),
            'sumOfDisplayedSourceValues': format(sum_displays, '.4f'),
            'displayRoundingDelta': format(Decimal(display(total)) - sum_displays, '.4f'),
            'roundingDeltaIsEmission': False}


def fixture():
    # New independent ten-source example, deliberately three distinct facilities.
    # These quantities/IDs do not describe the actual hosted inventory.
    sources = [
        dict(id='NG-O', family='natural_gas', entity='PARENT', facility='OFFICE', quantity='1250.125'),
        dict(id='NG-S', family='natural_gas', entity='SUBSIDIARY', facility='DISTRIBUTION-S', quantity='875.375'),
        dict(id='DG-P', family='stationary_diesel', entity='PARENT', facility='DISTRIBUTION-P', quantity='250.125'),
        dict(id='TRUCK-P', family='mobile_diesel', entity='PARENT', facility='DISTRIBUTION-P', quantity='1000.125', miles='12000.500'),
        dict(id='TRUCK-S', family='mobile_diesel', entity='SUBSIDIARY', facility='DISTRIBUTION-S', quantity='800.000', miles='10000.000'),
        dict(id='HVAC-O', family='fugitive', entity='PARENT', facility='OFFICE', gas='R-410A', refillsKg=['1.250000', '0.750000'], linkedReleaseKg=['1.000000']),
        dict(id='HVAC-P', family='fugitive', entity='PARENT', facility='DISTRIBUTION-P', gas='R-410A', refillsKg=['0.500000']),
        dict(id='FRIDGE-S', family='fugitive', entity='SUBSIDIARY', facility='DISTRIBUTION-S', gas='HFC-134a', refillsKg=['0.125000']),
        dict(id='FIRE-P', family='fugitive', entity='PARENT', facility='DISTRIBUTION-P', gas='HFC-227ea', refillsKg=['2.500000']),
        dict(id='FIRE-O', family='fugitive', entity='PARENT', facility='OFFICE', gas='HFC-227ea', refillsKg=['0.000003']),
    ]
    rows = [contribution(source) for source in sources]
    facility = {key: rollup([row for row in rows if row['source']['facility'] == key])
                for key in sorted({source['facility'] for source in sources})}
    entity = {key: rollup([row for row in rows if row['source']['entity'] == key])
              for key in sorted({source['entity'] for source in sources})}
    company = rollup(rows)
    assert sum((Decimal(value['kgCo2eExact']) for value in facility.values()), Decimal(0)) == Decimal(company['kgCo2eExact'])
    assert sum((Decimal(value['kgCo2eExact']) for value in entity.values()), Decimal(0)) == Decimal(company['kgCo2eExact'])
    cases = []
    for family, quantities in [('natural_gas', ['0.000', '0.001', '0.100', '0.300', '999999999999.999']),
                               ('stationary_diesel', ['0.000', '0.001', '25.000', '75.000', '999999999999.999'])]:
        for quantity in quantities:
            cases.append(contribution(dict(id=family + '-' + quantity, family=family, quantity=quantity)))
    for quantity, miles in [('0.000', '0.000'), ('1.000', '2.400'), ('1.000', '0.800'), ('999999999999.999', '999999999999.999')]:
        cases.append(contribution(dict(id='mobile-' + quantity + '-' + miles, family='mobile_diesel', quantity=quantity, miles=miles)))
    for gas, mass in [('HFC-227ea', '0.000001'), ('HFC-227ea', '0.000003'), ('R-410A', '2.000000'), ('HFC-134a', '0.125000')]:
        cases.append(contribution(dict(id='fugitive-' + gas + '-' + mass, family='fugitive', gas=gas, refillsKg=[mass])))
    aggregate_ties = []
    for mass in ['0.000001', '0.000003']:
        components = [contribution(dict(id='tie-' + suffix, family='fugitive', gas='HFC-227ea', refillsKg=[mass]))
                      for suffix in ['A', 'B']]
        aggregate_ties.append({'case': 'two_distinct_devices_' + mass, 'components': components, 'aggregate': rollup(components)})
    assert aggregate_ties[0]['aggregate']['kgCo2eDisplay'] == '0.0067'
    assert aggregate_ties[0]['aggregate']['displayRoundingDelta'] == '-0.0001'
    assert aggregate_ties[1]['aggregate']['kgCo2eDisplay'] == '0.0201'
    assert aggregate_ties[1]['aggregate']['displayRoundingDelta'] == '0.0001'
    assert rows[5]['kgCo2eExact'] == '3848'
    return {'schemaVersion': 1, 'profile': 'm78-independent-decimal-expectations-v1',
            'classification': 'synthetic_illustration_not_hosted_inventory',
            'arithmetic': 'Decimal precision96 cross-checked independently expanded Fraction coefficients',
            'sourceRows': rows, 'facilityRows': facility, 'entityRows': entity, 'company': company,
            'sourceBoundaryCases': cases, 'aggregateRoundingCases': aggregate_ties,
            'gasUnitChecks': [{'originalValue': '1.0', 'originalUnit': 'g CH4', 'massKgExact': '0.001'},
                              {'originalValue': '0.10', 'originalUnit': 'g N2O', 'massKgExact': '0.0001'}],
            'zeroAdmission': 'Arithmetic zeros require separate exact supporting evidence; no unknown-to-zero conversion',
            'implementationTested': False}


if __name__ == '__main__':
    with localcontext() as context:
        context.prec = 96
        value = fixture()
    target = Path(__file__).with_name('m78-expectations.json')
    content = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    if '--check' in __import__('sys').argv:
        assert target.read_text(encoding='utf-8') == content, 'Frozen expectations differ'
    else:
        target.write_text(content, encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'passed', 'sourceRows': len(value['sourceRows']),
                      'sourceBoundaryCases': len(value['sourceBoundaryCases']),
                      'company': value['company']['kgCo2eExact'],
                      'expectationsSha256': hashlib.sha256(content.encode()).hexdigest()}))
