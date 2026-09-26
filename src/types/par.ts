export type ParRatingTier = 'ace' | 'eagle' | 'birdie' | 'par' | 'bogey';

export interface EfficiencyResult {
  tier: ParRatingTier;
  label: string;
  emblem: string;
  delta: number; // actualMoves - par
  efficiencyPct: number; // (par / actualMoves) * 100
  accentColor: string;
  bgGlow: string;
  description: string;
}

/** Par for one deal, as shown in the header and used for ratings. */
export interface ParInfo {
  par: number;
  /** Length of the solver's best winning line; null when no line is known. */
  ace: number | null;
  /** False when Par is a heuristic estimate rather than derived from a solved line. */
  isExact: boolean;
}

export interface CachedParRecord extends ParInfo {
  computedAt: number;
}
