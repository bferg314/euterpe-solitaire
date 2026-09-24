import type { DifficultyLevel } from '../types/solitaire';

/**
 * High quality deterministic 32-bit Mulberry32 PRNG
 */
export class SeededRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? Math.floor(seed) : SeededRNG.hashString(seed);
    if (this.state === 0) {
      this.state = 1;
    }
  }

  /**
   * Hashes any string into a 32-bit signed integer
   */
  static hashString(str: string): number {
    let hash = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  /**
   * Returns a pseudo-random float in [0, 1)
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Deterministic Fisher-Yates shuffle
   */
  shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

/**
 * Generate a random readable seed string
 */
export function generateRandomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Formats daily challenge seed for today or a specific date
 */
export function getDailyChallengeSeed(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `DAILY-${y}-${m}-${d}`;
}

/**
 * Generates calibrated seed string for a difficulty level
 */
export function createSeedForDifficulty(difficulty: DifficultyLevel): string {
  if (difficulty === 'daily') {
    return getDailyChallengeSeed();
  }
  const prefix = difficulty.toUpperCase().slice(0, 3);
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
}
