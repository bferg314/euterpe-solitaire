import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportStatsJson, getMatchHistory, getStats, importStatsJson, ratedWins, recordGameResult } from './statsService';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

const win = (moves: number, timeSeconds: number, par?: number) =>
  recordGameResult('klondike-1', 'medium', true, timeSeconds, moves, 1000, 'MED-1', par, null);
const loss = (moves: number, timeSeconds: number) =>
  recordGameResult('klondike-1', 'medium', false, timeSeconds, moves, 100, 'MED-2', 90, null);

describe('stats', () => {
  it('counts a loss as a game played and resets the streak', () => {
    win(100, 300);
    win(100, 300);
    loss(20, 60);
    const stats = getStats('klondike-1', 'medium');
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesWon).toBe(2);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(2);
    expect(getMatchHistory()[0].won).toBe(false);
  });

  it('averages time over wins only', () => {
    win(100, 300);
    loss(20, 900);
    expect(getStats('klondike-1', 'medium').totalTimeSeconds).toBe(300);
  });

  it('has no efficiency until a win with a Par is recorded', () => {
    expect(getStats('klondike-1', 'medium').averageEfficiency).toBeUndefined();
    win(100, 300);
    const stats = getStats('klondike-1', 'medium');
    expect(ratedWins(stats)).toBe(0);
    expect(stats.averageEfficiency).toBeUndefined();
  });

  it('averages efficiency over wins that had a Par', () => {
    win(90, 300, 90);
    const first = getStats('klondike-1', 'medium').averageEfficiency!;
    win(100, 300); // No Par: leaves the average alone.
    expect(getStats('klondike-1', 'medium').averageEfficiency).toBe(first);
    win(120, 300, 90);
    const stats = getStats('klondike-1', 'medium');
    expect(ratedWins(stats)).toBe(2);
    expect(stats.averageEfficiency).toBeLessThan(first);
  });
});

describe('backup import', () => {
  it('rejects a file that is not a backup, and changes nothing', () => {
    win(100, 300);
    expect(importStatsJson('{}')).toEqual({ ok: false, matches: 0 });
    expect(importStatsJson('{"stats":"[1,2]"}').ok).toBe(false);
    expect(importStatsJson('not json').ok).toBe(false);
    expect(getMatchHistory()).toHaveLength(1);
  });

  it('restores an exported backup and reports its match count', () => {
    win(100, 300);
    loss(20, 60);
    const backup = exportStatsJson();
    store.clear();
    expect(importStatsJson(backup)).toEqual({ ok: true, matches: 2 });
    expect(getStats('klondike-1', 'medium').gamesPlayed).toBe(2);
  });
});
