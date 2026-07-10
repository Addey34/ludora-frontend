import { describe, expect, it } from 'vitest';

import { SCORE_GAMES } from './scoreGames.js';

describe('SCORE_GAMES registry', () => {
  it('has unique, non-empty keys', () => {
    const keys = SCORE_GAMES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of SCORE_GAMES) expect(g.key.length).toBeGreaterThan(0);
  });
});
