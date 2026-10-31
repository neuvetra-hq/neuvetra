// Round 2 ENG-1 (Claude, 31 October 2026): tests must run on a clean checkout. No test may read a file outside the
// repository: no absolute machine path (a scratchpad, a home directory, /tmp, /mnt, ...), no relative path that climbs
// out of the repository, and no file anywhere in apps/, packages/ or tools/ may name the agent scratchpad. Fixtures a
// test needs are committed (for example `src/testdata/spend-r4-c1.csv`, the r4 pack's C1 spend files, byte for byte).
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dir, '../../..')
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', 'dist-staging', '.turbo', 'coverage', 'output'])
const SOURCE = /\.(ts|tsx|js|mjs|cjs|py|sh|ya?ml|json)$/
const TEST_FILE = /(\.test\.(ts|tsx|js|mjs|cjs)|_test\.py|^test_[^/]*\.py)$/

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    const info = statSync(path, { throwIfNoEntry: false })
    if (!info) continue
    if (info.isDirectory()) walk(path, out)
    else if (info.isFile() && SOURCE.test(name) && info.size < 4_000_000) out.push(path)
  }
  return out
}
const files = ['apps', 'packages', 'tools'].flatMap(top => walk(join(ROOT, top), []))
// This file holds sample violations for its own self-test, so it is not scanned.
const tests = files.filter(file => TEST_FILE.test(file.split(sep).pop()!) && file !== import.meta.path)

/**
 * Absolute filesystem paths a test could read: string literals that start with a machine directory, or a file: URL.
 * Strings that are only identifiers shaped like paths (an agent reviewer ID such as `/root/independent_fixture` in the
 * m78 staging receipts) are listed here by exact value, with the file they appear in.
 */
const ABSOLUTE = /(['"`])((?:file:\/\/)?\/(?:tmp|home|Users|mnt|var|opt|private|root|srv)(?:\/[^'"`\s$]*)?)\1/g
const NOT_PATHS: Readonly<Record<string, readonly string[]>> = {
  'tools/staging/m78-readonly-revisit2.test.ts': ['/root/m78_transport_probe'],
  'tools/staging/check-m78-continuation3.test.ts': ['/root/independent_fixture', '/root', '/root/resume_recipe'],
}
/** Relative literals that climb (`../`): resolved against the test file's own directory, they must stay inside the repository. */
const CLIMBING = /(['"`])((?:\.\/)?(?:\.\.\/)+[^'"`\s$]*)\1/g

/** The problems in one test file's text (exported shape for the self-test below). */
function problemsIn(file: string, text: string): string[] {
  const rel = relative(ROOT, file).split(sep).join('/')
  const out: string[] = []
  for (const match of text.matchAll(ABSOLUTE)) if (!(NOT_PATHS[rel] ?? []).includes(match[2]!)) out.push(`${rel}: absolute path ${match[2]}`)
  for (const match of text.matchAll(CLIMBING)) {
    const target = resolve(dirname(file), match[2]!)
    if (target !== ROOT && !target.startsWith(ROOT + sep)) out.push(`${rel}: ${match[2]} leaves the repository`)
  }
  return out
}

describe('tests read only files inside the repository (round 2 ENG-1)', () => {
  test('the scan sees the repository (sanity)', () => {
    expect(tests.length).toBeGreaterThan(200)
    expect(tests.some(file => file.endsWith(`${sep}scope3-spend-import.test.ts`))).toBe(true)
  })

  test('the rule itself: an absolute default, a scratchpad path and a climbing path are caught; a path inside the repository is not', () => {
    const here = join(ROOT, 'packages', 'neuvetra-database', 'src', 'x.test.ts')
    expect(problemsIn(here, "const R4 = `${process.env.R4 ?? '/tmp/somewhere/r4'}/C1`")).toEqual(['packages/neuvetra-database/src/x.test.ts: absolute path /tmp/somewhere/r4'])
    expect(problemsIn(here, 'Bun.file("/home/someone/file.csv")')).toHaveLength(1)
    expect(problemsIn(here, "readFileSync('../../../../outside.csv')")).toHaveLength(1)
    expect(problemsIn(here, "readFileSync('./testdata/spend-r4-c1.csv'); import x from '../../../apps/site-api/src/x'")).toEqual([])
  })

  test('no test file reads an absolute machine path or climbs out of the repository', () => {
    const problems = tests.flatMap(file => problemsIn(file, readFileSync(file, 'utf8')))
    expect(problems).toEqual([])
  })

  test('no file in apps/, packages/ or tools/ names the agent scratchpad', () => {
    const marker = ['/tmp/claude-', '0/'].join('')
    const named = files.filter(file => file !== import.meta.path && readFileSync(file, 'utf8').includes(marker)).map(file => relative(ROOT, file))
    expect(named).toEqual([])
  })

  test('the committed r4 C1 spend fixtures are the pack files, byte for byte', async () => {
    const sha = async (name: string) => new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(`${import.meta.dir}/testdata/${name}`).arrayBuffer())).digest('hex')
    expect(await sha('spend-r4-c1.csv')).toBe('cb5871465315cd4528ae8db7055db4586cd7e8940867c97813b268420a81c0ca')
    expect(await sha('spend-r4-c1-overlap.csv')).toBe('6571ed6d0116b867259b9c2e5a5f19ee6a6dffd8ac70eb0bbb2fd2baa176719b')
  })
})
