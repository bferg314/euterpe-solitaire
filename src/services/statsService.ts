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
  averageEfficiency: 100,
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
  par?: number
): void {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    const db: StatsDatabase = raw ? JSON.parse(raw) : {};
    const key = getStatsKey(mode, difficulty);
    const current = db[key] ? { ...DEFAULT_STATS, ...db[key] } : { ...DEFAULT_STATS };

    current.gamesPlayed += 1;
    current.totalTimeSeconds += timeSeconds;

    let ratingTier: string | undefined;

    if (won) {
      current.gamesWon += 1;
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
        const eff = calculateEfficiency(moves, par);
        ratingTier = eff.tier;
        if (eff.tier === 'albatross' || eff.tier === 'eagle') {
          current.eaglesCount = (current.eaglesCount || 0) + 1;
        } else if (eff.tier === 'birdie') {
          current.birdiesCount = (current.birdiesCount || 0) + 1;
        } else if (eff.tier === 'par') {
          current.parsCount = (current.parsCount || 0) + 1;
        } else {
          current.bogeysCount = (current.bogeysCount || 0) + 1;
        }

        const prevTotalEff = (current.averageEfficiency || 100) * (current.gamesWon - 1);
        current.averageEfficiency = Math.round((prevTotalEff + eff.efficiencyPct) / current.gamesWon);
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
      ratingTier,
    });
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
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

export function importStatsJson(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.stats) localStorage.setItem(STATS_STORAGE_KEY, parsed.stats);
    if (parsed.history) localStorage.setItem(HISTORY_STORAGE_KEY, parsed.history);
    if (parsed.dailyWins) localStorage.setItem(DAILY_WINS_KEY, parsed.dailyWins);
    return true;
  } catch {
    return false;
  }
}
