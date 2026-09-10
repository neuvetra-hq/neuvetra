import { hash } from '../research-passages/release';
import { CompositionError, compositionLimits, exactKeys, need, resolveUnitClosure, strings, titleTextCharacters, type AnswerUnit, type UnitCatalog } from './catalog';
import { capabilityMatchPolicy, capabilityMatchesRequirement, capabilityKinds, requestedSubjects, type CapabilityCatalog, type SupportRequirement } from './capabilities';
import { ContractValidationError, contractNeed, contextIds, questionFragment, resolveQuestionContract, validateQuestionContract, type ContextId, type QuestionContractProposal } from './question-contract';
import { analyzeSelectionSize, parseSelection, parseSelectionReview, type Selection, type SelectionProposal, type SelectionReview } from './selection';
import { parseQuestionAnalysis, type QuestionAnalysis } from './question-analysis';
import { prepareSizeBundles } from './size-bundles';

export const sourceResolutions = ['source_available', 'withheld', 'coverage_missing', 'action_out_of_scope', 'context_required'] as const;
type Requirement = QuestionAnalysis['parts'][number]['requirements'][number];
export interface DemandState {
    analysis: QuestionAnalysis;
    additions: { part_id: string; requirements: Requirement[] }[];
    seal_sha256: string;
}
const freeze = <T>(value: T): T => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export function initialDemand(analysis: QuestionAnalysis): DemandState {
    return freeze({ analysis, additions: [], seal_sha256: analysis.seal_sha256 });
}
const requirementsFor = (demand: DemandState, id: string): Requirement[] => [...demand.analysis.parts.find(part => part.id === id)!.requirements, ...(demand.additions.find(entry => entry.part_id === id)?.requirements ?? [])];
/** Source-exposed stages receive complete exact fragments, but cannot repartition
 * them. The index table is needed only by the preceding source-blind analyzer. */
export function demandInput(demand: DemandState, question: string) {
    need(hash(question) === demand.analysis.question_sha256, 'question_analysis_invalid');
    return { version: demand.analysis.version, taxonomy_version: demand.analysis.taxonomy_version, question_sha256: demand.analysis.question_sha256,
        initial_seal_sha256: demand.analysis.seal_sha256, seal_sha256: demand.seal_sha256, operation: demand.analysis.operation,
        parts: demand.analysis.parts.map(part => ({ ...part, requirements: requirementsFor(demand, part.id), question_fragment: questionFragment(question, part) })) };
}

/** The schema is scoped to the immutable initial analysis, never a previous
 * selection. Cumulative additions remain service-owned: their historical array
 * insertion order is deliberately not inferred from part order here. */
export function plannerMaterialIds(raw: unknown, question: string): string[] {
    const valid = (value: unknown): void => need(value, 'question_analysis_invalid');
    valid(exactKeys(raw, ['version', 'taxonomy_version', 'question_sha256', 'initial_seal_sha256', 'seal_sha256', 'operation', 'parts']));
    const bound = raw as ReturnType<typeof demandInput>;
    valid(Array.isArray(bound.parts) && bound.parts.length >= 1 && bound.parts.length <= 12 && typeof bound.seal_sha256 === 'string' && /^[a-f0-9]{64}$/.test(bound.seal_sha256));
    const additions: DemandState['additions'] = [];
    const parts = bound.parts.map((part, index) => {
        valid(exactKeys(part, ['id', 'start_token', 'end_token', 'kind', 'requirements', 'ambiguity_context_ids', 'question_fragment']) && part.id === 'q' + (index + 1) && Array.isArray(part.requirements) && part.requirements.length <= 6);
        const initial: Requirement[] = [], added: Requirement[] = [], seen = new Set<string>();
        for (const requirement of part.requirements) {
            valid(exactKeys(requirement, ['id', 'kind', 'subject']) && capabilityKinds.includes(requirement.kind) && requestedSubjects.includes(requirement.subject));
            const key = requirement.kind + ':' + requirement.subject;
            valid(!seen.has(key)); seen.add(key);
            if (!added.length && requirement.id === part.id + '-r' + (initial.length + 1)) initial.push({ ...requirement });
            else { valid(requirement.id === part.id + '-a' + (added.length + 1)); added.push({ ...requirement }); }
        }
        valid(part.kind !== 'background' || added.length === 0);
        if (added.length) additions.push({ part_id: part.id, requirements: added });
        return { id: part.id, start_token: part.start_token, kind: part.kind, requirements: initial.map(({ kind, subject }) => ({ kind, subject })), ambiguity_context_ids: part.ambiguity_context_ids };
    });
    const analysis = parseQuestionAnalysis({ operation: bound.operation, parts }, question);
    valid(bound.initial_seal_sha256 === analysis.seal_sha256 && (additions.length > 0 || bound.seal_sha256 === analysis.seal_sha256));
    const expected = demandInput({ analysis, additions, seal_sha256: bound.seal_sha256 }, question);
    valid(JSON.stringify(expected) === JSON.stringify(bound));
    return analysis.parts.filter(part => part.kind !== 'background').map(part => part.id);
}

