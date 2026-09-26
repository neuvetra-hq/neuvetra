(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlanCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const SOURCE_FAMILY_IDS = ['stationary', 'generator', 'mobile', 'fugitive', 'process'];
  const VALID_STATUSES = new Set(['not-started', 'in-progress', 'complete']);
  const VALID_QUALITIES = new Set(['actual', 'estimated', 'unknown']);
  const VALID_LOCATION_MODES = new Set(['sites', 'company-wide', 'unknown']);
  const SOURCE_LOCATION_SENTINELS = new Set(['', 'Not sure', 'Multiple locations — describe below']);
  const UNIT_ALIASES = Object.freeze({
    therms: 'therm',
    gal: 'US gallon',
    gallons: 'US gallon'
  });
  const COMPANY_WIDE_SCOPE3 = new Set([
    'category-1', 'category-2', 'category-3', 'category-4', 'category-5', 'category-6',
    'category-7', 'category-9', 'category-10', 'category-11', 'category-12', 'category-15'
  ]);
  const FALLBACK_FAMILIES = {
    stationary: {
      title: 'Heating & process equipment',
      description: 'Boilers, furnaces, ovens or other equipment that burns fuel.'
    },
    generator: {
      title: 'Backup generators',
      description: 'Fuel-powered generators, including equipment used only in emergencies.'
    },
    mobile: {
      title: 'Road & off-road vehicles',
      description: 'Company-controlled cars, trucks, forklifts or other mobile equipment.'
    },
    fugitive: {
      title: 'Cooling & fire suppression',
      description: 'Refrigeration, air-conditioning or fire suppression systems that may release gases.'
    },
    process: {
      title: 'Processes & other direct releases',
      description: 'Manufacturing reactions, industrial gas use or other direct releases.'
    }
  };

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function asObject(value) {
    return isObject(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    return value == null ? '' : String(value);
  }

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
    if (isObject(value)) {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + stableSerialize(value[key]);
      }).join(',') + '}';
    }
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }

  // FNV-1a is used as a compact change detector, not as a security primitive.
  function fingerprint(value, prefix) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (prefix || 'fp') + '-' + (hash >>> 0).toString(16).padStart(8, '0');
  }

  function normalizedContext(onboarding) {
    const input = asObject(onboarding);
    const company = asObject(input.company);
    const period = asObject(input.period);
    return {
      legal: text(company.legal).trim().toLowerCase(),
      country: text(company.country).trim().toLowerCase(),
      start: text(period.start).trim(),
      end: text(period.end).trim()
    };
  }

  function contextKey(onboarding) {
    return fingerprint(normalizedContext(onboarding), 'ctx');
  }

  function onboardingFingerprint(onboarding) {
    const input = asObject(onboarding);
    return fingerprint({
      company: asObject(input.company),
      period: asObject(input.period),
      boundary: asObject(input.boundary),
      entities: asArray(input.entities),
      locations: asArray(input.locations),
      changes: asArray(input.changes),
      sources: asArray(input.sources)
    }, 'onboarding');
  }

  function normalizeAnswer(value) {
    return value === 'Yes' || value === 'No' || value === 'Not sure' ? value : '';
  }

  function normalizeCatalogList(value) {
    return asArray(value).map(function (entry) { return clone(asObject(entry)); });
  }

  function normalizeCatalogEntry(entry, fallback) {
    const value = asObject(entry);
    const defaultValue = asObject(fallback);
    return {
      id: text(value.id || defaultValue.id),
      title: text(value.title || defaultValue.title),
      description: text(value.description || defaultValue.description),
      checklist: normalizeCatalogList(value.checklist),
      records: normalizeCatalogList(value.records),
      subtypes: normalizeCatalogList(value.subtypes),
      sourceIds: asArray(value.sourceIds).map(text)
    };
  }

  function familyCatalog(catalog) {
    const byId = new Map();
    asArray(asObject(catalog).families).forEach(function (family) {
      const normalized = normalizeCatalogEntry(family);
      if (normalized.id) byId.set(normalized.id, normalized);
    });
    return SOURCE_FAMILY_IDS.map(function (id) {
      return byId.get(id) || normalizeCatalogEntry({ id: id }, FALLBACK_FAMILIES[id]);
    });
  }

  function scopeCatalog(catalog, scope) {
    const key = scope === '2' ? 'scope2' : 'scope3';
    return asArray(asObject(catalog)[key]).map(function (entry) {
      return normalizeCatalogEntry(entry);
    }).filter(function (entry) { return Boolean(entry.id); });
  }

  function locationsById(onboarding) {
    const map = new Map();
    asArray(asObject(onboarding).locations).forEach(function (location) {
      const value = clone(asObject(location));
      const id = text(value.id);
      if (id && !map.has(id)) map.set(id, value);
    });
    return map;
  }

  function sourceLocationIds(source, locationMap) {
    const location = text(asObject(source).location);
    if (SOURCE_LOCATION_SENTINELS.has(location)) return [];
    return locationMap.has(location) ? [location] : [];
  }

  function screeningSeed(catalog, existing) {
    const next = clone(asObject(existing)) || {};
    familyCatalog(catalog).forEach(function (entry) {
      const key = 'scope1:' + entry.id;
      const current = asObject(next[key]);
      next[key] = {
        ...current,
        reason: text(current.reason),
        notes: text(current.notes)
      };
    });
    ['2', '3'].forEach(function (scope) {
      scopeCatalog(catalog, scope).forEach(function (entry) {
        const current = asObject(next[entry.id]);
        const locationIds = asArray(current.locationIds).map(text).filter(Boolean);
        const migrateCompanyWideDefault = scope === '3' && COMPANY_WIDE_SCOPE3.has(entry.id) && current.locationMode === 'sites' && locationIds.length === 0;
        next[entry.id] = {
          ...current,
          answer: normalizeAnswer(current.answer),
          reason: text(current.reason),
          notes: text(current.notes),
          locationIds: locationIds,
          locationMode: migrateCompanyWideDefault
            ? 'company-wide'
            : VALID_LOCATION_MODES.has(current.locationMode)
            ? current.locationMode
            : scope === '3' && COMPANY_WIDE_SCOPE3.has(entry.id) ? 'company-wide' : 'sites'
        };
      });
    });
    return next;
  }

  function mergedChecklist(template, subtypeId) {
    const ordered = [];
    const positions = new Map();
    function add(check) {
      const value = clone(asObject(check));
      const id = text(value.id);
      if (!id) return;
      value.id = id;
      if (positions.has(id)) ordered[positions.get(id)] = value;
      else {
        positions.set(id, ordered.length);
        ordered.push(value);
      }
    }
    asArray(template.checklist).forEach(add);
    const subtype = asArray(template.subtypes).find(function (entry) {
      return text(asObject(entry).id) === text(subtypeId);
    });
    if (subtype) asArray(asObject(subtype).checklist).forEach(add);
    return ordered;
  }

  function baseState(id, seed, locationIds, locationMode) {
    const current = asObject(seed);
    return {
      ...clone(current),
      id: id,
      status: VALID_STATUSES.has(current.status) ? current.status : 'not-started',
      needsReview: current.needsReview === true,
      inputFingerprint: text(current.inputFingerprint),
      subtypeId: text(current.subtypeId),
      locationMode: VALID_LOCATION_MODES.has(current.locationMode)
        ? current.locationMode
        : VALID_LOCATION_MODES.has(locationMode) ? locationMode : 'sites',
      locationIds: Object.prototype.hasOwnProperty.call(current, 'locationIds') && Array.isArray(current.locationIds)
        ? current.locationIds.map(text).filter(Boolean)
        : asArray(locationIds).map(text).filter(Boolean),
      checks: clone(asObject(current.checks)) || {},
      notes: text(current.notes),
      records: clone(asArray(current.records))
    };
  }

  function catalogTemplateFields(entry) {
    return {
      title: text(entry.title),
      description: text(entry.description),
      checklist: clone(asArray(entry.checklist)),
      recordTypes: clone(asArray(entry.records)),
      subtypes: clone(asArray(entry.subtypes)),
      sourceIds: clone(asArray(entry.sourceIds))
    };
  }

  function buildTemplates(onboarding, plan, catalog) {
    const input = asObject(onboarding);
    const state = asObject(plan);
    const locationMap = locationsById(input);
    const templates = [];

    familyCatalog(catalog).forEach(function (family, index) {
      const source = clone(asObject(asArray(input.sources)[index]));
      const answer = normalizeAnswer(source.answer);
      if (answer === 'No') return;
      templates.push({
        id: 'scope1:' + family.id,
        scope: '1',
        familyId: family.id,
        answer: answer,
        kind: answer === 'Yes' ? 'inventory' : 'clarification',
        source: {
          names: text(source.names),
          notes: text(source.notes),
          location: text(source.location)
        },
        seedLocationIds: sourceLocationIds(source, locationMap),
        seedLocationMode: 'sites',
        catalog: family
      });
    });

    ['2', '3'].forEach(function (scope) {
      scopeCatalog(catalog, scope).forEach(function (entry) {
        const screening = asObject(asObject(state.screening)[entry.id]);
        const answer = normalizeAnswer(screening.answer);
        if (answer === 'No' || answer === '') return;
        templates.push({
          id: 'scope' + scope + ':' + entry.id,
          scope: scope,
          screeningId: entry.id,
          answer: answer,
          kind: answer === 'Yes' ? 'inventory' : 'clarification',
          source: null,
          seedLocationIds: asArray(screening.locationIds).map(text).filter(Boolean),
          seedLocationMode: VALID_LOCATION_MODES.has(screening.locationMode) ? screening.locationMode : 'sites',
          catalog: entry
        });
      });
    });

    asArray(state.custom).forEach(function (raw, index) {
      const custom = clone(asObject(raw));
      const customId = text(custom.id) || 'missing-' + index;
      const family = familyCatalog(catalog).find(function (entry) {
        return entry.id === text(custom.familyId);
      });
      const customCatalog = family || normalizeCatalogEntry({
        id: text(custom.familyId),
        title: text(custom.title),
        description: text(custom.description)
      });
      templates.push({
        id: 'custom:' + customId,
        scope: ['1', '2', '3'].includes(text(custom.scope)) ? text(custom.scope) : 'unknown',
        familyId: text(custom.familyId),
        customId: customId,
        answer: 'Yes',
        kind: 'custom',
        source: null,
        seedLocationIds: asArray(custom.locationIds).map(text).filter(Boolean),
        seedLocationMode: VALID_LOCATION_MODES.has(custom.locationMode) ? custom.locationMode : 'sites',
        catalog: {
          ...customCatalog,
          title: text(custom.title) || customCatalog.title,
          description: text(custom.description) || customCatalog.description
        },
        custom: custom
      });
    });
    return templates;
  }

  function itemFingerprint(onboarding, template, state, catalog) {
    const input = asObject(onboarding);
    return fingerprint({
      contextKey: contextKey(input),
      boundary: asObject(input.boundary),
      entities: asArray(input.entities),
      changes: asArray(input.changes),
      source: template.source,
      screening: template.screeningId ? asObject(asObject(asObject(state._plan).screening)[template.screeningId]) : null,
      locations: asArray(input.locations),
      catalog: asObject(catalog)
    }, 'upstream-item');
  }

  function reconcileInternal(onboarding, plan, catalog) {
    const input = asObject(onboarding);
    const previous = clone(asObject(plan)) || {};
    const next = {
      ...previous,
      schemaVersion: SCHEMA_VERSION,
      catalogVersion: text(asObject(catalog).version),
      contextKey: contextKey(input),
      onboardingFingerprint: onboardingFingerprint(input),
      items: clone(asObject(previous.items)) || {},
      custom: clone(asArray(previous.custom)),
      screening: screeningSeed(catalog, previous.screening)
    };
    const templates = buildTemplates(input, next, catalog);
    templates.forEach(function (template) {
      const prior = asObject(next.items[template.id]);
      const customSeed = template.custom || {};
      const seed = Object.keys(prior).length ? prior : customSeed;
      const state = baseState(template.id, seed, template.seedLocationIds, template.seedLocationMode);
      state._plan = next;
      const currentFingerprint = itemFingerprint(input, template, state, catalog);
      delete state._plan;

      const validChecks = new Set(mergedChecklist(template.catalog, state.subtypeId).map(function (check) {
        return text(check.id);
      }));
      const filteredChecks = {};
      Object.keys(state.checks).forEach(function (id) {
        if (validChecks.has(id)) filteredChecks[id] = state.checks[id];
      });
      state.checks = filteredChecks;

      const hasWork = state.status !== 'not-started' || state.notes !== '' || state.records.length > 0 || Object.keys(state.checks).length > 0;
      const hasCurrentFingerprint = state.inputFingerprint.startsWith('upstream-item-');
      const migratingLegacyFingerprint = state.inputFingerprint.startsWith('item-');
      const legacyUpstreamChanged = migratingLegacyFingerprint && (
        Boolean(previous.onboardingFingerprint && previous.onboardingFingerprint !== next.onboardingFingerprint) ||
        Boolean(previous.catalogVersion && previous.catalogVersion !== next.catalogVersion)
      );
      const changed = Boolean((hasCurrentFingerprint && state.inputFingerprint !== currentFingerprint) || legacyUpstreamChanged);
      const unversionedWork = !state.inputFingerprint && hasWork;
      if (changed || unversionedWork) {
        state.needsReview = true;
        if (state.status === 'complete') state.status = 'in-progress';
      }
      state.inputFingerprint = currentFingerprint;
      next.items[template.id] = state;
    });
    return next;
  }

  function createPlan(onboarding, catalog) {
    return reconcileInternal(onboarding, {
      schemaVersion: SCHEMA_VERSION,
      catalogVersion: text(asObject(catalog).version),
      contextKey: contextKey(onboarding),
      onboardingFingerprint: onboardingFingerprint(onboarding),
      items: {},
      custom: [],
      screening: {}
    }, catalog);
  }

  function reconcilePlan(onboarding, plan, catalog) {
    const prior = asObject(plan);
    const expectedContext = contextKey(onboarding);
    if (prior.contextKey && prior.contextKey !== expectedContext) {
      const fresh = createPlan(onboarding, catalog);
      if (Array.isArray(prior.archives)) fresh.archives = clone(prior.archives);
      return fresh;
    }
    return reconcileInternal(onboarding, prior, catalog);
  }

  function scopeTitle(scope) {
    return scope === '1' ? 'Scope 1' : scope === '2' ? 'Scope 2' : scope === '3' ? 'Scope 3' : 'Unclassified';
  }

  function upstreamIssues(onboarding) {
    const input = asObject(onboarding);
    const company = asObject(input.company);
    const period = asObject(input.period);
    const boundary = asObject(input.boundary);
    const review = asObject(input.review);
    const issues = [];
    if (!text(company.legal).trim()) issues.push('Reporting company legal name is unanswered.');
    if (!text(company.country).trim()) issues.push('Reporting company country is unanswered.');
    const start = parseDate(text(period.start));
    const end = parseDate(text(period.end));
    if (!start || !end || start > end) issues.push('Reporting period dates are incomplete or invalid and need review.');
    if (!text(boundary.approach).trim() || boundary.approach === 'Not sure') issues.push('Consolidation approach is unanswered or uncertain.');
    if (!text(boundary.operations).trim()) issues.push('Included operations are not yet described.');
    if (['Financial control', 'Equity share'].includes(boundary.approach)) issues.push('The proposed consolidation approach requires authorized boundary review.');

    const locations = asArray(input.locations);
    if (!locations.length) issues.push('No operating locations have been captured; this is not treated as no operations.');
    locations.forEach(function (raw, index) {
      const location = asObject(raw);
      const label = text(location.name).trim() || 'Location ' + (index + 1);
      if (!text(location.id).trim()) issues.push(label + ' has no stable location ID.');
      if (!text(location.included).trim() || location.included === 'Not sure' || text(location.included).startsWith('Exclude')) issues.push(label + ' has an unresolved proposed-boundary decision.');
      if (['Leased', 'Shared', 'Other', 'Not sure'].includes(location.occupancy) || ['Landlord', 'Shared control', 'Other', 'Not sure'].includes(location.control)) issues.push(label + ' has lease or control details that require boundary review.');
      if (location.entity === 'Not sure' || location.entity === 'Other') issues.push(label + ' has an unresolved operating-entity assignment.');
    });
    asArray(input.changes).forEach(function (raw, index) {
      const change = asObject(raw);
      if (change.answer === 'Yes' || change.answer === 'Not sure') {
        issues.push('Boundary change ' + (index + 1) + ' is present or uncertain and requires review.');
        if (!text(change.details).trim()) issues.push('Boundary change ' + (index + 1) + ' needs affected-entity or location details.');
      }
    });
    if (review.complete !== true || review.needed !== true || !text(review.role).trim()) issues.push('Onboarding review acknowledgement or reviewer role is incomplete.');
    return issues;
  }

  function derive(onboarding, plan, catalog) {
    const input = asObject(onboarding);
    const reconciled = reconcilePlan(input, plan, catalog);
    const locationMap = locationsById(input);
    const templates = buildTemplates(input, reconciled, catalog);
    const issues = upstreamIssues(input);
    const items = templates.map(function (template) {
      const state = clone(asObject(reconciled.items[template.id]));
      const savedLocationIds = asArray(state.locationIds).map(text).filter(Boolean);
      const locationMode = VALID_LOCATION_MODES.has(state.locationMode) ? state.locationMode : 'sites';
      const locationIds = locationMode === 'company-wide' ? [] : savedLocationIds;
      const resolvedLocations = locationIds.filter(function (id) { return locationMap.has(id); }).map(function (id) {
        return clone(locationMap.get(id));
      });
      const locations = locationMode === 'company-wide' ? [] : resolvedLocations;
      const orphanLocationIds = locationMode === 'company-wide' ? [] : locationIds.filter(function (id) { return !locationMap.has(id); });
      const subtypeId = text(state.subtypeId);
      const subtypeValid = !subtypeId || asArray(template.catalog.subtypes).some(function (entry) {
        return text(asObject(entry).id) === subtypeId;
      });
      const checklist = mergedChecklist(template.catalog, subtypeId);
      const unassigned = locationMode === 'company-wide' ? false : locationMode === 'unknown' || locations.length === 0;
      if (unassigned) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" has unresolved location coverage.');
      if (orphanLocationIds.length) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" references a removed location and needs review.');
      if (!subtypeValid) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" has an unavailable subtype and needs review.');
      if ((template.kind === 'inventory' || template.kind === 'custom') && asArray(template.catalog.subtypes).length && !subtypeId) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" needs a subtype or explicit other/unknown selection.');
      const unchecked = checklist.filter(function (check) { return state.checks[text(check.id)] !== true; });
      if ((template.kind === 'inventory' || template.kind === 'custom') && unchecked.length) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" has ' + unchecked.length + ' unfinished collection step' + (unchecked.length === 1 ? '.' : 's.'));
      if ((template.kind === 'inventory' || template.kind === 'custom') && state.status !== 'complete') issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" still needs method and collection review.');
      if ((template.kind === 'inventory' || template.kind === 'custom') && !asArray(state.records).length) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" has no activity records yet.');
      if (state.needsReview === true) issues.push(scopeTitle(template.scope) + ' item "' + template.catalog.title + '" changed and needs renewed review.');
      asArray(state.records).forEach(function (record, index) {
        const recordLabel = 'Record ' + (index + 1) + ' for "' + template.catalog.title + '"';
        validateRecord(record, input).forEach(function (error) { issues.push(recordLabel + ': ' + error); });
        if (asObject(record).quantity == null || asObject(record).quantity === '') issues.push(recordLabel + ' has no quantity and remains incomplete.');
        if (!text(asObject(record).reference).trim()) issues.push(recordLabel + ' has no evidence reference.');
      });
      if (template.kind === 'custom' && (template.scope === 'unknown' || !template.familyId)) issues.push('Custom item "' + template.catalog.title + '" still needs scope or source-family classification.');
      return {
        id: template.id,
        scope: template.scope,
        familyId: template.familyId || '',
        screeningId: template.screeningId || '',
        customId: template.customId || '',
        ...catalogTemplateFields(template.catalog),
        checklist: checklist,
        answer: template.answer,
        kind: template.kind,
        source: template.source ? clone(template.source) : null,
        names: template.source ? text(template.source.names) : '',
        sourceNames: template.source ? text(template.source.names) : '',
        sourceNotes: template.source ? text(template.source.notes) : '',
        status: state.status,
        needsReview: state.needsReview === true,
        inputFingerprint: text(state.inputFingerprint),
        subtypeId: subtypeId,
        subtypeValid: subtypeValid,
        locationMode: locationMode,
        locationIds: locationIds,
        retainedLocationIds: locationMode === 'company-wide' ? savedLocationIds : [],
        locations: locations,
        orphanLocationIds: orphanLocationIds,
        unassigned: unassigned,
        checks: clone(asObject(state.checks)) || {},
        notes: text(state.notes),
        records: clone(asArray(state.records))
      };
    });

    const exclusions = [];
    familyCatalog(catalog).forEach(function (family, index) {
      const source = asObject(asArray(input.sources)[index]);
      const answer = normalizeAnswer(source.answer);
      const scope1Screening = asObject(reconciled.screening['scope1:' + family.id]);
      const reason = text(scope1Screening.reason || source.notes);
      if (answer === '') issues.push('Scope 1 screening "' + family.title + '" is unanswered.');
      if (answer === 'Not sure') issues.push('Scope 1 screening "' + family.title + '" is uncertain and needs clarification.');
      if (answer === 'Yes' && !text(source.names).trim()) issues.push('Scope 1 source "' + family.title + '" needs equipment or activity names.');
      if (answer === 'No') {
        exclusions.push({
          id: 'scope1:' + family.id,
          scope: '1',
          title: family.title,
          answer: 'No',
          reason: reason,
          notes: text(source.notes),
          retainedState: Boolean(asObject(reconciled.items)['scope1:' + family.id])
        });
        if (!reason.trim()) issues.push('Scope 1 screening "' + family.title + '" is No but has no rationale.');
      }
    });

    const screening = [];
    ['2', '3'].forEach(function (scope) {
      scopeCatalog(catalog, scope).forEach(function (entry) {
        const state = clone(asObject(reconciled.screening[entry.id]));
        const answer = normalizeAnswer(state.answer);
        const itemId = 'scope' + scope + ':' + entry.id;
        const view = {
          id: entry.id,
          itemId: itemId,
          scope: scope,
          ...catalogTemplateFields(entry),
          answer: answer,
          reason: text(state.reason),
          notes: text(state.notes),
          locationIds: asArray(state.locationIds).map(text).filter(Boolean),
          locationMode: VALID_LOCATION_MODES.has(state.locationMode) ? state.locationMode : 'sites'
        };
        screening.push(view);
        if (answer === '') issues.push(scopeTitle(scope) + ' screening "' + entry.title + '" is unanswered.');
        if (answer === 'Not sure') issues.push(scopeTitle(scope) + ' screening "' + entry.title + '" is uncertain and needs clarification.');
        if (answer === 'No') {
          exclusions.push({
            id: itemId,
            screeningId: entry.id,
            scope: scope,
            title: entry.title,
            answer: 'No',
            reason: view.reason,
            notes: view.notes,
            retainedState: Boolean(asObject(reconciled.items)[itemId])
          });
          if (!view.reason.trim()) issues.push(scopeTitle(scope) + ' screening "' + entry.title + '" is No but has no rationale.');
        }
      });
    });

    asArray(reconciled.custom).forEach(function (custom, index) {
      if (!text(asObject(custom).id)) issues.push('Custom item ' + (index + 1) + ' needs a stable ID before it can be reconciled safely.');
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      catalogVersion: text(asObject(catalog).version),
      contextKey: reconciled.contextKey,
      onboardingFingerprint: reconciled.onboardingFingerprint,
      company: clone(asObject(input.company)),
      period: clone(asObject(input.period)),
      locations: clone(asArray(input.locations)),
      items: items,
      exclusions: exclusions,
      screening: screening,
      unassigned: items.filter(function (item) { return item.unassigned; }).map(function (item) { return item.id; }),
      issues: issues,
      plan: reconciled
    };
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parts = value.split('-').map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) return null;
    return value;
  }

  function validateRecord(record, onboarding) {
    const value = asObject(record);
    const errors = [];
    const quantity = value.quantity;
    if (quantity != null && quantity !== '') {
      if (!normalizeQuantity(quantity).valid) {
        errors.push('Quantity must be a nonnegative decimal. Use commas only as thousands separators, such as 1,234.50.');
      }
    }
    if (!text(value.recordType).trim()) errors.push('Record type is required.');
    if (!text(value.unit).trim()) errors.push('Unit is required.');
    if (!VALID_QUALITIES.has(value.quality)) errors.push('Quality must be actual, estimated or unknown.');

    const start = text(value.periodStart);
    const end = text(value.periodEnd);
    const validStart = parseDate(start);
    const validEnd = parseDate(end);
    if (!validStart) errors.push('Record period start must be a valid YYYY-MM-DD date.');
    if (!validEnd) errors.push('Record period end must be a valid YYYY-MM-DD date.');
    if (validStart && validEnd && validStart > validEnd) errors.push('Record period end must be on or after its start.');

    const reporting = asObject(asObject(onboarding).period);
    const reportingStart = parseDate(text(reporting.start));
    const reportingEnd = parseDate(text(reporting.end));
    if (!reportingStart || !reportingEnd || reportingStart > reportingEnd) {
      errors.push('A valid reporting period is required to validate record dates.');
    } else {
      if (validStart && (validStart < reportingStart || validStart > reportingEnd)) errors.push('Record period start must fall within the reporting period.');
      if (validEnd && (validEnd < reportingStart || validEnd > reportingEnd)) errors.push('Record period end must fall within the reporting period.');
    }
    return errors;
  }

  function normalizeQuantity(value) {
    if (value == null || value === '') return { original: value, canonical: value, valid: true };
    if (typeof value !== 'string') return { original: value, canonical: value, valid: false };
    const original = value;
    const trimmed = value.trim();
    const plain = /^\d+(?:\.\d+)?$/.test(trimmed);
    const grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed);
    return { original: original, canonical: plain || grouped ? trimmed.replace(/,/g, '') : trimmed, valid: plain || grouped };
  }

  function normalizeUnit(value) {
    const original = text(value);
    const trimmed = original.trim();
    const canonical = UNIT_ALIASES[trimmed.toLowerCase()] || trimmed;
    return { original: original, canonical: canonical, changed: canonical !== original };
  }

  function normalizeRecord(record) {
    const normalized = clone(asObject(record)) || {};
    const quantity = normalizeQuantity(normalized.quantity);
    const unit = normalizeUnit(normalized.unit);
    if (quantity.valid) {
      if (quantity.canonical !== quantity.original) normalized.quantityOriginal = quantity.original;
      else if (Object.prototype.hasOwnProperty.call(normalized, 'quantityOriginal') && normalizeQuantity(normalized.quantityOriginal).canonical !== quantity.canonical) delete normalized.quantityOriginal;
      normalized.quantity = quantity.canonical;
    }
    if (unit.canonical !== unit.original) normalized.unitOriginal = unit.original;
    else if (Object.prototype.hasOwnProperty.call(normalized, 'unitOriginal') && normalizeUnit(normalized.unitOriginal).canonical !== unit.canonical) delete normalized.unitOriginal;
    normalized.unit = unit.canonical;
    return normalized;
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  return Object.freeze({
    SCHEMA_VERSION: SCHEMA_VERSION,
    SOURCE_FAMILY_IDS: Object.freeze(SOURCE_FAMILY_IDS.slice()),
    createPlan: createPlan,
    onboardingFingerprint: onboardingFingerprint,
    fingerprintOnboarding: onboardingFingerprint,
    reconcilePlan: reconcilePlan,
    reconcile: reconcilePlan,
    derive: derive,
    validateRecord: validateRecord,
    normalizeQuantity: normalizeQuantity,
    normalizeUnit: normalizeUnit,
    normalizeRecord: normalizeRecord,
    escapeHtml: escapeHtml
  });
});
