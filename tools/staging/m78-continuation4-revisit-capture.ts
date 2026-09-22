/** Passive, read-only capture of the application GETs already made by a continuation4 revisit. */
import { decodeScope1Register } from '../../apps/site-web/src/lib/m78-api';
import { decodeCorporateRegister } from '../../apps/site-web/src/lib/m71-api';
import { decodeGasRegister } from '../../apps/site-web/src/lib/m73-api';
import { decodeMobileRegister } from '../../apps/site-web/src/lib/m74-api';
import { decodeFleetRegister } from '../../apps/site-web/src/lib/m75-api';
import { decodeGeneratorRegister } from '../../apps/site-web/src/lib/m76-diesel-api';
import { decodeStationaryRegister } from '../../apps/site-web/src/lib/m76-api';
import { decodeFugitiveRegister } from '../../apps/site-web/src/lib/m77-api';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';

export const M78_REVISIT_CAPTURE_MAX_RESPONSE_BYTES = 10_000_000;
export const M78_REVISIT_CAPTURE_MAX_AGGREGATE_BYTES = 128_000_000;
export const M78_REVISIT_CAPTURE_MAX_REQUESTS = 1024;

const APPLICATION_HOST = 'www.neuvetra.ai';
const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};

export type M78CapturedObservation = {
  route: string;
  sha256: string;
  byteLength: number;
  json?: unknown;
};

export type M78RevisitCaptureSet = {
  requests: number;
  aggregateBytes: number;
  observations: Map<string, M78CapturedObservation>;
};

function retainJson(route: string) {
  return !(
    route.endsWith('/download') ||
    route.endsWith('/snapshot') ||
    route.endsWith('/inventory-export') ||
    route.endsWith('/calculation-export') ||
    route.endsWith('/coverage-export') ||
    route.endsWith('/roster-export')
  );
}

async function readClone(
  response: Response,
  route: string,
  responseBound: number,
  reserveAggregate: (bytes: number) => void,
) {
  check(response.body, 'capture response body');
  const hasher = new Bun.CryptoHasher('sha256');
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const keep = retainJson(route);
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      check(byteLength <= responseBound, 'capture response bound');
      reserveAggregate(value.byteLength);
      hasher.update(value);
      if (keep) chunks.push(value.slice());
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const observation: M78CapturedObservation = {
    route,
    sha256: hasher.digest('hex'),
    byteLength,
  };
  if (keep) {
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    observation.json = JSON.parse(text);
  }
  return observation;
}

/**
 * The wrapper calls the supplied transport exactly once and returns its original Response.
 * Clone failures are retained until finish(), so the unchanged core can finish logout first.
 */
export function createM78Continuation4RevisitCapture(
  transport: typeof fetch,
  workspaceId: string,
  limits: Partial<{ responseBytes: number; aggregateBytes: number; requests: number }> = {},
) {
  check(/^[0-9a-f-]{36}$/i.test(workspaceId), 'capture workspace');
  const responseBound = limits.responseBytes ?? M78_REVISIT_CAPTURE_MAX_RESPONSE_BYTES;
  const aggregateBound = limits.aggregateBytes ?? M78_REVISIT_CAPTURE_MAX_AGGREGATE_BYTES;
  const requestBound = limits.requests ?? M78_REVISIT_CAPTURE_MAX_REQUESTS;
  check(
    [responseBound, aggregateBound, requestBound].every(Number.isSafeInteger) &&
      responseBound > 0 && aggregateBound > 0 && requestBound > 0,
    'capture limits',
  );
  const prefix = `/workspace-api/workspace/${workspaceId}`;
  const observations = new Map<string, M78CapturedObservation>();
  const pending: Promise<void>[] = [];
  const failures: unknown[] = [];
  let requests = 0;
  let aggregateBytes = 0;
  const reserveAggregate = (bytes: number) => {
    aggregateBytes += bytes;
    check(aggregateBytes <= aggregateBound, 'capture aggregate bound');
  };

  const wrapped = (async (raw: RequestInfo | URL, init?: RequestInit) => {
    const response = await transport(raw, init);
    const url = new URL(typeof raw === 'string' ? raw : raw instanceof URL ? raw.href : raw.url);
    const method = (init?.method ?? (raw instanceof Request ? raw.method : 'GET')).toUpperCase();
    if (
      url.hostname === APPLICATION_HOST &&
      method === 'GET' &&
      response.status === 200 &&
      (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))
    ) {
      requests += 1;
      if (requests > requestBound) failures.push(new Error('capture request bound'));
      else {
        try {
          const clone = response.clone();
          const task = readClone(clone, url.pathname, responseBound, reserveAggregate)
            .then((observation) => {
              const prior = observations.get(observation.route);
              if (prior) {
                check(
                  prior.sha256 === observation.sha256 && prior.byteLength === observation.byteLength,
                  `changed duplicate capture ${observation.route}`,
                );
              } else observations.set(observation.route, observation);
            })
            .catch((error) => { failures.push(error); });
          pending.push(task);
        } catch (error) {
          failures.push(error);
        }
      }
    }
    return response;
  }) as typeof fetch;

  return {
    fetch: wrapped,
    async finish(): Promise<M78RevisitCaptureSet> {
      await Promise.all(pending);
      check(failures.length === 0, 'revisit capture failed');
      return { requests, aggregateBytes, observations };
    },
  };
}

