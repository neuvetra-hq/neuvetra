import { hash } from '../research-passages/release';
import { CompositionError, exactKeys, strings, type UnitCatalog } from './catalog';

export const LEGACY_CAPABILITY_SHA = '230060af16b77bde32e253ca49e9676e2603e9ceebe165eae33c0ef87ce6e823';
export const LEGACY_CAPABILITY_UNIT_SHA = 'adb43b8a9e90cbe85f382988dedc16e16f82f7a596e0bcf5f5e98ba2f84630cd';
export const PRIOR_ACQUISITION_CAPABILITY_SHA = 'd768f4beea51ae5cf8cc1ca21f8e7eba8ecdc00dd7994e118ed1a55f15b138fe';
export const PRIOR_ROUTE_CAPABILITY_SHA = '379447e6a7b6c8b4d1db2749e179afd20965b617cfb8c6693a61feb4d4a791d5';
export const CAPABILITY_SHA = 'a7724c245fed1fd3a9dd08a82886c107b54905693039150f33359b2ed629e2c2';
export const CAPABILITY_UNIT_SHA = '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50';
export const capabilityMetadataLimits = Object.freeze({ maxCapabilitiesPerUnit: 10, maxLimitsPerUnit: 4 });
export const CAPABILITY_RELEASE_PAIRS = Object.freeze([
    Object.freeze({ version: '1', catalog_sha256: LEGACY_CAPABILITY_UNIT_SHA, capability_sha256: LEGACY_CAPABILITY_SHA }),
    Object.freeze({ version: '2-epa-acquisition', catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: PRIOR_ACQUISITION_CAPABILITY_SHA }),
    Object.freeze({ version: '3-epa-route', catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: PRIOR_ROUTE_CAPABILITY_SHA }),
    Object.freeze({ version: '4-epa-limitations', catalog_sha256: CAPABILITY_UNIT_SHA, capability_sha256: CAPABILITY_SHA }),
]);
export const capabilityKinds = ['definition', 'general_recommendation', 'conditional_rule', 'source_route', 'inquiry_step', 'explanation', 'limitation'] as const;
export const capabilitySubjects = ['accounting_methods', 'activity_records', 'agreement_period_alignment', 'certificate_quality_prerequisite', 'contract_certificate_claim', 'duplicate_consumption', 'electricity_units', 'factor_data_period', 'factor_update_adjustment', 'generation_boundary', 'grid_factor_source', 'grid_factor_uncertainty', 'grid_geography', 'market_procurement', 'methodology_adjustment', 'product_label_documentation', 'publisher_updates', 'reporting_methods', 'reporting_perspectives', 'source_date_recordkeeping', 'subregion_lookup', 'supplier_delivered_boundary', 'supplier_factor_inquiry'] as const;
export const requestedSubjects = [...capabilitySubjects, 'unrepresented_subject'] as const;
export interface Capability { id: string; kind: typeof capabilityKinds[number]; subject: typeof capabilitySubjects[number]; anchor: [number, number] }
export interface CapabilityLimit { id: string; anchor: [number, number] }
export interface CapabilityCatalog {
    schema_version: 1;
    capability_catalog_id: string;
    version: string;
    unit_catalog_sha256: string;
    source_release_sha256: string;
    condition_catalog_sha256: string;
    review: { status: string; expires_at: string; source_review: { reviewer: string; disposition: string; record_path: string }; qa_review: { reviewer: string; disposition: string; record_path: string } };
    kinds: string[];
    subjects: string[];
    units: { unit_id: string; capabilities: Capability[]; limits: CapabilityLimit[] }[];
    absence_policy: string;
    provenance: { reviewed_draft_sha256: string; qa_record_sha256: string; assembled_at: string; approval_note: string };
}
const need = (value: unknown, code = 'unit_catalog_invalid'): void => { if (!value) throw new CompositionError(code); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function parseCapabilities(bytes: Uint8Array, expectedSha: string, catalog: UnitCatalog, catalogSha: string, now = Date.now()): CapabilityCatalog {
    need(/^[a-f0-9]{64}$/.test(expectedSha) && hash(bytes) === expectedSha);
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new CompositionError('unit_catalog_invalid'); }
    need(exactKeys(raw, ['schema_version', 'capability_catalog_id', 'version', 'unit_catalog_sha256', 'source_release_sha256', 'condition_catalog_sha256', 'review', 'kinds', 'subjects', 'units', 'absence_policy', 'provenance']));
    const v = raw as CapabilityCatalog;
    need(v.schema_version === 1 && v.capability_catalog_id === 'scope2-website-unit-capabilities' && CAPABILITY_RELEASE_PAIRS.some(pair => pair.version === v.version && pair.catalog_sha256 === v.unit_catalog_sha256 && catalogSha === pair.catalog_sha256) && v.source_release_sha256 === catalog.source_release_sha256 && v.condition_catalog_sha256 === catalog.condition_catalog_sha256);
    need(exactKeys(v.review, ['status', 'expires_at', 'source_review', 'qa_review']) && v.review.status === 'approved_private');
    const expires = Date.parse(v.review.expires_at);
    need(Number.isFinite(expires) && expires > now && expires <= Date.parse(catalog.review.expires_at), 'unit_catalog_stale');
    for (const review of [v.review.source_review, v.review.qa_review]) need(exactKeys(review, ['reviewer', 'disposition', 'record_path']) && typeof review.reviewer === 'string' && review.reviewer.trim().length > 0 && review.disposition === 'approved_private' && typeof review.record_path === 'string' && review.record_path.length > 0);
    need(v.review.source_review.reviewer !== v.review.qa_review.reviewer);
    need(exactKeys(v.provenance, ['reviewed_draft_sha256', 'qa_record_sha256', 'assembled_at', 'approval_note']) && /^[a-f0-9]{64}$/.test(v.provenance.reviewed_draft_sha256) && /^[a-f0-9]{64}$/.test(v.provenance.qa_record_sha256) && Number.isFinite(Date.parse(v.provenance.assembled_at)) && Date.parse(v.provenance.assembled_at) <= now && typeof v.provenance.approval_note === 'string');
    need(same(v.kinds, capabilityKinds) && same(v.subjects, capabilitySubjects) && typeof v.absence_policy === 'string' && v.absence_policy.length > 0);
    need(Array.isArray(v.units) && v.units.length === catalog.units.length && same(v.units.map(u => u.unit_id), catalog.units.map(u => u.id)));
    const ids = new Set<string>();
    for (const entry of v.units) {
        need(exactKeys(entry, ['unit_id', 'capabilities', 'limits']) && Array.isArray(entry.capabilities) && entry.capabilities.length > 0 && entry.capabilities.length <= capabilityMetadataLimits.maxCapabilitiesPerUnit && Array.isArray(entry.limits) && entry.limits.length > 0 && entry.limits.length <= capabilityMetadataLimits.maxLimitsPerUnit);
        const unit = catalog.units.find(u => u.id === entry.unit_id)!;
        for (const [index, cap] of entry.capabilities.entries()) need(exactKeys(cap, ['id', 'kind', 'subject', 'anchor']) && cap.id === `${unit.id}-C${String(index + 1).padStart(2, '0')}` && capabilityKinds.includes(cap.kind) && capabilitySubjects.includes(cap.subject));
        for (const [index, limit] of entry.limits.entries()) need(exactKeys(limit, ['id', 'anchor']) && limit.id === `${unit.id}-L${String(index + 1).padStart(2, '0')}`);
        for (const item of [...entry.capabilities, ...entry.limits]) {
            need(!ids.has(item.id)); ids.add(item.id);
            need(Array.isArray(item.anchor) && item.anchor.length === 2 && item.anchor.every(Number.isSafeInteger) && item.anchor[0] >= 0 && item.anchor[1] > item.anchor[0] && item.anchor[1] <= unit.text.length && unit.text.slice(...item.anchor).trim().length > 0);
        }
    }
    need(CAPABILITY_RELEASE_PAIRS.some(pair => pair.version === v.version && pair.catalog_sha256 === catalogSha && pair.capability_sha256 === expectedSha));
    const freeze = (value: unknown): void => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } };
    freeze(v);
    return v;
}

