/// <reference lib="webworker" />
import { solvePyramid } from '../engines/solvers/pyramidSolver';
import { buildPyramidTierLines } from '../engines/trainer/lineBuilder';
import type { SolverRequest, SolverResponse } from '../services/solverClient';

// Runs solver searches off the main thread so the board stays responsive.
const scope = self as unknown as DedicatedWorkerGlobalScope;
const reply = (response: SolverResponse) => scope.postMessage(response);

scope.onmessage = (e: MessageEvent<SolverRequest>) => {
  const request = e.data;
  if (request.kind === 'solve') {
    reply({ id: request.id, type: 'solved', result: solvePyramid(request.state, { maxNodes: request.maxNodes }) });
    return;
  }
  // Tier lines stream one at a time, Ace first, so the trainer can start playing early.
  const result = buildPyramidTierLines(request.state, request.seed, (line, ace, par) =>
    reply({ id: request.id, type: 'line', line, ace, par })
  );
  reply({ id: request.id, type: 'done', status: result.status, ace: result.ace, par: result.par });
};
