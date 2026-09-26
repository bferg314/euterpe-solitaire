import type { PyramidState } from '../types/solitaire';
import type { PyramidSolverMove, SolveResult } from '../engines/solvers/types';
import { solvePyramid } from '../engines/solvers/pyramidSolver';

export interface SolverRequest {
  id: number;
  state: PyramidState;
  maxNodes?: number;
}

export interface SolverResponse {
  id: number;
  result: SolveResult<PyramidSolverMove>;
}

/**
 * Promise API over the solver worker. Each channel (e.g. 'par') has its own worker, and a new
 * request on a channel cancels the one still running there: the old promise resolves to null.
 */
interface Channel {
  worker: Worker;
  pending: { id: number; resolve: (result: SolveResult<PyramidSolverMove> | null) => void } | null;
}

const channels = new Map<string, Channel>();
let nextId = 1;

function openChannel(name: string): Channel {
  const worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
  const channel: Channel = { worker, pending: null };
  worker.onmessage = (e: MessageEvent<SolverResponse>) => {
    if (channel.pending?.id === e.data.id) {
      const { resolve } = channel.pending;
      channel.pending = null;
      resolve(e.data.result);
    }
  };
  // A crashed search reports "no answer" rather than hanging the caller.
  worker.onerror = () => {
    channel.pending?.resolve(null);
    channel.pending = null;
  };
  channels.set(name, channel);
  return channel;
}

export function solvePyramidAsync(
  state: PyramidState,
  options: { channel?: string; maxNodes?: number } = {}
): Promise<SolveResult<PyramidSolverMove> | null> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(solvePyramid(state, { maxNodes: options.maxNodes }));
  }

  const name = options.channel ?? 'default';
  let channel = channels.get(name);
  if (channel?.pending) {
    // The worker is busy with a search nobody needs any more: stop it and start fresh.
    channel.worker.terminate();
    channel.pending.resolve(null);
    channels.delete(name);
    channel = undefined;
  }
  const active = channel ?? openChannel(name);

  const id = nextId++;
  return new Promise((resolve) => {
    active.pending = { id, resolve };
    const request: SolverRequest = { id, state, maxNodes: options.maxNodes };
    active.worker.postMessage(request);
  });
}
