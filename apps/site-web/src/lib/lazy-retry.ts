import type { ComponentType } from "react"

/**
 * Round 2c integration (Claude, 31 October 2026; lane D's walk, R2-polish.md "Out of my scope" 6): a lazily loaded chunk
 * for `React.lazy`. After a new release a page opened before it asks for chunk files that no longer exist (their names carry
 * a content hash), and the dynamic import fails. A transient network failure fails the same way. So the load is retried
 * once after a short wait; if the retry fails too, `fallback` (a "newer version is available — reload" notice) stands in for
 * the component, instead of an error that would take the screen down. `React.lazy` keeps whichever it resolved with, so the
 * notice stays until the page is reloaded, which is what loads the new release.
 */
export async function lazyChunkWithRetry<P extends object>(load: () => Promise<ComponentType<P>>, fallback: ComponentType<P>,
  options: { wait?: (ms: number) => Promise<void>; report?: (error: unknown) => void } = {}): Promise<{ default: ComponentType<P> }> {
  const wait = options.wait ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)))
  const report = options.report ?? (cause => console.warn("A screen part could not be loaded; a newer version is probably available.", cause))
  try { return { default: await load() } } catch { await wait(500) }
  try { return { default: await load() } } catch (error) {
    report(error)
    return { default: fallback }
  }
}
