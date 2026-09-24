import { decodeScope1Register } from '../../apps/site-web/src/lib/m78-api';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';
import {
  readM78ContinuationJournal,
} from '../../tools/staging/check-m78-continuation';
import {
  m78Continuation3SafeRoute,
} from '../../tools/staging/check-m78-continuation3';
import { readM78Continuation4Diagnostics } from '../../tools/staging/check-m78-continuation4';

const HOST = 'https://www.neuvetra.ai';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);

type Inputs = {
  mainText: string;
  diagnosticText: string;
  baselineResultText: string;
  exerciseGateText: string;
  providerObservationText: string;
  browserObservationText: string;
};

function assertIdentityShape(name: string, identity: any) {
  check(identity && typeof identity === 'object' && UUID.test(identity.id), `identity id ${name}`);
  if (name.includes('report')) {
    check(UUID.test(identity.versionId) && HASH.test(identity.versionSha256) && HASH.test(identity.reportSha256), `report identity ${name}`);
  } else if (name.includes('review')) {
    check(UUID.test(identity.versionId) && HASH.test(identity.versionSha256) && HASH.test(identity.decisionSha256), `review identity ${name}`);
  } else {
    check(HASH.test(identity.versionSha256), `version identity ${name}`);
  }
}

function bindVersionConsumers(recipeByName: Map<string, any[]>, producer: string, consumers: string[]) {
  const produced = recipeByName.get(producer)![2].data.verifiedIdentity;
  for (const name of consumers) {
    const intent = recipeByName.get(name)![0].data;
    check(
      intent.request.versionId === produced.id &&
        intent.request.expectedVersionSha256 === produced.versionSha256,
      `consumer binds produced version ${producer}/${name}`,
    );
  }
}

