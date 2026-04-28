/**
 * Single source of truth for the origins allowed to call this API.
 * Used by the CORS plugin (browser-side enforcement) and the server-side
 * `checkOrigin` middleware (defense against non-browser callers).
 */
export const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://neuvetra.com",
  "https://www.neuvetra.com",
  "https://neuvetra.ai",
  "https://www.neuvetra.ai",
] as const
