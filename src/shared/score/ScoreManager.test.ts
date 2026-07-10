import { beforeEach, describe, expect, it } from 'vitest';
import { ScoreManager } from './ScoreManager.js';

describe('ScoreManager', () => {
  const KEY = 'test-scores';

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty leaderboard when nothing is stored', () => {
    const manager = new ScoreManager(KEY);
    expect(manager.getScores()).toEqual([]);
    expect(manager.getHighScore()).toBe(0);
  });

  it('sorts scores in descending order', () => {
    const manager = new ScoreManager(KEY);
    manager.saveScore({ username: 'A', score: 10 });
    manager.saveScore({ username: 'B', score: 30 });
    manager.saveScore({ username: 'C', score: 20 });

    expect(manager.getScores().map((s) => s.score)).toEqual([30, 20, 10]);
    expect(manager.getHighScore()).toBe(30);
  });

  it('only keeps the maxScores best ones', () => {
    const manager = new ScoreManager(KEY, 3);
    [5, 50, 15, 40, 25].forEach((score, i) => manager.saveScore({ username: `J${i}`, score }));

    expect(manager.getScores().map((s) => s.score)).toEqual([50, 40, 25]);
  });

  it('uses a distinct storage key per game', () => {
    const snake = new ScoreManager('snake');
    const tetris = new ScoreManager('tetris');
    snake.saveScore({ username: 'A', score: 100 });

    expect(snake.getScores()).toHaveLength(1);
    expect(tetris.getScores()).toEqual([]);
  });

  describe('isHighScore', () => {
    it('is true as long as the leaderboard is not full', () => {
      const manager = new ScoreManager(KEY, 2);
      manager.saveScore({ username: 'A', score: 10 });
      expect(manager.isHighScore(1)).toBe(true);
    });

    it('compares to the last entry when the leaderboard is full', () => {
      const manager = new ScoreManager(KEY, 2);
      manager.saveScore({ username: 'A', score: 10 });
      manager.saveScore({ username: 'B', score: 20 });

      expect(manager.isHighScore(15)).toBe(true); // beats the 10
      expect(manager.isHighScore(5)).toBe(false); // does not beat the 10
    });
  });

  it('returns an empty leaderboard if the stored content is unreadable', () => {
    localStorage.setItem(KEY, 'pas-du-json{');
    const manager = new ScoreManager(KEY);
    expect(manager.getScores()).toEqual([]);
  });

  it('rehydrates dates into Date objects', () => {
    const manager = new ScoreManager(KEY);
    manager.saveScore({ username: 'A', score: 10, date: new Date('2025-01-01') });
    expect(manager.getScores()[0].date).toBeInstanceOf(Date);
  });

  it('clears the leaderboard', () => {
    const manager = new ScoreManager(KEY);
    manager.saveScore({ username: 'A', score: 10 });
    manager.clearScores();
    expect(manager.getScores()).toEqual([]);
  });

  describe('online mode', () => {
    it('never writes to localStorage', () => {
      const manager = new ScoreManager(KEY, 10, true);
      manager.saveScore({ username: 'A', score: 100 });
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('getScores always returns empty', () => {
      const manager = new ScoreManager(KEY, 10, true);
      manager.saveScore({ username: 'A', score: 100 });
      expect(manager.getScores()).toEqual([]);
    });

    it('tracks session high score in memory', () => {
      const manager = new ScoreManager(KEY, 10, true);
      expect(manager.getHighScore()).toBe(0);
      manager.saveScore({ username: 'A', score: 50 });
      expect(manager.getHighScore()).toBe(50);
      manager.saveScore({ username: 'A', score: 30 });
      expect(manager.getHighScore()).toBe(50);
      manager.saveScore({ username: 'A', score: 80 });
      expect(manager.getHighScore()).toBe(80);
    });

    it('noteScore feeds the HUD "best" (session high) without persisting', () => {
      const manager = new ScoreManager(KEY, 10, true);
      expect(manager.getHighScore()).toBe(0);
      manager.noteScore(40);
      manager.noteScore(90);
      manager.noteScore(70);
      expect(manager.getHighScore()).toBe(90);
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('isHighScore is true for any positive score', () => {
      const manager = new ScoreManager(KEY, 10, true);
      expect(manager.isHighScore(1)).toBe(true);
      expect(manager.isHighScore(999)).toBe(true);
    });

    it('isHighScore is false for score 0', () => {
      const manager = new ScoreManager(KEY, 10, true);
      expect(manager.isHighScore(0)).toBe(false);
    });

    it('clearScores is a no-op', () => {
      const manager = new ScoreManager(KEY, 10, true);
      manager.saveScore({ username: 'A', score: 100 });
      manager.clearScores();
      expect(manager.getHighScore()).toBe(100);
      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });
});
