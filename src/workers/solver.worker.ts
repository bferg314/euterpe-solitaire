/// <reference lib="webworker" />
import { solvePyramid } from '../engines/solvers/pyramidSolver';
import type { SolverRequest, SolverResponse } from '../services/solverClient';

// Runs solver searches off the main thread so the board stays responsive.
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (e: MessageEvent<SolverRequest>) => {
  const { id, state, maxNodes } = e.data;
  const response: SolverResponse = { id, result: solvePyramid(state, { maxNodes }) };
  scope.postMessage(response);
};
