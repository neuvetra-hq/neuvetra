import { Elysia, t } from "elysia"
import { db, ghgReports } from "@terrascope/database"
import { eq } from "drizzle-orm"
import {
  dbFactorResolver,
  calculateScope1Combustion,
  calculateScope1Fugitive,
  calculateScope2Location,
  calculateScope2Market,
  Inventory,
  type CalculationContext,
} from "@terrascope/calculator"

export const reportsRoutes = new Elysia({ prefix: "/reports" })
  .post(
    "/",
    async ({ body }) => {
      const { company_id, reporting_year, regulatory_context, boundary_method, emission_data } = body

      const ctx: CalculationContext = {
        regulatoryContext: regulatory_context,
        reportingYear: reporting_year,
        gwpBasis: "AR6",
        boundaryMethod: boundary_method,
        factorResolver: dbFactorResolver,
      }

      const inv = new Inventory(boundary_method, regulatory_context, reporting_year)

      for (const entry of emission_data) {
        switch (entry.methodology) {
          case "scope-1-stationary-combustion":
            inv.addScope1(await calculateScope1Combustion(entry.inputs, ctx))
            break
          case "scope-1-fugitive-refrigerants":
            inv.addScope1(await calculateScope1Fugitive(entry.inputs, ctx))
            break
          case "scope-2-location-based":
            inv.addScope2Location(await calculateScope2Location(entry.inputs, ctx))
            break
          case "scope-2-market-based":
            inv.addScope2Market(await calculateScope2Market(entry.inputs, ctx))
            break
          default:
            throw new Error(`Unsupported methodology: ${entry.methodology}`)
        }
      }

      const summary = inv.summary() as any

      const [report] = await db.insert(ghgReports).values({
        companyId:           company_id,
        reportingYear:       reporting_year,
        regulatoryContext:   regulatory_context,
        boundaryMethod:      boundary_method,
        scope1Total:         String(summary.scope1KgCO2e / 1000),
        scope2LocationBased: String(summary.scope2LocationKgCO2e / 1000),
        scope2MarketBased:   String(summary.scope2MarketKgCO2e / 1000),
        auditTrail:          inv.auditTrail(),
      }).returning()

      return {
        report,
        summary,
        audit_trail: inv.auditTrail(),
      }
    },
    {
      body: t.Object({
        company_id:         t.String(),
        reporting_year:     t.Number(),
        regulatory_context: t.String(),
        boundary_method:    t.String(),
        emission_data:      t.Array(t.Object({
          methodology: t.String(),
          inputs:      t.Any(),
        })),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params }) => {
      const [report] = await db.select().from(ghgReports).where(eq(ghgReports.id, params.id))
      return report ?? { error: "Report not found" }
    },
    { params: t.Object({ id: t.String() }) }
  )
