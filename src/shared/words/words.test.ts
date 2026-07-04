import { describe, it, expect } from 'vitest';
import { isWordGuessed, maskWord, pickWord, scramble } from './words.js';

describe('scramble', () => {
  it('returns a permutation different from the original', () => {
    const out = scramble('MAISON', () => 0.42);
    expect(out).not.toBe('MAISON');
    expect(out.split('').sort().join('')).toBe('MAISON'.split('').sort().join(''));
  });

  it('leaves a single letter (or all-same) untouched', () => {
    expect(scramble('A')).toBe('A');
    expect(scramble('AAAA')).toBe('AAAA');
  });
});

describe('maskWord / isWordGuessed', () => {
  it('masks unguessed letters and detects completion', () => {
    const guessed = new Set(['C', 'A']);
    expect(maskWord('CHAT', guessed)).toBe('C_A_');
    expect(isWordGuessed('CHAT', guessed)).toBe(false);
    guessed.add('H');
    guessed.add('T');
    expect(isWordGuessed('CHAT', guessed)).toBe(true);
  });
});

describe('pickWord', () => {
  it('respects the length window, falling back when none matches', () => {
    const words = ['CHAT', 'MAISON', 'ELEPHANT'];
    expect(pickWord(words, 4, 5, () => 0)).toBe('CHAT');
    // No word of length 20 → falls back to the whole list.
    expect(words).toContain(pickWord(words, 20, 25, () => 0));
  });
});
