import { dependencyClosure, hash, record } from '../research-passages/release';
import { validateConceptualNumbers } from '../research-passages/numeric-policy';
import type { VerifiedPassages } from '../research-passages/types';
export class CompositionError extends Error {
    constructor(public readonly code: string) { super(code); }
}
export const need = (ok: unknown, code = 'selection_invalid'): void => { if (!ok)
    throw new CompositionError(code); };
export const exactKeys = (v: unknown, keys: string[]): v is Record<string, unknown> => record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.trim().length > 0) && new Set(v).size === v.length;
export interface AnswerUnit {
    id: string;
    title: string;
    text: string;
    type: 'source_summary' | 'reviewed_interpretation';
    passage_ids: string[];
    support: {
        passage_id: string;
        quote: string;
    }[];
    required_unit_ids: string[];
    coverage: string[];
}
export interface UnitCatalog {
    schema_version: 1;
    catalog_id: string;
    version: string;
    source_release_sha256: string;
    condition_catalog_sha256: string;
    review: {
        status: string;
        expires_at: string;
        source_review: unknown;
        qa_review: unknown;
    };
    units: AnswerUnit[];
}
export interface VerifiedCatalog {
    catalog: UnitCatalog;
    sha256: string;
}
export const SOURCE_SHA = '38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f';
export const CONDITIONS_SHA = '063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6';
/** The expected digest is operator-reviewed code/configuration, never model or browser input. */
export function parseUnitCatalog(bytes: Uint8Array, expectedSha: string, verified: VerifiedPassages, now = Date.now()): VerifiedCatalog {
    need(/^[a-f0-9]{64}$/.test(expectedSha) && hash(bytes) === expectedSha, 'unit_catalog_invalid');
    let raw: unknown;
    try {
        raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    catch {
        throw new CompositionError('unit_catalog_invalid');
    }
    need(exactKeys(raw, ['schema_version', 'catalog_id', 'version', 'source_release_sha256', 'condition_catalog_sha256', 'review', 'units']), 'unit_catalog_invalid');
    const v = raw as UnitCatalog;
    need(v.schema_version === 1 && v.catalog_id === 'scope2-website-answer-units' && v.version === '1' && v.source_release_sha256 === SOURCE_SHA && verified.sha256 === SOURCE_SHA && v.condition_catalog_sha256 === CONDITIONS_SHA, 'unit_catalog_invalid');
    need(exactKeys(v.review, ['status', 'expires_at', 'source_review', 'qa_review']) && v.review.status === 'approved_private', 'unit_catalog_invalid');
    const expiry = Date.parse(v.review.expires_at);
    need(Number.isFinite(expiry) && expiry > now && expiry <= Date.parse(verified.release.review.expires_at ?? ''), 'unit_catalog_stale');
    for (const review of [v.review.source_review, v.review.qa_review]) {
        need(exactKeys(review, ['reviewer', 'reviewed_at', 'disposition']) && typeof review.reviewer === 'string' && review.reviewer.trim() && review.disposition === 'approved_private' && typeof review.reviewed_at === 'string' && Number.isFinite(Date.parse(review.reviewed_at)) && Date.parse(review.reviewed_at) <= now, 'unit_catalog_invalid');
    }
    need((v.review.source_review as {
        reviewer: string;
    }).reviewer !== (v.review.qa_review as {
        reviewer: string;
    }).reviewer, 'unit_catalog_invalid');
    need(Array.isArray(v.units) && v.units.length >= 1 && v.units.length <= 48 && new Set(v.units.map(u => u.id)).size === v.units.length, 'unit_catalog_invalid');
    for (const u of v.units) {
        need(exactKeys(u, ['id', 'title', 'text', 'type', 'passage_ids', 'support', 'required_unit_ids', 'coverage']) && /^U\d{2}$/.test(u.id) && typeof u.title === 'string' && u.title.trim().length > 0 && u.title.length <= 100 && typeof u.text === 'string' && u.text.trim().length >= 12 && u.text.length <= 850 && ['source_summary', 'reviewed_interpretation'].includes(u.type) && strings(u.passage_ids) && u.passage_ids.length > 0 && strings(u.required_unit_ids) && strings(u.coverage) && u.coverage.length > 0, 'unit_catalog_invalid');
        const closure = dependencyClosure(u.passage_ids, verified.passages);
        need(closure.length === u.passage_ids.length && closure.every(p => u.passage_ids.includes(p.id)), 'unit_catalog_invalid');
        need(Array.isArray(u.support) && u.support.length >= u.passage_ids.length && u.support.length <= 24, 'unit_catalog_invalid');
        for (const a of u.support)
            need(exactKeys(a, ['passage_id', 'quote']) && u.passage_ids.includes(a.passage_id) && typeof a.quote === 'string' && a.quote.length >= 12 && a.quote.length <= 900 && closure.find(p => p.id === a.passage_id)!.text.includes(a.quote), 'unit_catalog_invalid');
        need(u.passage_ids.every(id => u.support.some(a => a.passage_id === id)), 'unit_catalog_invalid');
        validateConceptualNumbers(u.text, [...closure.map(p => p.text), ...verified.release.sources.map(s => s.version)]);
    }
    for (const u of v.units)
        selectedUnits([u.id], v);
    const freeze = (value: unknown): void => { if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    } };
    freeze(v);
    return { catalog: v, sha256: expectedSha };
}
export const compositionLimits = { maxUnits: 8, maxTitleTextCharacters: 4000 } as const;
export const titleTextCharacters = (units: AnswerUnit[]): number => units.reduce((n, u) => n + u.text.length + u.title.length, 0);
/** Resolve only valid known IDs and all companions before classifying size.
 * This helper never authorizes an oversized result for display.
 */
export function resolveUnitClosure(ids: string[], catalog: UnitCatalog): AnswerUnit[] {
    need(strings(ids) && ids.length > 0 && ids.length <= catalog.units.length);
    const chosen = new Set<string>(), visiting = new Set<string>();
    const visit = (id: string) => {
        need(!visiting.has(id), 'unit_catalog_invalid');
        if (chosen.has(id))
            return;
        const unit = catalog.units.find(u => u.id === id);
        need(unit, 'selection_invalid');
        visiting.add(id);
        for (const required of unit!.required_unit_ids)
            visit(required);
        visiting.delete(id);
        chosen.add(id);
    };
    for (const id of ids)
        visit(id);
    return catalog.units.filter(u => chosen.has(u.id));
}
/** Stable source-catalog order, not model order; companions cannot be dropped. */
export function selectedUnits(ids: string[], catalog: UnitCatalog): AnswerUnit[] {
    const result = resolveUnitClosure(ids, catalog);
    need(result.length <= compositionLimits.maxUnits && titleTextCharacters(result) <= compositionLimits.maxTitleTextCharacters, 'selection_too_large');
    return result;
}
