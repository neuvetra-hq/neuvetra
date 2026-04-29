import { setup, assign, fromPromise } from "xstate"

// ── Supporting types ───────────────────────────────────────────────────────

interface PhoneNumber {
  phoneNumber: string
  friendlyName: string
  locality: string
  region: string
}

interface OtpResult {
  userId: string
  accessToken: string
  hasExistingBusiness: boolean
}

interface ActivateInput {
  userId: string
  businessName: string
  businessType: string
  phoneNumber: string
  aiName: string
  aiPersonality: string
  aiVoiceGender: string
  aiKbSeed: string
  planId: string
  paymentMethodId: string
  stripeCustomerId: string
}

interface ActivateResult {
  businessId: string
  phoneNumber: string
}

// ── Context ────────────────────────────────────────────────────────────────

interface Context {
  // Mirrored from input on machine init so guards can read it from context
  isAlreadyActive: boolean
  // Step 0 — identity
  firstName: string
  lastName: string
  phone: string // E.164

  // Step 1 — OTP verified
  userId: string | null
  accessToken: string | null

  // Step 2 — business
  businessName: string
  businessType: string

  // Steps 3–5 — AI config
  aiName: string
  aiPersonality: "professional" | "friendly" | "empathetic" | "concise"
  aiVoiceGender: "male" | "female"

  // Step 6 — knowledge base seed
  kbSeed: string

  // Step 7 — number selection
  availableNumbers: PhoneNumber[]
  selectedNumber: string | null

  // Step 8 — post-activation
  businessId: string | null

  // Transient
  error: string | null
}

// ── Input ──────────────────────────────────────────────────────────────────

interface Input {
  // Checked on mount — if already active, skip the wizard entirely
  isAlreadyActive: boolean
}

// ── Events ─────────────────────────────────────────────────────────────────

type Events =
  | { type: "IDENTITY_SUBMITTED"; firstName: string; lastName: string; phone: string }
  | { type: "OTP_SUBMITTED"; code: string }
  | { type: "RESEND_REQUESTED" }
  | { type: "BUSINESS_SUBMITTED"; businessName: string; businessType: string }
  | { type: "AI_NAME_SUBMITTED"; name: string }
  | { type: "PERSONALITY_SELECTED"; personality: "professional" | "friendly" | "empathetic" | "concise" }
  | { type: "VOICE_SELECTED"; voiceGender: "male" | "female" }
  | { type: "KNOWLEDGE_SUBMITTED"; text: string }
  | { type: "NUMBER_SELECTED"; phoneNumber: string }
  | { type: "PAYMENT_SUBMITTED"; planId: string; paymentMethodId: string; stripeCustomerId: string }
  | { type: "CALENDAR_CONNECT_CLICKED"; provider: "google" | "outlook" | "caldav" }
  | { type: "CALENDAR_CONNECTED" }
  | { type: "CALENDAR_SKIPPED" }
  | { type: "BACK_CLICKED" }
  | { type: "RETRY_CLICKED" }

// ── Machine ────────────────────────────────────────────────────────────────

