-- BF-14 QA (accounting audit B-5): read-only staging check. SELECT only: nothing here writes, locks for update or calls a
-- function with side effects. Run it by hand against a read-only connection, for example:
--   psql "$READ_ONLY_URL" -X -v ON_ERROR_STOP=1 -f tools/scope3/bf14-currency-rate-year.sql
--
-- Lists every ACTIVE Scope 3 spend line that was converted from another currency (its notes carry the conversion line the
-- product writes: "Currency conversion: EUR 1000 × 1.0823 USD per EUR = USD 1082.3 (rate source: ...; rate date: 2025-06-30; ...)")
-- and whose rate date is in a different calendar year from the line, or whose year is not known. After BF-14 these lines are
-- held (currency_rate_outside_line_year) and drop out of the totals until that year is converted at its own rate.
-- The line year is the year of the line date; without one, the year of its period when the period lies in one calendar
-- year; otherwise it is null (no date and a period crossing years).
-- Expected on staging: 0 rows. Any row is a line whose amount changes from counted to held when BF-14 deploys.
-- A note counts only if its US-dollar figure equals the line's own amount (the product also checks rate x amount = figure, which
-- is not repeated here, so a hand-typed note with a consistent figure but wrong arithmetic could be listed though it is not held).
-- If a line was converted more than once, its notes keep only the last conversion, which is the one read here.
--
-- A second, summary statement follows the list: the number of such lines and their USD total per company.

with spend as (
  select r.company_id, r.id as record_id, v.id as version_id, v.revision, v.payload as a
  from neuvetra.collection_activity_heads h
  join neuvetra.collection_activity_versions v on v.id = h.version_id and v.company_id = h.company_id
  join neuvetra.collection_activity_records r on r.id = h.record_id and r.company_id = h.company_id
  where r.kind = 'purchase_spend' and v.payload->>'state' = 'active'
),
converted as (
  select s.*,
    substring(s.a->>'notes' from 'Currency conversion: [A-Z]{3} [^\n]*; rate date: ([0-9]{4}-[0-9]{2}-[0-9]{2});') as rate_date,
    substring(s.a->>'notes' from 'Currency conversion: ([A-Z]{3}) ') as from_currency,
    substring(s.a->>'notes' from ' = USD ([0-9.]+) \(rate source: ') as note_usd,
    case
      when s.a->'payload'->>'lineDate' is not null then substring(s.a->'payload'->>'lineDate' from '^[0-9]{4}')::int
      when extract(year from (s.a->'period'->>'start')::date) = extract(year from ((s.a->'period'->>'endExclusive')::date - 1))
        then extract(year from (s.a->'period'->>'start')::date)::int
    end as line_year
  from spend s
  where s.a->'quantity'->>'originalUnit' = 'USD'
)
select c.company_id, c.record_id, c.version_id, c.revision, c.a->>'sourceId' as source_id, c.from_currency,
  c.a->'payload'->>'lineDate' as line_date, c.a->'period'->>'start' as period_start, c.a->'period'->>'endExclusive' as period_end_exclusive,
  c.line_year, c.rate_date, substring(c.rate_date from '^[0-9]{4}')::int as rate_year, c.a->'quantity'->>'originalValue' as usd_amount
from converted c
where c.rate_date is not null
  and c.note_usd is not null and c.note_usd::numeric = (c.a->'quantity'->>'normalizedValue')::numeric
  and (c.line_year is null or c.line_year <> substring(c.rate_date from '^[0-9]{4}')::int)
order by c.company_id, c.a->>'sourceId', c.record_id;

with spend as (
  select r.company_id, v.payload as a
  from neuvetra.collection_activity_heads h
  join neuvetra.collection_activity_versions v on v.id = h.version_id and v.company_id = h.company_id
  join neuvetra.collection_activity_records r on r.id = h.record_id and r.company_id = h.company_id
  where r.kind = 'purchase_spend' and v.payload->>'state' = 'active' and v.payload->'quantity'->>'originalUnit' = 'USD'
),
converted as (
  select s.company_id, s.a,
    substring(s.a->>'notes' from 'Currency conversion: [A-Z]{3} [^\n]*; rate date: ([0-9]{4}-[0-9]{2}-[0-9]{2});') as rate_date,
    substring(s.a->>'notes' from ' = USD ([0-9.]+) \(rate source: ') as note_usd,
    case
      when s.a->'payload'->>'lineDate' is not null then substring(s.a->'payload'->>'lineDate' from '^[0-9]{4}')::int
      when extract(year from (s.a->'period'->>'start')::date) = extract(year from ((s.a->'period'->>'endExclusive')::date - 1))
        then extract(year from (s.a->'period'->>'start')::date)::int
    end as line_year
  from spend s
)
select c.company_id, count(*) as lines, sum((c.a->'quantity'->>'normalizedValue')::numeric) as usd_total
from converted c
where c.rate_date is not null
  and c.note_usd is not null and c.note_usd::numeric = (c.a->'quantity'->>'normalizedValue')::numeric
  and (c.line_year is null or c.line_year <> substring(c.rate_date from '^[0-9]{4}')::int)
group by c.company_id
order by c.company_id;
