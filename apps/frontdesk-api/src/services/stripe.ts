import Stripe from "stripe"

if (!Bun.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(Bun.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
})

export const PLANS = {
  starter: {
    name: "Starter",
    flatPriceId: Bun.env.STRIPE_PRICE_STARTER_FLAT!,
    meteredPriceId: Bun.env.STRIPE_PRICE_STARTER_METERED!,
    monthlyPrice: 49,
    includedMinutes: 150,
    overageRate: 0.25,
  },
  growth: {
    name: "Growth",
    flatPriceId: Bun.env.STRIPE_PRICE_GROWTH_FLAT!,
    meteredPriceId: Bun.env.STRIPE_PRICE_GROWTH_METERED!,
    monthlyPrice: 99,
    includedMinutes: 400,
    overageRate: 0.20,
  },
  pro: {
    name: "Pro",
    flatPriceId: Bun.env.STRIPE_PRICE_PRO_FLAT!,
    meteredPriceId: Bun.env.STRIPE_PRICE_PRO_METERED!,
    monthlyPrice: 199,
    includedMinutes: 1000,
    overageRate: 0.18,
  },
} as const

export type PlanId = keyof typeof PLANS
