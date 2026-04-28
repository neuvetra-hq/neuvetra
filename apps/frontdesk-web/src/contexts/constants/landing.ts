export const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Industries", href: "#industries" },
  { label: "Pricing", href: "#pricing" },
]

export const HERO = {
  badge: "AI Receptionist · From $49/mo",
  headline: "Every call answered.\nEvery appointment booked.\nZero revenue left behind.",
  subheadline:
    "The average small business misses 1 in 5 inbound calls. Each one is a potential customer who hangs up and calls someone else. Front Desk answers instantly, books the appointment, and texts you a summary. 24/7, in any language, for a fraction of the cost of a receptionist.",
  primaryCTA: "Get started free →",
  secondaryCTA: "See how it works",
  trust: "7-day free trial · Your card won't be charged until day 8 · Live in 10 minutes",
}

export const PRODUCTS = [
  {
    name: "Neuvetra Front Desk",
    tag: "Available now",
    available: true,
    color: "indigo",
    icon: "🎙️",
    description:
      "Your AI receptionist. Answers every call 24/7, handles FAQs, books appointments, and sends SMS alerts, so you never miss a customer.",
    cta: "Get started",
    href: "/signup",
  },
  {
    name: "Neuvetra Scheduler",
    tag: "Coming soon",
    available: false,
    color: "violet",
    icon: "📅",
    description:
      "Intelligent appointment scheduling that syncs with your calendar, sends reminders, and reduces no-shows automatically.",
    cta: "Join waitlist",
    href: "#",
  },
  {
    name: "Neuvetra Insights",
    tag: "Coming soon",
    available: false,
    color: "emerald",
    icon: "📊",
    description:
      "Call analytics and business intelligence. Understand what your customers are asking, when they call, and what drives bookings.",
    cta: "Join waitlist",
    href: "#",
  },
  {
    name: "Neuvetra Engage",
    tag: "Coming soon",
    available: false,
    color: "amber",
    icon: "💬",
    description:
      "Automated SMS follow-ups, appointment reminders, and re-engagement campaigns, all personalized by AI.",
    cta: "Join waitlist",
    href: "#",
  },
]

export const FRONT_DESK_FEATURES = [
  {
    icon: "📞",
    title: "Never misses a call",
    description:
      "Picks up instantly, every time. No hold music, no voicemail, no missed revenue while you're with a customer.",
  },
  {
    icon: "🧠",
    title: "Knows your business",
    description:
      "Train it on your FAQs, hours, services, and pricing. It answers exactly like a knowledgeable member of your team.",
  },
  {
    icon: "📆",
    title: "Books appointments",
    description:
      "Callers can schedule, reschedule, or cancel. Fully automated and synced to your calendar in real time.",
  },
  {
    icon: "🌐",
    title: "Any language",
    description:
      "Responds in the caller's preferred language automatically. Reach every customer, no extra setup required.",
  },
  {
    icon: "📋",
    title: "Full call logs",
    description:
      "Transcripts and plain-English summaries for every conversation, searchable from your dashboard.",
  },
  {
    icon: "🔔",
    title: "Instant alerts",
    description:
      "Urgent calls trigger an immediate SMS to your phone with a summary and a link to call back.",
  },
]

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Start with your phone number",
    description:
      "That's all we need to get going. Verify with a one-time code and your free trial begins immediately. No credit card, no commitment, no forms to fill out.",
    callout: "7-day free trial · 100 free minutes · no card required",
  },
  {
    step: "02",
    title: "Design your AI",
    description:
      "Give your AI a name. Choose its voice, the one that represents your business. Then train it on your services, your pricing, your hours, exactly how you like things handled. This is your AI, built by you, for you.",
    callout: "Your name, your voice, your rules. Edit any time.",
  },
  {
    step: "03",
    title: "Pick your AI's number",
    description:
      "Choose a real local number for your AI, one you can advertise, put on your website, or hand to clients directly. Forward missed calls from your existing number, or let clients call your AI's number straight. Either way, your current number stays exactly as it is.",
    callout: "Keep your existing number · your AI gets its own",
  },
  {
    step: "04",
    title: "Call it. Then let it work.",
    description:
      "Dial your AI's number before you go live and hear it handle a call exactly the way your clients will. When you're satisfied, it answers every call, books every appointment, and texts you instantly when something needs your attention. In English and Spanish, around the clock.",
    callout: "24/7 · English & Spanish · instant SMS alerts",
  },
]

export const STATS = [
  { value: "< 1s", label: "Average answer time" },
  { value: "24/7", label: "Always available" },
  { value: "80%", label: "Calls handled without staff" },
]

export const WHY_NEUVETRA = [
  {
    title: "Built for the real world",
    description:
      "Not a generic chatbot. Every Neuvetra product is purpose-built for the specific workflows of local service businesses.",
  },
  {
    title: "Enterprise AI, small business price",
    description:
      "We use the same AI models powering Fortune 500 companies, delivered at a price point that works for a 5-person team.",
  },
  {
    title: "You stay in control",
    description:
      "Set the rules, train the AI on your knowledge, and review every interaction from your dashboard. The AI works for you.",
  },
  {
    title: "Grows with your business",
    description:
      "Start with Front Desk. Add Scheduler, Insights, and Engage as your business scales. One platform, one subscription.",
  },
]

