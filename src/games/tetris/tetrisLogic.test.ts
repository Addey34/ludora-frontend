import { describe, it, expect } from 'vitest';
import {
  canPlace,
  rotateMatrix,
  getFullRows,
  getGhostY,
  composeBoard,
  moveHorizontal,
  rotate,
  hardDrop,
  lockPiece,
  applyLineClear,
  spawnPiece,
  calcLevel,
  calcDropInterval,
  createTetrisState,
  LINE_SCORES,
} from './tetrisLogic.js';
import type { TetrisGameState } from './tetrisState.js';

function emptyState(cols = 10, rows = 5): TetrisGameState {
  return {
    cols,
    rows,
    grid: Array.from({ length: rows }, () => new Array(cols).fill(null)),
    current: null,
    dropInterval: 800,
    lines: 0,
    level: 1,
    clearingRows: [],
  };
}

function stateWithPiece(
  state: TetrisGameState,
  matrix: number[][],
  x: number,
  y: number
): TetrisGameState {
  return { ...state, current: { type: 'I', matrix, x, y } };
}

const SINGLE = [[1]];
const HBAR = [[1, 1, 1]]; // 1×3 horizontal bar

describe('calcLevel', () => {
  it('stays at startLevel until 10 lines', () => {
    expect(calcLevel(0, 1)).toBe(1);
    expect(calcLevel(9, 1)).toBe(1);
    expect(calcLevel(10, 1)).toBe(2);
  });

  it('respects startLevel offset', () => {
    expect(calcLevel(0, 5)).toBe(5);
    expect(calcLevel(10, 5)).toBe(6);
  });
});

describe('calcDropInterval', () => {
  it('decreases with level', () => {
    expect(calcDropInterval(800, 120, 1)).toBe(800);
    expect(calcDropInterval(800, 120, 2)).toBe(735);
  });

  it('floors at minDropInterval', () => {
    expect(calcDropInterval(800, 120, 20)).toBe(120);
  });
});

describe('canPlace', () => {
  it('accepts a piece on an empty grid', () => {
    const state = stateWithPiece(emptyState(), SINGLE, 0, 0);
    expect(canPlace(state, SINGLE, 0, 0)).toBe(true);
  });

  it('rejects out-of-bounds left', () => {
    expect(canPlace(emptyState(), SINGLE, -1, 0)).toBe(false);
  });

  it('rejects out-of-bounds right', () => {
    expect(canPlace(emptyState(), SINGLE, 10, 0)).toBe(false);
  });

  it('rejects out-of-bounds bottom', () => {
    expect(canPlace(emptyState(), SINGLE, 0, 5)).toBe(false);
  });

  it('allows spawning above the grid (y < 0)', () => {
    expect(canPlace(emptyState(), SINGLE, 0, -1)).toBe(true);
  });

  it('rejects overlap with a frozen cell', () => {
    const state = emptyState();
    state.grid[2][3] = 'I';
    expect(canPlace(state, SINGLE, 3, 2)).toBe(false);
  });
});

describe('rotateMatrix', () => {
  it('rotates a 3×3 matrix 90° clockwise', () => {
    const matrix = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ];
    // T piece 90° CW → stem points right: [[0,1,0],[0,1,1],[0,1,0]]
    const result = rotateMatrix(matrix);
    expect(result[0][1]).toBe(1);
    expect(result[1][1]).toBe(1);
    expect(result[1][2]).toBe(1);
    expect(result[1][0]).toBe(0);
  });

  it('returns to the original after 4 rotations', () => {
    const matrix = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ];
    let m = matrix;
    for (let i = 0; i < 4; i++) m = rotateMatrix(m);
    expect(m).toEqual(matrix);
  });
});

describe('getFullRows', () => {
  it('returns empty array for an empty grid', () => {
    expect(getFullRows(emptyState())).toEqual([]);
  });

  it('ignores partially filled rows', () => {
    const state = emptyState(3, 3);
    state.grid[2][0] = 'I';
    expect(getFullRows(state)).toEqual([]);
  });

  it('detects a completely filled row', () => {
    const state = emptyState(3, 3);
    state.grid[2] = ['I', 'O', 'T'];
    expect(getFullRows(state)).toEqual([2]);
  });

  it('detects multiple full rows', () => {
    const state = emptyState(3, 3);
    state.grid[1] = ['I', 'O', 'T'];
    state.grid[2] = ['I', 'O', 'T'];
    expect(getFullRows(state)).toEqual([1, 2]);
  });
});

describe('getGhostY', () => {
  it('returns 0 when no current piece', () => {
    expect(getGhostY(emptyState())).toBe(0);
  });

  it('lands at the bottom on an empty grid', () => {
    const state = stateWithPiece(emptyState(5, 5), SINGLE, 0, 0);
    expect(getGhostY(state)).toBe(4);
  });

  it('lands on top of a frozen piece', () => {
    const state = emptyState(5, 5);
    state.grid[4][0] = 'I';
    const s = stateWithPiece(state, SINGLE, 0, 0);
    expect(getGhostY(s)).toBe(3);
  });
});

describe('composeBoard', () => {
  it('returns null cells for an empty board with no piece', () => {
    const board = composeBoard(emptyState(3, 3));
    expect(board.every((row) => row.every((c) => c === null))).toBe(true);
  });

  it('includes the current piece in the composed board', () => {
    const state = stateWithPiece(emptyState(3, 3), SINGLE, 1, 1);
    const board = composeBoard(state);
    expect(board[1][1]).toBe('I');
  });

  it('includes the ghost below the current piece', () => {
    const state = stateWithPiece(emptyState(3, 5), SINGLE, 1, 0);
    const board = composeBoard(state);
    expect(board[4][1]).toBe('ghost');
    expect(board[0][1]).toBe('I');
  });
});

