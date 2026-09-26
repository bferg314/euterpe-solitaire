import type { DifficultyLevel, PyramidState } from '../types/solitaire';
import type { LoadedDeck } from './deckLoader';
import { findWinnablePyramidDeal, type FoundDeal } from '../engines/dealFinder';
import type { PyramidSolverMove, SolveResult, SolveStatus } from '../engines/solvers/types';
import type { TierLine } from '../engines/trainer/lineBuilder';
import { solvePyramid } from '../engines/solvers/pyramidSolver';
import { buildPyramidTierLines } from '../engines/trainer/lineBuilder';

export type SolverRequest =
  | { id: number; kind: 'solve'; state: PyramidState; maxNodes?: number }
  | { id: number; kind: 'tierLines'; state: PyramidState; seed: string }
  | { id: number; kind: 'findDeal'; deck: LoadedDeck; difficulty: DifficultyLevel; seeds?: string[] };

export type SolverResponse =
  | { id: number; type: 'solved'; result: SolveResult<PyramidSolverMove> }
  | { id: number; type: 'line'; line: TierLine; ace: number; par: number }
  | { id: number; type: 'done'; status: SolveStatus; ace: number; par: number }
  | { id: number; type: 'deal'; found: FoundDeal | null };

type RequestBody = SolverRequest extends infer R ? (R extends SolverRequest ? Omit<R, 'id'> : never) : never;

/**
 * Promise API over the solver worker. Each channel ('par', 'trainer') has its own worker, and
 * a new request on a channel cancels the one still running there (its promise resolves null).
 */
interface Channel {
  worker: Worker;
  pending: { id: number; onMessage: (msg: SolverResponse) => boolean; cancel: () => void } | null;
}

const channels = new Map<string, Channel>();
let nextId = 1;

function openChannel(name: string): Channel {
  const worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
  const channel: Channel = { worker, pending: null };
  worker.onmessage = (e: MessageEvent<SolverResponse>) => {
    // onMessage returns true on the request's final message.
    if (channel.pending?.id === e.data.id && channel.pending.onMessage(e.data)) channel.pending = null;
  };
  // A crashed search reports "no answer" rather than hanging the caller.
  worker.onerror = () => {
    channel.pending?.cancel();
    channel.pending = null;
  };
  channels.set(name, channel);
  return channel;
}

function send<T>(
  channelName: string,
  body: RequestBody,
  onMessage: (msg: SolverResponse, resolve: (value: T) => void) => boolean
): Promise<T | null> {
  let channel = channels.get(channelName);
  if (channel?.pending) {
    // The worker is busy with a search nobody needs any more: stop it and start fresh.
    channel.worker.terminate();
    channel.pending.cancel();
    channels.delete(channelName);
    channel = undefined;
  }
  const active = channel ?? openChannel(channelName);
  const id = nextId++;
  return new Promise((resolve) => {
    active.pending = { id, onMessage: (msg) => onMessage(msg, resolve), cancel: () => resolve(null) };
    active.worker.postMessage({ ...body, id } as SolverRequest);
  });
}

const workersAvailable = () => typeof Worker !== 'undefined';

export function solvePyramidAsync(
  state: PyramidState,
  options: { channel?: string; maxNodes?: number } = {}
): Promise<SolveResult<PyramidSolverMove> | null> {
  if (!workersAvailable()) return Promise.resolve(solvePyramid(state, { maxNodes: options.maxNodes }));
  return send(options.channel ?? 'default', { kind: 'solve', state, maxNodes: options.maxNodes }, (msg, resolve) => {
    if (msg.type !== 'solved') return false;
    resolve(msg.result);
    return true;
  });
}

export interface TierLinesSummary {
  status: SolveStatus;
  ace: number;
  par: number;
}

/**
 * Builds the trainer's five lines in the worker. `onLine` fires as each is ready (Ace first);
 * the promise resolves when all are done, or null if a newer trainer request replaced this one.
 */
export function buildTierLinesAsync(
  state: PyramidState,
  seed: string,
  onLine: (line: TierLine, ace: number, par: number) => void
): Promise<TierLinesSummary | null> {
  if (!workersAvailable()) {
    const result = buildPyramidTierLines(state, seed, onLine);
    return Promise.resolve({ status: result.status, ace: result.ace, par: result.par });
  }
  return send<TierLinesSummary>('trainer', { kind: 'tierLines', state, seed }, (msg, resolve) => {
    if (msg.type === 'line') {
      onLine(msg.line, msg.ace, msg.par);
      return false;
    }
    if (msg.type !== 'done') return false;
    resolve({ status: msg.status, ace: msg.ace, par: msg.par });
    return true;
  });
}

/** Stops any trainer work in progress (e.g. when the trainer closes). */
export function cancelTrainerWork(): void {
  const channel = channels.get('trainer');
  if (!channel?.pending) return;
  channel.worker.terminate();
  channel.pending.cancel();
  channels.delete('trainer');
}

/**
 * Finds a winnable Pyramid deal in the worker (see `findWinnablePyramidDeal`). Runs on its own
 * channel, so it never interrupts par solving or the Trainer.
 */
export function findWinnableDealAsync(
  deck: LoadedDeck,
  difficulty: DifficultyLevel,
  seeds?: string[]
): Promise<FoundDeal | null> {
  if (!workersAvailable()) return Promise.resolve(findWinnablePyramidDeal(deck, difficulty, seeds));
  return send<FoundDeal | null>('deal', { kind: 'findDeal', deck, difficulty, seeds }, (msg, resolve) => {
    if (msg.type !== 'deal') return false;
    resolve(msg.found);
    return true;
  }).then((found) => found ?? null);
}
