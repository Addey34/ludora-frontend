import { describe, expect, it } from 'vitest';
import { featuredGame } from '../weekly/weekly.js';
import {
  tierFor,
  difficultyMultiplier,
  weeklyMultiplier,
  runMultiplier,
  DIFFICULTY_MULT,
  WEEKLY_MULT,
} from './multipliers.js';

describe('tierFor', () => {
  it('reads a literal difficulty variant', () => {
    expect(tierFor('snake', 'easy')).toBe('easy');
    expect(tierFor('snake', 'medium')).toBe('medium');
    expect(tierFor('snake', 'hard')).toBe('hard');
  });

  it('reads the difficulty suffix of a lang-difficulty variant', () => {
    expect(tierFor('typing', 'fr-hard')).toBe('hard');
    expect(tierFor('wordsearch', 'en-medium')).toBe('medium');
  });

  it('maps size-based variants to the right direction (2048: fewer = harder)', () => {
    expect(tierFor('2048', '5')).toBe('easy');
    expect(tierFor('2048', '4')).toBe('medium');
    expect(tierFor('2048', '3')).toBe('hard');
  });

  it('maps binairo (bigger = harder) and solitaire (draw-3 = harder)', () => {
    expect(tierFor('binairo', '6')).toBe('easy');
    expect(tierFor('binairo', '8')).toBe('hard');
    expect(tierFor('solitaire', '1')).toBe('easy');
    expect(tierFor('solitaire', '3')).toBe('hard');
  });

  it('is null for non-difficulty variants and the base board', () => {
    expect(tierFor('motus', 'fr')).toBeNull(); // language, not difficulty
    expect(tierFor('blackjack', '500')).toBeNull(); // bankroll, not difficulty
    expect(tierFor('snake', null)).toBeNull();
  });
});

describe('difficultyMultiplier', () => {
  it('applies the tier table, defaulting to 1', () => {
    expect(difficultyMultiplier('snake', 'easy')).toBe(DIFFICULTY_MULT.easy);
    expect(difficultyMultiplier('snake', 'medium')).toBe(DIFFICULTY_MULT.medium);
    expect(difficultyMultiplier('2048', '3')).toBe(DIFFICULTY_MULT.hard);
    expect(difficultyMultiplier('motus', 'fr')).toBe(1);
    expect(difficultyMultiplier('snake', null)).toBe(1);
  });
});

describe('weeklyMultiplier', () => {
  const pool = ['snake', 'tetris', '2048', 'motus'];

  it('boosts the featured game and leaves the rest at 1', () => {
    const featured = featuredGame(pool, '2026-W29')!;
    expect(weeklyMultiplier(featured, pool, '2026-W29')).toBe(WEEKLY_MULT);
    const other = pool.find((g) => g !== featured)!;
    expect(weeklyMultiplier(other, pool, '2026-W29')).toBe(1);
  });
});

describe('runMultiplier', () => {
  const pool = ['snake', 'tetris', '2048', 'motus'];

  it('stacks difficulty and the weekly spotlight multiplicatively', () => {
    const featured = featuredGame(pool, '2026-W29')!;
    // A hard run of the featured game: difficulty ×2 × weekly ×2 = 4.
    expect(runMultiplier(featured, 'hard', pool, '2026-W29')).toBeCloseTo(
      DIFFICULTY_MULT.hard * WEEKLY_MULT
    );
  });

  it('is 1 for an easy, non-featured, non-difficulty run', () => {
    const other = pool.find((g) => featuredGame(pool, '2026-W29') !== g)!;
    expect(runMultiplier(other, null, pool, '2026-W29')).toBe(1);
  });
});
