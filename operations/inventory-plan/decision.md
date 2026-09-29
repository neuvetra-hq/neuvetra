# Connected collection plan - ready for board testing

On 2026-09-25 the board rejected a hardcoded first design and requested a dynamic collection workflow driven by the previous seven-step setup, covering different businesses and durable storage.

Implemented the connection, primary-source collection templates, subtype selection, explicit location links/company-wide coverage, all purchased-energy and Scope 3 screens, custom activities, notes, draft quantities, record-linked originals, versioned SQLite snapshots and conflict checks. The earlier static first design is superseded.

Independent review passed for the bounded local demonstration with the two tool/environment test exclusions recorded in the review. Runtime was upgraded on the existing loopback origin to preserve the browser draft and actually exercise acknowledgment through database save to generated plan. The preserved Acme draft was migrated by its own review button; no business is hardcoded in the new plan.

Original onboarding worktree was untouched. Isolated implementation was necessary because it contains uncommitted work and another product milestone owns separate files. This local demonstration is ready for board feedback, not a production tenant service, calculation release, inventory-completeness certification or external assurance.

Chrome returned ERR_BLOCKED_BY_CLIENT for the connected server; no browser protections were changed. The Codex browser successfully exercises the page. Board was asked whether manual Chrome navigation works.
