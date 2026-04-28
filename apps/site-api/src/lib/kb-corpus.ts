import { KB_PAGES, type KbPage } from "../generated/kb-corpus"

export { KB_PAGES, type KbPage }

/**
 * Formats every public page in the neuvetra-kb corpus into a single string
 * block suitable for injection into an agent's system prompt.
 *
 * Today: dump every page in full. The brand-level KB is small (single-digit
 * pages) and Claude Sonnet 4.6's 200K window absorbs it cheaply. M3 swaps
 * this for retrieval-against-Weaviate when the KB grows or when retrieval
 * adds enough value (per-query embedding-based ranking) to be worth the
 * latency.
 */
export function formatKbForPrompt(pages: readonly KbPage[] = KB_PAGES): string {
  if (pages.length === 0) {
    return "(The knowledge base is empty. Answer from general knowledge of Neuvetra; do not fabricate specifics.)"
  }

  const blocks = pages.map((page) => {
    const productsLine =
      page.products.length === 0
        ? "brand-level"
        : `products: ${page.products.join(", ")}`
    const aliasesLine =
      page.aliases.length === 0
        ? ""
        : `\naliases: ${page.aliases.join(", ")}`
    return `=== ${page.title} ===
id: ${page.id}
type: ${page.type}
${productsLine}${aliasesLine}

${page.body}`
  })

  return blocks.join("\n\n---\n\n")
}
