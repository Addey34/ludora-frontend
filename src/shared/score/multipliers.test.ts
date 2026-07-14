import { describe, expect, it } from 'vitest';
import { dailyGame, weeklyGames } from '../spotlight/spotlight.js';
import {
  tierFor,
  difficultyMultiplier,
  spotlightMultiplier,
  runMultiplier,
  DIFFICULTY_MULT,
  SPOTLIGHT_MULT,
} from './multipliers.js';

// A pool big enough that at least one game is neither the daily pick nor in the
// weekly set (7 weekly + 1 daily out of 12).
const POOL = [
  'snake',
  'tetris',
  '2048',
  'motus',
  'simon',
  'flappy',
  'bubbles',
  'kakuro',
  'binairo',
  'taquin',
  'sudoku',
  'invaders',
];
const DAY = new Date('2026-07-14T00:00:00Z');

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

describe('spotlightMultiplier', () => {
  it('is ×daily for the daily pick, ×weekly for a weekly pick, ×0 otherwise', () => {
    const daily = dailyGame(POOL, DAY)!;
    const weeklyOnly = weeklyGames(POOL, 7, DAY).find((g) => g !== daily)!;
    const cold = POOL.find((g) => g !== daily && !weeklyGames(POOL, 7, DAY).includes(g))!;
    expect(spotlightMultiplier(daily, POOL, DAY)).toBe(SPOTLIGHT_MULT.daily);
    expect(spotlightMultiplier(weeklyOnly, POOL, DAY)).toBe(SPOTLIGHT_MULT.weekly);
    expect(spotlightMultiplier(cold, POOL, DAY)).toBe(SPOTLIGHT_MULT.none);
  });
});

describe('runMultiplier', () => {
  it('stacks difficulty and the spotlight multiplicatively', () => {
    const daily = dailyGame(POOL, DAY)!;
    // A hard run of the daily game: difficulty ×2 × spotlight ×2 = 4.
    expect(runMultiplier(daily, 'hard', POOL, DAY)).toBeCloseTo(
      DIFFICULTY_MULT.hard * SPOTLIGHT_MULT.daily
    );
  });

  it('is 0 (earns no GZP) for a non-spotlit run, whatever the difficulty', () => {
    const cold = POOL.find(
      (g) => g !== dailyGame(POOL, DAY) && !weeklyGames(POOL, 7, DAY).includes(g)
    )!;
    expect(runMultiplier(cold, 'hard', POOL, DAY)).toBe(0);
  });
});
