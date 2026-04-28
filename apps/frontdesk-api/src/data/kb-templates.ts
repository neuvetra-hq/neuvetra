/**
 * Default knowledge base templates per business type.
 * Seeded automatically when a new business is created.
 *
 * Answers use [PLACEHOLDERS] where the business must fill in their specifics.
 */

export interface KBEntry {
  question:  string
  answer:    string
  category:  string
  sortOrder: number
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

export const plumbingTemplate: KBEntry[] = [

  // -- Call Protocol ---------------------------------------------------------

  {
    category: "Call Protocol",
    sortOrder: 0,
    question: "What information do you collect on every call?",
    answer: [
      "On every call collect the following before hanging up:",
      "1. Full name",
      "2. Service address -- always ask: 'Is there a gate code or unit number?'",
      "3. Best callback phone number -- ask: 'Can the plumber text you when they are on the way?'",
      "4. Homeowner or tenant? If it is a rental property, the landlord must authorize the work and provide payment BEFORE dispatching a plumber.",
      "5. Brief description of the problem (e.g. 'Kitchen sink leaking underneath')",
      "6. How did they hear about us? (Google, Yelp, referral, saw the truck -- important for tracking)",
      "7. Confirm the dispatch fee: 'Just to confirm, you are aware of the [DISPATCH FEE] fee for today, correct?'",
    ].join("\n"),
  },

  // -- Emergencies -----------------------------------------------------------

  {
    category: "Emergencies",
    sortOrder: 10,
    question: "What should I say if a customer has a burst pipe or major leak?",
    answer: [
      "Take control immediately. Say: 'I can absolutely get someone out to you. First, do you know where your main water shut-off valve is? Please go turn that off right now to stop the water damage. While you do that, what is your address and phone number so I can dispatch our next available plumber?'",
      "",
      "Always get the address and phone number first -- if the call drops you can still reach them.",
    ].join("\n"),
  },
  {
    category: "Emergencies",
    sortOrder: 11,
    question: "What should I say if a customer's toilet is overflowing?",
    answer: "Say: 'Please reach down behind the toilet, close to the floor, and turn the silver valve clockwise to stop the water. I will check our schedule and get a technician headed your way.' Then collect their address and book the call.",
  },
  {
    category: "Emergencies",
    sortOrder: 12,
    question: "What should I say if a customer smells gas in their home?",
    answer: "Safety first -- say: 'Please leave the house immediately. Do not turn on any light switches or use your phone inside. Call the gas company or 911 right away to shut off the gas. Once it is safe to re-enter, call us back and we will send a plumber to repair the line.'",
  },
  {
    category: "Emergencies",
    sortOrder: 13,
    question: "Do you offer 24/7 emergency service?",
    answer: "Yes. We have technicians on call around the clock. Please note that after-hours emergency calls carry an additional dispatch fee of [AFTER-HOURS FEE]. Shall I send someone out right now?",
  },

  // -- Pricing ---------------------------------------------------------------

  {
    category: "Pricing",
    sortOrder: 30,
    question: "How do you charge for your work -- hourly or flat rate?",
    answer: "We charge flat-rate by the job, not by the hour. This protects you -- if a job takes longer than expected, you do not pay extra. We send a licensed technician out for a dispatch fee of [DISPATCH FEE]. They will diagnose the problem and give you an exact, upfront price before any work begins.",
  },
  {
    category: "Pricing",
    sortOrder: 31,
    question: "Can you give a rough estimate over the phone?",
    answer: "I completely understand wanting a ballpark. Unfortunately, because every plumbing system is different -- a leak could be a loose washer or a cracked pipe inside the wall -- we prefer not to guess over the phone. Our technician will come out for just [DISPATCH FEE] and give you an exact price before touching anything.",
  },
  {
    category: "Pricing",
    sortOrder: 32,
    question: "Do you offer free estimates?",
    answer: "For standard repairs and troubleshooting, we charge a dispatch fee of [DISPATCH FEE] to bring our fully stocked truck to your home. For large projects -- new water heater installation, sewer replacement, or whole-house repipe -- we do offer free estimates. Which type of work are you looking at?",
  },
  {
    category: "Pricing",
    sortOrder: 33,
    question: "What is your service / dispatch fee?",
    answer: "[DISPATCH FEE]",
  },
  {
    category: "Pricing",
    sortOrder: 34,
    question: "Is the dispatch fee applied toward the cost of the repair?",
    answer: "Yes. If you choose to move forward with the repair, we apply the [DISPATCH FEE] dispatch fee toward your final bill.",
  },

  // -- Scheduling ------------------------------------------------------------

  {
    category: "Scheduling",
    sortOrder: 50,
    question: "How soon can you send a technician?",
    answer: "Let me check our dispatch board. I have a technician available in our morning window (8 AM to 12 PM) or our afternoon window (12 PM to 4 PM). Which works better for you?",
  },
  {
    category: "Scheduling",
    sortOrder: 51,
    question: "Why do you give a time window instead of an exact arrival time?",
    answer: "Plumbing jobs are unpredictable -- a simple fix can turn into a bigger one, and we never want to rush our plumbers. Our technician will call or text you 30 minutes before they arrive so you are not stuck waiting around.",
  },
  {
    category: "Scheduling",
    sortOrder: 52,
    question: "Does the homeowner need to be present when the plumber arrives?",
    answer: "Yes. An adult over 18 must be present to review the upfront pricing, authorize the work, and process payment when the job is complete.",
  },

  // -- Services --------------------------------------------------------------

  {
    category: "Services",
    sortOrder: 70,
    question: "Do you service, repair, and install water heaters?",
    answer: "Yes. We service, repair, and install all types of water heaters -- tank and tankless, gas and electric. We can send a technician today to see if yours can be repaired or needs replacement. Do you know if your current unit is gas or electric?",
  },
  {
    category: "Services",
    sortOrder: 71,
    question: "Do you clear clogged drains and main sewer lines?",
    answer: "Yes. We handle all drain cleaning with professional snaking equipment, and we can run a camera down the line to show you exactly what is causing the blockage. Quick note -- have you used any chemical drain cleaner like Drano recently? Our technicians need to know to protect themselves.",
  },
  {
    category: "Services",
    sortOrder: 72,
    question: "Do you install fixtures the customer has already purchased?",
    answer: "Yes. We are happy to install customer-supplied faucets, toilets, and other fixtures. Our warranty covers our labor only -- if the fixture itself is defective from the factory, that falls under the manufacturer's warranty.",
  },
  {
    category: "Services",
    sortOrder: 73,
    question: "A customer's garbage disposal hums but won't spin -- what should I say?",
    answer: "Before booking a service call, try this: 'There is a small red reset button on the bottom of the disposal underneath the sink -- press that and run it again. Sometimes they just trip a breaker when overloaded.' If the reset does not fix it, book the call. Helping them try the reset first builds a lot of trust.",
  },

  // -- Trust & Payment -------------------------------------------------------

  {
    category: "Trust & Payment",
    sortOrder: 90,
    question: "Are your plumbers licensed, bonded, and insured?",
    answer: "Yes, 100%. All of our technicians are fully licensed, bonded, and insured. We also background-check every employee so you can feel completely safe having them in your home.",
  },
  {
    category: "Trust & Payment",
    sortOrder: 91,
    question: "Do you guarantee your work / offer a warranty?",
    answer: "Yes. We stand behind our work with a [WARRANTY PERIOD, e.g. 1 year] warranty on our labor and any parts we supply. All warranty details are provided in writing before we start the job.",
  },
  {
    category: "Trust & Payment",
    sortOrder: 92,
    question: "What forms of payment do you accept?",
    answer: "We accept all major credit cards, checks, and cash. Our technician has a tablet and can take payment securely at your home when the job is complete.",
  },
  {
    category: "Trust & Payment",
    sortOrder: 93,
    question: "Do you offer financing or payment plans for larger jobs?",
    answer: "Yes. For larger jobs we partner with [FINANCING COMPANY] to offer flexible financing. The technician can help you apply for approval in just a few minutes while they are at your home.",
  },
]

// ---------------------------------------------------------------------------
// Template registry -- add more business types here
// ---------------------------------------------------------------------------

export const KB_TEMPLATES: Partial<Record<string, KBEntry[]>> = {
  plumbing: plumbingTemplate,
}
