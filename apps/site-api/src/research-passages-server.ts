import { Elysia } from 'elysia'
import { readPassageConfig } from './research-passages/config'
import { createPassageRoutes } from './research-passages/routes'

// Opt-in local experiment. Never imports the historical greeter or telemetry.
const config = readPassageConfig(Bun.env)
new Elysia().use(createPassageRoutes(config)).listen({ hostname: '127.0.0.1', port: config.port, maxRequestBodySize: 16_384, idleTimeout: 160 })
console.info(`Neuvetra passage research experiment listening on http://127.0.0.1:${config.port}`)
