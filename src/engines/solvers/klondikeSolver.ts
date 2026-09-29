import type { KlondikeState, GameMode, DifficultyLevel, SolitaireCard } from '../../types/solitaire';
import type { KlondikeSolverMove, SolveResult } from './types';
import { applyKlondikeSolverMove, type KlondikeMoveSource, type KlondikeMoveTarget } from '../klondikeEngine';

/**
 * Heuristic Par estimate for Klondike (a real solver replaces this in a later phase)
 * Uses deep board entropy, hidden card depth analysis, and stock draw requirements
 */
export function estimateKlondikePar(
  state: KlondikeState,
  mode: GameMode,
  difficulty: DifficultyLevel
): number {
  // 1. Inherent absolute minimum foundation moves
  const totalFoundationMoves = 52;

  // 2. Count face-down cards and their depth penalties
  let faceDownCount = 0;
  let depthPenalty = 0;
  let buriedLowCardsPenalty = 0;

  state.tableau.forEach((col) => {
    let colFaceDown = 0;
    col.forEach((c) => {
      if (!c.faceUp) {
        colFaceDown++;
        faceDownCount++;
      } else if (colFaceDown > 0 && c.value !== null && c.value <= 4) {
        // Low cards (Aces, 2s, 3s, 4s) trapped on top of face-down cards that need to move away
        buriedLowCardsPenalty += 1;
      }
    });
    // Columns with 4+ face-down cards require multi-stage shifting to uncover
    if (colFaceDown >= 4) {
      depthPenalty += (colFaceDown - 3) * 2;
    }
  });

  // 3. Stock draw cost based on draw count (Turn 1 vs Turn 3)
  const stockCount = state.stock.length + state.waste.length;
  let stockDrawEstimate = 0;

  if (mode === 'klondike-3') {
    // In Turn 3, stock draws in batches of 3; reaching specific cards takes 1 to 3 passes
    const basePasses = difficulty === 'hard' ? 2.5 : 1.8;
    stockDrawEstimate = Math.round((stockCount / 3) * basePasses);
  } else {
    // In Turn 1, single draws allow immediate access, avg 0.65 draws per stock card needed
    const stockDrawRatio = difficulty === 'easy' ? 0.45 : difficulty === 'hard' ? 0.75 : 0.6;
    stockDrawEstimate = Math.round(stockCount * stockDrawRatio);
  }

  // 4. Tableau maneuver complexity (moving intermediate runs between columns)
  let tableauManeuverCost = 0;
  switch (difficulty) {
    case 'easy':
      tableauManeuverCost = 8;
      break;
    case 'medium':
      tableauManeuverCost = 14;
      break;
    case 'hard':
      tableauManeuverCost = 22;
      break;
    case 'daily':
      tableauManeuverCost = 16;
      break;
  }

  // Sum components
  const calculated =
    totalFoundationMoves +
    faceDownCount +
    depthPenalty +
    buriedLowCardsPenalty +
    stockDrawEstimate +
    tableauManeuverCost;

  // Realistic human-achievable optimal ranges:
  // Klondike 1: 76 - 110 moves
  // Klondike 3: 84 - 130 moves
  const minBound = mode === 'klondike-3' ? 82 : 74;
  const maxBound = mode === 'klondike-3' ? 135 : 118;

  return Math.max(minBound, Math.min(maxBound, calculated));
}

/*
 * Klondike solver.
 *
 * Cards are numbered id = suit * 13 + rank − 1, with suits in foundation order (spades, hearts,
 * diamonds, clubs). A position is: the top rank on each suit's foundation, how many face-down
 * cards each column still has (they're fixed from the deal and leave from the top), each
 * column's face-up run, and the stock and waste as one fixed draw order R with a pointer, as in
 * the Pyramid solver: waste = remaining cards of R before the pointer, stock = those from it on.
 * A recycle turns the waste back over in the same order, so R never changes.
 *
 * Draws only matter for the waste card they bring up, and they don't interact with tableau
 * moves, so the search folds them in: "draw k times (recycling if needed), then play the card on
 * top" is one step costing k + 1. Positions that differ only in which columns hold which bare
 * runs count as one, and moves that can't help are pruned (see `listSteps`).
 *
 * Plain A* can't prove shortest lines for Klondike in a browser's budget, so `findKlondikeLine`
 * searches in passes: a heavily weighted one finds a winning line fast, then lighter ones look
 * for shorter lines. Measured on 100 medium deals each (Node, 150k nodes per pass): Turn 1 won 83
 * with a median line of 123 moves, 3 proven shortest; Turn 3 won 76 with a median of 102, 16
 * proven shortest, and found no line in 10. Deals the search can't settle are left unknown.
 */

