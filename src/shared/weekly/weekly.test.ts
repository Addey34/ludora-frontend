import { describe, expect, it } from 'vitest';
import { weekKey, weeklySeed, featuredGame } from './weekly.js';

describe('weekKey (ISO-8601, UTC)', () => {
  it('formats as YYYY-Www', () => {
    expect(weekKey(new Date('2026-07-12T00:00:00Z'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('puts Thursday 2026-01-01 in week 1', () => {
    expect(weekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
  });

  it('assigns the ISO week-year, not the calendar year, to early January', () => {
    // 2021-01-01 is a Friday → still ISO week 53 of 2020.
    expect(weekKey(new Date('2021-01-01T12:00:00Z'))).toBe('2020-W53');
  });

  it('is stable across a whole UTC week and rolls over on Monday', () => {
    // 2026-07-06 is a Monday.
    const monday = weekKey(new Date('2026-07-06T00:00:00Z'));
    const sunday = weekKey(new Date('2026-07-12T23:59:59Z'));
    const nextMonday = weekKey(new Date('2026-07-13T00:00:00Z'));
    expect(sunday).toBe(monday);
    expect(nextMonday).not.toBe(monday);
  });

  it('ignores the time of day', () => {
    const a = weekKey(new Date('2026-07-08T00:00:00Z'));
    const b = weekKey(new Date('2026-07-08T23:30:00Z'));
    expect(a).toBe(b);
  });
});

describe('weeklySeed', () => {
  it('is deterministic and returns an unsigned 32-bit int', () => {
    const s = weeklySeed('2026-W29');
    expect(s).toBe(weeklySeed('2026-W29'));
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it('differs between weeks', () => {
    expect(weeklySeed('2026-W29')).not.toBe(weeklySeed('2026-W30'));
  });
});

describe('featuredGame', () => {
  const pool = ['snake', 'tetris', '2048', 'motus'];

  it('is deterministic for a given week and always in the pool', () => {
    const a = featuredGame(pool, '2026-W29');
    expect(a).toBe(featuredGame(pool, '2026-W29'));
    expect(pool).toContain(a);
  });

  it('returns null for an empty pool', () => {
    expect(featuredGame([], '2026-W29')).toBeNull();
  });

  it('rotates over consecutive weeks (not always the same game)', () => {
    const picks = new Set(
      Array.from({ length: 8 }, (_, i) =>
        featuredGame(pool, `2026-W${String(i + 20).padStart(2, '0')}`)
      )
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
