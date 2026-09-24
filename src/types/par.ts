import type { GameMode, DifficultyLevel } from './solitaire';

export type ParRatingTier =
  | 'albatross'
  | 'eagle'
  | 'birdie'
  | 'par'
  | 'bogey'
  | 'double-bogey';

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

export interface CachedParRecord {
  par: number;
  isExact: boolean;
  computedAt: number;
}

export interface SolverWorkerRequest {
  taskId: string;
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  seed: string;
  initialStockCount: number;
  pyramidCardValues?: number[]; // Values of pyramid cards if Pyramid
}

export interface SolverWorkerResponse {
  taskId: string;
  par: number;
  isExact: boolean;
}
