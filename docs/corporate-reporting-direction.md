# Corporate reporting direction

Board decision recorded 2026-09-14. Source: the board's explicit instruction in the coordinator conversation to make corporate Scope 1, 2 and 3 reporting the main goal for AI/verifier preparation, UI, database, semantic layer and all future development.

## Primary outcome

Build Neuvetra for corporate Scope 1, 2 and 3 reporting under California SB 253, using applicable GHG Protocol accounting and producing traceable inventories and evidence for independent external assurance. California/U.S. remains the initial market. Corporate reporting is the organizing product model; industrial CARB MRR is a secondary specialist capability when relevant.

## Requirements for future decisions

## First actual MVP acceptance target

The board further clarified that the first actual MVP must reliably produce corporate Scope 1, 2 and 3 reports for supported companies in California, with source documents, traceable calculations and a complete supporting package for an independent assurance provider. Existing synthetic electricity demonstrations are interim increments, not this MVP. Expansion to other jurisdictions, including the EU and Canada, follows the California MVP.

Before calling this MVP complete, define and independently verify:

- **Supported customer and reporting boundary:** declared company types, reporting year, entities, consolidation approach, facilities and sources; identify unsupported activities before presenting a report as complete. California-first is the regulatory/customer focus, not permission to omit out-of-state or overseas operations that fall within the applicable corporate inventory boundary.
- **Requirements coverage:** a maintained matrix of applicable SB 253 requirements, relevant GHG Protocol provisions and CARB implementation guidance, with primary-source locators, editions, dates, applicability reasoning, product behavior, validation evidence and unresolved gaps. Distinguish operative requirements, proposals and enforcement discretion; a source archive alone is not coverage evidence.
- **Inventory coverage:** reconcile the entity/source register and all Scope 3 categories to included data, supported estimates, justified exclusions or not-applicable findings. Cover applicable Scope 1 sources and Scope 2 methods and purchased energy. Show gaps explicitly; unknowns are never silently zero and estimates retain their methods and uncertainty.
- **Evidence and reproducibility:** trace each reported total through activity data, original evidence or documented estimation basis, unit conversions, factors, methods and rounding; retain versions and corrections. Check omissions, duplicates and reconciliation, with independent numerical and domain validation on representative company cases.
- **Assurance handoff:** provide a readable report and navigable evidence/workpaper package, outstanding findings and an exact reviewed version. Validate the handoff with a qualified independent human assurance provider. The desired outcome is efficient external review with minimal avoidable rework; no promise of automatic approval, a rubber stamp or a predetermined assurance opinion.
- **Operational readiness:** demonstrate tenant isolation, access control, persistence, recovery and authorized reviewer access for real company data. Source and method releases, lawful source use and customer-facing claims must pass their own gates.

These are required outcomes to turn into bounded acceptance cases, not claims that every regulation or every company's data is already covered. Missing material evidence or unresolved applicability must remain visible and prevent an unsupported completeness or compliance claim.

## Cross-layer requirements

- **Roadmap and UI:** organize work around companies, reporting years, organizational boundaries, subsidiaries/facilities and emissions sources/categories. Show covered, missing, estimated, excluded-with-reason and not-applicable items distinctly. A completed electricity worksheet or twelve entered months must not imply a complete corporate inventory. Make evidence gaps, corrections and reviewer handoff understandable to nontechnical users.
- **Database:** support tenant isolation and authorized corporate hierarchies, effective-dated boundaries and ownership/consolidation changes, activity records, original evidence, versioned factors/methods, calculations, estimates, review decisions and immutable report versions. Record provenance and applicable periods. Evolve schemas through bounded reviewed migrations; this direction does not assert these features already exist.
- **Semantic layer:** define consistent entities, scopes, Scope 3 categories, units, gases, GWP bases, periods, consolidation policies and source/method relationships. Preserve the distinction between missing and zero, activity and emissions, and location-based and market-based Scope 2 results; avoid double counting across corporate totals. Models propose structured input; deterministic code validates and calculates.
- **AI/RAG preparation and evaluation:** prioritize corporate accounting, source applicability, boundaries, evidence and reporting-year context. Use approved primary evidence, resolving citations and explicit uncertainty. Reading documents or editing prompts is not model training or demonstrated competence. Evaluate unseen corporate cases and retain failures before claiming capability; fine-tuning is not implicitly authorized or required by this direction.
- **Verifier and QA:** prioritize omitted entities/sources, Scope 1 and 2 treatment, relevant Scope 3 categories, estimates, duplicate records, factor applicability, evidence sufficiency and unsupported completeness conclusions. Use independent expected findings and valid control cases. Internal AI review does not constitute accreditation or external professional assurance; preserve independence requirements for the external provider.
- **New roles and milestones:** include the corporate outcome, supported scope and remaining gaps in the brief and acceptance criteria. Explain how work advances corporate reporting, evidence quality or a necessary operational foundation. Avoid unrelated MRR specialization unless the board or an applicable customer engagement requires it.

## Boundaries and status

This decision records durable product intent. It neither releases sources/methods nor certifies SB 253 compliance, approves an assurance provider, completes a milestone, changes a deployment, or changes existing release/board-feedback gates. Verify current law, amendments, CARB implementation/enforcement guidance and assurance requirements for the relevant reporting year using primary evidence. Existing synthetic and unreleased statuses remain in force until their own acceptance gates are met.
