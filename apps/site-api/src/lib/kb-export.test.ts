import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildCorpus, KB_WIKI_DIR } from "../../scripts/sync-kb-corpus"

describe("public KB export", () => {
  test("resolves the monorepo knowledge source without rewriting the generated corpus", async () => {
    const index = await readFile(join(KB_WIKI_DIR, "index.md"), "utf8")
    expect(index).toContain("Neuvetra Public KB")
    const corpus = await buildCorpus()
    expect(corpus.some((page) => page.pathFromWiki === "overview")).toBe(true)
  })

  test("exports only explicitly public pages and excludes drafts and administrative files", async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), "neuvetra-kb-export-"))
    const fixtures = {
      "public.md": "visibility: public",
      "draft.md": "visibility: draft",
      "unclassified.md": "",
      "README.md": "visibility: public",
    }
    try {
      await Promise.all(Object.entries(fixtures).map(([name, visibility]) =>
        writeFile(join(fixtureDir, name), `---\nid: ${name}\ntype: product\ntitle: Example\n${visibility}\n---\nPublic example body.\n`),
      ))
      const corpus = await buildCorpus(fixtureDir)
      expect(corpus.map((page) => page.id)).toEqual(["public.md"])
      expect(corpus[0]?.body).toBe("Public example body.")
    } finally {
      await Promise.all(Object.keys(fixtures).map((name) => unlink(join(fixtureDir, name))))
      await rmdir(fixtureDir)
    }
  })
})
