import { Elysia, t } from "elysia"
import { db, companies, ghgReports } from "@terrascope/database"
import { eq } from "drizzle-orm"

export const companiesRoutes = new Elysia({ prefix: "/companies" })
  .post(
    "/",
    async ({ body }) => {
      const [company] = await db.insert(companies).values({
        name: body.name,
        slug: body.slug,
        jurisdiction: body.jurisdiction,
        industry: body.industry,
        naicsCode: body.naicsCode,
      }).returning()
      return company
    },
    {
      body: t.Object({
        name:         t.String(),
        slug:         t.String(),
        jurisdiction: t.Optional(t.String()),
        industry:     t.Optional(t.String()),
        naicsCode:    t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params }) => {
      const [company] = await db.select().from(companies).where(eq(companies.id, params.id))
      if (!company) return { error: "Company not found" }
      const reports = await db.select().from(ghgReports).where(eq(ghgReports.companyId, params.id))
      return { ...company, reports }
    },
    { params: t.Object({ id: t.String() }) }
  )
