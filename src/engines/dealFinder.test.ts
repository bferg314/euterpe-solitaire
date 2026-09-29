import { describe, expect, it } from 'vitest';
import { dealPyramid } from './pyramidEngine';
import { applyKlondikeSolverMove, dealKlondike, isKlondikeWon } from './klondikeEngine';
import { solvePyramid } from './solvers/pyramidSolver';
import { solveKlondike } from './solvers/klondikeSolver';
import {
  DEAL_SEARCH_MAX_NODES,
  KLONDIKE_DEAL_SEARCH_MAX_NODES,
  dailyCandidates,
  findWinnableDeal,
  findWinnableKlondikeDeal,
  findWinnablePyramidDeal,
} from './dealFinder';
import { loadTestDeck } from '../test/fixtures';

const deck = loadTestDeck();

// Known deals (see pyramidSolver.test.ts): TEST-4 can't be won; the rest have Ace lines of
// TEST-8: 52 (Easy), TEST-0: 59 (Medium), TEST-10: 66 (Hard) when dealt as Medium or Hard. Easy deals
// move a King into the bottom row, so dealt as Easy they differ: TEST-7 has a 59-move line, TEST-6 60.
describe('findWinnablePyramidDeal', () => {
  it('skips unwinnable and out-of-band deals for the one that fits', () => {
    expect(findWinnablePyramidDeal(deck, 'medium', ['TEST-4', 'TEST-8', 'TEST-0'])).toEqual({ seed: 'TEST-0', ace: 59, inBand: true });
    expect(findWinnablePyramidDeal(deck, 'hard', ['TEST-8', 'TEST-10'])).toEqual({ seed: 'TEST-10', ace: 66, inBand: true });
  }, 30_000);

  it('falls back to the closest winnable deal when none fits the band', () => {
    expect(findWinnablePyramidDeal(deck, 'hard', ['TEST-8', 'TEST-0'])).toEqual({ seed: 'TEST-0', ace: 59, inBand: false });
    expect(findWinnablePyramidDeal(deck, 'easy', ['TEST-4', 'TEST-6', 'TEST-7'])).toEqual({ seed: 'TEST-7', ace: 59, inBand: false });
  }, 30_000);

  it('returns null when none of the seeds can be won', () => {
    expect(findWinnablePyramidDeal(deck, 'medium', ['TEST-4', 'TEST-9'])).toBeNull();
  });

  it('walks the daily candidates in order to the first winnable deal, the same every time', () => {
    const candidates = dailyCandidates('DAILY-2026-10-08');
    expect(candidates.slice(0, 3)).toEqual(['DAILY-2026-10-08', 'DAILY-2026-10-08-2', 'DAILY-2026-10-08-3']);
    const first = findWinnablePyramidDeal(deck, 'daily', candidates);
    // That day's first two seeds can't be won, so the daily is the third.
    expect(first).toEqual({ seed: 'DAILY-2026-10-08-3', ace: 57, inBand: true });
    expect(solvePyramid(dealPyramid(deck, first!.seed, 'daily')).moves.length).toBe(first!.ace);
    for (const seed of candidates.slice(0, candidates.indexOf(first!.seed))) {
      expect(solvePyramid(dealPyramid(deck, seed, 'daily'), { maxNodes: DEAL_SEARCH_MAX_NODES }).status).not.toBe('solved');
    }
  }, 60_000);
});

// Known Klondike deals (see klondikeSolver.test.ts): dealt as Turn 3 Medium, BENCH-53 has no
// winning line and BENCH-84 has one. Turn 3 keeps these tests fast.
describe('findWinnableKlondikeDeal', () => {
  it("skips deals the solver can't win for the first one it can", () => {
    expect(findWinnableKlondikeDeal(deck, 'medium', 3, ['BENCH-53', 'BENCH-84'])).toEqual({ seed: 'BENCH-84', ace: null, inBand: true });
  });

  it('returns null when none of the seeds can be won', () => {
    expect(findWinnableKlondikeDeal(deck, 'medium', 3, ['BENCH-53'])).toBeNull();
  });

  it('walks the daily candidates in order to the first winnable deal, the same every time', () => {
    const candidates = dailyCandidates('DAILY-2026-09-29');
    const found = findWinnableKlondikeDeal(deck, 'daily', 3, candidates);
    // That day's first three Turn 3 deals have no winning line, so the daily is the fourth.
    expect(found).toEqual({ seed: 'DAILY-2026-09-29-4', ace: null, inBand: true });
    const deal = dealKlondike(deck, found!.seed, 3, 'daily');
    const line = solveKlondike(deal, { weight: 5, maxNodes: KLONDIKE_DEAL_SEARCH_MAX_NODES }).moves;
    const end = line.reduce((state, move) => applyKlondikeSolverMove(state, move)!, deal);
    expect(isKlondikeWon(end)).toBe(true);
  });

  it('findWinnableDeal runs the search for the game', () => {
    expect(findWinnableDeal(deck, 'klondike-3', 'medium', ['BENCH-53', 'BENCH-84'])?.seed).toBe('BENCH-84');
    expect(findWinnableDeal(deck, 'pyramid', 'medium', ['TEST-4', 'TEST-8', 'TEST-0'])?.seed).toBe('TEST-0');
  }, 30_000);
});