type Decoders = {
  scope1: (value: unknown, company: string) => Promise<any>;
  corporate: (value: unknown, company: string) => PromiseLike<any> | any;
  gas: (value: unknown, company: string) => PromiseLike<any> | any;
  mobile: (value: unknown, company: string) => PromiseLike<any> | any;
  fleet: (value: unknown, company: string) => PromiseLike<any> | any;
  diesel: (value: unknown, company: string) => PromiseLike<any> | any;
  equipment: (value: unknown, company: string) => PromiseLike<any> | any;
  fugitive: (value: unknown, company: string) => Promise<any>;
};

const decoders: Decoders = {
  scope1: decodeScope1Register,
  corporate: decodeCorporateRegister,
  gas: decodeGasRegister,
  mobile: decodeMobileRegister,
  fleet: decodeFleetRegister,
  diesel: decodeGeneratorRegister,
  equipment: decodeStationaryRegister,
  fugitive: decodeFugitiveRegister,
};

type Pin = { path: string; sha256: string };
export type M78RevisitObservationEvidence = {
  workspaceId: string;
  journal: { path: string; sha256: string; head: string; events: number };
  gate: Pin;
  journeyGate: unknown;
  sourcePins: Pin[];
  captureStartedAt: string;
  captureCompletedAt: string;
  observedAt: string;
};

function observation(captures: M78RevisitCaptureSet, route: string) {
  const value = captures.observations.get(route);
  check(value, `missing capture ${route}`);
  return value;
}

function json(captures: M78RevisitCaptureSet, route: string) {
  const value = observation(captures, route);
  check(value.json !== undefined, `missing captured JSON ${route}`);
  return value.json;
}

function bytes(captures: M78RevisitCaptureSet, route: string) {
  const { sha256, byteLength } = observation(captures, route);
  return { sha256, byteLength };
}

function proof(captures: M78RevisitCaptureSet, route: string) {
  return sha(canonical(json(captures, route)));
}

function onlyRoute(captures: M78RevisitCaptureSet, pattern: RegExp, label: string) {
  const matches = [...captures.observations.keys()].filter((route) => pattern.test(route));
  check(matches.length === 1, `exact captured route ${label}`);
  return matches[0]!;
}

