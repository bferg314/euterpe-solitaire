import type { OpenPlayingCardItem } from './openPlayingCards';

export type GameMode = 'klondike-1' | 'klondike-3' | 'pyramid';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'daily';

export interface SolitaireCard extends OpenPlayingCardItem {
  instanceId: string; // Unique instance id for tracking movements
  faceUp: boolean;
  resolvedImage?: string; // Resolved Blob URL or path
  resolvedVector?: string; // Resolved Blob URL or path
}

// Klondike State
export interface KlondikeState {
  tableau: SolitaireCard[][]; // 7 columns
  foundations: SolitaireCard[][]; // 4 piles (0: Spades, 1: Hearts, 2: Diamonds, 3: Clubs)
  stock: SolitaireCard[];
  waste: SolitaireCard[];
  passesRemaining?: number;
  drawCount: 1 | 3;
}

// Pyramid State
export interface PyramidPosition {
  row: number; // 0 to 6
  col: number; // 0 to row
}

export interface SelectedPyramidCard {
  source: 'pyramid' | 'waste' | 'stock';
  pos?: PyramidPosition;
  card: SolitaireCard;
}

export interface PyramidState {
  // 7 rows: row 0 has 1 card, row 6 has 7 cards. Cleared cards are null.
  pyramid: (SolitaireCard | null)[][];
  stock: SolitaireCard[];
  waste: SolitaireCard[];
  selectedCard: SelectedPyramidCard | null;
  clearedPairs: number;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  longestStreak: number;
  bestTimeSeconds: number | null;
  totalTimeSeconds: number;
  fewestMoves: number | null;
  highScore: number;
}

export interface MatchHistoryEntry {
  id: string;
  timestamp: number;
  gameMode: GameMode;
  difficulty: DifficultyLevel;
  seed: string;
  won: boolean;
  moves: number;
  timeSeconds: number;
  score: number;
}

export type ThemeId = 'midnight-velvet' | 'obsidian-royale' | 'casino-crimson' | 'nordic-frost' | 'cyber-silk';

export interface AppSettings {
  theme: ThemeId;
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  autoFinishEnabled: boolean;
  cardBackStyle: 'default' | 'burgundy' | 'sapphire' | 'emerald';
  animationsEnabled: boolean;
}
