import type { EfficiencyResult, ParRatingTier } from '../types/par';

/**
 * Calculates parlor efficiency ranking based on actual moves taken vs. theoretical Par
 */
export function calculateEfficiency(actualMoves: number, par: number): EfficiencyResult {
  const safeMoves = Math.max(1, actualMoves);
  const safePar = Math.max(1, par);
  const delta = safeMoves - safePar;
  const rawPct = Math.round((safePar / safeMoves) * 100);
  const efficiencyPct = Math.min(125, Math.max(10, rawPct));

  let tier: ParRatingTier;
  let label: string;
  let emblem: string;
  let accentColor: string;
  let bgGlow: string;
  let description: string;

  if (delta <= -3) {
    tier = 'albatross';
    label = 'Albatross';
    emblem = '🪶';
    accentColor = '#38bdf8'; // Diamond sky blue
    bgGlow = 'rgba(56, 189, 248, 0.25)';
    description = 'Legendary routing! Smashed the theoretical benchmark through extraordinary sequence foresight.';
  } else if (delta <= -1) {
    tier = 'eagle';
    label = 'Eagle';
    emblem = '🦅';
    accentColor = '#f59e0b'; // Imperial Gold
    bgGlow = 'rgba(245, 158, 11, 0.25)';
    description = 'Near-perfect execution! Outperformed the expected line with exceptional tactical economy.';
  } else if (delta === 0) {
    tier = 'birdie';
    label = 'Birdie';
    emblem = '🐦';
    accentColor = '#d4af37'; // Antique Parlor Gold
    bgGlow = 'rgba(212, 175, 55, 0.25)';
    description = 'Flawless precision! Matched the theoretical Par with razor-sharp efficiency.';
  } else if (delta <= 5) {
    tier = 'par';
    label = 'Par';
    emblem = '⛳';
    accentColor = '#10b981'; // Emerald Felt
    bgGlow = 'rgba(16, 185, 129, 0.22)';
    description = 'Clean, disciplined solve! Direct line to victory with virtually zero retracing.';
  } else if (delta <= 12) {
    tier = 'bogey';
    label = 'Bogey';
    emblem = '🪵';
    accentColor = '#f97316'; // Warm Amber Mahogany
    bgGlow = 'rgba(249, 115, 22, 0.2)';
    description = 'Solid perseverance! Navigated complex board tangles with measured trial-and-error.';
  } else {
    tier = 'double-bogey';
    label = 'Double Bogey';
    emblem = '🕯️';
    accentColor = '#94a3b8'; // Slate Silver
    bgGlow = 'rgba(148, 163, 184, 0.18)';
    description = 'Casual victory! Cycled deep into the deck to unknot an obstinate board.';
  }

  return {
    tier,
    label,
    emblem,
    delta,
    efficiencyPct,
    accentColor,
    bgGlow,
    description,
  };
}

/**
 * Formats a Par Delta as a golf-style string, e.g. -2, E, +4
 */
export function formatParDelta(delta: number): string {
  if (delta === 0) return 'E';
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}
