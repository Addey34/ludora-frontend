import { describe, it, expect } from 'vitest';
import { normalizeWord, scoreGuess } from './motus.js';

describe('normalizeWord', () => {
  it('strips accents and upper-cases 5-letter words', () => {
    expect(normalizeWord('école')).toBe('ECOLE');
    expect(normalizeWord('Pêche')).toBe('PECHE');
  });

  it('rejects anything that is not exactly 5 plain letters', () => {
    expect(normalizeWord('chien')).toBe('CHIEN');
    expect(normalizeWord('chat')).toBeNull();
    expect(normalizeWord('abcdef')).toBeNull();
    expect(normalizeWord("l'ami")).toBeNull();
  });
});

describe('scoreGuess', () => {
  it('marks exact matches correct', () => {
    expect(scoreGuess('CRANE', 'CRANE')).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('marks misplaced letters present and others absent', () => {
    // target ARBRE vs guess ROBIN
    expect(scoreGuess('ROBIN', 'ARBRE')).toEqual([
      'present', // R exists elsewhere
      'absent', // O
      'correct', // B is at index 2 in both
      'absent', // I
      'absent', // N
    ]);
  });

  it('respects letter counts for duplicates', () => {
    // target ABBEY has two B; guess BOBBY -> only two B can be green/yellow
    const res = scoreGuess('BBBBB', 'ABBEY');
    const greens = res.filter((v) => v === 'correct').length;
    const yellows = res.filter((v) => v === 'present').length;
    expect(greens).toBe(2); // positions 1 and 2
    expect(yellows).toBe(0); // no B left to be "present"
  });
});
