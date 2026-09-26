import { describe, expect, it } from 'vitest';
import type { PyramidState } from '../../types/solitaire';
import { applyPyramidMove, dealPyramid, isPyramidWon } from '../pyramidEngine';
import { loadTestDeck } from '../../test/fixtures';
import { buildPyramidTierLines, TRAINER_TIERS, type TierLinesResult } from './lineBuilder';

const deck = loadTestDeck();

function expectWinningLines(deal: PyramidState, result: TierLinesResult) {
  for (const line of result.lines) {
    let state = deal;
    for (const step of line.steps) {
      const next = applyPyramidMove(state, step.move);
      expect(next, `${line.tier}: illegal move`).not.toBeNull();
      state = next!;
    }
    expect(isPyramidWon(state), `${line.tier} should win`).toBe(true);
    // Never longer than the tier allows, and the lessons account for every extra move.
    expect(line.steps.length).toBeLessThanOrEqual(line.max);
    const lessonCost = line.steps.reduce((sum, s) => sum + (s.cost ?? 0), 0);
    expect(lessonCost, `${line.tier} lesson costs`).toBe(line.steps.length - result.ace);
  }
  const ace = result.lines.find((l) => l.tier === 'ace')!;
  expect(ace.steps.some((s) => s.lesson)).toBe(false);
}

describe('buildPyramidTierLines', () => {
  // TEST-16 and TEST-18 have few cheap slips; Pyramid's wider bands still leave every tier reachable.
  it.each(['TEST-7', 'TEST-8', 'TEST-16', 'TEST-18'])('%s: every tier wins with a move count that earns its rating', (seed) => {
    const deal = dealPyramid(deck, seed, 'medium');
    const result = buildPyramidTierLines(deal, seed);
    expect(result.status).toBe('solved');
    expect(result.lines.map((l) => l.tier)).toEqual(TRAINER_TIERS);
    expectWinningLines(deal, result);
    for (const line of result.lines) {
      expect(line.steps.length, `${line.tier} length`).toBeGreaterThanOrEqual(line.min);
    }
    // Strictly shorter from Bogey to Ace.
    const lengths = result.lines.map((l) => l.steps.length);
    expect(new Set(lengths).size).toBe(lengths.length);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
  }, 30_000);

  it('streams the Ace line first, then the rest', () => {
    const order: string[] = [];
    buildPyramidTierLines(dealPyramid(deck, 'TEST-7', 'medium'), 'TEST-7', (line) => order.push(line.tier));
    expect(order[0]).toBe('ace');
    expect([...order].sort()).toEqual([...TRAINER_TIERS].sort());
  }, 30_000);

  it('is deterministic for a given seed', () => {
    const deal = dealPyramid(deck, 'TEST-8', 'medium');
    expect(buildPyramidTierLines(deal, 'TEST-8')).toEqual(buildPyramidTierLines(deal, 'TEST-8'));
  }, 30_000);

  it('reports an unwinnable deal', () => {
    const result = buildPyramidTierLines(dealPyramid(deck, 'TEST-4', 'medium'), 'TEST-4');
    expect(result.status).toBe('unsolvable');
    expect(result.lines).toEqual([]);
  });
});