function addLegacy(captures: M78RevisitCaptureSet, root: string) {
  const records: Record<string, string> = {};
  const keep = (name: string, route: string) => {
    const value = json(captures, route);
    records[name] = sha(canonical(value));
    return value as any;
  };
  const workspace = keep('m63_workspace', root);
  void workspace;
  const bill = keep('m63_bill', onlyRoute(captures, new RegExp(`^${root}/bills/[0-9a-f-]{36}$`, 'i'), 'm63 bill'));
  void bill;
  keep('m63_inventory', `${root}/inventories/2023/scope2`);
  keep('m63_registers', `${root}/annual-registers/2023`);
  const annual = keep('m63_annual', `${root}/annual-inventories/2023/scope2`);
  const annualRoot = `${root}/annual-inventories/${annual.id}`;
  const pack = keep('m63_pack', `${annualRoot}/evidence-packs/current`);
  const report = keep('m63_report', `${annualRoot}/draft-reports/current`);
  keep('m63_review', `${annualRoot}/draft-reports/${report.id}/decisions/current`);
  keep('m64_worksheet', `${root}/electricity-worksheet`);
  keep('m66_worksheet', `${root}/source-electricity-worksheet`);
  keep('m67_worksheet', `${root}/annual-electricity-worksheet`);
  keep('m68_evidence', `${root}/annual-electricity-evidence`);
  const sources = keep('m66_sources', `${root}/source-electricity-worksheet/sources`).sources as any[];
  const reportGroups = [
    ['m65', 'electricity-worksheet'],
    ['m66', 'source-electricity-worksheet'],
    ['m67', 'annual-electricity-worksheet'],
    ['m68', 'annual-electricity-evidence'],
  ] as const;
  const reports = new Map<string, any[]>();
  for (const [name, base] of reportGroups) {
    reports.set(name, keep(`${name}_reports`, `${root}/${base}/reports`).reports);
  }
  const downloads: Record<string, { sha256: string; byteLength: number }> = {
    m63_pack: bytes(captures, `${annualRoot}/evidence-packs/${pack.id}/download`),
    m63_report: bytes(captures, `${annualRoot}/draft-reports/${report.id}/download`),
  };
  for (const source of sources) {
    downloads[`m66_source_${source.id}`] = bytes(
      captures,
      `${root}/source-electricity-worksheet/sources/${source.id}/download`,
    );
  }
  for (const [name, base] of reportGroups) {
    for (const item of reports.get(name) ?? []) {
      downloads[`${name}_report_${item.id}`] = bytes(captures, `${root}/${base}/reports/${item.id}/download`);
    }
  }
  return { records, downloads };
}

