import type { PyramidState } from '../../types/solitaire';
import type { PyramidSolverMove, SolveStatus } from '../solvers/types';
import { solvePyramid } from '../solvers/pyramidSolver';
import { applyPyramidMove, listPyramidMoves, resolvePyramidCard } from '../pyramidEngine';
import { parFromAce, tierBounds } from '../../utils/efficiencyRating';
import { SeededRNG } from '../../services/rngService';

export type TrainerTier = 'bogey' | 'par' | 'birdie' | 'eagle' | 'ace';

/** Weakest to strongest, the order the trainer shows them in. */
export const TRAINER_TIERS: TrainerTier[] = ['bogey', 'par', 'birdie', 'eagle', 'ace'];

export const TRAINER_TIER_LABELS: Record<TrainerTier, string> = {
  bogey: 'Bogey',
  par: 'Par',
  birdie: 'Birdie',
  eagle: 'Eagle',
  ace: 'Ace',
};

/**
 * The Bogey bot may land anywhere this far over Par. In Pyramid a real slip usually costs a
 * whole extra pass through the stock (10–20 moves), so the range has to allow for one.
 */
export const BOGEY_MAX_OVER_PAR = 20;

export interface TrainerStep {
  move: PyramidSolverMove;
  /** Set on detour moves: what the bot did instead of the Ace line, and what it cost. */
  lesson?: string;
  cost?: number;
}

export interface TierLine {
  tier: TrainerTier;
  /** Move counts that earn this tier's rating. */
  min: number;
  max: number;
  steps: TrainerStep[];
}

export interface TierLinesResult {
  status: SolveStatus;
  ace: number;
  par: number;
  lines: TierLine[];
}

/** The move counts that rate as each tier on Pyramid (matches `calculateEfficiency`). */
export function tierRange(tier: TrainerTier, ace: number, par: number): { min: number; max: number } {
  const bounds = tierBounds(tier, ace, par, 'pyramid');
  return tier === 'bogey' ? { min: bounds.min, max: par + BOGEY_MAX_OVER_PAR } : bounds;
}

const MAX_DETOURS = 6;
// Evaluating a slip needs a capped re-solve, which early in a hard deal can be slow. A fast pass
// skips slips it can't settle quickly; a tier that misses its range gets a deeper second pass.
const FAST_SLIP_NODES = 40_000;
const DEEP_SLIP_NODES = 400_000;


const stateKey = (s: PyramidState) =>
  `${s.pyramid.map((row) => row.map((c) => (c ? 1 : 0)).join('')).join('')}|${s.stock.map((c) => c.id).join(',')}|${s.waste
    .map((c) => c.id)
    .join(',')}`;

/** "Drew a card", "Paired 8♦ + 5♣": what a move did. */
export function pastTense(state: PyramidState, move: PyramidSolverMove): string {
  switch (move.type) {
    case 'draw':
      return 'Drew a card';
    case 'recycle':
      return 'Recycled the waste';
    case 'king':
      return `Cleared ${resolvePyramidCard(state, move.card)?.label}`;
    case 'pair':
      return `Paired ${resolvePyramidCard(state, move.a)?.label} + ${resolvePyramidCard(state, move.b)?.label}`;
  }
}

/** "Draw a card", "Pair 8♦ + 5♣": a move about to be played. */
export function imperative(state: PyramidState, move: PyramidSolverMove): string {
  switch (move.type) {
    case 'draw':
      return 'Draw a card';
    case 'recycle':
      return 'Recycle the waste';
    case 'king':
      return `Clear ${resolvePyramidCard(state, move.card)?.label}`;
    case 'pair':
      return `Pair ${resolvePyramidCard(state, move.a)?.label} + ${resolvePyramidCard(state, move.b)?.label}`;
  }
}

function gerund(state: PyramidState, move: PyramidSolverMove): string {
  switch (move.type) {
    case 'draw':
      return 'drawing a card';
    case 'recycle':
      return 'recycling the waste';
    case 'king':
      return `clearing ${resolvePyramidCard(state, move.card)?.label}`;
    case 'pair':
      return `pairing ${resolvePyramidCard(state, move.a)?.label} + ${resolvePyramidCard(state, move.b)?.label}`;
  }
}

