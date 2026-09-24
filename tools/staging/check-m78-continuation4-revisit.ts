/** Public revisit entry with passive response capture; credential validation remains in the private wrapper. */
import {
  M78_CONTINUATION4_PATHS,
  runM78Continuation4,
  type M78Continuation4Input,
} from './check-m78-continuation4';
import {
  buildM78Continuation4RevisitObservation,
  createM78Continuation4RevisitCapture,
  type M78RevisitObservationEvidence,
} from './m78-continuation4-revisit-capture';
import {
  cleanM78ContinuationJournal,
  readM78ContinuationJournal,
} from './check-m78-continuation';
import type { M78Continuation3IO } from './check-m78-continuation3';

export const M78_CONTINUATION4_REVISIT_OBSERVATION =
  '.superpowers/m78-continuation4-revisit-observation.json';

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};

type Pin = { path: string; sha256: string };
export type M78Continuation4RevisitEvidence = {
  gate: Pin;
  sourcePins: Pin[];
};

export async function writeM78Continuation4RevisitObservation(
  io: Pick<M78Continuation3IO, 'append'>,
  observation: unknown,
) {
  const text = `${JSON.stringify(observation, null, 2)}\n`;
  await io.append(M78_CONTINUATION4_REVISIT_OBSERVATION, text, true);
  return { path: M78_CONTINUATION4_REVISIT_OBSERVATION, sha256: sha(text) };
}

type Runner = typeof runM78Continuation4;
export async function runM78Continuation4RevisitWithCapture(
  input: M78Continuation4Input,
  evidence: M78Continuation4RevisitEvidence,
  options: {
    io: M78Continuation3IO;
    fetch: typeof fetch;
    run?: Runner;
    now?: () => string;
  },
) {
  check(input.mode === 'revisit', 'capture entry is revisit only');
  const now = options.now ?? (() => new Date().toISOString());
  const captureStartedAt = now();
  const capture = createM78Continuation4RevisitCapture(options.fetch, input.roster.workspaceId);
  const result = await (options.run ?? runM78Continuation4)(input, {
    io: options.io,
    fetch: capture.fetch,
  });
  if (result.status !== 'passed') {
    // Drain every clone before returning; capture failures never mask the core failure/cleanup result.
    await capture.finish().catch(() => undefined);
    return result;
  }

  try {
    const captures = await capture.finish();
    const captureCompletedAt = now();
    const journalText = await options.io.read(M78_CONTINUATION4_PATHS.journal);
    check(journalText !== null, 'closed revisit journal');
    const events = readM78ContinuationJournal(journalText, input.roster.workspaceId);
    cleanM78ContinuationJournal(events);
    const finish = events.at(-1)!;
    check(
      finish.kind === 'attempt_finished' &&
        finish.mode === 'revisit' &&
        finish.data.status === 'passed' &&
        finish.data.applicationPostRequests === 0 &&
        finish.data.allCreatedAuthSessionsClosed === true,
      'closed successful revisit',
    );
    const observationEvidence: M78RevisitObservationEvidence = {
      workspaceId: input.roster.workspaceId,
      journal: {
        path: M78_CONTINUATION4_PATHS.journal,
        sha256: sha(journalText),
        head: finish.sha256,
        events: events.length,
      },
      gate: evidence.gate,
      journeyGate: input.gate,
      sourcePins: evidence.sourcePins,
      captureStartedAt,
      captureCompletedAt,
      observedAt: now(),
    };
    const observation = await buildM78Continuation4RevisitObservation(captures, observationEvidence);
    const revisitObservation = await writeM78Continuation4RevisitObservation(options.io, observation);
    return {
      ...result,
      revisitObservation,
      capture: observation.capture,
    };
  } catch {
    return {
      ...result,
      status: 'failed' as const,
      stage: 'revisit_capture',
      coreJourneyStatus: result.status,
      revisitObservationWritten: false,
    };
  }
}
