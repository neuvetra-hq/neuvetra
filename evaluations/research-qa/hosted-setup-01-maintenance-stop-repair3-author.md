# HOSTED-SETUP-MAINTENANCE-STOP-REPAIR-03 — author handoff

Date: 2026-09-26. Independent QA3 rejected Repair2 for MS-F04: canonical timestamps could run backward while a successful stop receipt and journal were still returned. Prior failed candidates and QA reports remain preserved.

This local repair requires each timestamp to be nondecreasing. A backward timestamp before scaling refuses; a backward timestamp after scaling remains uncertain with no retry. The failure journal uses the last accepted timestamp if the injected clock fails and records `clockFallback: true`, so a clock failure cannot erase the uncertainty event when the journal still works. Focused regressions cover both phases. No hosted or provider action occurred.

Validation: focused Bun suite **9 pass, 61 assertions**; focused strict TypeScript **pass**. Source SHA-256 `645b2a230366b891b2b9bfa93d7e659302bdd98f43d1774ade0fccc2a30d5c51`; test SHA-256 `506024203513cc82f827c3ba623d85e46f1a18062c65fd7976473073eca51beb`.
