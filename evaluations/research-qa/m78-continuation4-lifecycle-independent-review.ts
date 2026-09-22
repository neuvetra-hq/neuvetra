/** Offline exercise/full-lifecycle evaluator. Never opens credentials or calls a host/database. */
import { readFile } from 'node:fs/promises';
import {
  cleanM78ContinuationJournal,
  m78VerifiedIdentity,
  readM78ContinuationJournal,
  readM78ContinuationRestart,
} from '../../tools/staging/check-m78-continuation';
import { preservesM77History } from '../../tools/staging/check-m77-hosted';
import { readM78Continuation4Diagnostics } from '../../tools/staging/check-m78-continuation4';
import { decodeScope1Register } from '../../apps/site-web/src/lib/m78-api';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);

function graphObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) graphObjects(item, output);
  } else {
    const object = value as Record<string, unknown>;
    output.push(object);
    for (const item of Object.values(object)) graphObjects(item, output);
  }
  return output;
}

type Pin = { path: string; sha256: string };
type Loader = (path: string) => Promise<string>;

export interface LifecycleAdmission {
  journalSha256: string;
  journalHead: string;
  diagnosticsSha256: string;
  diagnosticsHead: string;
  baselineResult: Pin;
  restartAttestation?: Pin;
  /** Read-only state captured after the revisit; this prevents trusting the journal's retained-state boolean. */
  revisitObservation?: Pin;
}

function preservesBytes(before: any, after: any) {
  check(before && after && typeof before === 'object' && typeof after === 'object', 'artifact maps');
  for (const family of Object.keys(before)) {
    const prior = before[family];
    if (prior && typeof prior === 'object' && !Array.isArray(prior) && !('sha256' in prior)) {
      for (const [key, value] of Object.entries(prior)) {
        check(same(after[family]?.[key], value), `retained artifact ${family}/${key}`);
      }
    } else {
      check(same(after[family], prior), `retained artifact ${family}`);
    }
  }
}

type DiagnosticPhase = {
  mode: 'baseline' | 'exercise' | 'revisit';
  requests: number;
  startedAt: string;
  finishedAt: string;
};

export function verifyRestartFreshForRevisit(restartObservedAt: string, revisitStartedAt: string) {
  const restartTime = Date.parse(restartObservedAt);
  const revisitTime = Date.parse(revisitStartedAt);
  check(Number.isFinite(restartTime) && Number.isFinite(revisitTime), 'restart/revisit timestamps');
  const ageAtRevisit = revisitTime - restartTime;
  check(ageAtRevisit >= 0 && ageAtRevisit <= 15 * 60_000, 'fresh restart; restart fresh at revisit');
}

