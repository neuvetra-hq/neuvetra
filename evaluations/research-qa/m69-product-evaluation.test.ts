import { expect, test } from 'bun:test';
import unitsRelease from '../../data/research/answer-units/scope2-website.epa-acquisition.v1.json';

const unitIds = new Set(unitsRelease.units.map((u) => u.id));
const passageIds = new Set(['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','S13','S14','S15','S16','S17','S18']);

const pilot = [
  { id: 'P1', expected: 'qualified', units: ['U04','U05'], passages: ['S03','S04'] },
  { id: 'P2', expected: 'qualified', units: ['U06'], passages: ['S05'] },
  { id: 'P3', expected: 'qualified', units: ['U10','U17','U20','U21'], passages: ['S06','S07','S08','S09','S16','S17','S18'] },
  { id: 'P4', expected: 'unsupported', units: [], passages: [] },
  { id: 'P5', expected: 'unsupported', units: [], passages: [] },
] as const;

test('pilot map uses only approved answer units and released passages', () => {
  for (const item of pilot) {
    expect(item.units.every((id) => unitIds.has(id))).toBe(true);
    expect(item.passages.every((id) => passageIds.has(id))).toBe(true);
    if (item.expected === 'unsupported') {
      expect(item.units).toEqual([]);
      expect(item.passages).toEqual([]);
    }
  }
});

test('supported pilot units cite the passages that own their text', () => {
  const byId = new Map(unitsRelease.units.map((u) => [u.id, u]));
  for (const item of pilot.filter((x) => x.expected === 'qualified')) {
    for (const id of item.units) {
      const unit = byId.get(id)!;
      expect(item.passages.some((p) => unit.passage_ids.includes(p))).toBe(true);
    }
  }
});