const DEFAULT_KLONDIKE_MAX_NODES = 150_000;

const SUIT_ORDER = ['spades', 'hearts', 'diamonds', 'clubs'];
const rankOf = (id: number) => (id % 13) + 1;
const suitOf = (id: number) => Math.floor(id / 13);
const isRed = (id: number) => {
  const s = suitOf(id);
  return s === 1 || s === 2;
};
const fitsOn = (id: number, onto: number) => rankOf(onto) === rankOf(id) + 1 && isRed(onto) !== isRed(id);

interface KPos {
  found: number[]; // top rank per suit, 0 when empty
  down: number[]; // face-down cards left per column
  up: number[][]; // face-up run per column, bottom→top (shared between positions, never mutated)
  removed: number; // reserve cards played, one bit per index of R
  pointer: number;
}

/** A search step. Reserve steps first draw and recycle until R[reserve] is on top of the waste. */
interface KStep {
  kind: 'toFoundation' | 'toTableau';
  from: 'tableau' | 'reserve' | 'foundation';
  card: number;
  col: number; // source column (tableau), in this position's layout
  to: number; // target column (toTableau), in this position's layout
  onto: number; // card it lands on (toTableau), −1 for an empty column
  reserve: number; // index in R (reserve)
  pointer: number; // pointer after the draws (reserve)
  cost: number;
}

interface KDeal {
  hidden: number[][]; // face-down ids per column, bottom→top
  hiddenBlockers: { blockers: number; minRank: number[] }[][];
  reserve: number[];
  stockMask: number; // one bit per index of R
  drawCount: number;
  start: KPos;
}

function cardId(card: SolitaireCard): number {
  return SUIT_ORDER.indexOf(card.suit as string) * 13 + (card.value ?? 1) - 1;
}

function packKlondike(state: KlondikeState): KDeal {
  const found = [0, 0, 0, 0];
  for (const pile of state.foundations) {
    const top = pile[pile.length - 1];
    if (top) found[SUIT_ORDER.indexOf(top.suit as string)] = top.value ?? 0;
  }
  const hidden = state.tableau.map((col) => col.filter((c) => !c.faceUp).map(cardId));
  const up = state.tableau.map((col) => col.filter((c) => c.faceUp).map(cardId));
  // Waste bottom→top has been drawn already; the stock is drawn from its end.
  const reserve = [...state.waste, ...[...state.stock].reverse()].map(cardId);
  return {
    hidden,
    hiddenBlockers: hidden.map(hiddenBlockerTable),
    reserve,
    stockMask: 2 ** reserve.length - 1,
    drawCount: state.drawCount,
    start: { found, down: hidden.map((h) => h.length), up, removed: 0, pointer: state.waste.length },
  };
}

// Column keys are cached per run array: runs are shared between positions and never mutated.
const runKeys = new WeakMap<number[], string>();
function runKey(run: number[]): string {
  let k = runKeys.get(run);
  if (k === undefined) {
    k = String.fromCharCode(...run.map((id) => 65 + id));
    runKeys.set(run, k);
  }
  return k;
}

function positionKey(p: KPos): string {
  const cols: string[] = [];
  for (let c = 0; c < 7; c++) {
    // Columns with face-down cards keep their identity; bare runs are interchangeable.
    cols.push(p.down[c] > 0 ? String.fromCharCode(97 + c, 48 + p.down[c]) + runKey(p.up[c]) : runKey(p.up[c]));
  }
  cols.sort();
  const f = p.found;
  return `${String.fromCharCode(48 + f[0], 48 + f[1], 48 + f[2], 48 + f[3])}${p.removed.toString(36)}.${p.pointer}|${cols.join(',')}`;
}

/** The vacuum's rule: Aces and 2s, or a card whose opposite-colour cards a rank below are both home. */
function isSafe(id: number, found: number[]): boolean {
  const rank = rankOf(id);
  if (rank <= 2) return true;
  return isRed(id) ? found[0] >= rank - 1 && found[3] >= rank - 1 : found[1] >= rank - 1 && found[2] >= rank - 1;
}

interface ReserveReach {
  reserve: number;
  cost: number;
  pointer: number;
}

