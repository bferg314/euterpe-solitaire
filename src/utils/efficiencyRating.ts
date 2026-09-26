import type { EfficiencyResult, ParRatingTier } from '../types/par';

/**
 * Par is the solver's best line (the Ace line) plus some slack: a strong human line.
 * The slack is at least 3 so Eagle (par − 2) always sits above Ace.
 */
export const PAR_SLACK_MIN = 3;
export const PAR_SLACK_RATIO = 0.08;

export function parFromAce(ace: number): number {
  return ace + Math.max(PAR_SLACK_MIN, Math.round(ace * PAR_SLACK_RATIO));
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
    description: 'Exceptional economy! Two or more moves under Par.',
  },
  birdie: {
    label: 'Birdie',
    emblem: '🐦',
    accentColor: '#d4af37', // Antique Parlor Gold
    bgGlow: 'rgba(212, 175, 55, 0.25)',
    description: 'Sharp play! One move under Par.',
  },
  par: {
    label: 'Par',
    emblem: '⛳',
    accentColor: '#10b981', // Emerald Felt
    bgGlow: 'rgba(16, 185, 129, 0.22)',
    description: 'Clean, disciplined solve! Right on Par.',
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
 * Rates a win against Par on the Ace / Eagle / Birdie / Par / Bogey ladder.
 * `ace` is the solver's best line; without it (an estimated Par), Ace can't be awarded.
 */
export function calculateEfficiency(actualMoves: number, par: number, ace?: number | null): EfficiencyResult {
  const safeMoves = Math.max(1, actualMoves);
  const safePar = Math.max(1, par);
  const delta = safeMoves - safePar;
  const rawPct = Math.round((safePar / safeMoves) * 100);
  const efficiencyPct = Math.min(125, Math.max(10, rawPct));

  let tier: ParRatingTier;
  if (ace != null && safeMoves <= ace) tier = 'ace';
  else if (delta <= -2) tier = 'eagle';
  else if (delta === -1) tier = 'birdie';
  else if (delta === 0) tier = 'par';
  else tier = 'bogey';

  return { tier, delta, efficiencyPct, ...TIERS[tier] };
}

/**
 * Formats a Par Delta as a golf-style string, e.g. -2, E, +4
 */
export function formatParDelta(delta: number): string {
  if (delta === 0) return 'E';
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}
