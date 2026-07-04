import { describe, it, expect } from 'vitest';
import {
  accuracy,
  answered,
  buildChoices,
  difficultyMultiplier,
  emptyStats,
  isCorrect,
  normalizeAnswer,
  recordAnswer,
  scoreForCorrect,
} from './quiz.js';

describe('recordAnswer / stats', () => {
  it('tracks correct/wrong, streak and best streak', () => {
    const stats = emptyStats();
    recordAnswer(stats, true);
    recordAnswer(stats, true);
    expect(stats.streak).toBe(2);
    expect(stats.bestStreak).toBe(2);
    recordAnswer(stats, false); // resets the streak, keeps the best
    expect(stats.streak).toBe(0);
    expect(stats.bestStreak).toBe(2);
    expect(answered(stats)).toBe(3);
    expect(stats.correct).toBe(2);
  });

  it('accuracy is a rounded percentage (0 when nothing answered)', () => {
    const stats = emptyStats();
    expect(accuracy(stats)).toBe(0);
    recordAnswer(stats, true);
    recordAnswer(stats, false);
    recordAnswer(stats, false);
    expect(accuracy(stats)).toBe(33);
  });
});

describe('scoreForCorrect', () => {
  it('scales the base by difficulty', () => {
    expect(scoreForCorrect(100, 'easy', 1)).toBe(100);
    expect(scoreForCorrect(100, 'medium', 1)).toBe(150);
    expect(scoreForCorrect(100, 'hard', 1)).toBe(200);
  });

  it('adds a combo bonus that grows with the streak and caps', () => {
    expect(scoreForCorrect(100, 'easy', 1)).toBe(100); // first correct, no bonus
    expect(scoreForCorrect(100, 'easy', 3)).toBe(120); // +2 steps
    expect(scoreForCorrect(100, 'easy', 50)).toBe(200); // capped at +100
  });

  it('multiplier helper', () => {
    expect(difficultyMultiplier('hard')).toBe(2);
  });
});

describe('normalizeAnswer / isCorrect', () => {
  it('is forgiving on accents, case and spacing', () => {
    expect(normalizeAnswer('  Bogotá ')).toBe('bogota');
    expect(isCorrect('new   YORK', 'New York')).toBe(true);
    expect(isCorrect('Paris', 'London')).toBe(false);
  });
});

describe('buildChoices', () => {
  it('always includes the answer and the requested count of distinct options', () => {
    const pool = ['A', 'B', 'C', 'D', 'E'];
    const choices = buildChoices('A', pool, 4, () => 0);
    expect(choices).toContain('A');
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4); // no duplicates
    expect(choices).not.toContain(undefined);
  });
});
