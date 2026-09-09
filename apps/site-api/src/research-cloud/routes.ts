import { Elysia, t } from 'elysia'
interface ResearchService {
  status(): Promise<unknown>
  answer(question: string, signal?: AbortSignal): Promise<unknown>
}

/** The private preview binds only loopback. This is not customer authentication. */
export function createCloudRoutes(service: ResearchService, allowedOrigins: readonly string[]) {
  if (!allowedOrigins.length || allowedOrigins.some(v => { try { const u = new URL(v); return u.origin !== v || !['http:', 'https:'].includes(u.protocol) || !['localhost', '127.0.0.1'].includes(u.hostname) } catch { return true } })) throw new Error('Only explicit loopback origins are supported.')
  return new Elysia({ name: 'research-cloud', prefix: '/research', normalize: false })
    .onRequest(({ request, set }) => {
      set.headers['cache-control'] = 'no-store'
      const url = new URL(request.url)
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) { set.status = 403; return { error: 'Forbidden.' } }
    })
    .get('/status', ({ request, set }) => {
      const origin = request.headers.get('origin')
      if (origin && !allowedOrigins.includes(origin)) { set.status = 403; return { error: 'Forbidden.' } }
      return service.status()
    })
    .post('/answer', ({ body, request, set }) => {
      const origin = request.headers.get('origin')
      if (!origin || !allowedOrigins.includes(origin)) { set.status = 403; return { error: 'Forbidden.' } }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('question' in body) || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000) { set.status = 422; return { error: 'Provide only a question between 1 and 2000 characters.' } }
      return service.answer(body.question, request.signal)
    }, { body: t.Unknown() })
}
