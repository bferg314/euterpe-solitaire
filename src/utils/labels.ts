import type { DifficultyLevel, GameMode } from '../types/solitaire';

/** The one player-facing name for each game, used everywhere a mode is named. */
export function modeLabel(mode: GameMode): string {
  switch (mode) {
    case 'klondike-1':
      return 'Klondike Turn 1';
    case 'klondike-3':
      return 'Klondike Turn 3';
    case 'pyramid':
      return 'Pyramid';
  }
}

/** The one player-facing name for each difficulty. It matches the seed prefixes (EAS-, MED-, HAR-). */
export function difficultyLabel(difficulty: DifficultyLevel): string {
  switch (difficulty) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
    case 'daily':
      return 'Daily';
  }
}
