/// <reference lib="webworker" />
import { solvePyramid } from '../engines/solvers/pyramidSolver';
import { buildPyramidTierLines } from '../engines/trainer/lineBuilder';
import { findWinnableDeal } from '../engines/dealFinder';
import { findKlondikeLine } from '../engines/solvers/klondikeSolver';
import { runKlondikeTrainer } from '../engines/trainer/klondikeTrainer';
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
  if (request.kind === 'klondikeLine') {
    reply({ id: request.id, type: 'klondikeLine', result: findKlondikeLine(request.state) });
    return;
  }
  if (request.kind === 'klondikeTrainer') {
    runKlondikeTrainer(
      request.state,
      request.line,
      (result) => reply({ id: request.id, type: 'klondikeLine', result }),
      (slip) => reply({ id: request.id, type: 'klondikeSlip', slip })
    );
    reply({ id: request.id, type: 'klondikeTrainerDone' });
    return;
  }
  if (request.kind === 'findDeal') {
    reply({ id: request.id, type: 'deal', found: findWinnableDeal(request.deck, request.mode, request.difficulty, request.seeds) });
    return;
  }
  // Tier lines stream one at a time, Ace first, so the trainer can start playing early.
  const result = buildPyramidTierLines(request.state, request.seed, (line, ace, par) =>
    reply({ id: request.id, type: 'line', line, ace, par })
  );
  reply({ id: request.id, type: 'done', status: result.status, ace: result.ace, par: result.par, best: result.best });
};
