import type { PyramidState } from '../../types/solitaire';
import type { PyramidCardRef, PyramidSolverMove, SolveResult } from './types';

/*
 * Exact Pyramid solver.
 *
 * State: which of the 28 pyramid cards remain (bitmask), which reserve cards are gone
 * (bitmask), and the stock pointer. Drawing is one card at a time and a recycle turns the
 * waste back over in the same order, so the reserve keeps one fixed draw order R:
 * waste = remaining cards of R before the pointer, stock = remaining cards from it on.
 *
 * A* with the admissible, consistent bound in `heuristic` returns a shortest line in the
 * game's own move count: draw, recycle, King and pair each cost 1.
 */

const PYRAMID_SIZE = 28;
// About 2–4 s in a browser worker; deals still open after that are almost always unwinnable.
const DEFAULT_MAX_NODES = 2_000_000;

// Position index i = row*(row+1)/2 + col, for rows 0..6.
const ROW_OF: number[] = [];
const COL_OF: number[] = [];
const CHILDREN_MASK: number[] = [];
for (let row = 0, i = 0; row < 7; row++) {
  for (let col = 0; col <= row; col++, i++) {
    ROW_OF[i] = row;
    COL_OF[i] = col;
    const below = row + 1;
    const left = (below * (below + 1)) / 2 + col;
    CHILDREN_MASK[i] = row === 6 ? 0 : (1 << left) | (1 << (left + 1));
  }
}

// Cards that transitively cover i (BELOW) or that i transitively covers (ABOVE). A card can
// never pair with one in either cone: they are never both exposed at the same time.
const BELOW: number[] = [];
for (let i = PYRAMID_SIZE - 1; i >= 0; i--) {
  let cone = CHILDREN_MASK[i];
  for (let m = CHILDREN_MASK[i]; m !== 0; m &= m - 1) cone |= BELOW[31 - Math.clz32(m & -m)];
  BELOW[i] = cone;
}
const RELATED: number[] = [];
for (let i = 0; i < PYRAMID_SIZE; i++) {
  let above = 0;
  for (let j = 0; j < PYRAMID_SIZE; j++) if (BELOW[j] & (1 << i)) above |= 1 << j;
  RELATED[i] = BELOW[i] | above;
}

interface PackedDeal {
  pyramidValues: number[]; // by position index; 0 where already cleared
  reserveValues: number[]; // in draw order R
  startPyramid: number;
  startRemoved: number;
  startPointer: number;
}

/** Packs a game state (at any point in play) into the solver's numeric form. */
function packState(state: PyramidState): PackedDeal {
  const pyramidValues: number[] = [];
  let startPyramid = 0;
  for (let i = 0; i < PYRAMID_SIZE; i++) {
    const card = state.pyramid[ROW_OF[i]][COL_OF[i]];
    pyramidValues[i] = card?.value ?? 0;
    if (card) startPyramid |= 1 << i;
  }
  // Waste bottom→top has been drawn already; the stock is drawn from its end.
  const reserve = [...state.waste, ...[...state.stock].reverse()];
  return {
    pyramidValues,
    reserveValues: reserve.map((c) => c.value ?? 0),
    startPyramid,
    startRemoved: 0,
    startPointer: state.waste.length,
  };
}

const DEAD = Infinity;
const reserveCounts = new Array<number>(14);
const sideA: number[] = [];
const sideB: number[] = [];
const matchOfB: number[] = [];

/** Max matching between two small sets of positions, where a pair is allowed only if neither covers the other. */
function maxPyramidMatching(): number {
  matchOfB.length = sideB.length;
  matchOfB.fill(-1);
  const tryAugment = (a: number, seen: number): number => {
    for (let b = 0; b < sideB.length; b++) {
      if (seen & (1 << b) || RELATED[sideA[a]] & (1 << sideB[b])) continue;
      seen |= 1 << b;
      if (matchOfB[b] < 0) {
        matchOfB[b] = a;
        return seen;
      }
      const next = tryAugment(matchOfB[b], seen);
      if (next >= 0) {
        matchOfB[b] = a;
        return next;
      }
    }
    return -1;
  };
  let matched = 0;
  for (let a = 0; a < sideA.length; a++) if (tryAugment(a, 0) >= 0) matched++;
  return matched;
}

/**
 * Admissible, consistent lower bound on the moves left (DEAD if the position can't be won).
 *
 * Pyramid cards of value v pair with 13−v, from the pyramid or the reserve (never reserve
 * with reserve), and never with a card in their own cover cone. Pairing inside the pyramid as
 * much as possible, per value class, leaves `needReserve` cards that each take a reserve partner:
 *   moves ≥ kings + pyramid pairs + reserve pairs, and
 *   draws ≥ reserve partners needed − cards already in the waste (each stock card must be drawn).
 * If a class needs more reserve partners than remain, the position is dead.
 */
