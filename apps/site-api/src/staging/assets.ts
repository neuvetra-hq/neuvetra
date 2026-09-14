import path from "node:path"
import { realpath } from "node:fs/promises"

export const STAGING_ASSETS = [
  ["apps/site-api/src/calculation/linked_bill_calculation.py", "ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e"],
  ["apps/site-api/src/calculation/location_based_electricity.py", "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c"],
  ["output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135"],
  ["data/synthetic/m58-electricity-register-2023.json", "44cf813b31bf92a13e15a5432e26cd931355df7ded4684248759a50876dbdc29"],
  ["data/synthetic/m58-electricity-register-2023.manifest.json", "41bb93caa7cb7dc638c82cb20a9660b25976ff72ff7fa49c4a08af1559c27352"],
] as const

const repositoryRoot = path.resolve(import.meta.dir, "../../../..")

export async function verifyStagingAssets(webRoot: string) {
  for (const [relative, expected] of STAGING_ASSETS) {
    const bytes = await Bun.file(path.join(repositoryRoot, relative)).bytes()
    if (new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== expected) throw new Error("Staging assets unavailable.")
  }
  const index = await Bun.file(path.join(webRoot, "index.html")).text()
  if (!index.includes("<html") || index.length > 100_000) throw new Error("Staging assets unavailable.")
}

export async function serveStagingAsset(webRoot: string, pathname: string): Promise<Response | null> {
  const relative = pathname === "/" || pathname === "/workspace" ? "index.html" : /^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:js|css|svg|png|jpg|webp|woff2|pdf)$/.test(pathname) ? pathname.slice(1) : null
  if (!relative) return null
  try {
    const root = await realpath(webRoot)
    const filename = await realpath(path.join(root, relative))
    const location = path.relative(root, filename)
    if (location.startsWith("..") || path.isAbsolute(location)) return null
    const file = Bun.file(filename)
    if (!await file.exists()) return null
    return new Response(file)
  } catch { return null }
}