/** Explicit v6 wire: only material rows and facets are supplied; background and
 * the redundant aggregate are server-derived through the canonical validator.
 * All references are checked before projection; nothing is deleted or repaired. */
function project(raw: unknown, question: string, catalog: UnitCatalog, demand: DemandState): SelectionProposal {
    contractNeed(hash(question) === demand.analysis.question_sha256, 'contract_shape');
    contractNeed(exactKeys(raw, ['facets', 'question_contract']), 'selection_shape');
    const p = raw as { facets: Selection['facets']; question_contract: { parts: { id: string; resolution: typeof sourceResolutions[number]; facet_ids: string[]; context_ids: ContextId[] }[] } };
    contractNeed(Array.isArray(p.facets) && p.facets.length <= 6, 'selection_shape');
    for (let i = 0; i < p.facets.length; i++) {
        const facet = p.facets[i]!;
        contractNeed(exactKeys(facet, ['id', 'unit_ids']) && facet.id === `f${i + 1}`, 'facet_shape');
        resolveUnitClosure(facet.unit_ids, catalog);
    }
    const material = demand.analysis.parts.filter(part => part.kind !== 'background');
    contractNeed(material.length > 0 && exactKeys(p.question_contract, ['parts']) && Array.isArray(p.question_contract.parts) && p.question_contract.parts.length === material.length, 'contract_shape');
    for (let i = 0; i < p.question_contract.parts.length; i++) {
        const part = p.question_contract.parts[i]!, sealed = material[i]!;
        contractNeed(exactKeys(part, ['id', 'resolution', 'facet_ids', 'context_ids']) && part.id === sealed.id && sourceResolutions.includes(part.resolution) && strings(part.facet_ids) && strings(part.context_ids), 'part_shape');
        contractNeed(part.facet_ids.every(id => p.facets.some(facet => facet.id === id)), 'part_references');
        contractNeed(part.context_ids.every(id => contextIds.includes(id)), 'part_references');
        if (part.resolution === 'context_required') contractNeed(part.context_ids.length >= 1 && part.context_ids.length <= 3, 'context_ids_required', sealed.id);
        else contractNeed(part.context_ids.length === 0, 'context_ids_forbidden', sealed.id);
        if (sealed.kind === 'ambiguous_reference') contractNeed(part.resolution === 'context_required' && JSON.stringify(part.context_ids) === JSON.stringify(sealed.ambiguity_context_ids), 'ambiguity_context_mismatch', sealed.id);
    }
    const withheld = p.question_contract.parts.some(part => ['coverage_missing', 'action_out_of_scope', 'context_required'].includes(part.resolution));
    // The wire requires an empty displayed selection for whole withholding.
    // Even known nonempty mappings reject; no reference is silently cleared.
    if (withheld) {
        contractNeed(p.facets.length === 0 && p.question_contract.parts.every(part => part.facet_ids.length === 0), 'part_references');
        contractNeed(p.question_contract.parts.every(part => part.resolution !== 'source_available'), 'resolution_consistency');
    }
    else contractNeed(p.question_contract.parts.every(part => part.resolution !== 'withheld'), 'resolution_consistency');
    const contract: QuestionContractProposal = { operation: demand.analysis.operation,
        parts: demand.analysis.parts.map(sealed => {
            if (sealed.kind === 'background') return { id: sealed.id, start_token: sealed.start_token, kind: sealed.kind, resolution: 'background' as const, facet_ids: [], context_ids: [] };
            const part = p.question_contract.parts.find(row => row.id === sealed.id)!;
            return { ...structuredClone(part), start_token: sealed.start_token, kind: sealed.kind,
                resolution: part.resolution === 'source_available' ? 'covered' as const : part.resolution === 'withheld' ? 'not_answered' as const : part.resolution };
        }) };
    const aggregate = validateQuestionContract(resolveQuestionContract(contract, question), question, p.facets.map(facet => facet.id));
    return { decision: aggregate.decision, reason: aggregate.reason, facets: structuredClone(p.facets), question_contract: contract };
}
export const plannerProjectionContract = Object.freeze({
    version: 'derived-aggregate-planner.v1',
    policy: 'Exactly question_contract and facets. Validate all supplied rows, references, states and withholding first; derive only aggregate decision/reason through the unchanged resolved canonical validator. Legacy aggregate fields reject; no gap or reference is repaired. Fresh semantic review remains mandatory.',
    projection: project.toString(), resolve: resolveQuestionContract.toString(), canonical_validation: validateQuestionContract.toString(),
});
export function parseDemandSelection(raw: unknown, question: string, catalog: UnitCatalog, demand: DemandState): Selection {
    return parseSelection(project(raw, question, catalog, demand), question, catalog);
}
export const sizeChoiceVersion = 'demand-size-choice.v3';
export const sizeChoicePolicy = Object.freeze({ version: sizeChoiceVersion, schema_version: sizeChoiceVersion,
    wire: 'Exactly bundle_id and alternative_selection. Listed bNN requires an empty array; manual/none requires exactly one complete normal proposal.',
    provenance: 'Recompute the original otherwise-valid oversized proposal, complete current bundle packet and question/demand/catalog/capability/predicate bindings before any choice.',
    eligibility: 'Before ranking or top-32 truncation, every cumulative requirement must match at least one capability in the union of that part\'s own projected facet closures. Keep every facet nonempty and closed with exact bundle union. Never borrow another part\'s support or filter capabilities by limits. A match is necessary structural support only; a missing listed choice is not evidence absence.',
    projection: 'For an explicitly chosen listed closed bundle, expand each original facet to its complete companion closure, then intersect. Preserve every facet ID and every sealed part/state/reference/context. Reject empty facets, open dependencies or a union unequal to the chosen bundle.',
    alternatives: 'manual must be a complete normal answer using the full approved catalog; none must be a complete normal whole boundary. No unknown-ID fallback, hidden gap, facet dropping or reassignment.',
    review: 'The server does not choose a bundle or judge coverage. Full normal eight-unit/4000-character parsing and a fresh semantic review remain required; no additional attempt.',
});
export type DemandSizeCorrectionPacket = Extract<NonNullable<ReturnType<typeof demandSelectionCorrection>>, { kind: 'selection_size' }>;
const packetSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A listed choice projects only a revalidated original assignment. The server
 * never supplies a semantic choice or removes an empty facet/part to fit. */
