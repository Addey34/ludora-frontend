import { describe, it, expect } from 'vitest';
import { WordEntry, isWordGuessed, keyboardForm, maskWord, pickWord, scramble } from './words.js';

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

describe('keyboardForm', () => {
  it('strips accents and uppercases', () => {
    expect(keyboardForm('école')).toBe('ECOLE');
    expect(keyboardForm('château')).toBe('CHATEAU');
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
  it('picks from the requested tier, falling back when it is empty', () => {
    const entries: WordEntry[] = [
      { w: 'cat', d: 'easy' },
      { w: 'maison', d: 'medium' },
      { w: 'elephant', d: 'hard' },
    ];
    expect(pickWord(entries, 'easy', () => 0)).toBe('cat');
    expect(pickWord(entries, 'hard', () => 0)).toBe('elephant');
    // No word of the requested tier → falls back to the whole list.
    const onlyEasy: WordEntry[] = [{ w: 'cat', d: 'easy' }];
    expect(pickWord(onlyEasy, 'hard', () => 0)).toBe('cat');
  });
});
