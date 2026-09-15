import { M64_UUID, AnnualEvidenceValidationError, validateAnnualEvidenceInput, validateAnnualEvidenceReview, type WorkspaceDatabase } from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"

/** Separate profile and route boundary: no changes to the fixed M54-M63 decoders. */
export function createAnnualEvidenceRoutes(deps: { database: WorkspaceDatabase; validateUser: (token: string) => Promise<AuthenticatedUser | null>; origin: string }) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
    const match = /^\/workspace\/([^/]+)\/annual-electricity-evidence(?:\/(corrections|reviews))?$/.exec(new URL(request.url).pathname)
    if (!match || !M64_UUID.test(match[1]!)) return respond(404, { error: "Worksheet not found." })
    const companyId = match[1]!, action = match[2]
    const origin = request.headers.get("origin")
    if ((request.method !== "GET" && origin !== deps.origin) || (origin && origin !== deps.origin)) return respond(403,{error:"Forbidden."})
    const token = extractBearerToken(request.headers)
    if (!token) return respond(401,{error:"Authentication required."})
    const actor = await deps.validateUser(token)
    if (!actor) return respond(401,{error:"Authentication required."})
    try {
      const existing = await deps.database.findAnnualElectricityEvidence(actor.id,companyId)
      if (!existing) return respond(404,{error:"Worksheet not found."})
      if (request.method === "GET" && !action) return respond(200,existing)
      if (request.method !== "POST") return respond(405,{error:"Method not allowed."})
      if (!await deps.database.canManageWorkspace(actor.id,companyId)) return respond(403,{error:"Forbidden."})
      let body: unknown
      try { body = await request.json() } catch { return respond(422,{error:"Invalid worksheet request."}) }
      if (action === "reviews") return respond(201,await deps.database.reviewAnnualElectricityEvidence(actor.id,companyId,validateAnnualEvidenceReview(body)))
      const input = validateAnnualEvidenceInput(body,action === "corrections")
      return respond(201,await deps.database.saveAnnualElectricityEvidence(actor.id,companyId,input,action === "corrections"))
    } catch(error) {
      if (error instanceof AnnualEvidenceValidationError) return respond(422,{error:error.message})
      const code = (error as {code?: string})?.code
      if (code === "22023" || code === "22P02") return respond(422,{error:"Invalid worksheet request."})
      if (code === "23505") return respond(409,{error:"Worksheet changed or request conflicts. Reload the saved version."})
      if (code === "42501") return respond(403,{error:"Forbidden."})
      return respond(503,{error:"Worksheet could not be verified."})
    }
  }
}
