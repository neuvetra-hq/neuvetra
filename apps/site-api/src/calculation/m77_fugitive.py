"""Unreleased, offline M77 candidate. No database, server route or inventory claim.

The caller supplies declarations; this module cannot authenticate evidence.
Integration must bind every declaration to retained records and separate review.
"""
from datetime import date
from decimal import Decimal, localcontext, ROUND_HALF_EVEN
import re

METHOD = 'm77-stable-serviced-equipment-2025-candidate-v1'
SOURCE_SHA256 = '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7'
GUIDANCE_SHA256 = 'fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88'
FACTORS = {
    'R-410A': (1924, frozenset({'fixed_hvac'}), 'Emission Factors Hub!D575'),
    'HFC-134a': (1300, frozenset({'fixed_refrigeration'}), 'Emission Factors Hub!E532'),
    'HFC-227ea': (3350, frozenset({'fixed_fire_suppression', 'portable_fire_suppression'}), 'Emission Factors Hub!E538'),
}
DECLARATIONS = frozenset({
    'full_year_operational_control', 'california_office_or_distribution',
    'no_installation_retirement_or_retrofit', 'no_stocks_recovery_reuse_or_transfer',
    'complete_all_provider_service_records', 'all_known_releases_recorded',
    'opening_full_charge_verified', 'closing_full_charge_verified',
})
EVIDENCE = frozenset({'asset_identity', 'capacity', 'opening_full_charge', 'closing_full_charge', 'annual_contractor_record'})
FIELDS = frozenset({'year', 'asset_id', 'gas', 'equipment', 'unit', 'opening_date', 'closing_date',
                    'opening_capacity', 'closing_capacity', 'declarations', 'evidence',
                    'refills', 'releases', 'zero_activity_evidence', 'uncertainty'})
ID = re.compile(r'[A-Z0-9][A-Z0-9._-]{0,79}\Z', re.ASCII)
MASS = re.compile(r'(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,6})?\Z', re.ASCII)


class UnsupportedFugitiveInput(ValueError):
    """No candidate numerical result may be emitted for this input."""


def _object(value, keys, name):
    if type(value) is not dict or value.keys() != keys:
        raise UnsupportedFugitiveInput(f'{name}: exact fields required')
    return value


def _identifier(value, name):
    if type(value) is not str or not ID.fullmatch(value):
        raise UnsupportedFugitiveInput(f'{name}: canonical evidence identifier required')
    return value


def _mass(value, name, positive=False):
    if type(value) is not str or not MASS.fullmatch(value):
        raise UnsupportedFugitiveInput(f'{name}: kg decimal string required')
    mass = Decimal(value)
    if positive and mass <= 0:
        raise UnsupportedFugitiveInput(f'{name}: positive mass required')
    return mass


def _date(value, name):
    if type(value) is not str or not re.fullmatch(r'2025-[0-9]{2}-[0-9]{2}', value):
        raise UnsupportedFugitiveInput(f'{name}: date must be in 2025')
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise UnsupportedFugitiveInput(f'{name}: invalid date') from error


def _exact(value):
    value = format(value, 'f')
    return value.rstrip('0').rstrip('.') if '.' in value else value


