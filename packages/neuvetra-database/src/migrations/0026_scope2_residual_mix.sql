-- Scope 2 market-based residual mix (Claude, 2026-09-28, per-gas amendment 2026-09-29). Extends the 0024 method
-- reference store; changes no row. Decision: notes/decisions/2026-09-28-scope2-residual-mix.md (board delegated the
-- choice to Claude on 2026-09-28) as amended by notes/decisions/2026-09-29-scope2-residual-mix-per-gas.md; the
-- amendment's SHA-256 is pinned below. Independent of 0025 (Scope 3).

-- The Green-e residual mix is published only as a web page, so the original is kept as HTML.
alter table neuvetra.method_source_documents drop constraint method_source_documents_media_type_check,
  add constraint method_source_documents_media_type_check check(media_type in('application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','text/html'));
alter table neuvetra.method_source_copies drop constraint method_source_copies_check,
  add constraint method_source_copies_check check(location_kind<>'private_bucket' or locator ~ ('^method-sources/'||verified_sha256||'\.(pdf|xlsx|csv|html)$'));

insert into neuvetra.method_source_documents(id,publisher,title,edition,url,retrieved_on,sha256,bytes,media_type,source_use) values
('24000000-0000-4000-8000-00000000000a','Center for Resource Solutions (Green-e)','2025 Residual Mix Emissions Rates (2023 Data)',
 'Released 2026-01-29 (2023 data); applied to 2025 reporting by Neuvetra decision; Net Generation and Voluntary RE (MWh, 12-month vintage) feed the per-gas residual; rate column not used',
 'https://resource-solutions.org/2025-residual-mix/','2026-09-28','72bae141a88e44fb4a5d30dacd078f6d5c45063df784ce09f3ccbc1d11e799bb',122238,'text/html','numeric_values_with_citation');

-- eGRID2023 rev2 rates (unchanged from register 0626e6d3...) plus Green-e net generation and voluntary MWh for the 27 subregions.
insert into neuvetra.method_register_approvals(register_sha256,register_schema,scope,source_document_sha256,entry_count,decision_sha256,decision_reference,approved_by,approved_on) values
('4873b8c08dbab395336a2273501724118661cf505ad19fa48a6f625661e3a14d','neuvetra.verified-factor-register.v1',2,'895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6',138,
 '1960499ec1a6872b3eda5d684149e1e59d66a34a57a1eb920993bbc6ef5e5236','notes/decisions/2026-09-29-scope2-residual-mix-per-gas.md (amends 2026-09-28-scope2-residual-mix.md)','Claude, under delegation from Nima (board, release owner)','2026-09-29');
insert into neuvetra.method_release_decisions(register_sha256,decision_sha256,decision_reference,approved_by,approved_on) values
('4873b8c08dbab395336a2273501724118661cf505ad19fa48a6f625661e3a14d','1960499ec1a6872b3eda5d684149e1e59d66a34a57a1eb920993bbc6ef5e5236','notes/decisions/2026-09-29-scope2-residual-mix-per-gas.md (amends 2026-09-28-scope2-residual-mix.md)','Claude, under delegation from Nima (board, release owner)','2026-09-29');