function heuristic(
  pyramid: number,
  removed: number,
  pointer: number,
  positionsByValue: number[],
  rv: number[]
): number {
  reserveCounts.fill(0);
  let wasteCards = 0;
  for (let r = 0; r < rv.length; r++) {
    if (removed & (1 << r)) continue;
    reserveCounts[rv[r]]++;
    if (r < pointer) wasteCards++;
  }
  const kings = popcount(pyramid & positionsByValue[13]);
  let pyramidPairs = 0;
  let needReserve = 0;
  for (let v = 1; v <= 6; v++) {
    const aMask = pyramid & positionsByValue[v];
    const bMask = pyramid & positionsByValue[13 - v];
    const a = popcount(aMask);
    const b = popcount(bMask);
    if (a === 0 && b === 0) continue;
    let paired = 0;
    if (a > 0 && b > 0) {
      fillSide(sideA, aMask);
      fillSide(sideB, bMask);
      paired = maxPyramidMatching();
    }
    // Leftover v's need reserve (13−v)'s, and vice versa.
    if (a - paired > reserveCounts[13 - v] || b - paired > reserveCounts[v]) return DEAD;
    pyramidPairs += paired;
    needReserve += a + b - 2 * paired;
  }
  return kings + pyramidPairs + needReserve + Math.max(0, needReserve - wasteCards);
}

function popcount(m: number): number {
  let n = 0;
  for (; m !== 0; m &= m - 1) n++;
  return n;
}

function fillSide(side: number[], mask: number) {
  side.length = 0;
  for (let m = mask; m !== 0; m &= m - 1) side.push(31 - Math.clz32(m & -m));
}

// Move codes stored per node: kind in the low 3 bits, operands above.
const DRAW = 0;
const RECYCLE = 1;
const KING_PYR = 2; // operand: position
const KING_WASTE = 3;
const PAIR_PYR = 4; // operands: two positions
const PAIR_WASTE = 5; // operand: position (paired with the waste top)

export interface PyramidSolveOptions {
  maxNodes?: number;
}

export function solvePyramid(state: PyramidState, options: PyramidSolveOptions = {}): SolveResult<PyramidSolverMove> {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const deal = packState(state);
  const { pyramidValues: pv, reserveValues: rv } = deal;
  const reserveCount = rv.length;
  const positionsByValue = new Array<number>(14).fill(0);
  pv.forEach((v, i) => {
    if (v) positionsByValue[v] |= 1 << i;
  });

  // Node storage (parallel arrays) and a map from state key to node index.
  const nodePyramid: number[] = [];
  const nodeRemoved: number[] = [];
  const nodePointer: number[] = [];
  const nodeG: number[] = [];
  const nodeParent: number[] = [];
  const nodeMove: number[] = [];
  const closed: boolean[] = [];

  // Pyramid masks are interned to small ids so the whole key fits a safe integer.
  const pyramidIds = new Map<number, number>();
  const keyOf = (pyramid: number, removed: number, pointer: number) => {
    let id = pyramidIds.get(pyramid);
    if (id === undefined) {
      id = pyramidIds.size;
      pyramidIds.set(pyramid, id);
    }
    return id * 2 ** 30 + removed * 32 + pointer;
  };
  const index = new Map<number, number>();
  const buckets: number[][] = [];
  let lowestBucket = 0;

  const push = (pyramid: number, removed: number, pointer: number, g: number, parent: number, move: number) => {
    const key = keyOf(pyramid, removed, pointer);
    const existing = index.get(key);
    if (existing !== undefined && (closed[existing] || nodeG[existing] <= g)) return;
    let n = existing;
    if (n === undefined) {
      n = nodeG.length;
      index.set(key, n);
      nodePyramid.push(pyramid);
      nodeRemoved.push(removed);
      nodePointer.push(pointer);
      nodeG.push(g);
      nodeParent.push(parent);
      nodeMove.push(move);
      closed.push(false);
    } else {
      nodeG[n] = g;
      nodeParent[n] = parent;
      nodeMove[n] = move;
    }
    const h = heuristic(pyramid, removed, pointer, positionsByValue, rv);
    if (h === DEAD) {
      closed[n] = true;
      return;
    }
    const f = g + h;
    (buckets[f] ??= []).push(n);
    if (f < lowestBucket) lowestBucket = f;
  };

  push(deal.startPyramid, deal.startRemoved, deal.startPointer, 0, -1, -1);

  let expanded = 0;
  while (lowestBucket < buckets.length) {
    const bucket = buckets[lowestBucket];
    if (!bucket || bucket.length === 0) {
      lowestBucket++;
      continue;
    }
    const n = bucket.pop()!;
    if (closed[n]) continue;
    closed[n] = true;

    const pyramid = nodePyramid[n];
    const removed = nodeRemoved[n];
    const pointer = nodePointer[n];
    const g = nodeG[n];

    if (pyramid === 0) {
      return { status: 'solved', moves: rebuild(n), exact: true, nodes: expanded };
    }
    if (++expanded > maxNodes) {
      return { status: 'budget', moves: [], exact: false, nodes: expanded };
    }

    // Exposed pyramid cards.
    const exposed: number[] = [];
    let exposedKing = -1;
    for (let m = pyramid; m !== 0; m &= m - 1) {
      const i = 31 - Math.clz32(m & -m);
      if ((CHILDREN_MASK[i] & pyramid) === 0) {
        exposed.push(i);
        if (pv[i] === 13 && exposedKing < 0) exposedKing = i;
      }
    }

    // A pyramid King must be cleared eventually and clearing it early only exposes more,
    // so when one is available it's the only move worth trying.
    if (exposedKing >= 0) {
      push(pyramid & ~(1 << exposedKing), removed, pointer, g + 1, n, KING_PYR | (exposedKing << 3));
      continue;
    }

    // Waste top: the last remaining reserve card before the pointer. Stock next: first from it.
    let wasteTop = -1;
    for (let r = pointer - 1; r >= 0; r--) {
      if (!(removed & (1 << r))) {
        wasteTop = r;
        break;
      }
    }
    let stockNext = -1;
    for (let r = pointer; r < reserveCount; r++) {
      if (!(removed & (1 << r))) {
        stockNext = r;
        break;
      }
    }

    for (let a = 0; a < exposed.length; a++) {
      const i = exposed[a];
      for (let b = a + 1; b < exposed.length; b++) {
        const j = exposed[b];
        if (pv[i] + pv[j] === 13) {
          push(pyramid & ~(1 << i) & ~(1 << j), removed, pointer, g + 1, n, PAIR_PYR | (i << 3) | (j << 8));
        }
      }
      if (wasteTop >= 0 && pv[i] + rv[wasteTop] === 13) {
        push(pyramid & ~(1 << i), removed | (1 << wasteTop), pointer, g + 1, n, PAIR_WASTE | (i << 3));
      }
    }
    if (wasteTop >= 0 && rv[wasteTop] === 13) {
      push(pyramid, removed | (1 << wasteTop), pointer, g + 1, n, KING_WASTE);
    }
    if (stockNext >= 0) {
      push(pyramid, removed, stockNext + 1, g + 1, n, DRAW);
    } else if (wasteTop >= 0) {
      push(pyramid, removed, 0, g + 1, n, RECYCLE);
    }
  }

  return { status: 'unsolvable', moves: [], exact: true, nodes: expanded };

  function rebuild(goal: number): PyramidSolverMove[] {
    const codes: number[] = [];
    for (let n = goal; nodeParent[n] !== -1; n = nodeParent[n]) codes.push(nodeMove[n]);
    codes.reverse();
    const at = (i: number): PyramidCardRef => ({ from: 'pyramid', row: ROW_OF[i], col: COL_OF[i] });
    return codes.map((code): PyramidSolverMove => {
      const kind = code & 7;
      const x = (code >> 3) & 31;
      const y = (code >> 8) & 31;
      switch (kind) {
        case DRAW:
          return { type: 'draw' };
        case RECYCLE:
          return { type: 'recycle' };
        case KING_PYR:
          return { type: 'king', card: at(x) };
        case KING_WASTE:
          return { type: 'king', card: { from: 'waste' } };
        case PAIR_PYR:
          return { type: 'pair', a: at(x), b: at(y) };
        default:
          return { type: 'pair', a: at(x), b: { from: 'waste' } };
      }
    });
  }
}

