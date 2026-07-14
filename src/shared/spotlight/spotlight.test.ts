import { describe, it, expect } from 'vitest';
import {
  dayIndex,
  weekIndex,
  dailyGame,
  weeklyGames,
  isSpotlit,
  WEEKLY_COUNT,
} from './spotlight.js';

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p']; // 16 games

describe('dayIndex / weekIndex', () => {
  it('are monotonic UTC counters', () => {
    const d0 = new Date('2026-07-14T00:00:00Z');
    const d1 = new Date('2026-07-15T00:00:00Z');
    expect(dayIndex(d1)).toBe(dayIndex(d0) + 1);
    expect(weekIndex(d1) - weekIndex(d0)).toBeLessThanOrEqual(1);
  });

  it('the week counter advances once per 7 days', () => {
    const d = new Date('2026-07-14T00:00:00Z');
    const plus7 = new Date(d.getTime() + 7 * 86_400_000);
    expect(weekIndex(plus7)).toBe(weekIndex(d) + 1);
  });
});

describe('dailyGame', () => {
  it('is deterministic for a given day', () => {
    const d = new Date('2026-07-14T09:00:00Z');
    expect(dailyGame(POOL, d)).toBe(dailyGame(POOL, d));
  });

  it('is null for an empty pool', () => {
    expect(dailyGame([], new Date())).toBeNull();
  });

  it('does not repeat until the whole pool has cycled', () => {
    const seen = new Set<string>();
    const base = new Date('2026-07-14T00:00:00Z').getTime();
    for (let day = 0; day < POOL.length; day++) {
      const g = dailyGame(POOL, new Date(base + day * 86_400_000))!;
      expect(seen.has(g)).toBe(false);
      seen.add(g);
    }
    expect(seen.size).toBe(POOL.length);
  });
});

describe('weeklyGames', () => {
  it('returns exactly WEEKLY_COUNT distinct games', () => {
    const games = weeklyGames(POOL, WEEKLY_COUNT, new Date('2026-07-14T00:00:00Z'));
    expect(games).toHaveLength(WEEKLY_COUNT);
    expect(new Set(games).size).toBe(WEEKLY_COUNT);
  });

  it('is deterministic for a given week', () => {
    const d = new Date('2026-07-14T00:00:00Z');
    expect(weeklyGames(POOL, WEEKLY_COUNT, d)).toEqual(weeklyGames(POOL, WEEKLY_COUNT, d));
  });

  it('rotates: consecutive weeks share no game until the pool is exhausted', () => {
    const base = new Date('2026-07-14T00:00:00Z').getTime();
    const w0 = weeklyGames(POOL, 7, new Date(base));
    const w1 = weeklyGames(POOL, 7, new Date(base + 7 * 86_400_000));
    // 16 games, 7/week → the first two weeks (14 games) must not overlap.
    expect(w0.filter((g) => w1.includes(g))).toHaveLength(0);
  });

  it('caps at the pool size for a small pool', () => {
    expect(weeklyGames(['x', 'y'], 7, new Date())).toHaveLength(2);
    expect(weeklyGames([], 7, new Date())).toEqual([]);
  });
});

describe('isSpotlit', () => {
  it('flags the daily pick and the weekly set consistently', () => {
    const d = new Date('2026-07-14T00:00:00Z');
    const daily = dailyGame(POOL, d)!;
    const weekly = weeklyGames(POOL, WEEKLY_COUNT, d);
    expect(isSpotlit(POOL, daily, d).daily).toBe(true);
    for (const g of weekly) expect(isSpotlit(POOL, g, d).weekly).toBe(true);
    // A game in neither set is not spotlit at all.
    const cold = POOL.find((g) => g !== daily && !weekly.includes(g))!;
    expect(isSpotlit(POOL, cold, d)).toEqual({ daily: false, weekly: false });
  });
});
