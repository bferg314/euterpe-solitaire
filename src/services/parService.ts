import type { GameMode, DifficultyLevel, KlondikeState, PyramidState } from '../types/solitaire';
import type { CachedParRecord, ParInfo } from '../types/par';
import { estimateKlondikePar } from '../engines/solvers/klondikeSolver';
import { estimatePyramidPar } from '../engines/solvers/pyramidSolver';
import { parFromAce, parFromSolverLine } from '../utils/efficiencyRating';
import { findKlondikeLineAsync, solvePyramidAsync } from './solverClient';

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
  // Par is derived from the stored Ace line, so a change to the par formula applies to cached deals too.
  const ace = record.ace ?? null;
  if (record.isExact && ace != null) return { par: parFromAce(ace, mode), ace, isExact: true, winnable: true };
  if (record.line != null) return { par: parFromSolverLine(record.line), ace: null, isExact: false, winnable: true, line: record.line };
  return { par: record.par, ace, isExact: record.isExact, winnable: record.winnable ?? null };
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
  return { par, ace: null, isExact: false, winnable: null };
}

/**
 * Par for a deal from its initial layout, worked out in the solver worker and cached, so each
 * deal is only solved once. Resolves null if a newer request superseded this one.
 * - Pyramid: exact, from the shortest line; estimated if the solver finds no line.
 * - Klondike: always an estimate, from the best line the solver finds (it can't prove lines
 *   shortest in time), or the heuristic if it finds none. It never calls a Klondike deal
 *   unwinnable: its search skips some rarely useful moves, so "no line" isn't proof.
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

  if (mode !== 'pyramid') {
    if (!initialKlondike) return estimateParInfo(mode, difficulty, null, null);
    const line = await findKlondikeLineAsync(initialKlondike, { channel: 'par' });
    if (!line) return null;
    const info: ParInfo =
      line.status === 'solved'
        ? { par: parFromSolverLine(line.moves.length), ace: null, isExact: false, winnable: true, line: line.moves.length }
        : estimateParInfo(mode, difficulty, initialKlondike, null);
    writeCacheRecord(getCacheKey(mode, difficulty, seed), info);
    return info;
  }
  if (!initialPyramid) return estimateParInfo(mode, difficulty, null, null);

  const result = await solvePyramidAsync(initialPyramid, { channel: 'par' });
  if (!result) return null;

  const info: ParInfo =
    result.status === 'solved'
      ? { par: parFromAce(result.moves.length, mode), ace: result.moves.length, isExact: true, winnable: true }
      : { ...estimateParInfo(mode, difficulty, null, initialPyramid), winnable: result.status === 'unsolvable' ? false : null };
  // Unwinnable and out-of-budget deals are cached too: re-solving them would give the same answer.
  writeCacheRecord(getCacheKey(mode, difficulty, seed), info);
  return info;
}

/** Records Par for a deal whose Ace line is already known (e.g. found by the winnable-deal search). */
export function rememberSolvedPar(mode: GameMode, difficulty: DifficultyLevel, seed: string, ace: number): void {
  writeCacheRecord(getCacheKey(mode, difficulty, seed), {
    par: parFromAce(ace, mode),
    ace,
    isExact: true,
    winnable: true,
  });
}
