import { Elysia, t } from "elysia"
import Anthropic from "@anthropic-ai/sdk"
import { env } from "../env"
import {
  dbFactorResolver,
  calculateScope1Combustion,
  calculateScope1Fugitive,
  calculateScope2Location,
  calculateScope2Market,
  FactorNotFoundError,
  type CalculationContext,
} from "@terrascope/calculator"

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "extract_emission_inputs",
  description: "Extract structured GHG emission calculation inputs. Set ready=false if clarification is needed.",
  input_schema: {
    type: "object",
    properties: {
      ready: { type: "boolean" },
      methodology: {
        type: "string",
        enum: [
          "scope-1-stationary-combustion",
          "scope-1-fugitive-refrigerants",
          "scope-2-location-based",
          "scope-2-market-based",
        ],
      },
      inputs: { type: "object" },
      regulatory_context: {
        type: "string",
        enum: ["CARB-MRR", "SB-253", "ESRS-E1", "GHG-Protocol-voluntary", "GHG-Protocol"],
      },
      reporting_year: { type: "integer" },
      clarification_question: { type: "string" },
    },
    required: ["ready"],
  },
}

const EXTRACTION_SYSTEM = `You are a GHG accounting data extractor. Use the extract_emission_inputs tool to structure emission data from the conversation.
Extract: methodology type, fuel/refrigerant/grid details, quantity, unit, geography, regulatory context, reporting year.
Set ready=false and provide clarification_question if any required field is missing. Never guess quantities.

Geography rules (use canonical values only):
- Combustion fuels (Scope 1): use "US-national" for any US location; "EU" for European locations
- Grid electricity (Scope 2 location-based): use ISO subregion codes like "CAMX" for California, "WECC" for Western US, "RFC" for Mid-Atlantic
- Scope 2 market-based: omit geography (supplier-specific factor)
- For inputs.geography in scope-1-stationary-combustion, always use "US-national" unless a specific non-US country is mentioned

Fuel type substance rules (use canonical names matching emission factor database):
- Natural gas → "Natural Gas"
- Diesel → "Distillate Fuel Oil No. 2"
- Gasoline → "Motor Gasoline"
- Propane → "Propane"
- Coal → "Bituminous"`

const FORMATTING_SYSTEM = `You are Terrascope, an expert GHG accounting assistant.
You receive a CalculationResult JSON. Present the result clearly:
- State tCO2e (divide kg by 1000, round to 2 decimal places)
- Cite the emission factor used (factor_id and source_document)
- Note the methodology and regulatory context
- Keep it concise and friendly
NEVER change the numbers. NEVER fabricate values.`

async function runCalculation(methodology: string, inputs: Record<string, unknown>, ctx: CalculationContext) {
  switch (methodology) {
    case "scope-1-stationary-combustion":
      return calculateScope1Combustion(inputs as any, ctx)
    case "scope-1-fugitive-refrigerants":
      return calculateScope1Fugitive(inputs as any, ctx)
    case "scope-2-location-based":
      return calculateScope2Location(inputs as any, ctx)
    case "scope-2-market-based":
      return calculateScope2Market(inputs as any, ctx)
    default:
      throw new Error(`Unsupported methodology: ${methodology}`)
  }
}

export const chatRoutes = new Elysia({ prefix: "/chat" }).post(
  "/",
  async ({ body }) => {
    const { messages } = body

    // Step 1: Extract structured inputs
    const extractionResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "auto" },
    })

    const toolUse = extractionResponse.content.find(b => b.type === "tool_use")
    if (!toolUse || toolUse.type !== "tool_use") {
      return {
        message: { type: "text", text: "Could you describe your emissions source in more detail?" },
      }
    }

    const extracted = toolUse.input as {
      ready: boolean
      methodology?: string
      inputs?: Record<string, unknown>
      regulatory_context?: string
      reporting_year?: number
      clarification_question?: string
    }

    if (!extracted.ready) {
      return {
        message: {
          type: "text",
          text: extracted.clarification_question ?? "Could you provide more details about your emissions source?",
        },
      }
    }

    if (!extracted.methodology || !extracted.inputs || !extracted.regulatory_context || !extracted.reporting_year) {
      return {
        message: {
          type: "text",
          text: "I need more information. What fuel type, quantity, and regulatory framework are you reporting under?",
        },
      }
    }

    // Step 2: Calculate
    const ctx: CalculationContext = {
      regulatoryContext: extracted.regulatory_context,
      reportingYear: extracted.reporting_year,
      gwpBasis: "AR6",
      factorResolver: dbFactorResolver,
    }

    let calcResult
    try {
      calcResult = await runCalculation(extracted.methodology, extracted.inputs, ctx)
    } catch (err) {
      if (err instanceof FactorNotFoundError) {
        return {
          message: {
            type: "text",
            text: `I couldn't find an emission factor for your inputs. ${(err as Error).message}`,
          },
        }
      }
      throw err
    }

    // Step 3: Format for the user
    const formatResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: FORMATTING_SYSTEM,
      messages: [
        ...messages,
        {
          role: "user" as const,
          content: `Calculation result:\n${JSON.stringify(calcResult, null, 2)}`,
        },
      ],
    })

    return {
      message: formatResponse.content[0],
      metadata: {
        methodology: calcResult.methodologyId,
        factor_ids: calcResult.factors.map((f: { factorId: string }) => f.factorId),
        value_kg_co2e: calcResult.value,
        value_t_co2e: Math.round(calcResult.value / 10) / 100,
        regulatory_context: calcResult.regulatoryContext,
      },
    }
  },
  {
    body: t.Object({
      messages: t.Array(
        t.Object({
          role: t.Union([t.Literal("user"), t.Literal("assistant")]),
          content: t.String(),
        })
      ),
    }),
  }
)
