import { describe, expect, it } from 'vitest';
import type { Direction } from '../../shared/engine/input.js';
import { canMove, emptyCells, orientFromLeft, orientToLeft, planLine } from './2048Logic.js';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

describe('planLine', () => {
  it('slides tiles left with no merge', () => {
    const { outputs, gained } = planLine([2, 4]);
    expect(outputs).toEqual([
      { value: 2, sources: 1, merged: false },
      { value: 4, sources: 1, merged: false },
    ]);
    expect(gained).toBe(0);
  });

  it('merges an equal pair into its sum and scores it', () => {
    const { outputs, gained } = planLine([2, 2]);
    expect(outputs).toEqual([{ value: 4, sources: 2, merged: true }]);
    expect(gained).toBe(4);
  });

  it('merges at most once per tile (2,2,2 -> 4,2 left-biased)', () => {
    const { outputs, gained } = planLine([2, 2, 2]);
    expect(outputs).toEqual([
      { value: 4, sources: 2, merged: true },
      { value: 2, sources: 1, merged: false },
    ]);
    expect(gained).toBe(4);
  });

  it('resolves two independent pairs (2,2,4,4 -> 4,8)', () => {
    const { outputs, gained } = planLine([2, 2, 4, 4]);
    expect(outputs).toEqual([
      { value: 4, sources: 2, merged: true },
      { value: 8, sources: 2, merged: true },
    ]);
    expect(gained).toBe(12);
  });

  it('does not merge across unequal neighbours (4,4,4,4 -> 8,8)', () => {
    const { outputs, gained } = planLine([4, 4, 4, 4]);
    expect(outputs).toEqual([
      { value: 8, sources: 2, merged: true },
      { value: 8, sources: 2, merged: true },
    ]);
    expect(gained).toBe(16);
  });

  it('is a no-op shape for an empty line', () => {
    expect(planLine([])).toEqual({ outputs: [], gained: 0 });
  });

  it('total source tiles never exceeds the input length', () => {
    const line = [2, 2, 2, 2, 4, 8, 8];
    const { outputs } = planLine(line);
    const sources = outputs.reduce((sum, o) => sum + o.sources, 0);
    expect(sources).toBe(line.length);
  });
});

describe('orientToLeft / orientFromLeft', () => {
  const n = 4;

  it('are exact inverses of each other for every direction and cell', () => {
    for (const direction of DIRECTIONS) {
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const { r, c } = orientToLeft(row, col, direction, n);
          expect(orientFromLeft(r, c, direction, n)).toEqual({ row, col });
        }
      }
    }
  });

  it('leaves positions untouched for a leftward slide', () => {
    expect(orientToLeft(1, 2, 'left', n)).toEqual({ r: 1, c: 2 });
    expect(orientFromLeft(1, 2, 'left', n)).toEqual({ row: 1, col: 2 });
  });

  it('mirrors columns for a rightward slide', () => {
    expect(orientToLeft(1, 0, 'right', n)).toEqual({ r: 1, c: 3 });
    expect(orientToLeft(1, 3, 'right', n)).toEqual({ r: 1, c: 0 });
  });

  it('transposes for an upward slide (row/col swap)', () => {
    expect(orientToLeft(0, 2, 'up', n)).toEqual({ r: 2, c: 0 });
  });
});

describe('emptyCells', () => {
  it('lists every empty cell in row-major order', () => {
    const board = [
      [2, 0],
      [0, 4],
    ];
    expect(emptyCells(board)).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('returns nothing for a full board', () => {
    expect(emptyCells([[2, 4]])).toEqual([]);
  });
});

describe('canMove', () => {
  it('is true when a free cell exists', () => {
    expect(
      canMove([
        [2, 4],
        [8, 0],
      ])
    ).toBe(true);
  });

  it('is true when equal horizontal neighbours can merge', () => {
    expect(
      canMove([
        [2, 2],
        [4, 8],
      ])
    ).toBe(true);
  });

  it('is true when equal vertical neighbours can merge', () => {
    expect(
      canMove([
        [2, 4],
        [2, 8],
      ])
    ).toBe(true);
  });

  it('is false on a full board with no adjacent equals (game over)', () => {
    expect(
      canMove([
        [2, 4],
        [8, 16],
      ])
    ).toBe(false);
  });
});