/**
 * Heuristic par estimate, used only until the solver answers (or if it can't).
 */
export function estimatePyramidPar(state: PyramidState): number {
  // Count total pyramid cards (28 in standard pyramid)
  let pyramidCardCount = 0;
  let kingsCount = 0;
  const values: number[] = [];

  for (const row of state.pyramid) {
    for (const card of row) {
      if (card && card.value !== null) {
        pyramidCardCount++;
        values.push(card.value);
        if (card.value === 13) kingsCount++;
      }
    }
  }

  if (pyramidCardCount === 0) return 0;

  // Kings require 1 single-card move each
  // Non-kings need pairs summing to 13
  const nonKings = pyramidCardCount - kingsCount;

  // Check how many complementary pairs exist strictly within the pyramid
  const valueCounts = new Map<number, number>();
  for (const v of values) {
    if (v !== 13) {
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    }
  }

  let internalPairs = 0;
  for (let v = 1; v <= 6; v++) {
    const comp = 13 - v;
    const c1 = valueCounts.get(v) || 0;
    const c2 = valueCounts.get(comp) || 0;
    const matched = Math.min(c1, c2);
    internalPairs += matched;
    valueCounts.set(v, c1 - matched);
    valueCounts.set(comp, c2 - matched);
  }

  // Cards that must pair with the stock/waste
  const remainingPyramidCards = nonKings - (internalPairs * 2);
  const stockNeededPairs = remainingPyramidCards; // Each remaining pyramid card pairs with 1 stock card

  // Minimum stock cycling moves needed to find those cards (avg 1.2 draws per required stock match)
  const estimatedStockDrawMoves = Math.round(stockNeededPairs * 1.25);

  // Par = Kings + internal pairs + stock-paired moves + stock draw moves
  const theoreticalPar = kingsCount + internalPairs + stockNeededPairs + estimatedStockDrawMoves;

  // Bound within realistic pyramid bounds (typically 18 - 34 moves)
  return Math.max(16, Math.min(42, theoreticalPar));
}
