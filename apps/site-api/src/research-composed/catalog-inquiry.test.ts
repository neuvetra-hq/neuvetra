import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hash, parsePassageRelease } from '../research-passages/release'
import { parseUnitCatalog, selectedUnits, SOURCE_SHA } from './catalog'
const now = Date.parse('2026-09-12T12:00:00Z')
const oldBytes = readFileSync(new URL('../../../../data/research/answer-units/scope2-website.v1.json', import.meta.url))
const bytes = readFileSync(new URL('../../../../data/research/answer-units/scope2-website.epa-inquiry.v1.json', import.meta.url))
const expected = 'adb43b8a9e90cbe85f382988dedc16e16f82f7a596e0bcf5f5e98ba2f84630cd'
const release = parsePassageRelease(JSON.parse(readFileSync(new URL('../../../../data/research/releases/scope2-website.v1.json', import.meta.url), 'utf8')), now)
const verified = { release, passages: release.passages, sha256: SOURCE_SHA }

test('EPA inquiry version preserves all22 old units and the source review deadline', () => {
  expect(hash(oldBytes)).toBe('c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f')
  expect(hash(bytes)).toBe(expected)
  const old = JSON.parse(oldBytes.toString()), catalog = parseUnitCatalog(bytes, expected, verified, now).catalog
  expect(catalog.version).toBe('2-epa-inquiry')
  expect(catalog.units.slice(0, 22)).toEqual(old.units)
  expect(catalog.units).toHaveLength(23)
  expect(catalog.review.expires_at).toBe(old.review.expires_at)
  expect(selectedUnits(['U23'], catalog).map(u => u.id)).toEqual(['U23'])
  expect(catalog.units[22]!.passage_ids).toEqual(['S06', 'S11', 'S12', 'S15'])
})

test('inquiry wording cannot reuse a reviewed digest or omit its period dependency', () => {
  const changed = JSON.parse(bytes.toString()); changed.units[22].text += ' This validates the supplied factor.'
  expect(() => parseUnitCatalog(Buffer.from(JSON.stringify(changed)), expected, verified, now)).toThrow('unit_catalog_invalid')
  const incomplete = JSON.parse(bytes.toString()); incomplete.units[22].passage_ids = ['S06', 'S11', 'S12']; incomplete.units[22].support = incomplete.units[22].support.filter((s: { passage_id: string }) => s.passage_id !== 'S15')
  const incompleteBytes = Buffer.from(JSON.stringify(incomplete))
  expect(() => parseUnitCatalog(incompleteBytes, hash(incompleteBytes), verified, now)).toThrow('unit_catalog_invalid')
})
