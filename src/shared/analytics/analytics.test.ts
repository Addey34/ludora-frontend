import { describe, it, expect } from 'vitest';
import { buildEvent, sanitizeProps, trackingAllowed, EVENT_NAMES } from './analytics.js';

describe('analytics — pure helpers', () => {
  it('honours Do-Not-Track signals', () => {
    expect(trackingAllowed('1')).toBe(false);
    expect(trackingAllowed('yes')).toBe(false);
    expect(trackingAllowed('0')).toBe(true);
    expect(trackingAllowed(null)).toBe(true);
    expect(trackingAllowed(undefined)).toBe(true);
  });

  it('only builds allow-listed event names', () => {
    for (const name of EVENT_NAMES) {
      expect(buildEvent(name)?.name).toBe(name);
    }
    expect(buildEvent('evil_pii_dump')).toBeNull();
    expect(buildEvent('')).toBeNull();
  });

  it('stamps the event with props and a timestamp', () => {
    const e = buildEvent('game_start', { game: 'snake' }, 1234);
    expect(e).toEqual({ name: 'game_start', props: { game: 'snake' }, ts: 1234 });
  });

  it('keeps only short scalar props and caps their count', () => {
    const props: Record<string, unknown> = {
      s: 'x'.repeat(200),
      n: 42,
      b: true,
      obj: { nope: 1 },
      arr: [1, 2],
      fn: () => 0,
      nan: NaN,
    };
    const clean = sanitizeProps(props);
    expect(clean.s).toHaveLength(64); // string capped
    expect(clean.n).toBe(42);
    expect(clean.b).toBe(true);
    expect(clean).not.toHaveProperty('obj'); // objects dropped
    expect(clean).not.toHaveProperty('arr');
    expect(clean).not.toHaveProperty('fn');
    expect(clean).not.toHaveProperty('nan'); // non-finite dropped
  });

  it('caps the number of props', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 20; i++) many[`k${i}`] = i;
    expect(Object.keys(sanitizeProps(many)).length).toBeLessThanOrEqual(8);
  });
});
