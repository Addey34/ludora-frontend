import { describe, expect, it } from 'vitest';
import {
  apply{{Class}}Move,
  create{{Class}}State,
  is{{Class}}Draw,
  legal{{Class}}Moves,
} from './{{key}}.js';

describe('{{key}} rules', () => {
  it('starts with every cell available', () => {
    const state = create{{Class}}State();
    expect(legal{{Class}}Moves(state)).toHaveLength(9);
    expect(state.current).toBe(0);
  });

  it('switches seats without mutating the previous state', () => {
    const state = create{{Class}}State();
    const next = apply{{Class}}Move(state, { index: 0 });
    expect(state.cells[0]).toBeNull();
    expect(next.cells[0]).toBe(0);
    expect(next.current).toBe(1);
  });

  it('detects a completed line', () => {
    let state = create{{Class}}State();
    for (const index of [0, 3, 1, 4, 2]) {
      state = apply{{Class}}Move(state, { index });
    }
    expect(state.winner).toBe(0);
    expect(legal{{Class}}Moves(state)).toEqual([]);
  });

  it('detects a full board draw', () => {
    const state = {
      cells: [0, 1, 0, 0, 1, 1, 1, 0, 0],
      current: 1,
      winner: null,
    };
    expect(is{{Class}}Draw(state)).toBe(true);
  });
});