/**
 * Shortest finishes from positions, capped at a length. Shared by every tier of a deal,
 * since their lines start out identical.
 */
export class FinishCache {
  /** Node cap for each re-solve; raised for a deeper second pass. */
  nodeBudget = FAST_SLIP_NODES;
  private solved = new Map<string, PyramidSolverMove[]>();
  private noneWithin = new Map<string, number>();
  private gaveUp = new Map<string, number>();

  shortestWithin(state: PyramidState, maxLength: number): PyramidSolverMove[] | null {
    const key = stateKey(state);
    const known = this.solved.get(key);
    if (known) return known.length <= maxLength ? known : null;
    if ((this.noneWithin.get(key) ?? -1) >= maxLength) return null;
    if ((this.gaveUp.get(key) ?? -1) >= this.nodeBudget) return null;
    const result = solvePyramid(state, { maxLength, maxNodes: this.nodeBudget });
    if (result.status === 'solved') {
      this.solved.set(key, result.moves);
      return result.moves;
    }
    // "Unsolvable" here means proven: no finish that short exists. Running out of nodes doesn't.
    if (result.status === 'unsolvable') this.noneWithin.set(key, maxLength);
    else this.gaveUp.set(key, this.nodeBudget);
    return null;
  }
}

interface Detour {
  at: number;
  state: PyramidState;
  move: PyramidSolverMove;
  finish: PyramidSolverMove[];
  cost: number;
}

/**
 * Slips after `from` that cost between 1 and `maxCost` extra moves, scanning positions in
 * `order`. Stops at the first one `enough` accepts, if given.
 */
function findDetours(
  start: PyramidState,
  steps: TrainerStep[],
  from: number,
  maxCost: number,
  cache: FinishCache,
  order: 'forward' | number[] = 'forward',
  enough?: (d: Detour) => boolean
): Detour[] {
  const positions =
    order === 'forward' ? Array.from({ length: steps.length - from }, (_, i) => from + i) : order.filter((p) => p >= from);
  // States along the current line, so positions can be visited in any order.
  const states: PyramidState[] = [start];
  for (const s of steps) states.push(applyPyramidMove(states[states.length - 1], s.move)!);

  const detours: Detour[] = [];
  for (const at of positions) {
    const state = states[at];
    const remaining = steps.length - at;
    const lineNextKey = stateKey(states[at + 1]);
    for (const move of listPyramidMoves(state)) {
      const next = applyPyramidMove(state, move)!;
      if (stateKey(next) === lineNextKey) continue; // the same move, or an equivalent one
      const finish = cache.shortestWithin(next, remaining - 1 + maxCost);
      if (!finish) continue;
      const cost = 1 + finish.length - remaining;
      if (cost < 1) continue;
      const detour = { at, state, move, finish, cost };
      detours.push(detour);
      if (enough?.(detour)) return detours;
    }
  }
  return detours;
}

function applyDetour(steps: TrainerStep[], d: Detour): TrainerStep[] {
  return [
    ...steps.slice(0, d.at),
    {
      move: d.move,
      cost: d.cost,
      lesson: `${pastTense(d.state, d.move)} instead of ${gerund(d.state, steps[d.at].move)}. That cost ${d.cost} move${d.cost === 1 ? '' : 's'}.`,
    },
    ...d.finish.map((move) => ({ move })),
  ];
}

const MAX_SCANS = 12;

/**
 * Builds a winning line whose length falls in [min, max] (when the deal allows it) by taking
 * the Ace line and swapping in real slips: play some other legal move, then finish by the
 * shortest route from there. Slips go in order, so everything after the last one is a solver
 * line. Small budgets (Eagle, Birdie, Par) backtrack over which slips to combine; a big one
 * (Bogey) takes the first slip that lands in range, scanning from a seeded point.
 */
