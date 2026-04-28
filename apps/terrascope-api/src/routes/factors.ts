import { Elysia, t } from "elysia"
import { db } from "@terrascope/database"
import { emissionFactors } from "@terrascope/database"
import { eq, and, isNull, lte, gt, or, sql } from "drizzle-orm"

export const factorsRoutes = new Elysia({ prefix: "/factors" })
  .get(
    "/",
    async ({ query }) => {
      const { type, geography, scope, scope3_category, regulatory_context, effective_at } = query

      const conditions: any[] = []

      if (type)            conditions.push(eq(emissionFactors.factorType, type))
      if (geography)       conditions.push(eq(emissionFactors.geography, geography))
      if (scope)           conditions.push(eq(emissionFactors.scope, Number(scope)))
      if (scope3_category) conditions.push(eq(emissionFactors.scope3Category, Number(scope3_category)))

      if (regulatory_context) {
        conditions.push(
          sql`${emissionFactors.requiredBy} @> ARRAY[${regulatory_context}]::text[]`
        )
      }

      if (effective_at) {
        const year = Number(effective_at)
        conditions.push(lte(emissionFactors.effectiveStart, `${year}-12-31`) as any)
        conditions.push(
          or(isNull(emissionFactors.effectiveEnd), gt(emissionFactors.effectiveEnd, `${year}-01-01`)) as any
        )
      } else if (!regulatory_context) {
        // Default: only currently active factors when no temporal filter specified
        conditions.push(isNull(emissionFactors.effectiveEnd))
      }

      const factors = await db
        .select()
        .from(emissionFactors)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(100)

      return { factors }
    },
    {
      query: t.Object({
        type:               t.Optional(t.String()),
        geography:          t.Optional(t.String()),
        scope:              t.Optional(t.String()),
        scope3_category:    t.Optional(t.String()),
        regulatory_context: t.Optional(t.String()),
        effective_at:       t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/:factorId",
    async ({ params }) => {
      const [factor] = await db
        .select()
        .from(emissionFactors)
        .where(eq(emissionFactors.factorId, params.factorId))
        .limit(1)
      return factor ?? { error: "Factor not found" }
    },
    { params: t.Object({ factorId: t.String() }) }
  )
