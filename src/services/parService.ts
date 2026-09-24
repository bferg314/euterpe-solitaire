import type { GameMode, DifficultyLevel, KlondikeState, PyramidState } from '../types/solitaire';
import type { CachedParRecord } from '../types/par';
import { calculateKlondikePar } from '../engines/solvers/klondikeSolver';
import { calculatePyramidPar } from '../engines/solvers/pyramidSolver';

const PAR_CACHE_KEY = 'euterpe_solitaire_par_cache_v1';

interface ParDatabase {
  [seedKey: string]: CachedParRecord;
}

function getCacheKey(mode: GameMode, difficulty: DifficultyLevel, seed: string): string {
  return `${mode}_${difficulty}_${seed}`;
}

function readCache(): ParDatabase {
  try {
    const raw = localStorage.getItem(PAR_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(db: ParDatabase): void {
  try {
    localStorage.setItem(PAR_CACHE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Failed to save Par cache to localStorage:', err);
  }
}

/**
 * Gets cached Par or deterministically computes it based on the board state
 */
export function getOrComputePar(
  mode: GameMode,
  difficulty: DifficultyLevel,
  seed: string,
  klondikeState?: KlondikeState | null,
  pyramidState?: PyramidState | null
): number {
  const cacheKey = getCacheKey(mode, difficulty, seed);
  const db = readCache();

  if (db[cacheKey] && typeof db[cacheKey].par === 'number') {
    return db[cacheKey].par;
  }

  let par = 82; // Fallback sensible default

  if (mode === 'pyramid') {
    if (pyramidState) {
      par = calculatePyramidPar(pyramidState);
    } else {
      par = 24; // Average pyramid par
    }
  } else {
    if (klondikeState) {
      par = calculateKlondikePar(klondikeState, mode, difficulty);
    } else {
      par = mode === 'klondike-3' ? 96 : 84;
    }
  }

  // Cache the computed par
  db[cacheKey] = {
    par,
    isExact: true,
    computedAt: Date.now(),
  };
  writeCache(db);

  return par;
}

/**
 * Retrieves cached Par for a given seed, if available
 */
export function getCachedPar(
  mode: GameMode,
  difficulty: DifficultyLevel,
  seed: string
): number | null {
  const cacheKey = getCacheKey(mode, difficulty, seed);
  const db = readCache();
  return db[cacheKey]?.par ?? null;
}