export function verifyLifecycleDiagnostics(
  text: string,
  admission: LifecycleAdmission,
  baseline: any,
  full: boolean,
  mainRequests?: Partial<Record<DiagnosticPhase['mode'], number>>,
) {
  check(sha(text) === admission.diagnosticsSha256, 'diagnostic bytes');
  const events = readM78Continuation4Diagnostics(text);
  const modes: DiagnosticPhase['mode'][] = full
    ? ['baseline', 'exercise', 'revisit']
    : ['baseline', 'exercise'];
  const phases: any[][] = [];
  let phase: any[] = [];
  let lastTime = 0;
  for (const event of events) {
    const time = Date.parse(event.createdAt);
    check(Number.isFinite(time) && time >= lastTime, 'diagnostic chronology');
    lastTime = time;
    if (event.kind === 'phase_started') {
      check(phase.length === 0, 'nested diagnostic phase');
      phase = [event];
    } else {
      check(phase.length > 0, 'diagnostic event outside phase');
      phase.push(event);
      if (event.kind === 'phase_finished') {
        phases.push(phase);
        phase = [];
      }
    }
  }
  check(phase.length === 0 && phases.length === modes.length, 'diagnostic phase count');

  const summaries: DiagnosticPhase[] = [];
  for (let index = 0; index < modes.length; index += 1) {
    const current = phases[index]!;
    const mode = modes[index]!;
    const first = current[0]!;
    const last = current.at(-1)!;
    check(first.mode === mode && last.mode === mode, 'diagnostic phase order');
    if (index > 0) check(same(first.data, phases[0]![0]!.data), 'diagnostic phase parent metadata');
    check(
      same(first.data.transport, {
        runtime: 'bun-fetch',
        pooling: 'disabled',
        keepalive: false,
        retries: 0,
      }),
      'diagnostic transport',
    );
    check(
      last.data.status === 'passed' &&
        last.data.paused === false &&
        last.data.diagnosticsHealthy === true &&
        last.data.applicationPostRequests === (mode === 'exercise' ? 37 : 0) &&
        last.data.allCreatedAuthSessionsClosed === true,
      'diagnostic phase closure',
    );

    let ordinal = 0;
    let applicationPosts = 0;
    let tokens = 0;
    let logouts = 0;
    const open = new Map<number, any>();
    for (const event of current.slice(1, -1)) {
      check(event.mode === mode, 'diagnostic phase mode');
      if (event.kind === 'request_intent') {
        const { method, route } = event.data;
        check(event.data.ordinal === ++ordinal && ['GET', 'POST'].includes(method), 'diagnostic ordinal/method');
        check(typeof route === 'string' && (route.startsWith('auth:') || route.startsWith('application:')), 'diagnostic route');
        if (route === 'auth:/auth/v1/token') {
          check(method === 'POST', 'login method');
          tokens += 1;
        } else if (route === 'auth:/auth/v1/logout') {
          check(method === 'POST', 'logout method');
          logouts += 1;
        } else {
          check(route.startsWith('application:'), 'known diagnostic route');
          if (method === 'POST') {
            check(mode === 'exercise', 'application POST phase');
            applicationPosts += 1;
          }
        }
        open.set(ordinal, event.data);
      } else if (event.kind === 'response_headers') {
        const intent = open.get(event.data.ordinal);
        check(
          intent && Number.isInteger(event.data.status) && Number.isFinite(event.data.elapsedMs) && event.data.elapsedMs >= 0,
          'paired diagnostic response',
        );
        const allowed =
          intent.route === 'auth:/auth/v1/token'
            ? [200]
            : intent.route === 'auth:/auth/v1/logout'
              ? [204]
              : intent.method === 'POST'
                ? [201]
                : [200, 401, 403];
        check(allowed.includes(event.data.status), 'diagnostic response status');
        open.delete(event.data.ordinal);
      } else {
        check(false, 'diagnostic error or extra event');
      }
    }
    check(
      open.size === 0 && applicationPosts === (mode === 'exercise' ? 37 : 0) && tokens === 8 && logouts === 8,
      'complete diagnostic outcomes/posts/auth',
    );
    if (mainRequests?.[mode] !== undefined) check(ordinal === mainRequests[mode], 'main/diagnostic request count');
    if (mode === 'baseline') {
      const exactBaselinePhase = `${current.map((event) => JSON.stringify(event)).join('\n')}\n`;
      check(
        sha(exactBaselinePhase) === baseline.diagnosticSha256 &&
          current.length === baseline.diagnosticEvents &&
          last.sha256 === baseline.diagnosticHead &&
          ordinal === baseline.diagnosticRequests,
        'accepted baseline diagnostics',
      );
    }
    summaries.push({ mode, requests: ordinal, startedAt: first.createdAt, finishedAt: last.createdAt });
  }
  check(events.at(-1)?.sha256 === admission.diagnosticsHead, 'diagnostic head');
  return { events: events.length, phases: summaries };
}

