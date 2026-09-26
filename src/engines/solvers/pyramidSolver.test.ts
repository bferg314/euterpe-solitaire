import { describe, expect, it } from 'vitest';
import type { PyramidState, SolitaireCard } from '../../types/solitaire';
import type { PyramidCardRef, PyramidSolverMove } from './types';
import { applyPyramidMove, dealPyramid, isPyramidWon, resolvePyramidCard } from '../pyramidEngine';
import { solvePyramid } from './pyramidSolver';
import { loadTestDeck } from '../../test/fixtures';

const deck = loadTestDeck();

function replay(state: PyramidState, moves: PyramidSolverMove[]): PyramidState {
  let current = state;
  moves.forEach((move, i) => {
    const next = applyPyramidMove(current, move);
    if (!next) throw new Error(`Illegal move ${i}: ${JSON.stringify(move)}`);
    current = next;
  });
  return current;
}

/** Every legal move from a state, generated from the engine's own rules (no pruning). */
function legalMoves(state: PyramidState): PyramidSolverMove[] {
  const refs: PyramidCardRef[] = [{ from: 'waste' }];
  state.pyramid.forEach((row, r) => row.forEach((_, c) => refs.push({ from: 'pyramid', row: r, col: c })));
  const playable = refs.filter((ref) => resolvePyramidCard(state, ref));
  const candidates: PyramidSolverMove[] = [{ type: 'draw' }, { type: 'recycle' }];
  playable.forEach((a, i) => {
    candidates.push({ type: 'king', card: a });
    playable.slice(i + 1).forEach((b) => candidates.push({ type: 'pair', a, b }));
  });
  return candidates.filter((m) => applyPyramidMove(state, m));
}

const stateKey = (s: PyramidState) =>
  JSON.stringify([s.pyramid.map((row) => row.map((c) => (c ? 1 : 0))), s.stock.map((c) => c.id), s.waste.map((c) => c.id)]);

/** Plain breadth-first search: slow, but obviously correct, for small positions. */
function bruteForceShortest(start: PyramidState): number | null {
  let frontier = [start];
  const seen = new Set([stateKey(start)]);
  for (let depth = 0; frontier.length > 0; depth++) {
    const next: PyramidState[] = [];
    for (const s of frontier) {
      if (isPyramidWon(s)) return depth;
      for (const m of legalMoves(s)) {
        const t = applyPyramidMove(s, m)!;
        const k = stateKey(t);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(t);
        }
      }
    }
    frontier = next;
  }
  return null;
}

let seq = 0;
function card(value: number, faceUp = true): SolitaireCard {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
  const rank = ranks[value - 1];
  return {
    id: `x-${rank}-${seq}`,
    instanceId: `x-${rank}-${seq++}`,
    kind: 'standard',
    suit: 'spades',
    rank,
    value,
    label: rank,
    name: rank,
    color: 'black',
    order: 0,
    faceUp,
  };
}

/** A pyramid with only the listed positions filled, plus a small stock (drawn from its end). */
function position(cells: Record<string, number>, stock: number[], waste: number[] = []): PyramidState {
  const pyramid: (SolitaireCard | null)[][] = [];
  for (let r = 0; r < 7; r++) {
    pyramid[r] = [];
    for (let c = 0; c <= r; c++) pyramid[r][c] = cells[`${r},${c}`] ? card(cells[`${r},${c}`]) : null;
  }
  return {
    pyramid,
    stock: stock.map((v) => card(v, false)),
    waste: waste.map((v) => card(v)),
    selectedCard: null,
    clearedPairs: 0,
  };
}

describe('solvePyramid on hand-built positions', () => {
  const cases: [string, PyramidState][] = [
    ['two exposed cards that pair', position({ '6,0': 6, '6,1': 7 }, [])],
    ['a King on top of a pair', position({ '5,0': 13, '6,0': 1, '6,1': 12 }, [2])],
    ['needs the stock', position({ '6,0': 4, '6,3': 5 }, [9, 1, 8])],
    ['needs a recycle', position({ '6,0': 3 }, [10, 2, 5], [7])],
    ['stacked rows', position({ '4,1': 9, '5,1': 2, '5,2': 11, '6,1': 6, '6,2': 7, '6,3': 13 }, [4, 3, 12, 1])],
  ];

  it.each(cases)('%s: finds a shortest line', (_name, start) => {
    const result = solvePyramid(start);
    expect(result.status).toBe('solved');
    expect(isPyramidWon(replay(start, result.moves))).toBe(true);
    expect(result.moves.length).toBe(bruteForceShortest(start));
  });

  it('proves a dead position unsolvable', () => {
    // A 5 with no 8 anywhere can never be cleared.
    const result = solvePyramid(position({ '6,0': 5 }, [2, 3, 4]));
    expect(result.status).toBe('unsolvable');
    expect(result.moves).toEqual([]);
  });

  it('solves from a mid-game state (cards already in the waste)', () => {
    const start = position({ '6,0': 4, '6,1': 2 }, [11], [9, 1]);
    const result = solvePyramid(start);
    expect(result.status).toBe('solved');
    expect(isPyramidWon(replay(start, result.moves))).toBe(true);
    expect(result.moves.length).toBe(bruteForceShortest(start));
  });
});

describe('solvePyramid on real deals', () => {
  // A mix of winnable and unwinnable deals that each settle quickly.
  const seeds = ['TEST-0', 'TEST-4', 'TEST-6', 'TEST-8', 'TEST-9', 'TEST-10', 'TEST-16'];

  it('every solved line replays to a won board, and results are deterministic', () => {
    let solved = 0;
    for (const seed of seeds) {
      const deal = dealPyramid(deck, seed, 'medium');
      const result = solvePyramid(deal);
      expect(result.status).not.toBe('budget');
      if (result.status === 'unsolvable') expect(result.moves).toEqual([]);
      if (result.status === 'solved') {
        solved++;
        expect(isPyramidWon(replay(deal, result.moves))).toBe(true);
        expect(solvePyramid(deal).moves).toEqual(result.moves);
      }
    }
    expect(solved).toBeGreaterThan(0);
  });
});
