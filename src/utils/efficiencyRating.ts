import type { GameMode } from '../types/solitaire';
import type { EfficiencyResult, ParRatingTier } from '../types/par';

/**
 * How Par and the rating bands are set for a game.
 *
 * Par is the solver's best line (the Ace line) plus `slack`. Below Par the ladder runs in bands
 * of `band` moves: Par is the last band up to Par, Birdie the band below it, and Eagle anything
 * lower that still isn't the Ace line.
 *
 * - Klondike: a slip costs a move or two, so the ladder is golf-exact (band 1: Birdie is one
 *   under Par, Eagle two or more).
 * - Pyramid: missing a pair usually costs a whole pass through the stock (10–20 moves), so Par
 *   sits one typical slip above the Ace line and the bands are 4 moves wide.
 * The slack is always at least 2 bands + 1, so Eagle sits above Ace.
 */
interface ParLadder {
  slack: (ace: number) => number;
  band: number;
}

const KLONDIKE_LADDER: ParLadder = { slack: (ace) => Math.max(3, Math.round(ace * 0.08)), band: 1 };
const PYRAMID_LADDER: ParLadder = { slack: () => 16, band: 4 };

function ladderFor(mode: GameMode): ParLadder {
  return mode === 'pyramid' ? PYRAMID_LADDER : KLONDIKE_LADDER;
}

export function parFromAce(ace: number, mode: GameMode): number {
  return ace + ladderFor(mode).slack(ace);
}

/** The move counts that rate as each tier (Bogey is open-ended above Par). */
export function tierBounds(
  tier: ParRatingTier,
  ace: number,
  par: number,
  mode: GameMode
): { min: number; max: number } {
  const band = ladderFor(mode).band;
  switch (tier) {
    case 'ace':
      return { min: ace, max: ace };
    case 'eagle':
      return { min: ace + 1, max: par - 2 * band };
    case 'birdie':
      return { min: par - 2 * band + 1, max: par - band };
    case 'par':
      return { min: par - band + 1, max: par };
    case 'bogey':
      return { min: par + 1, max: Infinity };
  }
}

interface TierStyle {
  label: string;
  emblem: string;
  accentColor: string;
  bgGlow: string;
  description: string;
}

const TIERS: Record<ParRatingTier, TierStyle> = {
  ace: {
    label: 'Ace',
    emblem: '♠',
    accentColor: '#38bdf8', // Diamond sky blue
    bgGlow: 'rgba(56, 189, 248, 0.25)',
    description: 'Perfect routing! Matched the best line the solver could find for this deal.',
  },
  eagle: {
    label: 'Eagle',
    emblem: '🦅',
    accentColor: '#f59e0b', // Imperial Gold
    bgGlow: 'rgba(245, 158, 11, 0.25)',
    description: 'Exceptional economy! Well under Par.',
  },
  birdie: {
    label: 'Birdie',
    emblem: '🐦',
    accentColor: '#d4af37', // Antique Parlor Gold
    bgGlow: 'rgba(212, 175, 55, 0.25)',
    description: 'Sharp play! Under Par.',
  },
  par: {
    label: 'Par',
    emblem: '⛳',
    accentColor: '#10b981', // Emerald Felt
    bgGlow: 'rgba(16, 185, 129, 0.22)',
    description: 'Clean, disciplined solve! On Par.',
  },
  bogey: {
    label: 'Bogey',
    emblem: '🪵',
    accentColor: '#f97316', // Warm Amber Mahogany
    bgGlow: 'rgba(249, 115, 22, 0.2)',
    description: 'A win is a win! Over Par, so there were shorter routes to find.',
  },
};

/**
 * Rates a win against Par on the Ace / Eagle / Birdie / Par / Bogey ladder for its game.
 * `ace` is the solver's best line; without it (an estimated Par), Ace can't be awarded.
 */
export function calculateEfficiency(
  actualMoves: number,
  par: number,
  ace: number | null | undefined,
  mode: GameMode
): EfficiencyResult {
  const safeMoves = Math.max(1, actualMoves);
  const safePar = Math.max(1, par);
  const delta = safeMoves - safePar;
  const rawPct = Math.round((safePar / safeMoves) * 100);
  const efficiencyPct = Math.min(125, Math.max(10, rawPct));
  const band = ladderFor(mode).band;

  let tier: ParRatingTier;
  if (ace != null && safeMoves <= ace) tier = 'ace';
  else if (delta <= -2 * band) tier = 'eagle';
  else if (delta <= -band) tier = 'birdie';
  else if (delta <= 0) tier = 'par';
  else tier = 'bogey';

  return { tier, delta, efficiencyPct, ...TIERS[tier] };
}

/** A Par delta in words: "16 over Par", "4 under Par", "On Par". */
export function describeParDelta(delta: number): string {
  if (delta === 0) return 'On Par';
  return `${Math.abs(delta)} ${delta > 0 ? 'over' : 'under'} Par`;
}

/**
 * Formats a Par Delta as a golf-style string, e.g. -2, E, +4
 */
export function formatParDelta(delta: number): string {
  if (delta === 0) return 'E';
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}
