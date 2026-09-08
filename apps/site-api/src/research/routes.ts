import { Elysia, t } from 'elysia'
import { createResearchService, type ResearchServiceOptions } from './service'

export interface ResearchRoutesOptions extends ResearchServiceOptions {
  allowedOrigins: readonly string[]
}

export function createResearchRoutes(options: ResearchRoutesOptions) {
  const service = createResearchService(options)
  return new Elysia({ name: 'research-preview', prefix: '/research', normalize: false })
    .onRequest(({ set }) => { set.headers['cache-control'] = 'no-store' })
    .get('/status', () => service.status())
    .post('/answer', ({ body, request, set }) => {
      // The service is loopback-only. Origin checking reduces browser-triggered
      // spending; it is not authentication or authorization for a public API.
      const origin = request.headers.get('origin')
      if (!origin || !options.allowedOrigins.includes(origin)) {
        set.status = 403
        return { error: 'Forbidden.' }
      }
      // Validate the original object explicitly: parent Elysia instances may
      // normalize object schemas by silently dropping unknown properties.
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('question' in body) || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000) {
        set.status = 422
        return { error: 'Provide only a question between 1 and 2000 characters.' }
      }
      return service.answer(body.question)
    }, { body: t.Unknown() })
}
