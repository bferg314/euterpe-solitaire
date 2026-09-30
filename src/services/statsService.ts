import type { GameMode, DifficultyLevel, GameStats, MatchHistoryEntry } from '../types/solitaire';
import { calculateEfficiency } from '../utils/efficiencyRating';

const STATS_STORAGE_KEY = 'euterpe_solitaire_stats_v1';
const HISTORY_STORAGE_KEY = 'euterpe_solitaire_history_v1';
const DAILY_WINS_KEY = 'euterpe_solitaire_daily_wins_v1';

interface StatsDatabase {
  [key: string]: GameStats; // Format: `${gameMode}_${difficulty}`
}

function getStatsKey(mode: GameMode, difficulty: DifficultyLevel): string {
  return `${mode}_${difficulty}`;
}

const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  longestStreak: 0,
  bestTimeSeconds: null,
  totalTimeSeconds: 0,
  fewestMoves: null,
  highScore: 0,
  acesCount: 0,
  eaglesCount: 0,
  birdiesCount: 0,
  parsCount: 0,
  bogeysCount: 0,
};

export function getStats(mode: GameMode, difficulty: DifficultyLevel): GameStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const db: StatsDatabase = JSON.parse(raw);
    const key = getStatsKey(mode, difficulty);
    return db[key] ? { ...DEFAULT_STATS, ...db[key] } : { ...DEFAULT_STATS };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function recordGameResult(
  mode: GameMode,
  difficulty: DifficultyLevel,
  won: boolean,
  timeSeconds: number,
  moves: number,
  score: number,
  seed: string,
  par?: number,
  ace?: number | null
): void {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    const db: StatsDatabase = raw ? JSON.parse(raw) : {};
    const key = getStatsKey(mode, difficulty);
    const current = db[key] ? { ...DEFAULT_STATS, ...db[key] } : { ...DEFAULT_STATS };

    current.gamesPlayed += 1;

    let ratingTier: string | undefined;

    if (won) {
      current.gamesWon += 1;
      // Only wins count toward the average time.
      current.totalTimeSeconds += timeSeconds;
      current.currentStreak += 1;
      if (current.currentStreak > current.longestStreak) {
        current.longestStreak = current.currentStreak;
      }
      if (current.bestTimeSeconds === null || timeSeconds < current.bestTimeSeconds) {
        current.bestTimeSeconds = timeSeconds;
      }
      if (current.fewestMoves === null || moves < current.fewestMoves) {
        current.fewestMoves = moves;
      }
      if (score > current.highScore) {
        current.highScore = score;
      }

      // Record daily challenge win if applicable
      if (difficulty === 'daily') {
        recordDailyWin(seed);
      }

      // Record Par efficiency metrics
      if (par && par > 0) {
        const previouslyRated = ratedWins(current);
        const eff = calculateEfficiency(moves, par, ace, mode);
        ratingTier = eff.tier;
        if (eff.tier === 'ace') {
          current.acesCount = (current.acesCount || 0) + 1;
        } else if (eff.tier === 'eagle') {
          current.eaglesCount = (current.eaglesCount || 0) + 1;
        } else if (eff.tier === 'birdie') {
          current.birdiesCount = (current.birdiesCount || 0) + 1;
        } else if (eff.tier === 'par') {
          current.parsCount = (current.parsCount || 0) + 1;
        } else {
          current.bogeysCount = (current.bogeysCount || 0) + 1;
        }

        // Average over wins that had a Par only: a win without one says nothing about efficiency.
        const prevTotalEff = previouslyRated > 0 ? (current.averageEfficiency ?? 0) * previouslyRated : 0;
        current.averageEfficiency = Math.round((prevTotalEff + eff.efficiencyPct) / (previouslyRated + 1));
      }
    } else {
      current.currentStreak = 0;
    }

    db[key] = current;
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(db));

    // Also append to match history
    appendMatchHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      gameMode: mode,
      difficulty,
      seed,
      won,
      moves,
      timeSeconds,
      score,
      par,
      ace,
      ratingTier,
    });
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

/** Wins that had a Par, and so a rating tier. */
export function ratedWins(stats: GameStats): number {
  return (
    (stats.acesCount || 0) +
    (stats.eaglesCount || 0) +
    (stats.birdiesCount || 0) +
    (stats.parsCount || 0) +
    (stats.bogeysCount || 0)
  );
}

function appendMatchHistory(entry: MatchHistoryEntry): void {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const list: MatchHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    if (list.length > 100) {
      list.length = 100; // Keep last 100 matches
    }
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to append match history:', e);
  }
}

export function getMatchHistory(): MatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function recordDailyWin(seed: string): void {
  try {
    const raw = localStorage.getItem(DAILY_WINS_KEY);
    const wins: string[] = raw ? JSON.parse(raw) : [];
    if (!wins.includes(seed)) {
      wins.push(seed);
      localStorage.setItem(DAILY_WINS_KEY, JSON.stringify(wins));
    }
  } catch {
    // Ignore
  }
}

export function getDailyWins(): string[] {
  try {
    const raw = localStorage.getItem(DAILY_WINS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function resetAllStats(): void {
  localStorage.removeItem(STATS_STORAGE_KEY);
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  localStorage.removeItem(DAILY_WINS_KEY);
}

export function exportStatsJson(): string {
  const data = {
    stats: localStorage.getItem(STATS_STORAGE_KEY),
    history: localStorage.getItem(HISTORY_STORAGE_KEY),
    dailyWins: localStorage.getItem(DAILY_WINS_KEY),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export interface ImportResult {
  ok: boolean;
  /** Matches in the backup's history. */
  matches: number;
}

type BackupPart = readonly [key: string, raw: string];

/** The parts of a backup from `exportStatsJson` to write, or null when the file isn't a valid backup. */
function parseBackup(jsonStr: string): { parts: BackupPart[]; matches: number } | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;
    const checks = [
      [STATS_STORAGE_KEY, parsed.stats, (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)],
      [HISTORY_STORAGE_KEY, parsed.history, Array.isArray],
      [DAILY_WINS_KEY, parsed.dailyWins, Array.isArray],
    ] as const;
    const present = checks.filter(([, raw]) => raw !== undefined && raw !== null);
    if (present.length === 0) return null;
    const parts: BackupPart[] = [];
    let matches = 0;
    for (const [key, raw, isValid] of present) {
      if (typeof raw !== 'string') return null;
      const value = JSON.parse(raw);
      if (!isValid(value)) return null;
      if (key === HISTORY_STORAGE_KEY) matches = (value as unknown[]).length;
      parts.push([key, raw]);
    }
    return { parts, matches };
  } catch {
    return null;
  }
}

/** Checks a backup without writing anything, so the player can confirm before it replaces their stats. */
export function checkStatsBackup(jsonStr: string): ImportResult {
  const backup = parseBackup(jsonStr);
  return backup ? { ok: true, matches: backup.matches } : { ok: false, matches: 0 };
}

/** Restores a backup from `exportStatsJson`. Nothing is written unless the whole file checks out. */
export function importStatsJson(jsonStr: string): ImportResult {
  const backup = parseBackup(jsonStr);
  if (!backup) return { ok: false, matches: 0 };
  for (const [key, raw] of backup.parts) localStorage.setItem(key, raw);
  return { ok: true, matches: backup.matches };
}
