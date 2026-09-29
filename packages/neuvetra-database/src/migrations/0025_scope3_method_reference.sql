-- Scope 3 beta methods (Claude, 2026-09-28). Extends the 0024 method reference store; changes no row.
-- DO NOT MERGE until the board has approved notes/decisions/2026-09-28-scope3-beta-methods.md unchanged:
-- its SHA-256 is the decision pinned below, and the rows below record that approval. Scope 1 and 2 do not
-- depend on this migration.

-- One EPA Hub Table 9 cell (Asphalt Concrete, recycled, D490) stores 0.0035205384954666674 (19 decimals).
alter table neuvetra.method_factor_values drop constraint method_factor_values_value_text_check,
  add constraint method_factor_values_value_text_check check(value_text ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,20})?$');

alter table neuvetra.method_versions drop constraint method_versions_scope_check, drop constraint method_versions_family_check,
  add constraint method_versions_scope_check check(scope in(1,2,3)),
  add constraint method_versions_family_check check(
    (scope in(1,2) and family in('stationary_combustion','mobile_combustion','fugitive','purchased_electricity'))
    or (scope=3 and family in('fuel_energy_related','transportation_distribution','waste','business_travel','employee_commuting')));

-- EPA publishes Hub Table 9 waste factors as CO2e computed with AR4 GWPs; there are no per-gas values to load.
insert into neuvetra.method_gwp_sets(id,assessment,horizon_years) values
('AR4-100','IPCC Fourth Assessment Report (AR4), embedded by EPA in CO2e-only factors (Hub Table 9); no per-gas values',100);

-- Hub 2025 Tables 8-11 (EPA's latest edition on 2026-09-28) with eGRID2023 rev2 rates and grid gross loss (per-entry source).
insert into neuvetra.method_register_approvals(register_sha256,register_schema,scope,source_document_sha256,entry_count,decision_sha256,decision_reference,approved_by,approved_on) values
('5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2','neuvetra.verified-factor-register.v1',3,'43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7',330,
 '4ae9f2250963975723e5a5f48786d4d1fb7972a21f37de3302dfd10fda5d1ec2','notes/decisions/2026-09-28-scope3-beta-methods.md','Nima (board, release owner)','2026-09-28');
insert into neuvetra.method_release_decisions(register_sha256,decision_sha256,decision_reference,approved_by,approved_on) values
('5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2','4ae9f2250963975723e5a5f48786d4d1fb7972a21f37de3302dfd10fda5d1ec2','notes/decisions/2026-09-28-scope3-beta-methods.md','Nima (board, release owner)','2026-09-28');