/**
 * Waste cards reachable by drawing (and recycling), each with the fewest draws that bring it to
 * the top and the pointer at that moment. Includes the current waste top at cost 0.
 */
function reachableReserve(deal: KDeal, p: KPos): ReserveReach[] {
  const size = deal.reserve.length;
  const out: ReserveReach[] = [];
  let seenCards = 0;
  let seenPointers = 0;
  let ptr = p.pointer;
  for (let cost = 0; ; cost++) {
    let top = -1;
    for (let r = ptr - 1; r >= 0; r--) {
      if (!(p.removed & (1 << r))) {
        top = r;
        break;
      }
    }
    if (top >= 0 && !(seenCards & (1 << top))) {
      seenCards |= 1 << top;
      out.push({ reserve: top, cost, pointer: ptr });
    }
    if (seenPointers & (1 << ptr)) break;
    seenPointers |= 1 << ptr;
    // Draw up to drawCount remaining cards, or recycle when the stock is empty.
    let drawn = 0;
    let next = ptr;
    while (next < size && drawn < deal.drawCount) {
      if (!(p.removed & (1 << next))) drawn++;
      next++;
    }
    if (drawn > 0) ptr = next;
    else if (top >= 0) ptr = 0;
    else break; // stock and waste both empty
  }
  return out;
}

function popcount(m: number): number {
  let n = 0;
  for (; m !== 0; m &= m - 1) n++;
  return n;
}

const cardsHome = (p: KPos) => p.found[0] + p.found[1] + p.found[2] + p.found[3];

/**
 * Admissible lower bound on the moves left: every card not yet home needs a move to its
 * foundation; every stock card must be drawn (a draw brings up at most drawCount cards); and a
 * card above a lower card of its own suit in a column must first move somewhere else.
 */
function klondikeHeuristic(deal: KDeal, p: KPos): number {
  const stock = popcount(deal.stockMask & ~p.removed & ~((1 << p.pointer) - 1));
  let h = 52 - cardsHome(p) + Math.ceil(stock / deal.drawCount);
  for (let c = 0; c < 7; c++) {
    const below = deal.hiddenBlockers[c][p.down[c]];
    h += below.blockers;
    const run = p.up[c];
    if (run.length === 0) continue;
    // Face-up runs alternate colours and descend, so within a run no card sits above a lower
    // card of its own suit: only the face-down cards beneath can make a run card a blocker.
    for (const id of run) if (below.minRank[suitOf(id)] < rankOf(id)) h++;
  }
  return h;
}

/** For each column and face-down count: blockers among those cards, and each suit's lowest rank. */
function hiddenBlockerTable(hidden: number[]): { blockers: number; minRank: number[] }[] {
  const table = [{ blockers: 0, minRank: [99, 99, 99, 99] }];
  for (const id of hidden) {
    const prev = table[table.length - 1];
    const minRank = prev.minRank.slice();
    const blocks = minRank[suitOf(id)] < rankOf(id);
    if (!blocks) minRank[suitOf(id)] = rankOf(id);
    table.push({ blockers: prev.blockers + (blocks ? 1 : 0), minRank });
  }
  return table;
}