export function parseDemandSizeSelection(raw: unknown, question: string, catalog: UnitCatalog, demand: DemandState, packet: unknown, capabilities: CapabilityCatalog): Selection {
    need(exactKeys(raw, ['bundle_id', 'alternative_selection']) && typeof raw.bundle_id === 'string' && Array.isArray(raw.alternative_selection), 'selection_invalid');
    need(exactKeys(packet, ['kind', 'previous_selection_trust', 'previous_selection', 'closure_unit_ids', 'closure_title_text_characters', 'limits', 'feasible_bundles', 'minimum_reduction', 'exact_unit_costs', 'size_choice_provenance']), 'selection_invalid');
    const supplied = packet as DemandSizeCorrectionPacket;
    const verified = demandSelectionCorrection(supplied.previous_selection, question, catalog, demand, capabilities);
    need(verified?.kind === 'selection_size' && packetSame(supplied, verified), 'selection_invalid');
    const { bundle_id, alternative_selection } = raw as { bundle_id: string; alternative_selection: unknown[] };
    if (bundle_id === 'manual' || bundle_id === 'none') {
        need(alternative_selection.length === 1, 'selection_invalid');
        const plan = parseDemandSelection(alternative_selection[0], question, catalog, demand);
        need(bundle_id === 'manual' ? plan.decision === 'answer' : plan.decision !== 'answer', 'selection_invalid');
        return plan;
    }
    need(alternative_selection.length === 0, 'selection_invalid');
    const chosen = supplied.feasible_bundles.bundles.find(bundle => bundle.id === bundle_id);
    need(chosen, 'selection_invalid');
    // project rechecks all original references before deriving any intersection.
    const original = project(supplied.previous_selection, question, catalog, demand);
    const facets = original.facets.map(facet => {
        const unit_ids = resolveUnitClosure(facet.unit_ids, catalog).map(unit => unit.id).filter(id => chosen!.unit_ids.includes(id));
        need(unit_ids.length > 0, 'selection_invalid');
        need(packetSame(resolveUnitClosure(unit_ids, catalog).map(unit => unit.id), unit_ids), 'selection_invalid');
        return { id: facet.id, unit_ids };
    });
    const previous = supplied.previous_selection as { question_contract: unknown };
    const plan = parseDemandSelection({ facets, question_contract: structuredClone(previous.question_contract) }, question, catalog, demand);
    const union = resolveUnitClosure([...new Set(plan.facets.flatMap(facet => facet.unit_ids))], catalog);
    need(packetSame(union.map(unit => unit.id), chosen!.unit_ids) && union.length === chosen!.unit_count && titleTextCharacters(union) === chosen!.title_text_characters, 'selection_invalid');
    return plan;
}
export const demandContractGuidance: Record<string, string> = {
    selection_shape: 'Return exactly question_contract and facets with the declared types and limits. Never return decision or reason; the server derives those redundant whole-response fields from all validated parts.',
    facet_shape: 'Use sequential f IDs and known unit_ids only; never supply replacement question or answer text.',
    unit_selection: 'Use known distinct unit IDs and all required companions. Do not change reviewed text.',
    contract_shape: 'question_contract has only parts, exactly one for every sealed MATERIAL question-analysis part in its original order. Omit every sealed background row; only the server derives it. Do not return operation, starts, ends, kinds or new part IDs.',
    part_shape: 'Each part contains only id, resolution, facet_ids and context_ids. Use source_available, withheld, coverage_missing, action_out_of_scope, context_required; background rows and states are forbidden. Never legacy covered or not_answered.',
    part_references: 'Every reference must name an existing facet. For whole withholding, facets and every facet_ids must be empty. Preserve every independently established gap; use neutral withheld for other material parts without claiming support exists or is absent.',
    resolution_consistency: 'source_available is for affirmative answers. With an actual gap, withhold the whole response and use neutral withheld for other material parts; never hide an independent gap or sealed ambiguity. Without any actual gap, withheld is forbidden. Only the server derives sealed background entries; never return a background row or state.',
    context_ids_required: 'The targeted context_required part needs 1-3 distinct known relevant context IDs. A dependent request may repeat the relevant referent category when it truly needs that clarification. Do not invent context: neutral unanswered remainder can use withheld only with an independently established whole-question gap. Preserve every action/coverage gap and all sealed ambiguity.',
    context_ids_forbidden: 'The targeted part must have context_ids:[] unless its actual resolution is context_required. Do not change its meaning merely to keep an irrelevant context ID.',
    ambiguity_context_mismatch: 'The targeted sealed ambiguous_reference must remain context_required with exactly its sealed ambiguity_context_ids. Never guess, replace or erase that reference, including during whole withholding.',
    decision_consistency: 'Actual gaps determine the whole response: action_out_of_scope before coverage_missing before context_required. With no gap use answer/covered and source_available for every material part.',
    operation_boundary: 'The sealed calculate or submit_or_file operation requires action_out_of_scope; explanation cannot perform excluded execution.',
};
/** Built only from a fully validated oversized original. Intersecting two closed
 * sets preserves dependencies, but explicit checks keep this contract auditable. */
