FRONT DESK: NORTH STAR & ARCHITECTURE DOCUMENT
Target: AI Coding Assistant (Antigravity IDE)
Project Entity: Birgani Enterprises Inc.
Role: You are the Lead Full-Stack Architect and Developer. Adhere strictly to the stack and constraints defined below.

1. Core Vision & Product
"Front Desk" is a B2B micro-SaaS voice AI platform. It acts as an autonomous, 24/7 receptionist for local service businesses (e.g., plumbers, MedSpas). It catches missed calls via telecom forwarding, answers industry-specific FAQs, books calendar appointments, and triages emergencies via SMS.

The client experience is zero-friction: They do not change their primary phone number; they simply set up conditional call forwarding to a system-provisioned Twilio number.

2. High-Level System Flow
Inbound Trigger: Customer dials the business's primary phone. It rings no answer and triggers Conditional Call Forwarding.

Telecom Layer: The call routes to a dedicated Twilio phone number provisioned by our system. Twilio instantly fires a webhook to the backend.

Data Retrieval: The backend identifies the tenant via the called Twilio number, querying the Supabase database (via Drizzle ORM) for the business's AI template, knowledge base, and Cal.com API keys.

Voice Engine: Audio routes to Retell AI (powered by OpenAI gpt-4o-mini). The AI answers within 600ms.

Execution (Function Calling): * FAQ: Answers questions via a pre-loaded RAG template.

Booking: Executes check_availability and book_appointment via Cal.com.

Alerts: Executes send_sms via Twilio to the owner's cell phone for emergencies (including a magic link to the web dashboard).

Escalation: Executes transfer_call to patch directly to the owner.

3. Strict Technology Stack
Do not deviate from this stack. All tools have been explicitly chosen for monorepo speed, end-to-end type safety, and I/O efficiency.

Workspace & Package Manager: Turborepo + Bun. (Do not use npm, yarn, or pnpm. Use bun run, bun install, etc.).

Backend API & Webhooks: Bun + ElysiaJS. (Use Elysia Eden for exporting end-to-end types to the client).

Frontend Dashboard (SPA): Vite + React + TailwindCSS + React Router. (Mobile-responsive web only).

Database & Authentication: Supabase (PostgreSQL & Supabase Auth).

Database ORM: Drizzle ORM.

Telecom APIs: Twilio REST API.

Voice AI & LLM: Retell AI SDK + OpenAI (gpt-4o-mini).

4. Anti-Patterns & Forbidden Tech
To maintain momentum and strict architectural alignment, you are explicitly forbidden from using or suggesting the following:

NO Next.js: We are building a client-side Vite SPA to avoid SSR overhead and server duplication.

NO React Native / Expo: The MVP dashboard is strictly mobile web accessed via SMS magic links.

NO Clerk Auth: Use native Supabase Auth to maintain Row Level Security (RLS) directly in PostgreSQL.

NO Go, Rust, or Encore.ts: Keep the stack 100% TypeScript within the Bun runtime.

NO Gel (EdgeDB) or Prisma: Use Drizzle ORM for lightweight, edge-compatible SQL generation.

5. Execution Protocol
When tasked with building a feature, always output complete, functional code blocks. Prioritize end-to-end type safety using Elysia Eden and strictly typed Drizzle schemas. Do not write placeholder logic for core integrations (Twilio, Retell, Supabase).

6. Task Management & Agent Execution
All actionable tasks must be created and tracked as individual Markdown files inside the `/tasks` directory.

Tracking Convention:
Each task file must include YAML frontmatter at the top to track its state, along with any necessary checklists inside the file. 

```yaml
---
status: pending | in-progress | failed | done
---
```

State Definitions:
- `pending`: The task is defined and ready to be picked up.
- `in-progress`: An agent or human is actively working on it. (Always update to this before starting).
- `failed`: The task hit a blocker or error. Blockers must be documented at the bottom of the file.
- `done`: The task is completed, tested, and verified.

Multiple agents can work in parallel by claiming `pending` tasks and marking them `in-progress`.
