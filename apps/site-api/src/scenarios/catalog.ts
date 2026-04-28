import type { ScenarioDescriptor } from "./types"
import { collectOtpVerification } from "./collect-otp-verification"

/**
 * Public registry of every scenario the agent can invoke. Building from
 * here forward, this map grows as new scenarios are authored. M2.1
 * ships with one entry (added in Task 7); M2.3 adds more.
 */
const SCENARIOS: ReadonlyArray<ScenarioDescriptor> = [collectOtpVerification]

export const SCENARIO_CATALOG: ReadonlyMap<string, ScenarioDescriptor> = new Map(
  SCENARIOS.map((s) => [s.id, s]),
)

/**
 * Markdown-formatted catalog for inclusion in agent system prompts.
 * Returns a placeholder string when the catalog is empty.
 */
export function formatCatalogForPrompt(): string {
  if (SCENARIOS.length === 0) {
    return "(No scenarios registered yet.)"
  }
  return SCENARIOS.map(
    (s) => `- **${s.id}** (${s.surface}) — ${s.description} Goal: ${s.goal}`,
  ).join("\n")
}
