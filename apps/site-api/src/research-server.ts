import { Elysia } from 'elysia'
import { readResearchConfig } from './research/config'
import { createResearchRoutes } from './research/routes'

// Separate local-only entry point. The historical greeter, authentication,
// telemetry and production database modules are deliberately never imported.
const config = readResearchConfig(Bun.env)
new Elysia().use(createResearchRoutes(config)).listen({ hostname: '127.0.0.1', port: config.port, maxRequestBodySize: 16_384 })
console.info(`Neuvetra research preview listening on http://127.0.0.1:${config.port}`)