function sizeEligibility(original: SelectionProposal, catalog: UnitCatalog, demand: DemandState, capabilities: CapabilityCatalog) {
    need(capabilities && Array.isArray(capabilities.units), 'selection_invalid');
    const closures = original.facets.map(facet => ({ id: facet.id, units: resolveUnitClosure(facet.unit_ids, catalog) }));
    return (ids: readonly string[]): boolean => {
        const chosen = new Set(ids);
        const projected = closures.map(facet => ({ id: facet.id, units: facet.units.filter(unit => chosen.has(unit.id)) }));
        if (projected.some(facet => !facet.units.length || facet.units.some(unit => unit.required_unit_ids.some(id => !facet.units.some(own => own.id === id))))) return false;
        const union = new Set(projected.flatMap(facet => facet.units.map(unit => unit.id)));
        if (union.size !== chosen.size || ids.some(id => !union.has(id))) return false;
        return original.question_contract.parts.every(part => {
            const own = new Set(projected.filter(facet => part.facet_ids.includes(facet.id)).flatMap(facet => facet.units.map(unit => unit.id)));
            const caps = capabilities.units.filter(unit => own.has(unit.unit_id)).flatMap(unit => unit.capabilities);
            return requirementsFor(demand, part.id).every(requirement => caps.some(cap => capabilityMatchesRequirement(requirement, cap)));
        });
    };
}
export function demandSelectionCorrection(raw: unknown, question: string, catalog: UnitCatalog, demand: DemandState, capabilities: CapabilityCatalog) {
    try { parseDemandSelection(raw, question, catalog, demand); return null; }
    catch (error) {
        if (!(error instanceof CompositionError)) return null;
        if (error.code === 'selection_too_large') {
            const packet = analyzeSelectionSize(project(raw, question, catalog, demand), question, catalog);
            if (!packet) return null;
            const units = resolveUnitClosure(packet.closure_unit_ids, catalog);
            return { ...packet, previous_selection: structuredClone(raw), feasible_bundles: prepareSizeBundles(packet.previous_selection.facets.flatMap(facet => facet.unit_ids), catalog, sizeEligibility(packet.previous_selection, catalog, demand, capabilities)), minimum_reduction: {
                units: Math.max(0, units.length - compositionLimits.maxUnits), title_text_characters: Math.max(0, packet.closure_title_text_characters - compositionLimits.maxTitleTextCharacters) },
                exact_unit_costs: units.map(unit => ({ id: unit.id, title_text_characters: titleTextCharacters([unit]), required_unit_ids: [...unit.required_unit_ids],
                    closure_unit_ids: resolveUnitClosure([unit.id], catalog).map(companion => companion.id), closure_title_text_characters: titleTextCharacters(resolveUnitClosure([unit.id], catalog)) })),
                size_choice_provenance: { version: sizeChoiceVersion, question_sha256: hash(question), demand_record_sha256: hash(JSON.stringify(demand)), catalog_record_sha256: hash(JSON.stringify(catalog)), capability_record_sha256: hash(JSON.stringify(capabilities)), predicate_version: capabilityMatchPolicy.version, predicate_sha256: capabilityMatchPolicy.predicate_sha256, previous_selection_sha256: hash(JSON.stringify(raw)) } };
        }
        if (error.code !== 'selection_invalid') return null;
        const issue = error instanceof ContractValidationError ? error.issue : 'unit_selection';
        return { kind: 'selection_contract' as const, previous_selection_trust: 'untrusted' as const, previous_selection: structuredClone(raw), validation_issue: issue,
            ...(error instanceof ContractValidationError && error.partId ? { validation_target: { part_id: error.partId, field: 'context_ids' as const } } : {}),
            validation_guidance: demandContractGuidance[issue] ?? demandContractGuidance.contract_shape };
    }
}

