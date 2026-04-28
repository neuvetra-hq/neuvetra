/**
 * OpenTelemetry instrumentation for Langfuse tracing.
 *
 * Must be imported BEFORE any code that produces spans (Vercel AI SDK calls).
 * The `import "./instrumentation"` at the top of `index.ts` ensures this runs
 * before the AI SDK is loaded.
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { env } from "./env"

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_HOST,
      environment: Bun.env.NODE_ENV ?? "development",
    }),
  ],
})

sdk.start()

process.on("SIGTERM", () => {
  sdk.shutdown().catch(() => {})
})
