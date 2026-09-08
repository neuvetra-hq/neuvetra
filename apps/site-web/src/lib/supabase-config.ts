/** Missing or example configuration must not prevent the public homepage rendering. */
export function getSupabaseConfig(url?: string, anonKey?: string) {
  const normalizedUrl = url?.trim()
  const normalizedKey = anonKey?.trim()
  if (!normalizedUrl || !normalizedKey || /[<>]/.test(normalizedUrl + normalizedKey)) {
    return null
  }

  try {
    const parsed = new URL(normalizedUrl)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    return { url: normalizedUrl, anonKey: normalizedKey }
  } catch {
    return null
  }
}
