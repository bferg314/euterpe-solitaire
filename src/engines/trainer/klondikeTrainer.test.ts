import { describe, expect, it } from 'vitest';
import type { KlondikeState, SolitaireCard } from '../../types/solitaire';
import type { RankId, SuitId } from '../../types/openPlayingCards';
import type { KlondikeSolverMove } from '../solvers/types';
import { applyKlondikeSolverMove, dealKlondike, isKlondikeWon } from '../klondikeEngine';
import { findKlondikeLine } from '../solvers/klondikeSolver';
import { loadTestDeck } from '../../test/fixtures';
import { findKlondikeSlips, klondikeImperative, klondikePastTense, klondikePrinciple } from './klondikeTrainer';

const deck = loadTestDeck();
const RANKS: RankId[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SYMBOLS: Record<SuitId, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', joker: '' } as Record<SuitId, string>;

function card(suit: SuitId, value: number, faceUp = true): SolitaireCard {
  const rank = RANKS[value - 1];
  return {
    id: `${suit}-${rank}`,
    instanceId: `${suit}-${rank}`,
    kind: 'standard',
    suit,
    rank,
    value,
    label: `${rank}${SYMBOLS[suit]}`,
    name: `${rank} of ${suit}`,
    color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
    order: 0,
    faceUp,
  };
}

function board(partial: Partial<KlondikeState>): KlondikeState {
  return { tableau: [[], [], [], [], [], [], []], foundations: [[], [], [], []], stock: [], waste: [], drawCount: 1, ...partial };
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

describe('move text', () => {
  const state = board({
    tableau: [[card('clubs', 9, false), card('spades', 7)], [card('hearts', 8)], [], [], [], [], []],
    stock: [card('clubs', 2, false), card('clubs', 3, false)],
    waste: [card('hearts', 1)],
    drawCount: 3,
  });
  it('names the cards and where they go', () => {
    const toEight: KlondikeSolverMove = { type: 'move', source: { pile: 'tableau', col: 0, index: 1 }, target: { pile: 'tableau', col: 1 } };
    expect(klondikePastTense(state, toEight)).toBe('Moved 7♠ onto 8♥');
    expect(klondikeImperative(state, toEight)).toBe('Move 7♠ onto 8♥');
    const home: KlondikeSolverMove = { type: 'move', source: { pile: 'waste' }, target: { pile: 'foundation', index: 1 } };
    expect(klondikePastTense(state, home)).toBe('Played A♥ to the foundation');
    // Only two cards are left in the stock, so a Turn 3 draw takes two.
    expect(klondikeImperative(state, { type: 'draw' })).toBe('Draw 2 cards');
  });
});

describe('klondikePrinciple', () => {
  it('Aces go home at once', () => {
    const state = board({ waste: [card('hearts', 1)] });
    const move: KlondikeSolverMove = { type: 'move', source: { pile: 'waste' }, target: { pile: 'foundation', index: 1 } };
    expect(klondikePrinciple(state, move, [])).toMatch(/^Aces go home at once/);
  });

  it('turning a card over, from the column hiding the most', () => {
    const state = board({
      tableau: [[card('clubs', 9, false), card('clubs', 10, false), card('spades', 7)], [card('hearts', 8)], [], [], [], [], []],
    });
    const move: KlondikeSolverMove = { type: 'move', source: { pile: 'tableau', col: 0, index: 2 }, target: { pile: 'tableau', col: 1 } };
    expect(klondikePrinciple(state, move, [])).toMatch(/column hiding the most/);
  });

  it('names the waste card a run of draws is for', () => {
    const state = board({ stock: [card('clubs', 1, false), card('hearts', 5, false)] });
    const following: KlondikeSolverMove[] = [
      { type: 'draw' },
      { type: 'move', source: { pile: 'waste' }, target: { pile: 'foundation', index: 3 } },
    ];
    expect(klondikePrinciple(state, { type: 'draw' }, following)).toBe('Drawing toward the A♣, which plays next.');
  });
});

describe('findKlondikeSlips', () => {
  // Turn 3 BENCH-84 solves in well under a second (see klondikeSolver.test.ts).
  const deal = dealKlondike(deck, 'BENCH-84', 3, 'medium');
  const line = findKlondikeLine(deal).moves;
  const options = { maxSlips: 3, nodesPerSolve: 5_000, totalNodes: 150_000 };

  it('every slip replays to a win, exactly its cost longer than the bot line', () => {
    const slips = findKlondikeSlips(deal, line, options);
    expect(slips.length).toBeGreaterThan(0);
    for (const slip of slips) {
      const moves = [...line.slice(0, slip.at), slip.move, ...slip.finish];
      expect(isKlondikeWon(replay(deal, moves))).toBe(true);
      expect(moves.length).toBe(line.length + slip.cost);
      expect(slip.cost).toBeGreaterThanOrEqual(2);
      expect(slip.lesson).toMatch(/instead of/);
    }
  });

  it('is deterministic for a given line', () => {
    expect(findKlondikeSlips(deal, line, options)).toEqual(findKlondikeSlips(deal, line, options));
  });
});

describe('best attempt', () => {
  it('a deal the bot cannot win still gets its furthest line, which replays legally', () => {
    const deal = dealKlondike(deck, 'BENCH-53', 3, 'medium');
    const result = findKlondikeLine(deal);
    expect(result.status).toBe('unsolvable');
    const end = replay(deal, result.bestMoves);
    expect(end.foundations.reduce((n, pile) => n + pile.length, 0)).toBe(result.bestHome);
  });
});
