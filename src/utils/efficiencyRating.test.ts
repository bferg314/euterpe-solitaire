import { describe, expect, it } from 'vitest';
import { calculateEfficiency, parFromAce } from './efficiencyRating';

describe('parFromAce', () => {
  it('adds at least 3 moves of slack', () => {
    expect(parFromAce(20)).toBe(23);
    expect(parFromAce(37)).toBe(40);
  });

  it('adds about 8% on longer lines', () => {
    expect(parFromAce(50)).toBe(54);
    expect(parFromAce(100)).toBe(108);
  });

  it('always leaves Eagle (par − 2) above Ace', () => {
    for (let ace = 1; ace <= 200; ace++) expect(parFromAce(ace) - 2).toBeGreaterThan(ace);
  });
});

describe('calculateEfficiency ladder', () => {
  // ace 50 → par 54
  const tierFor = (moves: number, ace: number | null = 50) => calculateEfficiency(moves, 54, ace).tier;

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
    expect(calculateEfficiency(52, 54, 50).delta).toBe(-2);
    expect(calculateEfficiency(57, 54, 50).delta).toBe(3);
  });
});