export const onboardingMachine = setup({
  types: {
    context: {} as Context,
    events:  {} as Events,
    input:   {} as Input,
  },

  actors: {
    sendOtp: fromPromise<void, { phone: string }>(
      async ({ input }) => {
        // supabase.auth.signInWithOtp({ phone: input.phone })
        void input
      }
    ),

    verifyOtp: fromPromise<OtpResult, { phone: string; code: string }>(
      async ({ input }) => {
        // supabase.auth.verifyOtp({ phone, token: code, type: "sms" })
        void input
        return { userId: "", accessToken: "", hasExistingBusiness: false }
      }
    ),

    fetchNumbers: fromPromise<PhoneNumber[], { areaCode: string }>(
      async ({ input }) => {
        // GET /available-numbers?areaCode=...
        void input
        return []
      }
    ),

    activateAccount: fromPromise<ActivateResult, ActivateInput>(
      async ({ input }) => {
        // POST /billing/activate
        void input
        return { businessId: "", phoneNumber: "" }
      }
    ),

    startCalendarOAuth: fromPromise<{ url: string }, { businessId: string; provider: string }>(
      async ({ input }) => {
        // GET /calendar/auth-url?businessId=...
        void input
        return { url: "" }
      }
    ),
  },

  guards: {
    alreadyActive: ({ context }) => context.isAlreadyActive,

    isExistingAccount: ({ event }) =>
      // event.type from xstate.done.actor.<id> is not in the user Events union;
      // cast for the runtime comparison
      (event as { type: string }).type === "xstate.done.actor.verifyOtp" &&
      (event as any).output?.hasExistingBusiness === true,
  },

  actions: {
    storeIdentity: assign(({ event }) => {
      const e = event as Extract<Events, { type: "IDENTITY_SUBMITTED" }>
      return { firstName: e.firstName, lastName: e.lastName, phone: e.phone, error: null }
    }),

    storeAuth: assign(({ event }) => {
      const output = (event as any).output as OtpResult
      return { userId: output.userId, accessToken: output.accessToken, error: null }
    }),

    storeBusiness: assign(({ event }) => {
      const e = event as Extract<Events, { type: "BUSINESS_SUBMITTED" }>
      return { businessName: e.businessName, businessType: e.businessType }
    }),

    storeAiName: assign(({ event }) => ({
      aiName: (event as Extract<Events, { type: "AI_NAME_SUBMITTED" }>).name,
    })),

    storePersonality: assign(({ event }) => ({
      aiPersonality: (event as Extract<Events, { type: "PERSONALITY_SELECTED" }>).personality,
    })),

    storeVoice: assign(({ event }) => ({
      aiVoiceGender: (event as Extract<Events, { type: "VOICE_SELECTED" }>).voiceGender,
    })),

    storeKbSeed: assign(({ event }) => ({
      kbSeed: (event as Extract<Events, { type: "KNOWLEDGE_SUBMITTED" }>).text,
    })),

    storeNumbers: assign(({ event }) => ({
      availableNumbers: (event as any).output as PhoneNumber[],
    })),

    storeNumber: assign(({ event }) => ({
      selectedNumber: (event as Extract<Events, { type: "NUMBER_SELECTED" }>).phoneNumber,
    })),

    storeBusinessId: assign(({ event }) => ({
      businessId: ((event as any).output as ActivateResult).businessId,
      error: null,
    })),

    setError: assign(({ event }) => ({
      error: (event as any).error?.message ?? "Something went wrong",
    })),

    clearError: assign({ error: null }),

    redirectToDashboard: () => {
      window.location.href = "/dashboard"
    },

    redirectToCalendarOAuth: ({ event }) => {
      window.location.href = (event as any).output?.url ?? ""
    },
  },

}).createMachine({
  id: "onboarding",

  context: ({ input }) => ({
    isAlreadyActive: input.isAlreadyActive,
    firstName: "", lastName: "", phone: "",
    userId: null, accessToken: null,
    businessName: "", businessType: "",
    aiName: "", aiPersonality: "professional", aiVoiceGender: "female",
    kbSeed: "", availableNumbers: [], selectedNumber: null,
    businessId: null,
    error: null,
  }),

  // ── Gate: skip wizard if already active ─────────────────────────────────
  initial: "checkingSession",
  states: {

    checkingSession: {
      always: [
        { guard: "alreadyActive", target: "alreadyActive" },
        { target: "wizard" },
      ],
    },

    alreadyActive: {
      // Shows "Welcome back" UI — no transitions out
      type: "final",
    },

    // ── Wizard ─────────────────────────────────────────────────────────────
    wizard: {
      initial: "identity",
      states: {

        // ── Step 0: Collect name + phone, fire OTP ────────────────────────
        identity: {
          initial: "editing",
          states: {
            editing: {
              on: {
                IDENTITY_SUBMITTED: {
                  target: "sendingOtp",
                  actions: "storeIdentity",
                },
              },
            },
            sendingOtp: {
              invoke: {
                id: "sendOtp",
                src: "sendOtp",
                input: ({ context }) => ({ phone: context.phone }),
                onDone:  { target: "#onboarding.wizard.verify" },
                onError: { target: "otpSendFailed", actions: "setError" },
              },
            },
            otpSendFailed: {
              on: {
                RETRY_CLICKED: { target: "sendingOtp", actions: "clearError" },
              },
            },
          },
        },

        // ── Step 1: Enter 6-digit OTP (auto-submits at 6 digits) ──────────
        verify: {
          initial: "entering",
          states: {
            entering: {
              on: {
                OTP_SUBMITTED:    { target: "verifyingOtp" },
                RESEND_REQUESTED: {
                  target: "#onboarding.wizard.identity.sendingOtp",
                  actions: "clearError",
                },
              },
            },
            verifyingOtp: {
              invoke: {
                id: "verifyOtp",
                src: "verifyOtp",
                input: ({ context, event }) => ({
                  phone: context.phone,
                  code:  (event as Extract<Events, { type: "OTP_SUBMITTED" }>).code,
                }),
                onDone: [
                  {
                    guard:   "isExistingAccount",
                    actions: "redirectToDashboard",
                  },
                  {
                    target:  "#onboarding.wizard.business",
                    actions: "storeAuth",
                  },
                ],
                onError: { target: "verifyFailed", actions: "setError" },
              },
            },
            verifyFailed: {
              on: {
                OTP_SUBMITTED:  { target: "verifyingOtp", actions: "clearError" },
                RETRY_CLICKED:  { target: "entering",     actions: "clearError" },
              },
            },
          },
        },

        // ── Step 2: Business name + type (no back allowed) ────────────────
        business: {
          on: {
            BUSINESS_SUBMITTED: {
              target:  "aiName",
              actions: "storeBusiness",
            },
            // BACK_CLICKED intentionally absent — cannot go before business
          },
        },

        // ── Step 3: Name the AI ───────────────────────────────────────────
        aiName: {
          on: {
            AI_NAME_SUBMITTED: { target: "personality", actions: "storeAiName" },
            BACK_CLICKED:      { target: "business" },
          },
        },

        // ── Step 4: Pick personality ──────────────────────────────────────
        personality: {
          on: {
            PERSONALITY_SELECTED: { target: "voice",   actions: "storePersonality" },
            BACK_CLICKED:         { target: "aiName" },
          },
        },

        // ── Step 5: Pick voice gender ─────────────────────────────────────
        voice: {
          on: {
            VOICE_SELECTED: { target: "knowledge", actions: "storeVoice" },
            BACK_CLICKED:   { target: "personality" },
          },
        },

        // ── Step 6: Knowledge base seed (optional — can be empty) ─────────
        knowledge: {
          on: {
            KNOWLEDGE_SUBMITTED: { target: "numbers",  actions: "storeKbSeed" },
            BACK_CLICKED:        { target: "voice" },
          },
        },

        // ── Step 7: Fetch + pick Twilio phone number ──────────────────────
        numbers: {
          initial: "loading",
          on: {
            BACK_CLICKED: { target: "knowledge" },
          },
          states: {
            loading: {
              invoke: {
                id: "fetchNumbers",
                src: "fetchNumbers",
                input: ({ context }) => ({
                  areaCode: context.phone.replace(/\D/g, "").slice(1, 4),
                }),
                onDone:  { target: "picking", actions: "storeNumbers" },
                onError: { target: "loadFailed", actions: "setError" },
              },
            },
            picking: {
              on: {
                NUMBER_SELECTED: {
                  target:  "#onboarding.wizard.activation",
                  actions: "storeNumber",
                },
              },
            },
            loadFailed: {
              on: {
                RETRY_CLICKED: { target: "loading", actions: "clearError" },
              },
            },
          },
        },

        // ── Step 8: Stripe payment + full account activation ──────────────
        activation: {
          initial: "idle",
          on: {
            BACK_CLICKED: { target: "numbers.picking" },
          },
          states: {
            idle: {
              on: {
                PAYMENT_SUBMITTED: { target: "processing" },
              },
            },
            processing: {
              invoke: {
                id: "activateAccount",
                src: "activateAccount",
                input: ({ context, event }) => ({
                  userId:           context.userId!,
                  businessName:     context.businessName,
                  businessType:     context.businessType,
                  phoneNumber:      context.selectedNumber!,
                  aiName:           context.aiName,
                  aiPersonality:    context.aiPersonality,
                  aiVoiceGender:    context.aiVoiceGender,
                  aiKbSeed:         context.kbSeed,
                  planId:           (event as Extract<Events, { type: "PAYMENT_SUBMITTED" }>).planId,
                  paymentMethodId:  (event as Extract<Events, { type: "PAYMENT_SUBMITTED" }>).paymentMethodId,
                  stripeCustomerId: (event as Extract<Events, { type: "PAYMENT_SUBMITTED" }>).stripeCustomerId,
                }),
                onDone:  {
                  target:  "#onboarding.wizard.calendar",
                  actions: "storeBusinessId",
                },
                onError: { target: "activationFailed", actions: "setError" },
              },
            },
            activationFailed: {
              on: {
                RETRY_CLICKED: { target: "idle", actions: "clearError" },
              },
            },
          },
        },

        // ── Step 9: Optional calendar connection (no back — activation done)
        calendar: {
          initial: "idle",
          states: {
            idle: {
              on: {
                CALENDAR_CONNECT_CLICKED: { target: "connecting" },
                CALENDAR_CONNECTED:       { target: "#onboarding.complete" },
                CALENDAR_SKIPPED:         { target: "#onboarding.complete" },
              },
            },
            connecting: {
              invoke: {
                id: "startCalendarOAuth",
                src: "startCalendarOAuth",
                input: ({ context, event }) => ({
                  businessId: context.businessId!,
                  provider:   (event as Extract<Events, { type: "CALENDAR_CONNECT_CLICKED" }>).provider,
                }),
                onDone:  { actions: "redirectToCalendarOAuth" },
                onError: { target: "idle", actions: "setError" },
              },
            },
          },
        },

      },
    },

    // ── Wizard complete ────────────────────────────────────────────────────
    complete: {
      type: "final",
    },

  },
})
