# Site-Web deployment binding: omitted-region repair (2026-09-26)

The independent live bridge check found that Railway's status JSON omits `serviceInstance.region` for the exact Site-Web service. The candidate binder required `null` or an empty string and therefore refused a healthy raw provider capture with `HS_DEPLOYMENT_BINDING_STATUS_INSTANCE_REFUSED`. The original raw observation and FAIL remain separate review evidence.

The binder now accepts an omitted region in that status view. It still requires the exact project, environment, service, deployment, commit and image; the authenticated environment configuration must contain only `us-east4-eqdc4a` with one replica. An explicit unexpected status region remains refused. No raw provider response was rewritten and no maintenance action was taken.

Frozen candidate SHA-256: `tools/staging/hosted-setup-deployment-binding.ts` `ecca1ad63fd77598a56f2e599fd7b96b386bd6dacc797c0a4963f2ca3abdbae4`; focused test source `3affe1f8c679bdfed0e9f87d8032025abb4b99b8e42858c7e8278a2ffc0f2114`. Focused Bun test: 11 passed, 70 assertions. Strict TypeScript: passed. Independent targeted review is pending. This repair alone does not authorize a stop or migration.
