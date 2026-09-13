import { Elysia, t } from "elysia"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
import { checkOrigin } from "../lib/origin-check"
import type { WorkspaceStore } from "./types"

const AUTH_REQUIRED = { error: "Authentication required." } as const
const NOT_FOUND = { error: "Workspace not found." } as const
const FORBIDDEN = { error: "Forbidden." } as const
const INVALID_REQUEST = { error: "Invalid workspace request." } as const
const CREATE_FAILED = { error: "Workspace could not be created." } as const
const READ_FAILED = { error: "Workspace is unavailable." } as const
const INPUT_KEYS = ["companyName", "facilityName", "countryCode", "stateCode", "egridSubregion", "reportingYear", "approach"] as const

interface WorkspaceRoutesDeps {
  allowedOrigins: readonly string[]
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  store: WorkspaceStore
}

async function authenticate(request: Request, validateUser: WorkspaceRoutesDeps["validateUser"]) {
  const token = extractBearerToken(request.headers)
  if (!token) return null
  return validateUser(token)
}

function parseInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (Object.keys(body).sort().join("|") !== [...INPUT_KEYS].sort().join("|")) return null
  if (body.companyName !== "Synthetic Acme, Inc." || body.facilityName !== "Synthetic California office" || body.countryCode !== "US" || body.stateCode !== "CA" || body.egridSubregion !== "CAMX" || body.reportingYear !== 2023 || body.approach !== "operational_control") return null
  return body as unknown as {
    companyName: "Synthetic Acme, Inc."
    facilityName: "Synthetic California office"
    countryCode: "US"
    stateCode: "CA"
    egridSubregion: "CAMX"
    reportingYear: 2023
    approach: "operational_control"
  }
}

const responseSchema = t.Object({
  id: t.String(),
  companyName: t.String(),
  countryCode: t.Literal("US"),
  stateCode: t.Literal("CA"),
  facility: t.Object({
    id: t.String(),
    name: t.String(),
    egridSubregion: t.Literal("CAMX"),
  }),
  boundary: t.Object({
    id: t.String(),
    reportingYear: t.Literal(2023),
    approach: t.Literal("operational_control"),
    status: t.Literal("draft"),
    version: t.Literal(1),
  }),
})

export function createWorkspaceRoutes(deps: WorkspaceRoutesDeps) {
  return new Elysia({ prefix: "/workspace" })
    .post(
      "/",
      async ({ body, request, set }) => {
        if (!checkOrigin(request.headers, deps.allowedOrigins).allowed) {
          set.status = 403
          return FORBIDDEN
        }
        const user = await authenticate(request, deps.validateUser)
        if (!user) {
          set.status = 401
          return AUTH_REQUIRED
        }
        const input = parseInput(body)
        if (!input) {
          set.status = 422
          return INVALID_REQUEST
        }
        try {
          const workspace = await deps.store.create(user.id, input)
          set.status = 201
          return workspace
        } catch {
          set.status = 409
          return CREATE_FAILED
        }
      },
      {
        body: t.Unknown(),
        response: {
          201: responseSchema,
          401: t.Object({ error: t.String() }),
          403: t.Object({ error: t.String() }),
          409: t.Object({ error: t.String() }),
          422: t.Object({ error: t.String() }),
        },
      },
    )
    .get(
      "/:id",
      async ({ params, request, set }) => {
        const origin = request.headers.get("origin")
        if (origin && !deps.allowedOrigins.includes(origin)) {
          set.status = 403
          return FORBIDDEN
        }
        const user = await authenticate(request, deps.validateUser)
        if (!user) {
          set.status = 401
          return AUTH_REQUIRED
        }
        let workspace
        try {
          workspace = await deps.store.findById(user.id, params.id)
        } catch {
          set.status = 503
          return READ_FAILED
        }
        if (!workspace) {
          set.status = 404
          return NOT_FOUND
        }
        return workspace
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        response: {
          200: responseSchema,
          401: t.Object({ error: t.String() }),
          403: t.Object({ error: t.String() }),
          404: t.Object({ error: t.String() }),
          503: t.Object({ error: t.String() }),
        },
      },
    )
}
