import { describe, expect, it } from 'vitest';
import type { KlondikeState, SolitaireCard } from '../../types/solitaire';
import type { RankId, SuitId } from '../../types/openPlayingCards';
import type { KlondikeSolverMove } from './types';
import { applyKlondikeMove, applyKlondikeSolverMove, dealKlondike, isKlondikeWon, type KlondikeMoveSource } from '../klondikeEngine';
import { findKlondikeLine, solveKlondike } from './klondikeSolver';
import { SeededRNG } from '../../services/rngService';
import { loadTestDeck } from '../../test/fixtures';

const deck = loadTestDeck();
const RANKS: RankId[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: SuitId[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function card(suit: SuitId, value: number, faceUp: boolean): SolitaireCard {
  const rank = RANKS[value - 1];
  return {
    id: `${suit}-${rank}`,
    instanceId: `${suit}-${rank}`,
    kind: 'standard',
    suit,
    rank,
    value,
    label: `${rank}${suit[0]}`,
    name: `${rank} of ${suit}`,
    color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
    order: 0,
    faceUp,
  };
}

function replay(state: KlondikeState, moves: KlondikeSolverMove[]): KlondikeState {
  let current = state;
  moves.forEach((move, i) => {
    const next = applyKlondikeSolverMove(current, move);
    if (!next) throw new Error(`Illegal move ${i}: ${JSON.stringify(move)}`);
    current = next;
  });
  return current;
}

/**
 * A late-game position: each suit home up to `found`, the rest dealt at random into the
 * tableau (face-down under one face-up card) and the stock.
 */
function endgame(seed: string, found: number[], drawCount: 1 | 3): KlondikeState {
  const rng = new SeededRNG(seed);
  const rest = rng.shuffle(SUITS.flatMap((suit, s) => RANKS.slice(found[s]).map((_, i) => card(suit, found[s] + i + 1, false))));
  const tableau: SolitaireCard[][] = [[], [], [], [], [], [], []];
  const stockSize = Math.floor(rest.length / 2);
  rest.slice(stockSize).forEach((c, i) => tableau[i % 4].push(c));
  for (const col of tableau) if (col.length > 0) col[col.length - 1].faceUp = true;
  return {
    tableau,
    foundations: SUITS.map((suit, s) => Array.from({ length: found[s] }, (_, i) => card(suit, i + 1, true))),
    stock: rest.slice(0, stockSize),
    waste: [],
    drawCount,
  };
}

/** Every legal move, straight from the engine's rules (no pruning). */
function legalMoves(state: KlondikeState): KlondikeSolverMove[] {
  const sources: KlondikeMoveSource[] = [{ pile: 'waste' }];
  state.tableau.forEach((col, c) => col.forEach((_, index) => sources.push({ pile: 'tableau', col: c, index })));
  state.foundations.forEach((_, index) => sources.push({ pile: 'foundation', index }));
  const moves: KlondikeSolverMove[] = [{ type: 'draw' }, { type: 'recycle' }];
  for (const source of sources) {
    for (let col = 0; col < 7; col++) moves.push({ type: 'move', source, target: { pile: 'tableau', col } });
    for (let index = 0; index < 4; index++) moves.push({ type: 'move', source, target: { pile: 'foundation', index } });
  }
  return moves.filter((m) => (m.type === 'move' ? applyKlondikeMove(state, m.source, m.target) : applyKlondikeSolverMove(state, m)));
}

// Column order doesn't matter to how many moves are left, so columns are sorted in the key.
const stateKey = (s: KlondikeState) =>
  JSON.stringify([
    s.tableau.map((col) => JSON.stringify(col, ['id', 'faceUp'])).sort(),
    [s.foundations, s.stock, s.waste].map((piles) => JSON.stringify(piles, ['id'])),
  ]);

const cardsLeft = (s: KlondikeState) => 52 - s.foundations.reduce((n, pile) => n + pile.length, 0);

/**
 * Reference search: every legal engine move, no pruning, and the simplest lower bound (each card
 * not yet home needs a move, and one move sends at most one card home). Slow but obviously
 * correct, for small positions.
 */
function referenceShortest(start: KlondikeState): number | null {
  const buckets: { state: KlondikeState; g: number }[][] = [];
  const best = new Map<string, number>();
  const push = (state: KlondikeState, g: number) => {
    const key = stateKey(state);
    if ((best.get(key) ?? Infinity) <= g) return;
    best.set(key, g);
    (buckets[g + cardsLeft(state)] ??= []).push({ state, g });
  };
  push(start, 0);
  for (let f = 0; f < buckets.length; f++) {
    for (let item = buckets[f]?.pop(); item; item = buckets[f].pop()) {
      if (best.get(stateKey(item.state))! < item.g) continue;
      if (isKlondikeWon(item.state)) return item.g;
      for (const m of legalMoves(item.state)) push(applyKlondikeSolverMove(item.state, m)!, item.g + 1);
    }
  }
  return null;
}

describe('solveKlondike', () => {
  it.each([
    ['END-1', 1],
    ['END-2', 1],
    ['END-3', 1],
    ['END-4', 3],
    ['END-5', 3],
    ['END-6', 3],
  ] as const)('%s (Turn %i): finds a shortest line, the same length as the reference search', (seed, drawCount) => {
    const position = endgame(seed, [9, 10, 10, 11], drawCount);
    const shortest = referenceShortest(position);
    const result = solveKlondike(position, { maxNodes: 1_000_000 });
    if (shortest === null) {
      expect(result.status).toBe('unsolvable');
    } else {
      expect(result.status).toBe('solved');
      expect(result.moves.length).toBe(shortest);
      expect(isKlondikeWon(replay(position, result.moves))).toBe(true);
    }
  });

  it('counts draws and recycles as moves', () => {
    // Only the stock is left, drawn one at a time: K♥ comes up first, then Q♥ after a recycle.
    const position: KlondikeState = {
      tableau: [[], [], [], [], [], [], []],
      foundations: SUITS.map((suit, s) => Array.from({ length: s === 1 ? 11 : 13 }, (_, i) => card(suit, i + 1, true))),
      stock: [card('hearts', 12, false), card('hearts', 13, false)],
      waste: [],
      drawCount: 1,
    };
    const result = solveKlondike(position);
    expect(result.moves.map((m) => m.type)).toEqual(['draw', 'draw', 'move', 'move']);
  });
});

describe('findKlondikeLine', () => {
  // Known results for fixed seeds (medium deals), measured with the default budget.
  it('Turn 3 BENCH-84: a winning line, proven shortest', () => {
    const deal = dealKlondike(deck, 'BENCH-84', 3, 'medium');
    const result = findKlondikeLine(deal);
    expect(result.status).toBe('solved');
    expect(result.exact).toBe(true);
    expect(result.moves.length).toBe(94);
    expect(isKlondikeWon(replay(deal, result.moves))).toBe(true);
  });

  it('Turn 3 BENCH-53: no winning line exists within the solver moves', () => {
    const result = findKlondikeLine(dealKlondike(deck, 'BENCH-53', 3, 'medium'));
    expect(result.status).toBe('unsolvable');
    expect(result.moves).toEqual([]);
  });

  it('is deterministic for a given deal', () => {
    const deal = dealKlondike(deck, 'BENCH-84', 3, 'medium');
    expect(findKlondikeLine(deal, 20_000)).toEqual(findKlondikeLine(deal, 20_000));
  });
});
