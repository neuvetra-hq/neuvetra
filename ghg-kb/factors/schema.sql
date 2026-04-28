-- Emission Factor Database Schema
-- Database: Supabase (PostgreSQL)
-- Single source of truth for the emission_factors table definition.
-- Any change to this file must be applied to Supabase and versioned here.

CREATE TABLE emission_factors (
    -- Identity
    factor_id           TEXT PRIMARY KEY,                   -- stable slug, never changes
    name                TEXT NOT NULL,                      -- human-readable label

    -- Classification
    factor_type         TEXT NOT NULL CHECK (factor_type IN (
                            'combustion',
                            'electricity-grid',
                            'refrigerant-gwp',
                            'scope3-spend',
                            'scope3-distance',
                            'scope3-weight',
                            'process',
                            'agriculture',
                            'waste'
                        )),
    scope               INTEGER CHECK (scope IN (1, 2, 3)),
    scope3_category     INTEGER CHECK (scope3_category BETWEEN 1 AND 15),
    substance           TEXT,                               -- fuel, refrigerant, commodity, mode, etc.

    -- The factor value
    value               NUMERIC NOT NULL,                   -- always in kg CO2e per unit
    unit                TEXT NOT NULL,                      -- e.g. 'kg CO2e / MMBtu'

    -- Individual gas breakdown (optional; sum = value when all present)
    co2_factor          NUMERIC,
    ch4_factor          NUMERIC,
    n2o_factor          NUMERIC,

    -- Geographic and regulatory context
    geography           TEXT,                               -- CAMX, California, US-national, Global, EU, etc.
    jurisdiction        TEXT,                               -- California, US-Federal, EU, Global
    required_by         TEXT[],                             -- ['CARB-MRR', 'SB-253', 'GHG-Protocol']

    -- Unit conversion support (required by calculation engine)
    unit_class          TEXT CHECK (unit_class IN (
                            'energy', 'volume', 'mass', 'distance',
                            'currency', 'count', 'dimensionless'
                        )),
    input_unit_canonical TEXT,                              -- canonical unit the factor expects (e.g. 'MMBtu', 'MWh', 'km')

    -- Methodology metadata
    gwp_basis           TEXT CHECK (gwp_basis IN ('AR4', 'AR5', 'AR6')),
    tier                INTEGER CHECK (tier BETWEEN 1 AND 4),   -- GHG Protocol Scope 3 data quality tier
    uncertainty_pct     NUMERIC,                            -- percent uncertainty where published

    -- Source provenance
    source_document     TEXT NOT NULL,                      -- e.g. 'EPA eGRID 2023'
    source_url          TEXT,
    data_year           INTEGER,                            -- year the underlying source data represents
    published_date      DATE,

    -- Version control
    effective_start     DATE NOT NULL,                      -- when to start using this version
    effective_end       DATE,                               -- null = current version
    superseded_by       TEXT REFERENCES emission_factors(factor_id),

    -- Wiki linkage
    wiki_method_page    TEXT,                               -- wiki methodology page ID

    -- Housekeeping
    last_verified       DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common chatbot query patterns
CREATE INDEX idx_ef_type_geo
    ON emission_factors(factor_type, geography);

CREATE INDEX idx_ef_scope_cat
    ON emission_factors(scope, scope3_category);

CREATE INDEX idx_ef_substance
    ON emission_factors(substance);

CREATE INDEX idx_ef_data_year
    ON emission_factors(data_year);

-- Fast lookup for "give me the current version"
CREATE INDEX idx_ef_current
    ON emission_factors(effective_end)
    WHERE effective_end IS NULL;

-- Array search for required_by (e.g. find all factors required by CARB-MRR)
CREATE INDEX idx_ef_required_by
    ON emission_factors USING GIN(required_by);