export const flexibleConceptualKinds = ['definition', 'explanation', 'general_recommendation'] as const;
export const semanticTargetKinds = [] as const;
/** Labels describe conceptual demand, not a required source wording style.
 * Source routes, conditional effects, inquiries and limitations retain exact
 * kind/subject support. Full wording and task-fit review still apply. */
export function capabilityMatchesRequirement(requirement: Pick<SupportRequirement, 'kind' | 'subject'>, cap: Capability): boolean {
    if (requirement.subject === 'unrepresented_subject') return false;
    return (flexibleConceptualKinds as readonly string[]).includes(requirement.kind)
        || (cap.kind === requirement.kind && cap.subject === requirement.subject);
}
export const capabilityMatchPolicy = Object.freeze({
    version: 'capabilityMatchesRequirement.v19',
    predicate_sha256: hash(JSON.stringify({ implementation: capabilityMatchesRequirement.toString(), flexible_conceptual_kinds: flexibleConceptualKinds, semantic_target_kinds: semanticTargetKinds })),
    source_route: 'Affirmative source-route proof requires exact action kind and requested subject within the part-owned selection; matching labels do not establish full semantic coverage.',
});
export interface SupportRequirement {
    kind: typeof capabilityKinds[number];
    subject: typeof requestedSubjects[number];
    capability_ids: string[];
    blocking_limit_ids: string[];
}
/** Strict consistency proof, not a natural-language semantic oracle. The fresh
 * reviewer independently identifies requirements; its raw verdict is preserved.
 * A missing capability may justify a boundary but cannot approve an answer. */
