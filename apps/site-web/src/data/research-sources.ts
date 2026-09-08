export const SOURCE_CATEGORIES = ["All sources", "Standards", "Emission factors", "California"] as const
export type SourceCategory = typeof SOURCE_CATEGORIES[number]

export interface ResearchSource {
  id: string
  title: string
  publisher: string
  category: Exclude<SourceCategory, "All sources">
  description: string
  url: string
  domain: string
  keywords: string[]
}

// Publisher entry points, not an approved calculation-factor dataset.
export const RESEARCH_SOURCES: ResearchSource[] = [
  {
    id: "corporate-standard",
    title: "Corporate Standard",
    publisher: "GHG Protocol",
    category: "Standards",
    description: "The starting point for preparing a corporate greenhouse gas inventory, with accounting and reporting principles for organizations.",
    url: "https://ghgprotocol.org/corporate-standard",
    domain: "ghgprotocol.org",
    keywords: ["inventory", "organizational boundaries", "scope 1", "scope 2", "scope 3", "accounting"],
  },
  {
    id: "scope-2-guidance",
    title: "Scope 2 Guidance",
    publisher: "GHG Protocol",
    category: "Standards",
    description: "Guidance for accounting for purchased electricity, steam, heat, and cooling, including energy contracts and instruments.",
    url: "https://ghgprotocol.org/scope-2-guidance",
    domain: "ghgprotocol.org",
    keywords: ["electricity", "energy", "location-based", "market-based", "renewable"],
  },
  {
    id: "epa-factors-hub",
    title: "GHG Emission Factors Hub",
    publisher: "U.S. Environmental Protection Agency",
    category: "Emission factors",
    description: "EPA's emission factor reference for organizational reporting, with downloadable resources and previous editions.",
    url: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub",
    domain: "epa.gov",
    keywords: ["EPA", "United States", "U.S.", "fuel", "combustion", "electricity", "data"],
  },
  {
    id: "carb-climate-reporting",
    title: "California Corporate Climate Reporting",
    publisher: "California Air Resources Board",
    category: "California",
    description: "CARB's program information and resources for corporate greenhouse gas reporting and climate-related financial risk disclosure.",
    url: "https://ww2.arb.ca.gov/our-work/programs/california-corporate-greenhouse-gas-reporting-and-climate-related-financial-risk",
    domain: "arb.ca.gov",
    keywords: ["CARB", "California", "disclosure", "SB 253", "SB 261", "regulation"],
  },
]

export function filterResearchSources(query: string, category: SourceCategory): ResearchSource[] {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return RESEARCH_SOURCES.filter((source) => {
    if (category !== "All sources" && source.category !== category) return false
    const words = [source.title, source.publisher, source.category, source.description, ...source.keywords]
      .join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    return terms.every((term) => words.some((word) => word.startsWith(term)))
  })
}
