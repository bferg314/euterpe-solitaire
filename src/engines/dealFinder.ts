import type { DifficultyLevel } from '../types/solitaire';
import type { LoadedDeck } from '../services/deckLoader';
import { dealPyramid } from './pyramidEngine';
import { solvePyramid } from './solvers/pyramidSolver';
import { createSeedForDifficulty } from '../services/rngService';

/**
 * Pyramid difficulty comes from the deal itself: the length of its shortest winning line
 * (the Ace line). Shorter lines need fewer passes through the stock. The cut-offs are the
 * thirds of winnable deals measured on 180 sample deals (about 55 and 60 moves).
 */
export const PYRAMID_DIFFICULTY_BANDS: Record<'easy' | 'medium' | 'hard', { min: number; max: number }> = {
  easy: { min: 0, max: 55 },
  medium: { min: 56, max: 60 },
  hard: { min: 61, max: Infinity },
};

export function pyramidBandFor(difficulty: DifficultyLevel): { min: number; max: number } | null {
  return difficulty === 'daily' ? null : PYRAMID_DIFFICULTY_BANDS[difficulty];
}

/**
 * Node cap per candidate. Well below the par solver's cap: a deal that's slow to settle is
 * simply skipped. Fixed, so the daily walk lands on the same deal on every machine.
 */
export const DEAL_SEARCH_MAX_NODES = 700_000;
const MAX_ATTEMPTS = 24;
const DAILY_WALK_LENGTH = 40;

/** Today's daily seed, then `-2`, `-3`, …: the daily is the first winnable one, for everyone. */
export function dailyCandidates(base: string): string[] {
  return [base, ...Array.from({ length: DAILY_WALK_LENGTH - 1 }, (_, i) => `${base}-${i + 2}`)];
}

export interface FoundDeal {
  seed: string;
  /** Length of the deal's shortest winning line. */
  ace: number;
  /** False when no candidate matched the difficulty band and this is the closest winnable one. */
  inBand: boolean;
}

/**
 * Finds a winnable Pyramid deal: tries `seeds` in order, or fresh random seeds for the
 * difficulty, until one has a winning line of the difficulty's length. If none match the band
 * in time, returns the closest winnable deal seen; null only if nothing winnable turned up.
 */
export function findWinnablePyramidDeal(
  deck: LoadedDeck,
  difficulty: DifficultyLevel,
  seeds?: string[]
): FoundDeal | null {
  const band = pyramidBandFor(difficulty);
  const candidates = seeds ?? Array.from({ length: MAX_ATTEMPTS }, () => createSeedForDifficulty(difficulty));
  let closest: FoundDeal | null = null;
  let closestGap = Infinity;

  for (const seed of candidates) {
    const result = solvePyramid(dealPyramid(deck, seed, difficulty), { maxNodes: DEAL_SEARCH_MAX_NODES });
    if (result.status !== 'solved') continue;
    const ace = result.moves.length;
    const gap = band ? Math.max(0, band.min - ace, ace - band.max) : 0;
    if (gap === 0) return { seed, ace, inBand: true };
    if (gap < closestGap) {
      closest = { seed, ace, inBand: false };
      closestGap = gap;
    }
  }
  return closest;
}
