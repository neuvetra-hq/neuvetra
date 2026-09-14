export const PREVIEW_PAUSED_MESSAGE = 'Research preview is paused while we improve question coverage. Your question will stay here.'
export const isResearchPreviewPaused = (value: unknown): boolean => value === 'true'

/** A local operator pause makes no request, including the status/reconnect probe. */
export async function requestResearchConnection(signal: AbortSignal, paused = false): Promise<'paused' | 'ready' | 'unavailable' | 'offline'> {
  if (paused) return 'paused'
  try {
    const response = await fetch('/research-api/status', { signal })
    const body: unknown = await response.json()
    if (response.ok && typeof body === 'object' && body !== null && 'readiness' in body) return body.readiness === 'ready' ? 'ready' : 'unavailable'
    return 'offline'
  } catch { return 'offline' }
}
