import { describe, expect, it } from 'vitest';

import { buildChallengeUrl, challengeBeaten, parseChallenge } from './challengeLink.js';

describe('parseChallenge', () => {
  it('returns null when there is no challenge param', () => {
    expect(parseChallenge('?foo=1')).toBeNull();
    expect(parseChallenge('')).toBeNull();
  });

  it('reads the score and sender name', () => {
    expect(parseChallenge('?challenge=1200&by=Alice')).toEqual({ score: 1200, by: 'Alice' });
  });

  it('treats a missing or blank name as anonymous', () => {
    expect(parseChallenge('?challenge=50')).toEqual({ score: 50, by: null });
    expect(parseChallenge('?challenge=50&by=%20%20')).toEqual({ score: 50, by: null });
  });

  it('rejects a negative or non-numeric score', () => {
    expect(parseChallenge('?challenge=-5')).toBeNull();
    expect(parseChallenge('?challenge=abc')).toBeNull();
  });

  it('clamps an overlong name', () => {
    const c = parseChallenge(`?challenge=1&by=${'x'.repeat(50)}`);
    expect(c?.by?.length).toBe(20);
  });
});

describe('buildChallengeUrl', () => {
  it('sets the challenge and name on the page url', () => {
    const url = buildChallengeUrl('https://gz.app/snake', 1200, 'Bob');
    expect(url).toContain('challenge=1200');
    expect(url).toContain('by=Bob');
  });

  it('replaces an existing challenge rather than stacking it', () => {
    const url = buildChallengeUrl('https://gz.app/snake?challenge=10&by=Old', 900, null);
    expect(url).toContain('challenge=900');
    expect(url).not.toContain('challenge=10');
    expect(url).not.toContain('by=');
  });
});

describe('challengeBeaten', () => {
  it('requires strictly exceeding the target', () => {
    expect(challengeBeaten(101, 100)).toBe(true);
    expect(challengeBeaten(100, 100)).toBe(false);
    expect(challengeBeaten(99, 100)).toBe(false);
  });
});