/** Reconstructs state only from captured revisit responses. Exercise journal data is not an input. */
export async function buildM78Continuation4RevisitObservation(
  captures: M78RevisitCaptureSet,
  evidence: M78RevisitObservationEvidence,
  decode: Decoders = decoders,
) {
  check(captures.requests > 0 && captures.aggregateBytes > 0, 'empty revisit capture');
  check(
    evidence.sourcePins.length === 173 &&
      evidence.sourcePins.every((pin) => pin.path.length > 0 && /^[a-f0-9]{64}$/.test(pin.sha256)) &&
      new Set(evidence.sourcePins.map((pin) => pin.path)).size === 173,
    'exact source pin inventory',
  );
  check(evidence.gate.path.length > 0 && /^[a-f0-9]{64}$/.test(evidence.gate.sha256), 'gate pin');
  for (const timestamp of [evidence.captureStartedAt, evidence.captureCompletedAt, evidence.observedAt]) {
    check(new Date(timestamp).toISOString() === timestamp, 'capture timestamp');
  }
  check(
    Date.parse(evidence.captureStartedAt) <= Date.parse(evidence.captureCompletedAt) &&
      Date.parse(evidence.captureCompletedAt) <= Date.parse(evidence.observedAt),
    'capture chronology',
  );

  const company = evidence.workspaceId;
  const root = `/workspace-api/workspace/${company}`;
  const scope1 = await decode.scope1(json(captures, `${root}/scope1-inventory`), company);
  const registers: any = {
    corporate: await decode.corporate(json(captures, `${root}/corporate-inventories`), company),
    gas: await decode.gas(json(captures, `${root}/stationary-natural-gas`), company),
    mobile: await decode.mobile(json(captures, `${root}/mobile-diesel`), company),
    fleet: await decode.fleet(json(captures, `${root}/controlled-fleet`), company),
    diesel: await decode.diesel(json(captures, `${root}/stationary-diesel`), company),
    equipment: await decode.equipment(json(captures, `${root}/stationary-equipment`), company),
    fugitive: await decode.fugitive(json(captures, `${root}/fugitive-sources`), company),
  };

  const downloads: Record<string, Record<string, unknown>> = {};
  const put = (family: string, key: string, value: unknown) => ((downloads[family] ??= {})[key] = value);
  for (const version of registers.corporate.versions) {
    put('corporate', version.id, bytes(captures, `${root}/corporate-inventories/${version.inventoryId}/versions/${version.id}/coverage-export`));
  }
  for (const [family, base] of [['gas', 'stationary-natural-gas'], ['mobile', 'mobile-diesel'], ['diesel', 'stationary-diesel']] as const) {
    for (const worksheet of registers[family].worksheets) {
      for (const version of worksheet.versions) {
        put(family, `version_${version.id}`, bytes(captures, `${root}/${base}/${worksheet.worksheetId}/versions/${version.id}/calculation-export`));
        const statements = family === 'mobile'
          ? [['fuel', version.fuelStatement], ['mileage', version.mileageStatement]]
          : [['statement', version.statement]];
        for (const [kind, statement] of statements as [string, any][]) {
          if (statement) put(family, `${kind}_${statement.id}`, bytes(captures, `${root}/${base}/${worksheet.worksheetId}/statements/${statement.id}/download`));
        }
      }
      for (const report of worksheet.reports) {
        const reportRoot = `${root}/${base}/${worksheet.worksheetId}/reports/${report.id}`;
        put(family, `report_${report.id}`, bytes(captures, `${reportRoot}/download`));
        if (family === 'diesel') put(family, `snapshot_${report.id}`, bytes(captures, `${reportRoot}/snapshot`));
      }
    }
  }
  for (const [family, base] of [['fleet', 'controlled-fleet'], ['equipment', 'stationary-equipment']] as const) {
    for (const version of registers[family].versions) {
      put(family, `version_${version.id}`, bytes(captures, `${root}/${base}/${version.rosterId}/versions/${version.id}/roster-export`));
      if (version.statement) put(family, `statement_${version.statement.id}`, bytes(captures, `${root}/${base}/${version.rosterId}/statements/${version.statement.id}/download`));
    }
    for (const report of registers[family].reports) {
      const reportRoot = `${root}/${base}/${report.rosterId}/reports/${report.id}`;
      put(family, `report_${report.id}`, bytes(captures, `${reportRoot}/download`));
      put(family, `snapshot_${report.id}`, bytes(captures, `${reportRoot}/snapshot`));
      put(family, `proof_${report.id}`, proof(captures, `${reportRoot}/proof`));
    }
  }
  for (const worksheet of [...registers.fugitive.worksheets, registers.fugitive.population]) {
    for (const version of worksheet.versions) {
      const base = version.family === 'source' ? 'fugitive-sources' : 'fugitive-population';
      put('fugitive', `version_${version.id}`, bytes(captures, `${root}/${base}/${version.streamId}/versions/${version.id}/calculation-export`));
      for (const statement of version.statements) {
        put('fugitive', `statement_${statement.id}`, bytes(captures, `${root}/${base}/${version.streamId}/statements/${statement.id}/download`));
      }
    }
    for (const report of worksheet.reports) {
      const base = report.family === 'source' ? 'fugitive-sources' : 'fugitive-population';
      const reportRoot = `${root}/${base}/${report.streamId}/reports/${report.id}`;
      put('fugitive', `report_${report.id}`, bytes(captures, `${reportRoot}/download`));
      put('fugitive', `snapshot_${report.id}`, bytes(captures, `${reportRoot}/snapshot`));
    }
  }

  const m78bytes: Record<string, { sha256: string; byteLength: number }> = {};
  for (const [family, stream] of [['process-screen', scope1.process], ['scope1-inventory', scope1.inventory]] as const) {
    for (const version of stream.versions) {
      const base = `${root}/${family}/${version.streamId}`;
      m78bytes[`version_${version.id}`] = bytes(captures, `${base}/versions/${version.id}/inventory-export`);
      for (const statement of version.statements) m78bytes[`statement_${statement.id}`] = bytes(captures, `${base}/statements/${statement.id}/download`);
    }
    for (const report of stream.reports) {
      const base = `${root}/${family}/${report.streamId}/reports/${report.id}`;
      m78bytes[`html_${report.id}`] = bytes(captures, `${base}/download`);
      m78bytes[`snapshot_${report.id}`] = bytes(captures, `${base}/snapshot`);
    }
  }

  return {
    status: 'm78_continuation4_revisit_observed',
    profile: 'm78-continuation4-revisit-observation-v1',
    workspaceId: company,
    journal: evidence.journal,
    gate: evidence.gate,
    journeyGate: evidence.journeyGate,
    sourcePins: evidence.sourcePins,
    sourcePinsSha256: sha(canonical(evidence.sourcePins)),
    capture: {
      startedAt: evidence.captureStartedAt,
      completedAt: evidence.captureCompletedAt,
      requests: captures.requests,
      aggregateBytes: captures.aggregateBytes,
      uniqueRoutes: captures.observations.size,
      authBodiesCaptured: 0,
      extraNetworkRequests: 0,
    },
    scope1,
    registers,
    downloads,
    m78bytes,
    legacy: addLegacy(captures, root),
    observedAt: evidence.observedAt,
  };
}
