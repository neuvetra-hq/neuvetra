import { hash } from '../research-passages/release';
import { compositionLimits, need, resolveUnitClosure, titleTextCharacters, type UnitCatalog } from './catalog';

export const sizeBundleVersion = 'size-bundles.v3';
export const sizeBundleLimits = Object.freeze({ maxRows: 32, maxVisits: 32768, maxBytes: 10000, maxPoolUnits: 24 });
export const sizeBundlePolicy = Object.freeze({ version: sizeBundleVersion, limits: sizeBundleLimits,
    eligibility: 'Apply caller structural eligibility before ranking and row truncation. An ineligible partial subset never prunes expansion: adding units can restore required support. Capability matches are necessary labels only, not semantic acceptance.',
    manual_fallback: 'Explicit manual answers use full normal selection validation and fresh semantic review; unknown bundle IDs never fall back.',
    ranking: 'Most retained original direct IDs, then most retained units, then fewer title+text characters, then canonical ID order. This is not a semantic ranking.',
    limitation: 'These are budget-feasible closed subsets of the previous selection only. Search and row/byte limits may omit useful alternatives; no completeness or task-coverage claim is made. A missing option is not proof of missing source evidence. An explicit manual alternative remains subject to full original selection limits. Preserve every sealed part and requirement; the chosen mapping still needs fresh semantic review.',
});
export interface SizeBundle {
    readonly id: string;
    readonly unit_ids: readonly string[];
    readonly unit_count: number;
    readonly title_text_characters: number;
}
export interface SizeBundleSet {
    readonly version: typeof sizeBundleVersion;
    readonly pool_unit_ids: readonly string[];
    readonly bundles: readonly SizeBundle[];
    readonly limits: typeof sizeBundleLimits;
    readonly display_limits: typeof compositionLimits;
    readonly visited: number;
    readonly feasible_candidates_seen: number;
    readonly eligible_candidates_seen: number;
    readonly search_limited: boolean;
    readonly output_limited: boolean;
    readonly ranking: string;
    readonly limitation: string;
    readonly sha256: string;
}
const freeze = <T>(value: T): T => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};
type Candidate = { mask: number; unit_ids: string[]; unit_count: number; title_text_characters: number; direct_count: number };
const rank = (a: Candidate, b: Candidate) => b.direct_count - a.direct_count || b.unit_count - a.unit_count || a.title_text_characters - b.title_text_characters || (a.unit_ids.join(',') < b.unit_ids.join(',') ? -1 : a.unit_ids.join(',') > b.unit_ids.join(',') ? 1 : 0);
const count = (mask: number) => { let total = 0; while (mask) { mask &= mask - 1; total++; } return total; };

/** Budget assistance only. The caller must first validate the whole original
 * proposal, including all sealed parts and references. Search never introduces
 * an outside unit, changes wording, removes companions, or judges task coverage. */
export function prepareSizeBundles(unitIds: readonly string[], catalog: UnitCatalog, isEligible: (unitIds: readonly string[]) => boolean = () => true): SizeBundleSet {
    need(Array.isArray(unitIds) && unitIds.length > 0, 'size_bundle_invalid');
    const direct = [...new Set(unitIds)], pool = resolveUnitClosure(direct, catalog);
    need(pool.length <= sizeBundleLimits.maxPoolUnits, 'size_bundle_pool_too_large');
    need(pool.length > compositionLimits.maxUnits || titleTextCharacters(pool) > compositionLimits.maxTitleTextCharacters, 'size_bundle_not_oversized');
    const ids = pool.map(unit => unit.id), directMask = ids.reduce((mask, id, i) => direct.includes(id) ? mask | (1 << i) : mask, 0);
    const closureMasks = ids.map(id => resolveUnitClosure([id], catalog).reduce((mask, unit) => mask | (1 << ids.indexOf(unit.id)), 0));
    const costs = pool.map(unit => titleTextCharacters([unit]));
    const seen = new Set<number>(), expanded = new Map<number, number>(), best: Candidate[] = [];
    let visited = 0, eligibleSeen = 0, searchLimited = false;
    const candidate = (mask: number): Candidate | null => {
        const unitCount = count(mask);
        if (unitCount > compositionLimits.maxUnits) return null;
        let characters = 0;
        for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) characters += costs[i]!;
        if (characters > compositionLimits.maxTitleTextCharacters) return null;
        return { mask, unit_ids: ids.filter((_id, i) => Boolean(mask & (1 << i))), unit_count: unitCount, title_text_characters: characters, direct_count: count(mask & directMask) };
    };
    // Inclusion search visits feasible partial subsets immediately. Branches
    // already exceeding either positive-cost limit cannot recover by adding.
    const visit = (value: Candidate, next: number) => {
        if (visited >= sizeBundleLimits.maxVisits) { searchLimited = true; return; }
        visited++;
        if (value.mask && !seen.has(value.mask)) {
            seen.add(value.mask);
            if (isEligible(Object.freeze([...value.unit_ids]))) {
                eligibleSeen++; best.push(value); best.sort(rank);
                if (best.length > sizeBundleLimits.maxRows) best.pop();
            }
        }
        const priorNext = expanded.get(value.mask);
        if (priorNext !== undefined && priorNext <= next) return;
        expanded.set(value.mask, next);
        for (let i = next; i < pool.length; i++) {
            const mask = value.mask | closureMasks[i]!;
            if (mask === value.mask) continue;
            const child = candidate(mask);
            if (child) visit(child, i + 1);
            if (searchLimited) return;
        }
    };
    visit({ mask: 0, unit_ids: [], unit_count: 0, title_text_characters: 0, direct_count: 0 }, 0);
    let outputLimited = eligibleSeen > best.length;
    const render = () => {
        const record = {
            version: sizeBundleVersion as typeof sizeBundleVersion, pool_unit_ids: [...ids],
            bundles: best.map((value, i) => ({ id: `b${String(i + 1).padStart(2, '0')}`, unit_ids: [...value.unit_ids], unit_count: value.unit_count, title_text_characters: value.title_text_characters })),
            limits: { ...sizeBundleLimits }, display_limits: { ...compositionLimits }, visited, feasible_candidates_seen: seen.size, eligible_candidates_seen: eligibleSeen,
            search_limited: searchLimited, output_limited: outputLimited,
            ranking: sizeBundlePolicy.ranking, limitation: sizeBundlePolicy.limitation,
        };
        return { ...record, sha256: hash(JSON.stringify(record)) };
    };
    let result = render();
    while (new TextEncoder().encode(JSON.stringify(result)).length > sizeBundleLimits.maxBytes && best.length) {
        best.pop(); outputLimited = true; result = render();
    }
    need(new TextEncoder().encode(JSON.stringify(result)).length <= sizeBundleLimits.maxBytes, 'size_bundle_packet_too_large');
    return freeze(result);
}
