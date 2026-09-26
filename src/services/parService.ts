import type { GameMode, DifficultyLevel, KlondikeState, PyramidState } from '../types/solitaire';
import type { CachedParRecord, ParInfo } from '../types/par';
import { estimateKlondikePar } from '../engines/solvers/klondikeSolver';
import { estimatePyramidPar } from '../engines/solvers/pyramidSolver';
import { parFromAce } from '../utils/efficiencyRating';
import { solvePyramidAsync } from './solverClient';

// v2: Par comes from solved lines. v1 held heuristic estimates and is ignored.
const PAR_CACHE_KEY = 'euterpe_solitaire_par_cache_v2';

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

function writeCacheRecord(key: string, info: ParInfo): void {
  try {
    const db = readCache();
    db[key] = { ...info, computedAt: Date.now() };
    localStorage.setItem(PAR_CACHE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Failed to save Par cache to localStorage:', err);
  }
}

/** Par already worked out for this deal, if any. */
export function getCachedParInfo(mode: GameMode, difficulty: DifficultyLevel, seed: string): ParInfo | null {
  const record = readCache()[getCacheKey(mode, difficulty, seed)];
  if (!record || typeof record.par !== 'number') return null;
  return { par: record.par, ace: record.ace ?? null, isExact: record.isExact };
}

/** Heuristic Par for when no winning line is known. */
export function estimateParInfo(
  mode: GameMode,
  difficulty: DifficultyLevel,
  initialKlondike: KlondikeState | null,
  initialPyramid: PyramidState | null
): ParInfo {
  const par =
    mode === 'pyramid'
      ? initialPyramid
        ? estimatePyramidPar(initialPyramid)
        : 24
      : initialKlondike
      ? estimateKlondikePar(initialKlondike, mode, difficulty)
      : mode === 'klondike-3'
      ? 96
      : 84;
  return { par, ace: null, isExact: false };
}

/**
 * Par for a deal from its initial layout. Pyramid deals are solved exactly in the solver
 * worker; Klondike uses the heuristic estimate until its solver lands. Results are cached,
 * so each deal is only solved once. Resolves null if a newer request superseded this one.
 */
export async function computeParInfo(
  mode: GameMode,
  difficulty: DifficultyLevel,
  seed: string,
  initialKlondike: KlondikeState | null,
  initialPyramid: PyramidState | null
): Promise<ParInfo | null> {
  const cached = getCachedParInfo(mode, difficulty, seed);
  if (cached) return cached;

  if (mode !== 'pyramid' || !initialPyramid) {
    return estimateParInfo(mode, difficulty, initialKlondike, initialPyramid);
  }

  const result = await solvePyramidAsync(initialPyramid, { channel: 'par' });
  if (!result) return null;

  const info: ParInfo =
    result.status === 'solved'
      ? { par: parFromAce(result.moves.length), ace: result.moves.length, isExact: true }
      : estimateParInfo(mode, difficulty, null, initialPyramid);
  // Unwinnable and out-of-budget deals are cached too: re-solving them would give the same answer.
  writeCacheRecord(getCacheKey(mode, difficulty, seed), info);
  return info;
}
