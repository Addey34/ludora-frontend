import { describe, expect, it } from 'vitest';
import { ScoreManager } from './ScoreManager.js';

describe('ScoreManager (in-session high score)', () => {
  it('starts at zero', () => {
    expect(new ScoreManager().getHighScore()).toBe(0);
  });

  it('keeps the maximum score noted', () => {
    const manager = new ScoreManager();
    manager.noteScore(40);
    manager.noteScore(90);
    manager.noteScore(70);
    expect(manager.getHighScore()).toBe(90);
  });

  it('never persists to localStorage', () => {
    const manager = new ScoreManager();
    manager.noteScore(100);
    expect(localStorage.length).toBe(0);
  });
});