function listSteps(deal: KDeal, p: KPos): KStep[] {
  const base = { col: -1, to: -1, onto: -1, reserve: -1, pointer: p.pointer, cost: 1 };
  // A safe card on a column top goes home at once, and nothing else is tried: it's never
  // needed on the tableau, and moving it only uncovers more.
  for (let c = 0; c < 7; c++) {
    const run = p.up[c];
    if (run.length === 0) continue;
    const top = run[run.length - 1];
    if (p.found[suitOf(top)] === rankOf(top) - 1 && isSafe(top, p.found)) {
      return [{ ...base, kind: 'toFoundation', from: 'tableau', card: top, col: c }];
    }
  }

  const steps: KStep[] = [];
  // Empty columns are interchangeable: only the first is offered.
  const emptyCol = p.up.findIndex((run) => run.length === 0);
  const topOf = (d: number) => (p.up[d].length > 0 ? p.up[d][p.up[d].length - 1] : -1);
  const targets = (card: number, exclude: number): number[] => {
    const out: number[] = [];
    for (let d = 0; d < 7; d++) {
      if (d === exclude) continue;
      const run = p.up[d];
      if (run.length === 0 ? rankOf(card) === 13 && d === emptyCol : fitsOn(card, run[run.length - 1])) out.push(d);
    }
    return out;
  };
  const goesHome = (card: number) => p.found[suitOf(card)] === rankOf(card) - 1;

  for (let c = 0; c < 7; c++) {
    const run = p.up[c];
    for (let i = 0; i < run.length; i++) {
      const card = run[i];
      if (i === run.length - 1 && goesHome(card)) steps.push({ ...base, kind: 'toFoundation', from: 'tableau', card, col: c });
      // Moving a run between columns only helps if it turns a card over, empties the column, or
      // frees the card under it to go home. Anything else just swaps equivalent spots.
      const useful = i === 0 || goesHome(run[i - 1]);
      if (!useful) continue;
      for (const d of targets(card, c)) {
        // A King that already heads a bare column gains nothing from another empty one.
        if (p.up[d].length === 0 && i === 0 && p.down[c] === 0) continue;
        steps.push({ ...base, kind: 'toTableau', from: 'tableau', card, col: c, to: d, onto: topOf(d) });
      }
    }
  }
  for (const { reserve, cost, pointer } of reachableReserve(deal, p)) {
    const card = deal.reserve[reserve];
    const from = { ...base, from: 'reserve' as const, card, reserve, pointer, cost: cost + 1 };
    if (goesHome(card)) steps.push({ ...from, kind: 'toFoundation' });
    for (const d of targets(card, -1)) steps.push({ ...from, kind: 'toTableau', to: d, onto: topOf(d) });
  }
  // Back down from a foundation (never an Ace: nothing can use it).
  for (let s = 0; s < 4; s++) {
    if (p.found[s] < 2) continue;
    const card = s * 13 + p.found[s] - 1;
    for (const d of targets(card, -1)) steps.push({ ...base, kind: 'toTableau', from: 'foundation', card, to: d, onto: topOf(d) });
  }
  return steps;
}

function applyStep(deal: KDeal, p: KPos, step: KStep): KPos {
  let found = p.found;
  let down = p.down;
  let removed = p.removed;
  const up = p.up.slice();
  let moved: number[] = [step.card];
  if (step.from === 'tableau') {
    const run = p.up[step.col];
    const index = run.lastIndexOf(step.card);
    moved = run.slice(index);
    up[step.col] = run.slice(0, index);
    if (index === 0 && p.down[step.col] > 0) {
      down = p.down.slice();
      down[step.col]--;
      up[step.col] = [deal.hidden[step.col][down[step.col]]];
    }
  } else if (step.from === 'reserve') {
    removed |= 1 << step.reserve;
  }
  const suit = suitOf(step.card);
  if (step.kind === 'toFoundation') {
    found = found.slice();
    found[suit] = rankOf(step.card);
  } else {
    if (step.from === 'foundation') {
      found = found.slice();
      found[suit] = rankOf(step.card) - 1;
    }
    up[step.to] = [...p.up[step.to], ...moved];
  }
  return { found, down, up, removed, pointer: step.from === 'reserve' ? step.pointer : p.pointer };
}

// Steps packed into 31 bits, so the open list can hold millions of them cheaply:
// kind 1 | from 2 | card 6 | col 3 | to 3 | reserve 5 | pointer 5 | onto + 1 6.
const FROM_CODES = ['tableau', 'reserve', 'foundation'] as const;

function packStep(s: KStep): number {
  return (
    (s.kind === 'toTableau' ? 1 : 0) |
    (FROM_CODES.indexOf(s.from) << 1) |
    (s.card << 3) |
    ((s.col & 7) << 9) |
    ((s.to & 7) << 12) |
    ((s.reserve & 31) << 15) |
    (s.pointer << 20) |
    ((s.onto + 1) << 25)
  );
}

function unpackStep(code: number): KStep {
  return {
    kind: code & 1 ? 'toTableau' : 'toFoundation',
    from: FROM_CODES[(code >> 1) & 3],
    card: (code >> 3) & 63,
    col: (code >> 9) & 7,
    to: (code >> 12) & 7,
    reserve: (code >> 15) & 31,
    pointer: (code >> 20) & 31,
    onto: ((code >> 25) & 63) - 1,
    cost: 0, // not needed once a step is stored: g carries it
  };
}

/**
 * Turns search steps into game moves by replaying them through the engine. Steps are matched by
 * card, not column: a position stands for every arrangement of its bare columns, so the column
 * numbers a step was generated with may not be the ones on this line's board.
 */
