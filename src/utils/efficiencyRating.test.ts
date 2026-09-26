import { describe, expect, it } from 'vitest';
import type { GameMode } from '../types/solitaire';
import { calculateEfficiency, parFromAce, tierBounds } from './efficiencyRating';

describe('parFromAce', () => {
  it('Klondike: adds at least 3 moves, or about 8% on longer lines', () => {
    expect(parFromAce(20, 'klondike-1')).toBe(23);
    expect(parFromAce(37, 'klondike-1')).toBe(40);
    expect(parFromAce(100, 'klondike-3')).toBe(108);
  });

  it('Pyramid: adds one typical slip (16 moves)', () => {
    expect(parFromAce(51, 'pyramid')).toBe(67);
  });

  it.each<GameMode>(['klondike-1', 'klondike-3', 'pyramid'])('%s: Eagle always sits above Ace', (mode) => {
    for (let ace = 1; ace <= 200; ace++) {
      const par = parFromAce(ace, mode);
      expect(tierBounds('eagle', ace, par, mode).max).toBeGreaterThan(ace);
    }
  });
});

describe('calculateEfficiency, Klondike (golf-exact ladder)', () => {
  // ace 50 → par 54
  const tierFor = (moves: number, ace: number | null = 50) => calculateEfficiency(moves, 54, ace, 'klondike-1').tier;

  it('awards Ace at or under the best line', () => {
    expect(tierFor(50)).toBe('ace');
    expect(tierFor(48)).toBe('ace');
  });

  it('rates Eagle, Birdie, Par and Bogey against par', () => {
    expect(tierFor(51)).toBe('eagle');
    expect(tierFor(52)).toBe('eagle');
    expect(tierFor(53)).toBe('birdie');
    expect(tierFor(54)).toBe('par');
    expect(tierFor(55)).toBe('bogey');
    expect(tierFor(90)).toBe('bogey');
  });

  it('never awards Ace when par is only an estimate', () => {
    expect(tierFor(40, null)).toBe('eagle');
  });

  it('reports the delta against par', () => {
    expect(calculateEfficiency(52, 54, 50, 'klondike-1').delta).toBe(-2);
    expect(calculateEfficiency(57, 54, 50, 'klondike-1').delta).toBe(3);
  });
});

describe('calculateEfficiency, Pyramid (4-move bands)', () => {
  // ace 51 → par 67
  const tierFor = (moves: number) => calculateEfficiency(moves, 67, 51, 'pyramid').tier;

  it('rates each band', () => {
    expect(tierFor(51)).toBe('ace');
    expect(tierFor(52)).toBe('eagle');
    expect(tierFor(59)).toBe('eagle');
    expect(tierFor(60)).toBe('birdie');
    expect(tierFor(63)).toBe('birdie');
    expect(tierFor(64)).toBe('par');
    expect(tierFor(67)).toBe('par');
    expect(tierFor(68)).toBe('bogey');
  });

  it('matches tierBounds', () => {
    for (let moves = 51; moves <= 90; moves++) {
      const tier = tierFor(moves);
      const { min, max } = tierBounds(tier, 51, 67, 'pyramid');
      expect(moves).toBeGreaterThanOrEqual(min);
      expect(moves).toBeLessThanOrEqual(max);
    }
  });
});