export function buildDetourLine(
  start: PyramidState,
  aceLine: PyramidSolverMove[],
  range: { min: number; max: number },
  rngSeed: string,
  cache = new FinishCache()
): TrainerStep[] {
  const rng = new SeededRNG(rngSeed);
  const pickOne = <T>(items: T[]) => items[Math.floor(rng.next() * items.length)];
  const aceSteps: TrainerStep[] = aceLine.map((move) => ({ move }));
  const inRange = (s: TrainerStep[]) => s.length >= range.min && s.length <= range.max;
  let best = aceSteps;
  let scans = 0;

  // One big slip: visit positions in a seeded order and take the first that lands in range.
  if (range.max - aceLine.length > MAX_DETOURS) {
    const order = rng.shuffle(Array.from({ length: aceLine.length }, (_, i) => i));
    const need = range.min - aceLine.length;
    const found = findDetours(start, aceSteps, 0, range.max - aceLine.length, cache, order, (d) => d.cost >= need);
    const hit = found.find((d) => d.cost >= need);
    if (hit) return applyDetour(aceSteps, hit);
  }

  const search = (steps: TrainerStep[], lastDetour: number, depth: number): TrainerStep[] | null => {
    if (inRange(steps)) return steps;
    if (steps.length > best.length && steps.length <= range.max) best = steps;
    if (depth >= MAX_DETOURS || scans >= MAX_SCANS) return null;
    scans++;
    const need = range.min - steps.length;
    const detours = findDetours(start, steps, lastDetour + 1, range.max - steps.length, cache);
    const finishing = detours.filter((d) => d.cost >= need);
    if (finishing.length > 0) return applyDetour(steps, pickOne(finishing));
    // Otherwise try the biggest partial slips first, one per distinct cost.
    const costs = [...new Set(detours.map((d) => d.cost))].sort((a, b) => b - a);
    for (const cost of costs.slice(0, 3)) {
      const d = pickOne(detours.filter((x) => x.cost === cost));
      const result = search(applyDetour(steps, d), d.at, depth + 1);
      if (result) return result;
    }
    return null;
  };

  // The deal may have no slips that land in range: then return the closest line found.
  return search(aceSteps, -1, 0) ?? best;
}

/** Builds one tier's line (the Ace line is the solver's own). */
export function buildTierLine(
  tier: TrainerTier,
  start: PyramidState,
  aceLine: PyramidSolverMove[],
  seed: string,
  cache: FinishCache
): TierLine {
  const ace = aceLine.length;
  const range = tierRange(tier, ace, parFromAce(ace, 'pyramid'));
  if (tier === 'ace') return { tier, ...range, steps: aceLine.map((move) => ({ move })) };

  let steps = buildDetourLine(start, aceLine, range, `${seed}:${tier}`, cache);
  if (steps.length < range.min) {
    cache.nodeBudget = DEEP_SLIP_NODES;
    steps = buildDetourLine(start, aceLine, range, `${seed}:${tier}`, cache);
    cache.nodeBudget = FAST_SLIP_NODES;
  }
  return { tier, ...range, steps };
}

/**
 * All five trainer lines for a deal, or the solve status if it has no known winning line.
 * `onLine` is called as each line is ready, Ace first, so a viewer can start watching early.
 */
export function buildPyramidTierLines(
  start: PyramidState,
  seed: string,
  onLine?: (line: TierLine, ace: number, par: number) => void
): TierLinesResult {
  const solved = solvePyramid(start);
  if (solved.status !== 'solved') return { status: solved.status, ace: 0, par: 0, lines: [] };

  const ace = solved.moves.length;
  const par = parFromAce(ace, 'pyramid');
  const cache = new FinishCache();
  const built = new Map<TrainerTier, TierLine>();
  for (const tier of ['ace', 'eagle', 'birdie', 'par', 'bogey'] as TrainerTier[]) {
    const line = buildTierLine(tier, start, solved.moves, seed, cache);
    built.set(tier, line);
    onLine?.(line, ace, par);
  }
  return { status: 'solved', ace, par, lines: TRAINER_TIERS.map((tier) => built.get(tier)!) };
}