function toEngineMoves(start: KlondikeState, steps: KStep[]): KlondikeSolverMove[] {
  let state = start;
  const moves: KlondikeSolverMove[] = [];
  const play = (move: KlondikeSolverMove) => {
    const next = applyKlondikeSolverMove(state, move);
    if (!next) throw new Error(`Klondike solver produced an illegal move: ${JSON.stringify(move)}`);
    moves.push(move);
    state = next;
  };
  const topId = (pile: SolitaireCard[]) => (pile.length > 0 ? cardId(pile[pile.length - 1]) : -1);

  for (const step of steps) {
    let source: KlondikeMoveSource;
    if (step.from === 'reserve') {
      for (let guard = 0; topId(state.waste) !== step.card; guard++) {
        if (guard > 100) throw new Error('Klondike solver: waste card never came up');
        play(state.stock.length > 0 ? { type: 'draw' } : { type: 'recycle' });
      }
      source = { pile: 'waste' };
    } else if (step.from === 'tableau') {
      const col = state.tableau.findIndex((column) => column.some((c) => c.faceUp && cardId(c) === step.card));
      source = { pile: 'tableau', col, index: state.tableau[col]?.findIndex((c) => cardId(c) === step.card) ?? -1 };
    } else {
      source = { pile: 'foundation', index: state.foundations.findIndex((pile) => topId(pile) === step.card) };
    }
    let target: KlondikeMoveTarget;
    if (step.kind === 'toTableau') {
      const col =
        step.onto >= 0
          ? state.tableau.findIndex((column) => topId(column) === step.onto)
          : state.tableau.findIndex((column) => column.length === 0);
      target = { pile: 'tableau', col };
    } else {
      const suit = suitOf(step.card);
      let index = state.foundations.findIndex((pile) => pile.length > 0 && suitOf(topId(pile)) === suit);
      // An Ace goes to its suit's usual pile if that's free, as the vacuum does.
      if (index < 0) index = state.foundations[suit].length === 0 ? suit : state.foundations.findIndex((pile) => pile.length === 0);
      target = { pile: 'foundation', index };
    }
    play({ type: 'move', source, target });
  }
  return moves;
}

export interface KlondikeSolveOptions {
  maxNodes?: number;
  /** Only look for lines of at most this many moves (see `PyramidSolveOptions.maxLength`). */
  maxLength?: number;
  /** Above 1, weights the heuristic: faster, but the line found may not be the shortest. */
  weight?: number;
}

export interface KlondikeSolveResult extends SolveResult<KlondikeSolverMove> {
  /** The most cards the search got home, for a deal it didn't win. */
  bestHome: number;
  /** A line reaching `bestHome` in the fewest moves found: the bot's best attempt when it can't win. */
  bestMoves: KlondikeSolverMove[];
}

/** Growable Int32 column for the open list. */
class IntColumn {
  data = new Int32Array(1 << 16);
  length = 0;
  push(v: number): number {
    if (this.length === this.data.length) {
      const next = new Int32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length] = v;
    return this.length++;
  }
}