export async function verifyExerciseFailure(inputs: Inputs) {
  check(sha(inputs.mainText) === '44e7bec2d2e6a4a554de6ba23775150bfdf29582fd69ff12bc6cfbc73770ba8b', 'main bytes');
  check(sha(inputs.diagnosticText) === 'd77a8f58ec92a0642a5b0b4a91113920ccd4013b9bcfee9a9c7e5de90d93e651', 'diagnostic bytes');
  check(sha(inputs.baselineResultText) === '57fc10f6ee4dce55ced4060aa1d41cbd5a125eac3bd58d99bbad7c37ef1daddf', 'baseline result bytes');
  check(sha(inputs.exerciseGateText) === '9fe233c964b8c40f6c7a9871eecf75a318e7a800f2ec14570c6803288ff9dce7', 'exercise gate bytes');
  check(sha(inputs.providerObservationText) === 'bb98e5a3125f87a9aa5a4de01ec9105ef1b46b1a7f5687e80b7f1c01822db090', 'provider observation bytes');
  check(sha(inputs.browserObservationText) === '27e7420cdf5f3788e3894b466a78b24e889d48a732c13220a50f29f2ef7ff3d5', 'browser observation bytes');

  const first = JSON.parse(inputs.mainText.split('\n')[0]!);
  const events = readM78ContinuationJournal(inputs.mainText, first.workspaceId);
  const diagnostics = readM78Continuation4Diagnostics(inputs.diagnosticText);
  check(events.length === 176 && events.at(-1)?.sha256 === '44817c9e96c62576fe65198ab4ea357ef4a4b212b755f64419e8516496498ab9', 'main closure');
  check(diagnostics.length === 1350 && diagnostics.at(-1)?.sha256 === 'c95e235e08844012639f4a12d969231e3ae7131bb0d419d9ed0de9130b61d48f', 'diagnostic closure');

  const baseline = JSON.parse(inputs.baselineResultText);
  check(baseline.status === 'm78_independent_continuation4_hosted_baseline_passed', 'accepted baseline');
  const mainBytes = Buffer.from(inputs.mainText, 'utf8');
  const mainPrefix = mainBytes.subarray(0, baseline.verifiedPrefixBytes).toString('utf8');
  check(
    baseline.verifiedPrefixEvents === 42 &&
      baseline.verifiedPrefixBytes === 9_186_947 &&
      sha(mainPrefix) === baseline.prefixSha256 &&
      baseline.prefixSha256 === 'ef4d8ebaa36b447d4dfa7cf8e6636b263d587a4b29c899d875f3e5401eedf3d5',
    'preserved main baseline prefix',
  );
  const prefixEvents = readM78ContinuationJournal(mainPrefix, first.workspaceId);
  check(prefixEvents.length === 42 && prefixEvents.at(-1)?.sha256 === baseline.headSha256, 'main prefix head');
  const diagnosticLines = inputs.diagnosticText.split('\n').slice(0, baseline.diagnosticEvents).join('\n') + '\n';
  check(
    baseline.diagnosticEvents === 572 &&
      Buffer.byteLength(diagnosticLines) === 243_558 &&
      sha(diagnosticLines) === baseline.diagnosticSha256 &&
      baseline.diagnosticSha256 === 'b98846b6ce33c0d943a73437f13ba83390a4c63d3ab3547729b4926d7573bf40',
    'preserved diagnostic baseline prefix',
  );

  const starts = events.filter((event) => event.kind === 'attempt_started');
  const finishes = events.filter((event) => event.kind === 'attempt_finished');
  check(starts.map((event) => event.mode).join(',') === 'baseline,exercise', 'main phase starts');
  check(finishes.map((event) => event.mode).join(',') === 'baseline,exercise', 'main phase finishes');
  const gate = JSON.parse(inputs.exerciseGateText);
  check(gate.mode === 'exercise' && same(starts[1]!.data.gate, gate.gate), 'exercise gate binding');

  const baselineEvent = events.find((event) => event.kind === 'baseline')!;
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
  check(expectedNames.length === 37, 'exact recipe names');
  const recipe = events.filter(
    (event) => event.mode === 'exercise' && ['post_intent', 'post_outcome', 'post_verified'].includes(event.kind),
  );
  check(recipe.length === 111, '37 complete operation triples');
  const recipeByName = new Map<string, any[]>();
  const identities: any[] = [];
  const idempotencyKeys = new Set<string>();
  for (let index = 0; index < expectedNames.length; index += 1) {
    const name = expectedNames[index]!;
    const triple = recipe.slice(index * 3, index * 3 + 3);
    const [intent, outcome, verified] = triple;
    check(intent?.kind === 'post_intent' && outcome?.kind === 'post_outcome' && verified?.kind === 'post_verified', `operation triple ${index + 1}`);
    check(intent.data.name === name && outcome.data.name === name && verified.data.name === name, `operation name ${index + 1}`);
    check(intent.data.route === outcome.data.route && intent.data.expected === 201 && outcome.data.status === 201, `operation route/status ${index + 1}`);
    check(outcome.data.responseSha256 === verified.data.responseSha256 && HASH.test(outcome.data.responseSha256), `verified response bytes ${index + 1}`);
    check(typeof intent.data.request.idempotencyKey === 'string' && !idempotencyKeys.has(intent.data.request.idempotencyKey), `unique idempotency ${index + 1}`);
    idempotencyKeys.add(intent.data.request.idempotencyKey);
    assertIdentityShape(name, verified.data.verifiedIdentity);
    identities.push(verified.data.verifiedIdentity);
    recipeByName.set(name, triple);
  }
  check(new Set(identities.map((identity) => canonical(identity))).size === 37, '37 distinct verified identities');

  const root = `/workspace-api/workspace/${first.workspaceId}`;
  const routeByName = new Map<string, string>();
  const initialInventory = baselineDecoded.inventory.versions[0]!;
  routeByName.set('m78_initial_unreviewed_report', `${root}/scope1-inventory/${initialInventory.streamId}/reports`);
  routeByName.set('m78_factual_corporate_successor', `${root}/corporate-inventories/${baselineDecoded.coverageVersion.inventoryId}/versions`);
  routeByName.set('m78_corporate_separate_review', `${root}/corporate-inventories/${baselineDecoded.coverageVersion.inventoryId}/reviews`);
  for (const { family, version } of baselineDecoded.proof.sourceVersions as any[]) {
    const sourceId = version.activity.binding.sourceId;
    const base = ({ natural_gas: 'stationary-natural-gas', stationary_diesel: 'stationary-diesel', mobile_diesel: 'mobile-diesel', fugitive: 'fugitive-sources' } as any)[family];
    const stream = version.worksheetId ?? version.streamId;
    routeByName.set(`m78_rebind_${family}_${sourceId}`, `${root}/${base}/${stream}/versions`);
    routeByName.set(`m78_review_${family}_${sourceId}`, `${root}/${base}/${stream}/reviews`);
    bindVersionConsumers(recipeByName, `m78_rebind_${family}_${sourceId}`, [`m78_review_${family}_${sourceId}`]);
  }
  for (const family of ['fleet', 'stationary', 'fugitive'] as const) {
    const base = family === 'fleet' ? 'controlled-fleet' : family === 'stationary' ? 'stationary-equipment' : 'fugitive-population';
    const version: any = baselineDecoded.proof[family].version;
    const stream = version.rosterId ?? version.streamId;
    routeByName.set(`m78_rebind_${family}_discovery`, `${root}/${base}/${stream}/versions`);
    routeByName.set(`m78_review_${family}_discovery`, `${root}/${base}/${stream}/reviews`);
    bindVersionConsumers(recipeByName, `m78_rebind_${family}_discovery`, [`m78_review_${family}_discovery`]);
  }
  bindVersionConsumers(recipeByName, 'm78_factual_corporate_successor', ['m78_corporate_separate_review']);
  const process = recipeByName.get('m78_complete_process_discovery')![2].data.verifiedIdentity;
  routeByName.set('m78_complete_process_discovery', `${root}/process-screen`);
  routeByName.set('m78_process_unreviewed_report', `${root}/process-screen/${process.streamId}/reports`);
  routeByName.set('m78_process_separate_review', `${root}/process-screen/${process.streamId}/reviews`);
  routeByName.set('m78_process_reviewed_report', `${root}/process-screen/${process.streamId}/reports`);
  bindVersionConsumers(recipeByName, 'm78_complete_process_discovery', ['m78_process_unreviewed_report', 'm78_process_separate_review', 'm78_process_reviewed_report']);
  const inventory = recipeByName.get('m78_current_inventory_successor')![2].data.verifiedIdentity;
  routeByName.set('m78_current_inventory_successor', `${root}/scope1-inventory/${initialInventory.streamId}/versions`);
  routeByName.set('m78_inventory_unreviewed_report', `${root}/scope1-inventory/${inventory.streamId}/reports`);
  routeByName.set('m78_inventory_separate_review', `${root}/scope1-inventory/${inventory.streamId}/reviews`);
  routeByName.set('m78_inventory_reviewed_report', `${root}/scope1-inventory/${inventory.streamId}/reports`);
  bindVersionConsumers(recipeByName, 'm78_current_inventory_successor', ['m78_inventory_unreviewed_report', 'm78_inventory_separate_review', 'm78_inventory_reviewed_report']);
  const firstReportRequest = recipeByName.get('m78_initial_unreviewed_report')![0].data.request;
  check(firstReportRequest.versionId === initialInventory.id && firstReportRequest.expectedVersionSha256 === initialInventory.versionSha256, 'initial report version binding');
  check(routeByName.size === 37, '37 expected routes');
  for (const name of expectedNames) check(recipeByName.get(name)![0].data.route === routeByName.get(name), `exact operation route ${name}`);
  const reports = expectedNames.filter((name) => name.includes('report')).map((name) => recipeByName.get(name)![2].data.verifiedIdentity);
  check(reports.length === 5 && new Set(reports.map((identity) => identity.id)).size === 5, 'five distinct report identities');

  const exerciseDiagnostics = diagnostics.slice(baseline.diagnosticEvents);
  check(exerciseDiagnostics[0]?.kind === 'phase_started' && exerciseDiagnostics[0]?.mode === 'exercise', 'exercise diagnostic start');
  check(same(exerciseDiagnostics[0]!.data, diagnostics[0]!.data), 'diagnostic parent/transport binding');
  const requestIntents = exerciseDiagnostics.filter((event) => event.kind === 'request_intent');
  const responses = exerciseDiagnostics.filter((event) => event.kind === 'response_headers');
  const errors = exerciseDiagnostics.filter((event) => event.kind === 'request_error');
  check(requestIntents.length === 388 && responses.length === 387 && errors.length === 1, 'diagnostic request outcomes');
  const open = new Map<number, any>();
  let appPosts = 0;
  let tokens = 0;
  let logouts = 0;
  const diagnosticPostRoutes: string[] = [];
  for (const event of exerciseDiagnostics.slice(1, -1)) {
    if (event.kind === 'request_intent') {
      check(event.data.ordinal === open.size + 1, `diagnostic ordinal ${event.data.ordinal}`);
      check(['GET', 'POST'].includes(event.data.method), `diagnostic method ${event.data.ordinal}`);
      if (event.data.route === 'auth:/auth/v1/token') {
        check(event.data.method === 'POST', 'token method');
        tokens += 1;
      } else if (event.data.route === 'auth:/auth/v1/logout') {
        check(event.data.method === 'POST', 'logout method');
        logouts += 1;
      } else {
        check(event.data.route.startsWith('application:'), 'application route');
        if (event.data.method === 'POST') {
          appPosts += 1;
          diagnosticPostRoutes.push(event.data.route);
        }
      }
      open.set(event.data.ordinal, { intent: event, outcome: null });
    } else if (event.kind === 'response_headers' || event.kind === 'request_error') {
      const pair = open.get(event.data.ordinal);
      check(pair && pair.outcome === null, `paired outcome ${event.data.ordinal}`);
      if (event.kind === 'response_headers') {
        const intent = pair.intent.data;
        const allowed = intent.route === 'auth:/auth/v1/token'
          ? [200]
          : intent.route === 'auth:/auth/v1/logout'
            ? [204]
            : intent.method === 'POST'
              ? [201]
              : [200, 401, 403];
        check(allowed.includes(event.data.status), `response status ${event.data.ordinal}`);
      }
      pair.outcome = event;
    } else {
      check(false, `unexpected diagnostic event ${event.kind}`);
    }
  }
  check([...open.values()].every((pair) => pair.outcome), 'all diagnostic requests closed');
  check(appPosts === 37 && tokens === 4 && logouts === 4, 'posts and auth counts');
  const mainPostRoutes = expectedNames.map((name) => m78Continuation3SafeRoute(HOST + recipeByName.get(name)![0].data.route));
  check(same(diagnosticPostRoutes, mainPostRoutes), 'diagnostic/main exact post order');
  const error = errors[0]!;
  const failedIntent = open.get(error.data.ordinal)!.intent;
  check(
    error.data.ordinal === 384 &&
      error.data.category === 'timeout' &&
      error.data.elapsedMs === 30_011 &&
      failedIntent.data.method === 'GET' &&
      failedIntent.data.route === 'application:/workspace-api/workspace/:id/scope1-inventory/:id/reports/:id/snapshot',
    'exact timeout ordinal',
  );
  const exerciseFinish = finishes[1]!;
  check(
      exerciseFinish.data.status === 'failed' &&
      exerciseFinish.data.stage.startsWith('read:/scope1-inventory/') &&
      m78Continuation3SafeRoute(HOST + root + exerciseFinish.data.stage.slice('read:'.length)) === failedIntent.data.route &&
      exerciseFinish.data.applicationPostRequests === 37 &&
      exerciseFinish.data.requests === 388 &&
      exerciseFinish.data.allCreatedAuthSessionsClosed === true &&
      exerciseFinish.data.unknownAuthSessions === 0,
    'main failure closure',
  );
  const phaseFinished = exerciseDiagnostics.at(-1)!;
  check(
    phaseFinished.kind === 'phase_finished' && phaseFinished.mode === 'exercise' &&
      same(phaseFinished.data, {
        status: 'failed', paused: false, diagnosticsHealthy: true,
        applicationPostRequests: 37, allCreatedAuthSessionsClosed: true,
      }),
    'diagnostic failure closure',
  );
  const mainExercise = events.filter((event) => event.mode === 'exercise');
  const count = (kind: string) => mainExercise.filter((event) => event.kind === kind);
  check(count('auth_intent').length === 4 && count('auth_outcome').length === 4, 'four main logins');
  check(count('logout_intent').length === 4 && count('logout_outcome').length === 4, 'four main logouts');
  const expectedRoles = ['manager1', 'manager2', 'member', 'outsider'];
  check(same(count('auth_intent').map((event) => event.data.role), expectedRoles), 'login roles');
  check(same(count('logout_intent').map((event) => event.data.role), expectedRoles), 'logout roles');
  check(count('auth_outcome').every((event) => event.data.status === 200 && event.data.tokenObserved === true && event.data.subjectMatched === true), 'login statuses/subjects');
  check(count('logout_outcome').every((event) => event.data.status === 204), 'logout statuses');
  check(count('legacy_auth_intent').length === 0 && count('legacy_read_verified').length === 0 && count('exercise_complete').length === 0, 'legacy/final stage not reached');
  check(!events.some((event) => event.mode === 'revisit' || event.kind === 'revisit_verified'), 'no revisit journal');

  const provider = JSON.parse(inputs.providerObservationText);
  const failureHttp = provider.http.filter((event: any) => event.httpStatus === 499);
  check(
    failureHttp.length === 1 &&
      failureHttp[0].method === 'GET' &&
      failureHttp[0].route === '/workspace-api/workspace/:id/scope1-inventory/:id/reports/:id/snapshot' &&
      failureHttp[0].totalDuration === 29_965 &&
      failureHttp[0].upstreamRqDuration === 29_964,
    'sanitized provider timeout correspondence',
  );
  check(provider.limitation === 'Provider completion records alone do not establish the cause of a client timeout.', 'provider limitation');
  const browser = JSON.parse(inputs.browserObservationText);
  const laterSnapshot = browser.http.filter((event: any) =>
    event.method === 'GET' &&
    event.route === '/workspace-api/workspace/:id/scope1-inventory/:id/reports/:id/snapshot' &&
    event.httpStatus === 200
  );
  check(
    laterSnapshot.length === 1 &&
      laterSnapshot[0].totalDuration === 90_427 &&
      laterSnapshot[0].upstreamRqDuration === 90_425,
    'later browser snapshot observation',
  );
  check(browser.limitation === provider.limitation, 'browser provider limitation');

  return {
    status: 'm78_continuation4_exercise_failure_independently_reconciled',
    materialFindingsOpen: 1,
    journal: { events: 176, bytes: 9_378_221, sha256: sha(inputs.mainText), head: events.at(-1)!.sha256 },
    diagnostics: { events: 1350, bytes: 576_941, sha256: sha(inputs.diagnosticText), head: diagnostics.at(-1)!.sha256 },
    baselinePrefixPreserved: true,
    diagnosticBaselinePrefixPreserved: true,
    operationTriplesVerified: 37,
    distinctVerifiedIdentities: 37,
    distinctIdempotencyKeys: 37,
    repeatedApplicationPostRequests: 0,
    applicationPostRequests: 37,
    reportsVerifiedFromPostResponses: 5,
    timeout: {
      ordinal: 384,
      route: failedIntent.data.route,
      category: 'timeout',
      clientElapsedMs: 30_011,
      providerStatus: 499,
      providerTotalDurationMs: 29_965,
      laterBrowserSuccessDurationMs: 90_427,
      preciseCauseEstablished: false,
    },
    exerciseRequests: 388,
    mainLogins: 4,
    mainLogouts: 4,
    unknownAuthSessions: 0,
    allCreatedAuthSessionsClosed: true,
    legacyStageReached: false,
    successEvaluatorExecuted: false,
    restartExecuted: false,
    revisitExecuted: false,
  };
}