export async function verifyContinuation4Lifecycle(
  text: string,
  diagnosticText: string,
  admission: LifecycleAdmission,
  load: Loader = (filePath) => readFile(filePath, 'utf8'),
) {
  check(sha(text) === admission.journalSha256, 'journal bytes');
  const first = JSON.parse(text.split('\n')[0]!);
  const events = readM78ContinuationJournal(text, first.workspaceId);
  cleanM78ContinuationJournal(events);
  check(events.at(-1)?.sha256 === admission.journalHead, 'journal head');

  const baselineText = await load(admission.baselineResult.path);
  check(sha(baselineText) === admission.baselineResult.sha256, 'baseline result pin');
  const baseline = JSON.parse(baselineText);
  check(
    baseline.status === 'm78_independent_continuation4_hosted_baseline_passed' &&
      baseline.journalPath === '.superpowers/m78-hosted-continuation4.jsonl' &&
      Number.isSafeInteger(baseline.verifiedPrefixBytes) &&
      baseline.verifiedPrefixBytes > 0 &&
      Number.isSafeInteger(baseline.verifiedPrefixEvents) &&
      baseline.verifiedPrefixEvents > 0,
    'accepted baseline result',
  );
  const bytes = Buffer.from(text, 'utf8');
  check(baseline.verifiedPrefixBytes <= bytes.length, 'baseline prefix length');
  const prefix = bytes.subarray(0, baseline.verifiedPrefixBytes).toString('utf8');
  check(sha(prefix) === baseline.prefixSha256, 'exact baseline prefix bytes');
  const baselineEvents = readM78ContinuationJournal(prefix, first.workspaceId);
  check(
    baselineEvents.length === baseline.verifiedPrefixEvents &&
      baselineEvents.at(-1)?.sha256 === baseline.headSha256 &&
      baselineEvents.at(-1)?.createdAt === baseline.completedAt,
    'accepted baseline prefix',
  );

  const finishes = events.filter((event) => event.kind === 'attempt_finished');
  const full = finishes.some((event) => event.mode === 'revisit');
  check(
    finishes.map((event) => event.mode).join(',') === (full ? 'baseline,exercise,revisit' : 'baseline,exercise'),
    'lifecycle phase order',
  );
  const starts = events.filter((event) => event.kind === 'attempt_started');
  check(starts.length === finishes.length && starts.every((event) => same(event.data.gate, starts[0]!.data.gate)), 'one gate');

  const baselineEvent = events.find((event) => event.kind === 'baseline')!;
  const exercise = events.find((event) => event.kind === 'exercise_complete')!;
  const exerciseFinish = finishes.find((event) => event.mode === 'exercise')!;
  check(exercise && exercise.data.applicationPostRequests === 37, 'exercise terminal');
  const baselineDecoded = await decodeScope1Register(baselineEvent.data.scope1, first.workspaceId);
  const expectedNames = [
    'm78_initial_unreviewed_report',
    'm78_factual_corporate_successor',
    'm78_corporate_separate_review',
    ...baselineDecoded.proof.sourceVersions.flatMap(({ family, version }: any) => [
      `m78_rebind_${family}_${version.activity.binding.sourceId}`,
      `m78_review_${family}_${version.activity.binding.sourceId}`,
    ]),
    'm78_rebind_fleet_discovery',
    'm78_review_fleet_discovery',
    'm78_rebind_stationary_discovery',
    'm78_review_stationary_discovery',
    'm78_rebind_fugitive_discovery',
    'm78_review_fugitive_discovery',
    'm78_complete_process_discovery',
    'm78_process_unreviewed_report',
    'm78_process_separate_review',
    'm78_process_reviewed_report',
    'm78_current_inventory_successor',
    'm78_inventory_unreviewed_report',
    'm78_inventory_separate_review',
    'm78_inventory_reviewed_report',
  ];
  check(expectedNames.length === 37, 'exact recipe definition');
  const recipe = events.filter(
    (event) => event.mode === 'exercise' && ['post_intent', 'post_outcome', 'post_verified'].includes(event.kind),
  );
  check(recipe.length === 111, '37 complete recipe operations');
  const identities: unknown[] = [];
  for (let index = 0; index < expectedNames.length; index += 1) {
    const [intent, outcome, verified] = recipe.slice(index * 3, index * 3 + 3);
    const name = expectedNames[index];
    check(
      intent?.kind === 'post_intent' &&
        outcome?.kind === 'post_outcome' &&
        verified?.kind === 'post_verified' &&
        intent.data.name === name &&
        outcome.data.name === name &&
        verified.data.name === name &&
        outcome.data.status === 201,
      `exact recipe operation ${index + 1} (exact37 recipe)`,
    );
    identities.push(verified.data.verifiedIdentity);
  }
  check(new Set(identities.map((identity) => canonical(identity))).size === 37, 'distinct verified recipe identities');

  const decoded = await decodeScope1Register(exercise.data.scope1, first.workspaceId);
  check(
    same(decoded, exercise.data.scope1) &&
      decoded.reconciliation.status === 'reconciled_bounded_synthetic' &&
      decoded.reconciliation.totals?.company.kgCo2eExact === '126850.17632025' &&
      decoded.reconciliation.sourceUnion.length === 10 &&
      decoded.process.versions.length === 1 &&
      decoded.inventory.versions.length === 2 &&
      decoded.process.reports.length === 2 &&
      decoded.inventory.reports.length === 3 &&
      decoded.process.versions.at(-1)?.review?.decision === 'accepted_bounded_process_screen' &&
      decoded.inventory.versions.at(-1)?.review?.decision === 'accepted_bounded_inventory',
    'decoded final state',
  );
  const currentGraph = graphObjects({ scope1: decoded, registers: exercise.data.registers });
  for (let index = 0; index < identities.length; index += 1) {
    const identity = identities[index] as Record<string, unknown>;
    check(
      currentGraph.some(
        (record) =>
          record.id === identity.id &&
          Object.entries(identity).every(([key, value]) => same(record[key], value)),
      ),
      `verified identity in current graph ${index + 1}`,
    );
  }
  const finalReportIds = [...decoded.process.reports, ...decoded.inventory.reports]
    .map((report: any) => report.id)
    .sort();
  const verifiedReportIds = identities
    .flatMap((identity: any) => identity && typeof identity.reportSha256 === 'string' ? [identity.id] : [])
    .sort();
  check(verifiedReportIds.length === 5 && same(verifiedReportIds, finalReportIds), 'five exact report identities');
  const workspaceRoot = `/workspace-api/workspace/${first.workspaceId}`;
  const expectedOperations = new Map<string, { route: string; identity: unknown }>();
  const bind = (name: string, route: string, record: any) => {
    check(record, `expected operation record ${name}`);
    expectedOperations.set(name, { route, identity: m78VerifiedIdentity(record) });
  };
  const initialInventory = baselineDecoded.inventory.versions[0]!;
  const initialReports = decoded.inventory.reports.filter((report: any) => report.versionId === initialInventory.id);
  check(initialReports.length === 1, 'initial report identity');
  bind(
    'm78_initial_unreviewed_report',
    `${workspaceRoot}/scope1-inventory/${initialInventory.streamId}/reports`,
    initialReports[0],
  );
  bind(
    'm78_factual_corporate_successor',
    `${workspaceRoot}/corporate-inventories/${baselineDecoded.coverageVersion.inventoryId}/versions`,
    decoded.coverageVersion,
  );
  bind(
    'm78_corporate_separate_review',
    `${workspaceRoot}/corporate-inventories/${decoded.coverageVersion.inventoryId}/reviews`,
    decoded.coverageVersion.review,
  );
  for (const { family, version: baselineVersion } of baselineDecoded.proof.sourceVersions as any[]) {
    const sourceId = baselineVersion.activity.binding.sourceId;
    const current = decoded.proof.sourceVersions.find(
      (item: any) => item.family === family && item.version.activity.binding.sourceId === sourceId,
    );
    check(current, `current source ${family}/${sourceId}`);
    const base = ({
      natural_gas: 'stationary-natural-gas',
      stationary_diesel: 'stationary-diesel',
      mobile_diesel: 'mobile-diesel',
      fugitive: 'fugitive-sources',
    } as Record<string, string>)[family];
    check(base, `source family ${family}`);
    const stream = baselineVersion.worksheetId ?? baselineVersion.streamId;
    bind(`m78_rebind_${family}_${sourceId}`, `${workspaceRoot}/${base}/${stream}/versions`, current.version);
    bind(`m78_review_${family}_${sourceId}`, `${workspaceRoot}/${base}/${stream}/reviews`, current.version.review);
  }
  for (const family of ['fleet', 'stationary', 'fugitive'] as const) {
    const base = family === 'fleet'
      ? 'controlled-fleet'
      : family === 'stationary'
        ? 'stationary-equipment'
        : 'fugitive-population';
    const baselineVersion: any = baselineDecoded.proof[family].version;
    const stream = baselineVersion.rosterId ?? baselineVersion.streamId;
    bind(`m78_rebind_${family}_discovery`, `${workspaceRoot}/${base}/${stream}/versions`, decoded.proof[family].version);
    bind(`m78_review_${family}_discovery`, `${workspaceRoot}/${base}/${stream}/reviews`, decoded.proof[family].review);
  }
  const processVersion = decoded.process.versions.at(-1)!;
  const processReports = decoded.process.reports.filter((report: any) => report.versionId === processVersion.id);
  check(processReports.length === 2, 'process report identities');
  bind('m78_complete_process_discovery', `${workspaceRoot}/process-screen`, processVersion);
  bind('m78_process_unreviewed_report', `${workspaceRoot}/process-screen/${processVersion.streamId}/reports`, processReports[0]);
  bind('m78_process_separate_review', `${workspaceRoot}/process-screen/${processVersion.streamId}/reviews`, processVersion.review);
  bind('m78_process_reviewed_report', `${workspaceRoot}/process-screen/${processVersion.streamId}/reports`, processReports[1]);
  const inventoryVersion = decoded.inventory.versions.at(-1)!;
  const inventoryReports = decoded.inventory.reports.filter((report: any) => report.versionId === inventoryVersion.id);
  check(inventoryReports.length === 2, 'inventory report identities');
  bind('m78_current_inventory_successor', `${workspaceRoot}/scope1-inventory/${initialInventory.streamId}/versions`, inventoryVersion);
  bind('m78_inventory_unreviewed_report', `${workspaceRoot}/scope1-inventory/${inventoryVersion.streamId}/reports`, inventoryReports[0]);
  bind('m78_inventory_separate_review', `${workspaceRoot}/scope1-inventory/${inventoryVersion.streamId}/reviews`, inventoryVersion.review);
  bind('m78_inventory_reviewed_report', `${workspaceRoot}/scope1-inventory/${inventoryVersion.streamId}/reports`, inventoryReports[1]);
  check(expectedOperations.size === 37, '37 operation bindings');
  for (let index = 0; index < expectedNames.length; index += 1) {
    const name = expectedNames[index]!;
    const expected = expectedOperations.get(name)!;
    const intent = recipe[index * 3]!;
    const verified = recipe[index * 3 + 2]!;
    check(
      expected && intent.data.route === expected.route && same(verified.data.verifiedIdentity, expected.identity),
      `operation result binding ${index + 1}`,
    );
  }
  check(same(decoded.inventory.versions[0], baselineDecoded.inventory.versions[0]), 'initial inventory history');
  preservesM77History(baselineEvent.data.registers, exercise.data.registers);
  preservesBytes(baselineEvent.data.downloads, exercise.data.downloads);
  preservesBytes(baselineEvent.data.m78bytes, exercise.data.m78bytes);
  check(same(exercise.data.legacy, baselineEvent.data.legacy), 'legacy state retained');

  const mainRequests = Object.fromEntries(finishes.map((event) => [event.mode, event.data.requests]));
  const diagnostics = verifyLifecycleDiagnostics(diagnosticText, admission, baseline, full, mainRequests);
  for (const summary of diagnostics.phases) {
    const start = starts.find((event) => event.mode === summary.mode)!;
    const finish = finishes.find((event) => event.mode === summary.mode)!;
    check(
      Date.parse(summary.startedAt) <= Date.parse(start.createdAt) &&
        Date.parse(summary.finishedAt) >= Date.parse(finish.createdAt),
      'diagnostic phase brackets journal phase',
    );
  }

  if (full) {
    check(admission.restartAttestation && admission.revisitObservation, 'restart/revisit pins');
    const revisit = events.find((event) => event.kind === 'revisit_verified')!;
    check(
      revisit.data.exerciseSha256 === exercise.sha256 &&
        revisit.data.applicationPostRequests === 0 &&
        revisit.data.exactRetainedState === true,
      'revisit marker',
    );
    await readM78ContinuationRestart(
      { gate: starts[0]!.data.gate, restartAttestation: admission.restartAttestation } as any,
      exerciseFinish.createdAt,
      load,
    );
    const restartText = await load(admission.restartAttestation.path);
    check(sha(restartText) === admission.restartAttestation.sha256, 'restart pin');
    const restart = JSON.parse(restartText);
    const revisitStart = starts.find((event) => event.mode === 'revisit')!;
    verifyRestartFreshForRevisit(restart.observedAt, revisitStart.createdAt);

    const observationText = await load(admission.revisitObservation.path);
    check(sha(observationText) === admission.revisitObservation.sha256, 'revisit observation pin');
    const observation = JSON.parse(observationText);
    const revisitDecoded = await decodeScope1Register(observation.scope1, first.workspaceId);
    check(
      observation.status === 'm78_continuation4_revisit_observed' &&
        same(revisitDecoded, decoded) &&
        same(observation.registers, exercise.data.registers) &&
        same(observation.downloads, exercise.data.downloads) &&
        same(observation.m78bytes, exercise.data.m78bytes) &&
        same(observation.legacy, exercise.data.legacy),
      'independent revisit state; independently decoded revisit state',
    );
  } else {
    check(!admission.restartAttestation && !admission.revisitObservation, 'exercise-only before restart');
  }

  return {
    status: full
      ? 'm78_independent_continuation4_full_lifecycle_passed'
      : 'm78_independent_continuation4_exercise_passed',
    events: events.length,
    applicationPostRequests: 37,
    reports: 5,
    grossKgCo2eExact: '126850.17632025',
    actualRestartVerified: full,
    hostedCalls: 0,
  };
}