export const INDUSTRIES = [
  { label: "Medical & Healthcare", icon: "🏥" },
  { label: "Dental", icon: "🦷" },
  { label: "MedSpa & Wellness", icon: "✨" },
  { label: "Salon & Beauty", icon: "💇" },
  { label: "Home Services", icon: "🔧" },
  { label: "Legal", icon: "⚖️" },
  { label: "Real Estate", icon: "🏡" },
  { label: "And many more", icon: "+" },
]

export const COMPARISON = {
  features: [
    "Available 24/7",
    "Monthly cost",
    "Setup time",
    "Knows your business",
    "Appointment booking",
    "Call transcripts",
  ],
  columns: [
    {
      name: "Neuvetra Front Desk",
      highlight: true,
      values: ["Always", "From $49/mo", "< 10 minutes", "Fully trained by you", "Direct calendar sync", "Every call"],
    },
    {
      name: "Hire a receptionist",
      highlight: false,
      values: ["Business hours only", "$3,000+/mo", "Weeks to hire & train", "Takes time to learn", "Manual only", "None"],
    },
    {
      name: "Answering service",
      highlight: false,
      values: ["Partial coverage", "$300–$600/mo", "2–3 days", "Generic scripts only", "None", "Rarely"],
    },
  ],
}

export const TESTIMONIALS = [
  {
    quote:
      "We used to miss 20–30% of calls during peak hours. Now every call gets answered and I can see exactly what patients are asking about. New patient bookings are up noticeably.",
    name: "Dr. Sarah M.",
    business: "Family Dental Practice",
    stars: 5,
  },
  {
    quote:
      "I run a small crew and can't have someone sitting by the phone all day. Neuvetra Front Desk handles it while we're on jobs. Customers get a real answer, not voicemail.",
    name: "Marcus T.",
    business: "T&R Plumbing",
    stars: 5,
  },
  {
    quote:
      "Setup took maybe 10 minutes. The AI knows our services, our pricing, our hours. Clients honestly can't tell it's not a person. Worth every penny.",
    name: "Elena V.",
    business: "Lumina MedSpa",
    stars: 5,
  },
]

export const CTA_BANNER = {
  headline: "Your first AI-answered call is 10 minutes away.",
  subheadline: "No contracts. No hardware. No hiring. Just sign up and forward your calls.",
  primaryCTA: "Get started free",
  secondaryCTA: "Talk to us",
}

export const PRICING_TIERS = [
  {
    name: "Starter",
    description: "For solo operators just getting started.",
    monthlyPrice: 49,
    annualPrice: 39,
    minutes: 200,
    overageRate: "0.20",
    popular: false,
    goodFor: "Solo operators who need AI coverage after hours with no secretary on staff.",
    features: [
      "200 minutes / month (~100 calls)",
      "1 local phone number",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Dashboard access",
      "Email support",
    ],
  },
  {
    name: "Growth",
    description: "For active businesses with steady call volume.",
    monthlyPrice: 99,
    annualPrice: 79,
    minutes: 500,
    overageRate: "0.18",
    popular: true,
    goodFor: "Businesses ready for a dedicated AI line that handles every call, all day long.",
    features: [
      "500 minutes / month (~250 calls)",
      "1 local phone number",
      "Full-day AI coverage, including business hours",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Custom AI knowledge base",
      "Dashboard access",
      "Priority email support",
    ],
  },
  {
    name: "Pro",
    description: "For high-volume businesses.",
    monthlyPrice: 199,
    annualPrice: 159,
    minutes: 1000,
    overageRate: "0.16",
    popular: false,
    goodFor: "High-volume businesses that want hands-on setup, training, and priority support.",
    features: [
      "1,000 minutes / month (~500 calls)",
      "1 local phone number",
      "Full-day AI coverage, including business hours",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Custom AI knowledge base",
      "Early access to Insights & Scheduler",
      "Personalized AI training and setup call",
      "Priority support via phone and email",
    ],
  },
]

export const FAQ_ITEMS = [
  {
    question: "Will my callers know they're talking to AI?",
    answer:
      "Front Desk sounds natural and professional. Most callers don't ask, and if they do, it's honest about being an AI assistant. You control the name and personality.",
  },
  {
    question: "Do I need to change my phone number?",
    answer:
      "No. You keep your existing number. You simply set up call forwarding for missed or after-hours calls. It takes about 2 minutes with your carrier.",
  },
  {
    question: "What if it gets something wrong?",
    answer:
      "Every call is transcribed and summarized in your dashboard. You review everything. If the AI is ever unsure, it takes a message and you call back. It never guesses on pricing or commitments it isn't trained on.",
  },
  {
    question: "What languages does it support?",
    answer:
      "Front Desk automatically detects the caller's language and responds in kind. No extra setup required. Particularly useful for businesses serving multilingual communities.",
  },
  {
    question: "Can I customize what it says?",
    answer:
      "Yes, you train it on your business: services, pricing, hours, FAQs, and policies. The more you teach it, the better it performs. You can update it any time from your dashboard.",
  },
]

export const FOOTER = {
  tagline: "AI-powered products for the businesses that keep communities running.",
  columns: [
    {
      heading: "Products",
      links: [
        { label: "Front Desk", href: "/signup", disabled: false },
        { label: "Scheduler", href: null, disabled: true },
        { label: "Insights", href: null, disabled: true },
        { label: "Engage", href: null, disabled: true },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Pricing", href: "#pricing", disabled: false },
        { label: "Contact", href: "/contact", disabled: false },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy", disabled: false },
        { label: "Terms of Service", href: "/terms", disabled: false },
      ],
    },
  ],
  copyright: `© ${new Date().getFullYear()} Neuvetra / Birgani Enterprises Inc. All rights reserved.`,
}