export function validateSupportRequirements(raw: unknown, options: { background: boolean; covered: boolean; appropriatelyResolved: boolean; ownUnitIds: string[]; capabilities: CapabilityCatalog; ambiguityContext?: boolean }): void {
    const valid = (value: unknown) => need(value, 'selection_review_invalid');
    // The caller derives ambiguityContext only from the validated canonical kind/resolution.
    // Demand review separately enforces every sealed and cumulative need ID/count.
    valid(!options.ambiguityContext || !options.covered);
    valid(Array.isArray(raw) && raw.length <= 6 && (options.background ? raw.length === 0 : options.ambiguityContext === true || raw.length > 0));
    const requirements = raw as SupportRequirement[], seen = new Set<string>();
    const allCaps = options.capabilities.units.flatMap(unit => unit.capabilities.map(cap => ({ ...cap, unit_id: unit.unit_id })));
    const allLimits = options.capabilities.units.flatMap(unit => unit.limits);
    for (const requirement of requirements) {
        valid(exactKeys(requirement, ['kind', 'subject', 'capability_ids', 'blocking_limit_ids']) && capabilityKinds.includes(requirement.kind) && requestedSubjects.includes(requirement.subject) && strings(requirement.capability_ids) && requirement.capability_ids.length <= 8 && strings(requirement.blocking_limit_ids) && requirement.blocking_limit_ids.length <= 8);
        const key = `${requirement.kind}:${requirement.subject}`;
        valid(!seen.has(key)); seen.add(key);
        let hasRequiredSupport = false;
        for (const id of requirement.capability_ids) {
            const cap = allCaps.find(c => c.id === id);
            valid(cap && (!options.covered || options.ownUnitIds.includes(cap.unit_id)));
            if (cap && capabilityMatchesRequirement(requirement, cap)) hasRequiredSupport = true;
        }
        // Conceptual needs allow a suitable own wording role without label equality.
        // Action roles and strict conditional/limit targets remain independent needs.
        valid(requirement.capability_ids.length === 0 || hasRequiredSupport);
        valid(requirement.blocking_limit_ids.every(id => allLimits.some(limit => limit.id === id)));
        if (options.covered && options.appropriatelyResolved) valid(hasRequiredSupport && requirement.blocking_limit_ids.length === 0);
    }
}

/** Compact IDs and own wording offsets avoid duplicating the full approved
 * catalog in the provider packet. Full immutable unit text remains available. */
export function capabilityInput(capabilities: CapabilityCatalog, unitId: string) {
    const unit = capabilities.units.find(u => u.unit_id === unitId);
    need(unit);
    return { capabilities: unit!.capabilities, capability_limits: unit!.limits };
}