def calculate(value):
    """Validate declared method eligibility and return a deterministic candidate estimate.

    It is deliberately unmounted. Evidence IDs are not proof that documents exist.
    """
    v = _object(value, FIELDS, 'workpaper')
    if type(v['year']) is not int or v['year'] != 2025 or v['unit'] != 'kg':
        raise UnsupportedFugitiveInput('Only calendar 2025 and kg are admitted')
    _identifier(v['asset_id'], 'asset_id')
    if type(v['gas']) is not str or v['gas'] not in FACTORS:
        raise UnsupportedFugitiveInput('Unsupported gas; retain an unresolved source')
    gwp, equipment, locator = FACTORS[v['gas']]
    if type(v['equipment']) is not str or v['equipment'] not in equipment:
        raise UnsupportedFugitiveInput('Unsupported gas/equipment combination')
    if v['opening_date'] != '2025-01-01' or v['closing_date'] != '2025-12-31':
        raise UnsupportedFugitiveInput('Exact opening/closing boundary dates required')
    if _mass(v['opening_capacity'], 'opening capacity', True) != _mass(v['closing_capacity'], 'closing capacity', True):
        raise UnsupportedFugitiveInput('Unchanged documented full charge required')
    declarations = _object(v['declarations'], DECLARATIONS, 'declarations')
    if any(item is not True for item in declarations.values()):
        raise UnsupportedFugitiveInput('All method eligibility declarations must be explicit true')
    evidence = _object(v['evidence'], EVIDENCE, 'evidence')
    for key, item in evidence.items():
        _identifier(item, key)
    if type(v['uncertainty']) is not str or not 20 <= len(v['uncertainty'].strip()) <= 2000:
        raise UnsupportedFugitiveInput('Describe uncertainty and evidence limitations')
    for name in ('refills', 'releases'):
        if type(v[name]) is not list or len(v[name]) > 100:
            raise UnsupportedFugitiveInput(f'{name}: at most 100 events required')
    if not v['refills']:
        _identifier(v['zero_activity_evidence'], 'explicit zero activity evidence')
        if v['releases']:
            raise UnsupportedFugitiveInput('Known loss without a refill is unsupported')
    elif v['zero_activity_evidence'] is not None:
        raise UnsupportedFugitiveInput('Zero declaration conflicts with servicing activity')

    with localcontext() as context:
        context.prec = 96
        refills = {}
        references = set()
        event_ids = set()
        total = Decimal(0)
        for event in v['refills']:
            _object(event, {'id', 'date', 'kg', 'contractor', 'reference'}, 'refill')
            key = _identifier(event['id'], 'refill ID')
            issuer = _identifier(event['contractor'], 'contractor')
            reference = _identifier(event['reference'], 'refill reference')
            if key in event_ids or (issuer, reference) in references:
                raise UnsupportedFugitiveInput('Duplicate servicing event or contractor reference')
            event_ids.add(key)
            references.add((issuer, reference))
            amount = _mass(event['kg'], 'refill', True)
            refills[key] = {'date': _date(event['date'], 'refill'), 'kg': amount, 'released': Decimal(0)}
            total += amount
        release_references = set()
        for event in v['releases']:
            _object(event, {'id', 'date', 'kg', 'evidence', 'refill_id', 'preceded_refill_verified'}, 'release')
            if event['preceded_refill_verified'] is not True:
                raise UnsupportedFugitiveInput('Evidence-backed release/refill chronology required')
            key = _identifier(event['id'], 'release ID')
            reference = _identifier(event['evidence'], 'release evidence')
            refill_id = _identifier(event['refill_id'], 'linked refill')
            if key in event_ids or reference in release_references:
                raise UnsupportedFugitiveInput('Duplicate release evidence or event')
            event_ids.add(key)
            release_references.add(reference)
            if refill_id not in refills:
                raise UnsupportedFugitiveInput('Unrecharged known release')
            refill = refills[refill_id]
            if _date(event['date'], 'release') > refill['date']:
                raise UnsupportedFugitiveInput('A known release must precede its refill')
            refill['released'] += _mass(event['kg'], 'release', True)
            if refill['released'] > refill['kg']:
                raise UnsupportedFugitiveInput('Known releases exceed the linked refill')
        co2e = total * Decimal(gwp)
        return {
            'status': 'candidate_method_estimate',
            'method': METHOD,
            'gas': v['gas'],
            'gwp': str(gwp),
            'gwp_basis': 'EPA January 2025 Hub; AR5 100-year published value',
            'factor_locator': locator,
            'factor_source_sha256': SOURCE_SHA256,
            'guidance_sha256': GUIDANCE_SHA256,
            'estimated_emitted_kg': _exact(total),
            'kg_co2e_exact': _exact(co2e),
            'kg_co2e_display': format(co2e.quantize(Decimal('0.0001'), rounding=ROUND_HALF_EVEN), 'f'),
            'refill_count': len(refills),
            'known_release_count': len(v['releases']),
            'evidence_verified': False,
            'limitation': 'Declared evidence is not verified by this calculator. Candidate service-based estimate; no measured-zero or complete-inventory claim.',
        }
