import { Elysia, t } from 'elysia'
import { createPassageService, type PassageServiceOptions } from './service'

export function createPassageRoutes(options: PassageServiceOptions & { allowedOrigins: readonly string[] }) {
  const service = createPassageService(options)
  return new Elysia({ name: 'research-passages', prefix: '/research', normalize: false })
    .onRequest(({ set }) => { set.headers['cache-control'] = 'no-store' })
    .get('/status', () => service.status())
    .post('/answer', ({ body, request, set }) => {
      const origin = request.headers.get('origin')
      if (!origin || !options.allowedOrigins.includes(origin)) { set.status = 403; return { error: 'Forbidden.' } }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('question' in body) || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000) { set.status = 422; return { error: 'Provide only a question between 1 and 2000 characters.' } }
      return service.answer(body.question, request.signal)
    }, { body: t.Unknown() })
}
