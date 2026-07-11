import { describe, it, expect } from 'vitest';
import {
  dayKey,
  nextDay,
  dailySeed,
  mulberry32,
  emptyProgress,
  isSolvedToday,
  recordDailySolve,
  currentStreak,
} from './daily.js';

describe('daily — dates & seed', () => {
  it('formats a UTC day key', () => {
    expect(dayKey(new Date('2026-07-11T23:59:59Z'))).toBe('2026-07-11');
    expect(dayKey(new Date('2026-07-11T00:00:00Z'))).toBe('2026-07-11');
  });

  it('advances to the next day across month/year boundaries', () => {
    expect(nextDay('2026-07-11')).toBe('2026-07-12');
    expect(nextDay('2026-07-31')).toBe('2026-08-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });

  it('gives a stable, distinct seed per day', () => {
    expect(dailySeed('2026-07-11')).toBe(dailySeed('2026-07-11'));
    expect(dailySeed('2026-07-11')).not.toBe(dailySeed('2026-07-12'));
    expect(Number.isInteger(dailySeed('2026-07-11'))).toBe(true);
  });
});

describe('daily — PRNG', () => {
  it('is deterministic for a seed and stays in [0,1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seq = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seq);
    for (const n of seq) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('daily — streak', () => {
  it('starts a streak on the first solve', () => {
    const p = recordDailySolve(emptyProgress(), '2026-07-11');
    expect(p).toEqual({ lastSolved: '2026-07-11', streak: 1, best: 1 });
  });

  it('extends the streak on consecutive days and tracks best', () => {
    let p = recordDailySolve(emptyProgress(), '2026-07-11');
    p = recordDailySolve(p, '2026-07-12');
    p = recordDailySolve(p, '2026-07-13');
    expect(p.streak).toBe(3);
    expect(p.best).toBe(3);
  });

  it('resets after a gap but keeps the best', () => {
    let p = { lastSolved: '2026-07-11', streak: 5, best: 5 };
    p = recordDailySolve(p, '2026-07-13'); // skipped the 12th
    expect(p.streak).toBe(1);
    expect(p.best).toBe(5);
  });

  it('is idempotent for a second solve the same day', () => {
    const first = recordDailySolve(emptyProgress(), '2026-07-11');
    expect(recordDailySolve(first, '2026-07-11')).toBe(first);
    expect(isSolvedToday(first, '2026-07-11')).toBe(true);
    expect(isSolvedToday(first, '2026-07-12')).toBe(false);
  });

  it('reads current streak as lapsed (0) after missing days', () => {
    const p = { lastSolved: '2026-07-11', streak: 4, best: 4 };
    expect(currentStreak(p, '2026-07-11')).toBe(4); // today
    expect(currentStreak(p, '2026-07-12')).toBe(4); // yesterday → still live
    expect(currentStreak(p, '2026-07-14')).toBe(0); // lapsed
  });
});