interface RequirementProof { id: string; capability_ids: string[]; blocking_limit_ids: string[] }
interface DemandReviewPart { id: string; faithful: boolean; appropriately_resolved: boolean; requirements: RequirementProof[]; additional_requirements: SupportRequirement[] }
export type DemandReview = Omit<SelectionReview, 'question_parts'> & { question_parts: DemandReviewPart[] };
/** Wire IDs resolve to sealed types on the server. A later reviewer cannot
 * remove, retype, or forget an initial or previously added material need. */
export function parseDemandReview(raw: unknown, plan: Selection, units: AnswerUnit[], catalog: UnitCatalog, capabilities: CapabilityCatalog, demand: DemandState) {
    const valid = (value: unknown) => need(value, 'selection_review_invalid');
    valid(exactKeys(raw, ['decision', 'decomposition_complete', 'relevant', 'scope_appropriate', 'context_appropriate', 'premise_handled', 'task_fit', 'proportionate', 'question_parts', 'facets', 'issues']));
    const wire = raw as DemandReview;
    valid(Array.isArray(wire.question_parts) && wire.question_parts.length === demand.analysis.parts.length);
    const additions = structuredClone(demand.additions);
    const parts = wire.question_parts.map((part, i) => {
        const sealed = demand.analysis.parts[i]!, requirements = requirementsFor(demand, sealed.id);
        valid(exactKeys(part, ['id', 'faithful', 'appropriately_resolved', 'requirements', 'additional_requirements']) && part.id === sealed.id && typeof part.faithful === 'boolean' && typeof part.appropriately_resolved === 'boolean');
        valid(Array.isArray(part.requirements) && part.requirements.length === requirements.length && Array.isArray(part.additional_requirements) && part.additional_requirements.length <= 3 && requirements.length + part.additional_requirements.length <= 6);
        valid(part.additional_requirements.every(requirement => exactKeys(requirement, ['kind', 'subject', 'capability_ids', 'blocking_limit_ids'])));
        const support = part.requirements.map((proof, j) => {
            const requirement = requirements[j]!;
            valid(exactKeys(proof, ['id', 'capability_ids', 'blocking_limit_ids']) && proof.id === requirement.id);
            return { kind: requirement.kind, subject: requirement.subject, capability_ids: proof.capability_ids, blocking_limit_ids: proof.blocking_limit_ids };
        });
        // The existing strict proof validator checks every added type/ID and
        // duplicate kind/subject together with the immutable original needs.
        support.push(...part.additional_requirements);
        if (part.additional_requirements.length) {
            let entry = additions.find(value => value.part_id === sealed.id);
            if (!entry) { entry = { part_id: sealed.id, requirements: [] }; additions.push(entry); }
            for (const requirement of part.additional_requirements) entry.requirements.push({ id: `${sealed.id}-a${entry.requirements.length + 1}`, kind: requirement.kind, subject: requirement.subject });
        }
        return { id: part.id, faithful: part.faithful, appropriately_resolved: part.appropriately_resolved, support_requirements: support };
    });
    const review = parseSelectionReview({ ...wire, question_parts: parts }, plan, units, catalog, capabilities);
    // A semantic rejection of the sealed task cannot acquire a source-exposed
    // analysis rewrite. Raw review was already retained by the provider journal.
    if (review.question_parts.some(part => !part.faithful)) throw new CompositionError('question_analysis_not_verified');
    const next = additions.length ? freeze({ analysis: demand.analysis, additions, seal_sha256: hash(JSON.stringify({ initial_seal_sha256: demand.analysis.seal_sha256, additions })) }) : demand;
    return { review, demand: next };
}
