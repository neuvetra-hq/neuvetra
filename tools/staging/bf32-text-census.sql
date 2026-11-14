-- BF-32 census (READ ONLY: one SELECT, no writes, no functions created). Run it by hand, as a database administrator, against a
-- COPY or a read replica; never against hosted staging or production without the owner's say-so.
--
-- For every free-text field of a stored collection activity (Scope 1, 2 and 3) it counts the stored versions whose NFC-normalised
-- text would be over the field's limit under the BF-32 save rule (NFC first, then UTF-16 code units), which is what a CORRECTION of
-- that record has to meet. Such a record still READS (the read path is unchanged); the count tells QA which records will need
-- a shorter text the next time someone corrects them.
--   over_new_rule_versions : stored versions over the limit under the new rule
--   over_new_rule_heads    : the same, current versions only (what a user would correct next)
--   not_nfc_versions       : stored versions whose text is not in NFC today (Scope 3 text was stored as typed)
--   over_old_read_rule     : stored versions already over the limit as the read path counts them (should be 0; any row here is a record
--                            the read path already refuses, saved before this fix by the old rule's expansion hole)
-- UTF-16 code units = characters + the number of characters outside the Basic Multilingual Plane (4 bytes in UTF-8).
-- Needs a UTF8 database and PostgreSQL 13+ (normalize()). The list below is SAVE_TEXT_LIMITS in collection-text-rule.ts.
with limits(path, label, max) as (values
    ('$.sourceId','Source identifier',120),
    ('$.quantity.originalValue','Quantity as written',100),
    ('$.quantity.originalUnit','Unit as written',80),
    ('$.reference','Reference',1000),
    ('$.notes','Notes',4000),
    ('$.estimateBasis','Estimate basis',2000),
    ('$.withdrawalReason','Withdrawal reason',2000),
    ('$.payload.heatContent.value','Heat content value',100),
    ('$.payload.consumption.gallons','Gallons',100),
    ('$.payload.consumption.purchasedGallons','Purchased gallons',100),
    ('$.payload.consumption.openingGallons','Opening gallons',100),
    ('$.payload.consumption.closingGallons','Closing gallons',100),
    ('$.payload.vehicleGroupId','Vehicle group ID',120),
    ('$.payload.fuel','Fuel',80),
    ('$.payload.vehicleType','Vehicle type',120),
    ('$.payload.gallons','Gallons',100),
    ('$.payload.miles.value','Miles value',100),
    ('$.payload.miles.basis','Miles basis',500),
    ('$.payload.fuelEconomy.mpg','Fuel economy',100),
    ('$.payload.fuelEconomy.source','Fuel economy source',500),
    ('$.payload.terms.PN','Refrigerant term PN',100),
    ('$.payload.terms.CN','Refrigerant term CN',100),
    ('$.payload.terms.PS','Refrigerant term PS',100),
    ('$.payload.terms.CD','Refrigerant term CD',100),
    ('$.payload.terms.RD','Refrigerant term RD',100),
    ('$.payload.meterOrAccountNumber','Meter or account number',120),
    ('$.payload.utilityName','Utility name',200),
    ('$.payload.site','Site',200),
    ('$.payload.subregion','Subregion',20),
    ('$.payload.utilityEiaId','Utility EIA ID',40),
    ('$.payload.instruments[*].mwh','Instrument MWh',100),
    ('$.payload.instruments[*].rateLbPerMwh.co2','Instrument CO2 rate',100),
    ('$.payload.instruments[*].rateLbPerMwh.ch4','Instrument CH4 rate',100),
    ('$.payload.instruments[*].rateLbPerMwh.n2o','Instrument N2O rate',100),
    ('$.payload.instruments[*].instrumentId','Instrument ID',120),
    ('$.payload.instruments[*].registry','Instrument registry',80),
    ('$.payload.vehicle','Vehicle',80),
    ('$.payload.dataQuality.basis','Data quality basis',500),
    ('$.payload.material','Material',80),
    ('$.payload.treatment','Treatment',80),
    ('$.payload.mode','Mode',80),
    ('$.payload.haulBasis','Haul basis',200),
    ('$.payload.supplierName','Supplier name',200),
    ('$.payload.glAccount','GL account',120),
    ('$.payload.description','Description',200),
    ('$.payload.spendEstimateBasis','Spend estimate basis',300),
    ('$.payload.product','Product',200),
    ('$.payload.factorUnit','Factor unit',80),
    ('$.payload.supersedesSpend.supplierName','Superseded supplier name',200),
    ('$.payload.modes[*].mode','Commuting mode',80),
    ('$.payload.sharesBasis','Shares basis',300),
    ('$.payload.distanceBasis','Distance basis',300),
    ('$.payload.baselineBasis','Baseline basis',300),
    ('$.payload.assetLabel','Asset label',200),
    ('$.payload.counterpartyName','Counterparty name',200),
    ('$.payload.noOperationalControlBasis','Operational control basis',500),
    ('$.payload.refrigerantGas','Refrigerant gas',80),
    ('$.payload.cbecsActivity','Building activity',80),
    ('$.payload.productLabel','Product',200),
    ('$.payload.energyCarrier','Energy carrier',80),
    ('$.payload.energyUnit','Energy unit',80),
    ('$.payload.useRegion','Use region',80),
    ('$.payload.lifetimeSource','Lifetime source',300),
    ('$.payload.gas','Gas',80),
    ('$.payload.releaseBasis','Release basis',300),
    ('$.payload.splitBasis','Split basis',300),
    ('$.payload.investeeName','Investee name',200)
  ), strings as (
    select v.id version_id, v.record_id, l.label, l.max, x.val #>> '{}' as raw
      from neuvetra.collection_activity_versions v
      cross join limits l
      cross join lateral jsonb_path_query(v.payload, l.path::jsonpath) as x(val)
     where jsonb_typeof(x.val) = 'string'
    union all
    select v.id, v.record_id, 'Correction reason', 2000, v.correction_reason
      from neuvetra.collection_activity_versions v where v.correction_reason is not null
  ), counted as (
    select s.*, h.version_id is not null as is_head,
           normalize(s.raw, NFC) as nfc
      from strings s
      left join neuvetra.collection_activity_heads h on h.version_id = s.version_id
  ), units as (
    select c.*,
           length(c.nfc) + length(regexp_replace(c.nfc, '[^\U00010000-\U0010FFFF]', '', 'g')) as nfc_units,
           length(c.raw) + length(regexp_replace(c.raw, '[^\U00010000-\U0010FFFF]', '', 'g')) as raw_units
      from counted c
  )
select label as field, max as "limit",
       count(*) filter (where nfc_units > max) as over_new_rule_versions,
       count(*) filter (where nfc_units > max and is_head) as over_new_rule_heads,
       count(*) filter (where raw <> nfc) as not_nfc_versions,
       count(*) filter (where raw_units > max) as over_old_read_rule
  from units
 group by label, max
 order by over_new_rule_versions desc, field;
