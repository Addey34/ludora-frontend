import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Stopwatch, formatClock } from './stopwatch.js';

describe('formatClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(600)).toBe('10:00');
  });
});

describe('Stopwatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks once per second and reports the elapsed count', () => {
    const ticks: number[] = [];
    const sw = new Stopwatch((s) => ticks.push(s));
    sw.start();
    vi.advanceTimersByTime(3000);
    expect(ticks).toEqual([1, 2, 3]);
    expect(sw.seconds).toBe(3);
  });

  it('stop() freezes the count', () => {
    const sw = new Stopwatch(() => {});
    sw.start();
    vi.advanceTimersByTime(2000);
    sw.stop();
    vi.advanceTimersByTime(5000);
    expect(sw.seconds).toBe(2);
  });

  it('reset() zeroes the count and stops ticking', () => {
    const sw = new Stopwatch(() => {});
    sw.start();
    vi.advanceTimersByTime(4000);
    sw.reset();
    expect(sw.seconds).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(sw.seconds).toBe(0);
  });

  it('start() is idempotent (no double interval)', () => {
    const ticks: number[] = [];
    const sw = new Stopwatch((s) => ticks.push(s));
    sw.start();
    sw.start(); // must not stack a second interval
    vi.advanceTimersByTime(2000);
    expect(ticks).toEqual([1, 2]);
  });
});
