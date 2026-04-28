export interface IndustryCategory {
  id: string
  label: string
}

export interface Industry {
  id: string
  name: string
  category: string
  slug: string
  thumbnail: string
  painHook: string
  headline: string
  subheadline: string
  painPoints: string[]
  features: string[]
  featured: boolean
}

export interface IndustriesData {
  categories: IndustryCategory[]
  industries: Industry[]
}