describe('moveHorizontal', () => {
  it('moves left on a free grid', () => {
    const state = stateWithPiece(emptyState(), SINGLE, 3, 0);
    const next = moveHorizontal(state, -1);
    expect(next?.current?.x).toBe(2);
  });

  it('moves right on a free grid', () => {
    const state = stateWithPiece(emptyState(), SINGLE, 3, 0);
    const next = moveHorizontal(state, 1);
    expect(next?.current?.x).toBe(4);
  });

  it('returns null when blocked by left wall', () => {
    const state = stateWithPiece(emptyState(), SINGLE, 0, 0);
    expect(moveHorizontal(state, -1)).toBeNull();
  });

  it('returns null when blocked by a frozen cell', () => {
    const state = emptyState();
    state.grid[0][5] = 'I';
    const s = stateWithPiece(state, SINGLE, 4, 0);
    expect(moveHorizontal(s, 1)).toBeNull();
  });
});

describe('rotate', () => {
  it('rotates a T piece', () => {
    const matrix = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ];
    const state = stateWithPiece(emptyState(), matrix, 4, 1);
    const next = rotate(state);
    expect(next).not.toBeNull();
    expect(next!.current!.matrix).not.toEqual(matrix);
  });

  it('returns null when current is null', () => {
    expect(rotate(emptyState())).toBeNull();
  });

  it('uses wall kicks to fit near right wall', () => {
    const state = stateWithPiece(emptyState(), HBAR, 8, 0);
    const next = rotate(state);
    expect(next).not.toBeNull();
  });
});

describe('hardDrop', () => {
  it('drops to the bottom and returns the distance', () => {
    const state = stateWithPiece(emptyState(5, 5), SINGLE, 0, 0);
    const result = hardDrop(state);
    expect(result.state.current?.y).toBe(4);
    expect(result.distance).toBe(4);
  });

  it('returns distance 0 when already at the bottom', () => {
    const state = stateWithPiece(emptyState(5, 5), SINGLE, 0, 4);
    const result = hardDrop(state);
    expect(result.distance).toBe(0);
  });

  it('lands on a frozen piece', () => {
    const state = emptyState(5, 5);
    state.grid[4][0] = 'I';
    const s = stateWithPiece(state, SINGLE, 0, 0);
    const result = hardDrop(s);
    expect(result.state.current?.y).toBe(3);
    expect(result.distance).toBe(3);
  });
});

describe('lockPiece', () => {
  it('freezes the current piece into the grid', () => {
    const state = stateWithPiece(emptyState(5, 5), SINGLE, 2, 4);
    const next = lockPiece(state);
    expect(next.grid[4][2]).toBe('I');
    expect(next.current).toBeNull();
  });

  it('does not modify the original grid (immutability)', () => {
    const state = stateWithPiece(emptyState(5, 5), SINGLE, 2, 4);
    lockPiece(state);
    expect(state.grid[4][2]).toBeNull();
  });
});

describe('applyLineClear', () => {
  it('removes specified rows and pads from the top', () => {
    const state = emptyState(3, 3);
    state.grid[2] = ['I', 'O', 'T'];
    const next = applyLineClear(state, [2], 800, 120, 1);
    expect(next.grid.length).toBe(3);
    expect(next.grid[2].every((c) => c === null)).toBe(true);
  });

  it('increments lines count', () => {
    const state = emptyState(3, 3);
    state.grid[2] = ['I', 'O', 'T'];
    const next = applyLineClear(state, [2], 800, 120, 1);
    expect(next.lines).toBe(1);
  });

  it('levels up after 10 cleared lines', () => {
    const state = { ...emptyState(), lines: 9 };
    state.grid[4] = ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I'];
    const next = applyLineClear(state, [4], 800, 120, 1);
    expect(next.level).toBe(2);
  });

  it('clears the clearingRows flag', () => {
    const state = { ...emptyState(), clearingRows: [2] };
    const next = applyLineClear(state, [2], 800, 120, 1);
    expect(next.clearingRows).toEqual([]);
  });
});

describe('spawnPiece', () => {
  it('spawns a piece at the top center', () => {
    const result = spawnPiece(emptyState());
    expect(result.state.current).not.toBeNull();
    expect(result.state.current!.y).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it('reports blocked when the spawn position is occupied', () => {
    const state = emptyState(4, 4);
    state.grid[0] = ['I', 'I', 'I', 'I'];
    state.grid[1] = ['I', 'I', 'I', 'I'];
    const fixed = () => 0; // always picks 'I' piece (4-wide)
    const result = spawnPiece(state, fixed);
    expect(result.blocked).toBe(true);
  });
});

describe('LINE_SCORES', () => {
  it('matches classic Tetris scoring', () => {
    expect(LINE_SCORES[1]).toBe(40);
    expect(LINE_SCORES[2]).toBe(100);
    expect(LINE_SCORES[3]).toBe(300);
    expect(LINE_SCORES[4]).toBe(1200);
  });
});

describe('createTetrisState', () => {
  it('creates a valid initial state with a first piece', () => {
    const state = createTetrisState(10, 20, 800, 120, 1);
    expect(state.current).not.toBeNull();
    expect(state.lines).toBe(0);
    expect(state.level).toBe(1);
    expect(state.grid.length).toBe(20);
  });

  it('applies startLevel to dropInterval immediately (bug fix)', () => {
    const hard = createTetrisState(10, 20, 800, 120, 10);
    const easy = createTetrisState(10, 20, 800, 120, 1);
    expect(hard.dropInterval).toBeLessThan(easy.dropInterval);
  });
});
