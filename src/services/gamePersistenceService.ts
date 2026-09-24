import type {
  GameMode,
  DifficultyLevel,
  KlondikeState,
  PyramidState,
} from '../types/solitaire';

export const ACTIVE_GAME_STORAGE_KEY = 'euterpe_solitaire_active_game_v1';

export interface SavedGameSession {
  version: 1;
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  seed: string;
  moves: number;
  score: number;
  timeSeconds: number;
  par?: number;
  klondikeState: KlondikeState | null;
  pyramidState: PyramidState | null;
  klondikeHistory: KlondikeState[];
  klondikeFuture: KlondikeState[];
  pyramidHistory: PyramidState[];
  pyramidFuture: PyramidState[];
  savedAt: number;
}

/**
 * Saves the current active game state to localStorage
 */
export function saveActiveGame(session: Omit<SavedGameSession, 'version' | 'savedAt'>): void {
  try {
    const payload: SavedGameSession = {
      ...session,
      version: 1,
      savedAt: Date.now(),
    };
    localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save active game state to localStorage:', err);
  }
}

/**
 * Loads a saved active game state if one exists and has in-progress moves
 */
export function loadActiveGame(): SavedGameSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_STORAGE_KEY);
    if (!raw) return null;

    const parsed: SavedGameSession = JSON.parse(raw);
    if (parsed.version !== 1 || !parsed.gameMode || !parsed.seed) {
      return null;
    }

    // Only restore if there was an actual game with state
    if (
      (parsed.gameMode === 'pyramid' && !parsed.pyramidState) ||
      (parsed.gameMode !== 'pyramid' && !parsed.klondikeState)
    ) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn('Failed to parse saved game state:', err);
    return null;
  }
}

/**
 * Clears any saved active game state from localStorage
 */
export function clearActiveGame(): void {
  try {
    localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear active game state:', err);
  }
}

/**
 * Checks if a saved game exists in localStorage
 */
export function hasActiveGame(): boolean {
  try {
    return localStorage.getItem(ACTIVE_GAME_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
