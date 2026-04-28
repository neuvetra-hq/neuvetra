# Pricing Strategy

## Overview
Front Desk is an AI voice receptionist SaaS. Customers pay a flat monthly fee that includes
a dedicated Twilio phone number and a bundle of AI-handled call minutes. Overages are billed
per minute above the included allowance.

---

## Our Cost Per Minute (Per Active Customer)

| Component | Cost/min | Notes |
|---|---|---|
| Twilio inbound call | $0.0085 | Customer's caller reaches our Twilio number |
| Retell AI voice engine | $0.0700 | STT + TTS, base Elevenlabs voice |
| Retell AI LLM | $0.0200 | GPT-4o class (mid-tier model) |
| **Total per minute** | **~$0.10** | |

> Cheaper LLM (GPT-4o-mini) → ~$0.085/min. Premium LLM (Claude 3.5 Sonnet) → ~$0.13/min.

## Static Monthly Cost Per Customer

| Item | Cost/month |
|---|---|
| Twilio phone number | $1.15 |
| Cal.com Platform API (~10 bookings avg) | ~$0.50 |
| **Total fixed per customer** | **~$1.65** |

---

## Pricing Tiers

| | **Starter** | **Pro** | **Business** |
|---|---|---|---|
| **Price** | $49/mo | $99/mo | $199/mo |
| **Minutes included** | 100 | 300 | 1,000 |
| **Overage rate** | $0.20/min | $0.20/min | $0.15/min |
| **AI receptionist number** | 1 | 1 | 1 |
| **Knowledge base** | 20 Q&As | Unlimited | Unlimited |
| **Call transcripts** | ✅ | ✅ | ✅ |
| **Call summaries (AI)** | ❌ | ✅ | ✅ |
| **Appointment booking** | ❌ | ✅ | ✅ |
| **Multi-language** | ❌ | ❌ | ✅ |
| **Analytics dashboard** | ❌ | ❌ | ✅ |
| **Support** | Email | Priority email | Phone + email |

---

## Gross Margin Per Tier

| Tier | Revenue | Fixed cost | Variable cost | **Gross profit** | **Margin** |
|---|---|---|---|---|---|
| Starter (100 min) | $49 | $1.65 | $10.00 | **$37.35** | **76%** |
| Pro (300 min) | $99 | $1.65 | $30.00 | **$67.35** | **68%** |
| Business (1,000 min) | $199 | $1.65 | $100.00 | **$97.35** | **49%** |

Business tier margin is thinner but acceptable — most customers won't hit 1,000 min/month,
so average realized cost will be lower, pushing effective margin higher.

Overage cost to us: **$0.10/min** → charge **$0.20/min** = 100% margin on every extra minute.

---

## Competitive Landscape

| Competitor | Price | Minutes |
|---|---|---|
| Synthflow AI | $29/mo | Limited |
| Goodcall | $59/mo | Unlimited (lower quality) |
| Answering Agent | $99/mo | Unlimited |
| Smith.ai | $95/mo | 50 calls only |
| Aircall AI Receptionist | $825/mo | 300 calls |

**Our position:** mid-market, transparent per-minute pricing, purpose-built for small businesses.

---

## Booking Integration Options

| Option | Cost model | API access | Notes |
|---|---|---|---|
| **Cal.com** | $0.05/booking (Platform API) | ✅ Full API | Open-source, self-hostable, preferred |
| **Calendly** | $10/seat/mo (Standard) | ✅ Webhooks on paid | More widely used by customers |

Recommendation: support both via a pluggable integration. Default to Cal.com for our own
hosted onboarding; let customers connect their existing Calendly on Pro/Business plans.

---

## Future Considerations

- **Usage-based add-ons:** charge per SMS notification sent, per booking confirmed
- **Multi-number plans:** agencies managing multiple client businesses
- **White-label tier:** reseller pricing for agencies
- **Annual discount:** 2 months free (20% discount) to reduce churn