export function solveKlondike(state: KlondikeState, options: KlondikeSolveOptions = {}): KlondikeSolveResult {
  const maxNodes = options.maxNodes ?? DEFAULT_KLONDIKE_MAX_NODES;
  const maxLength = options.maxLength ?? Infinity;
  const weight = options.weight ?? 1;
  const deal = packKlondike(state);

  // Expanded positions are kept in full. Positions still waiting are just (parent, step, g):
  // most are never expanded, and they're rebuilt from the parent when they are.
  const nodePos: KPos[] = [];
  const nodeG: number[] = [];
  const nodeParent: number[] = [];
  const nodeStep: number[] = [];
  const expandedIndex = new Map<string, number>();
  const openParent = new IntColumn();
  const openStep = new IntColumn();
  const openG = new IntColumn();
  const buckets: number[][] = [];
  let lowestBucket = 0;
  let bestHome = cardsHome(deal.start);
  let bestNode = 0;

  const enqueue = (parent: number, step: number, g: number, f: number) => {
    const e = openParent.push(parent);
    openStep.push(step);
    openG.push(g);
    (buckets[f] ??= []).push(e);
    if (f < lowestBucket) lowestBucket = f;
  };
  enqueue(-1, 0, 0, Math.floor(weight * klondikeHeuristic(deal, deal.start)));

  let expanded = 0;
  while (lowestBucket < buckets.length) {
    const bucket = buckets[lowestBucket];
    if (!bucket || bucket.length === 0) {
      lowestBucket++;
      continue;
    }
    const e = bucket.pop()!;
    const parent = openParent.data[e];
    const code = openStep.data[e];
    const g = openG.data[e];
    let p = parent < 0 ? deal.start : applyStep(deal, nodePos[parent], unpackStep(code));
    const key = positionKey(p);
    let n = expandedIndex.get(key);
    if (n !== undefined && nodeG[n] <= g) continue;
    if (n === undefined) {
      n = nodeG.length;
      expandedIndex.set(key, n);
      nodePos.push(p);
      nodeG.push(g);
      nodeParent.push(parent);
      nodeStep.push(code);
    } else {
      // A shorter way to an expanded position (the heuristic isn't consistent): expand it again.
      // Keep the stored layout: queued steps from it name its column numbers.
      p = nodePos[n];
      nodeG[n] = g;
      nodeParent[n] = parent;
      nodeStep[n] = code;
    }

    const home = cardsHome(p);
    if (home > bestHome || (home === bestHome && g < nodeG[bestNode])) {
      bestHome = home;
      bestNode = n;
    }
    if (home === 52) {
      const moves = rebuild(n);
      return { status: 'solved', moves, exact: weight === 1, nodes: expanded, bestHome: 52, bestMoves: moves };
    }
    if (++expanded > maxNodes) return failed('budget');
    for (const step of listSteps(deal, p)) {
      const childG = g + step.cost;
      if (childG > maxLength) continue;
      const child = applyStep(deal, p, step);
      const h = klondikeHeuristic(deal, child);
      if (childG + h > maxLength) continue;
      enqueue(n, packStep(step), childG, Math.floor(childG + weight * h));
    }
  }
  return failed('unsolvable');

  function failed(status: 'budget' | 'unsolvable'): KlondikeSolveResult {
    return { status, moves: [], exact: status === 'unsolvable' && weight === 1, nodes: expanded, bestHome, bestMoves: rebuild(bestNode) };
  }

  function rebuild(goal: number): KlondikeSolverMove[] {
    const steps: KStep[] = [];
    for (let n = goal; nodeParent[n] !== -1; n = nodeParent[n]) steps.push(unpackStep(nodeStep[n]));
    return toEngineMoves(state, steps.reverse());
  }
}

/** Heuristic weights for the passes of `findKlondikeLine`, heaviest (fastest) first. */
const LINE_PASS_WEIGHTS = [5, 3, 2, 1.5, 1.25, 1];

export interface KlondikeLineResult {
  /** 'solved' when some pass found a win; 'unsolvable' when the first pass searched everything. */
  status: KlondikeSolveResult['status'];
  /** The shortest winning line found, or empty. */
  moves: KlondikeSolverMove[];
  /** True when the unweighted pass showed no shorter line exists (within the solver's moves). */
  exact: boolean;
  nodes: number;
  bestHome: number;
  /** When there's no win: the line that got the most cards home (see `KlondikeSolveResult`). */
  bestMoves: KlondikeSolverMove[];
}

/**
 * The best winning line the solver can find within `nodesPerPass` per pass. Each pass after the
 * first only looks for lines shorter than the best so far, which also makes it faster.
 */
export function findKlondikeLine(state: KlondikeState, nodesPerPass = DEFAULT_KLONDIKE_MAX_NODES): KlondikeLineResult {
  let best: KlondikeSolverMove[] | null = null;
  let exact = false;
  let nodes = 0;
  let bestHome = -1;
  let bestMoves: KlondikeSolverMove[] = [];
  for (const weight of LINE_PASS_WEIGHTS) {
    const result = solveKlondike(state, {
      weight,
      maxNodes: nodesPerPass,
      maxLength: best ? best.length - 1 : Infinity,
    });
    nodes += result.nodes;
    const further = result.bestHome > bestHome;
    if (!best && (further || (result.bestHome === bestHome && result.bestMoves.length < bestMoves.length))) {
      bestHome = result.bestHome;
      bestMoves = result.bestMoves;
    }
    if (result.status === 'solved') {
      best = result.moves;
      if (weight === 1) exact = true;
    } else if (result.status === 'unsolvable') {
      if (!best) return { status: 'unsolvable', moves: [], exact: false, nodes, bestHome, bestMoves };
      // Nothing shorter at this weight. Weighted passes can miss lines; the unweighted one can't.
      if (weight === 1) exact = true;
    }
  }
  return best
    ? { status: 'solved', moves: best, exact, nodes, bestHome: 52, bestMoves: best }
    : { status: 'budget', moves: [], exact: false, nodes, bestHome, bestMoves };
}
