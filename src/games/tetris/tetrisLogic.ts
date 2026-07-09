import type {
  TetrominoType,
  CellValue,
  Tetromino,
  ActivePiece,
  TetrisGameState,
} from './tetrisState.js';

export type RandomSource = () => number;

export const TETROMINOES: readonly Tetromino[] = [
  {
    type: 'I',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    type: 'O',
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    type: 'T',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    type: 'S',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    type: 'Z',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    type: 'J',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    type: 'L',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
];

export const LINE_SCORES: readonly number[] = [0, 40, 100, 300, 1200];

const ROTATION_KICKS = [0, -1, 1, -2, 2] as const;

export function calcLevel(lines: number, startLevel: number): number {
  return Math.floor(lines / 10) + startLevel;
}

export function calcDropInterval(base: number, min: number, level: number): number {
  return Math.max(min, base - (level - 1) * 65);
}

export function createTetrisState(
  cols: number,
  rows: number,
  baseDropInterval: number,
  minDropInterval: number,
  startLevel: number,
  random: RandomSource = Math.random
): TetrisGameState {
  const grid = Array.from({ length: rows }, () => new Array<TetrominoType | null>(cols).fill(null));
  const base: TetrisGameState = {
    cols,
    rows,
    grid,
    current: null,
    dropInterval: calcDropInterval(baseDropInterval, minDropInterval, startLevel),
    lines: 0,
    level: startLevel,
    clearingRows: [],
  };
  return spawnPiece(base, random).state;
}

export function canPlace(
  state: TetrisGameState,
  matrix: number[][],
  posX: number,
  posY: number
): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const gx = posX + c;
      const gy = posY + r;
      if (gx < 0 || gx >= state.cols || gy >= state.rows) return false;
      if (gy >= 0 && state.grid[gy][gx]) return false;
    }
  }
  return true;
}

export function rotateMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const rotated = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      rotated[j][n - 1 - i] = matrix[i][j];
    }
  }
  return rotated;
}

export function getGhostY(state: TetrisGameState): number {
  if (!state.current) return 0;
  let ghostY = state.current.y;
  while (canPlace(state, state.current.matrix, state.current.x, ghostY + 1)) {
    ghostY++;
  }
  return ghostY;
}

export function getFullRows(state: TetrisGameState): number[] {
  const rows: number[] = [];
  for (let y = 0; y < state.rows; y++) {
    if (state.grid[y].every((cell) => cell !== null)) rows.push(y);
  }
  return rows;
}

export function composeBoard(state: TetrisGameState): CellValue[][] {
  const cells: CellValue[][] = state.grid.map((row) => [...row]);

  if (state.current) {
    const ghostY = getGhostY(state);
    if (ghostY !== state.current.y) {
      state.current.matrix.forEach((row, r) => {
        row.forEach((filled, c) => {
          if (!filled) return;
          const gy = ghostY + r;
          const gx = state.current!.x + c;
          if (gy >= 0 && gy < state.rows && gx >= 0 && gx < state.cols && !cells[gy][gx]) {
            cells[gy][gx] = 'ghost';
          }
        });
      });
    }

    const { matrix, x, y, type } = state.current;
    matrix.forEach((row, r) => {
      row.forEach((filled, c) => {
        if (!filled) return;
        const gx = x + c;
        const gy = y + r;
        if (gy >= 0 && gy < state.rows && gx >= 0 && gx < state.cols) {
          cells[gy][gx] = type;
        }
      });
    });
  }

  return cells;
}

export function moveHorizontal(state: TetrisGameState, dx: number): TetrisGameState | null {
  if (!state.current) return null;
  if (!canPlace(state, state.current.matrix, state.current.x + dx, state.current.y)) return null;
  return { ...state, current: { ...state.current, x: state.current.x + dx } };
}

export function rotate(state: TetrisGameState): TetrisGameState | null {
  if (!state.current) return null;
  const rotated = rotateMatrix(state.current.matrix);
  for (const offset of ROTATION_KICKS) {
    if (canPlace(state, rotated, state.current.x + offset, state.current.y)) {
      return {
        ...state,
        current: { ...state.current, matrix: rotated, x: state.current.x + offset },
      };
    }
  }
  return null;
}

export function softDrop(state: TetrisGameState): { state: TetrisGameState; moved: boolean } {
  if (!state.current) return { state, moved: false };
  if (!canPlace(state, state.current.matrix, state.current.x, state.current.y + 1)) {
    return { state, moved: false };
  }
  return {
    state: { ...state, current: { ...state.current, y: state.current.y + 1 } },
    moved: true,
  };
}

export function hardDrop(state: TetrisGameState): { state: TetrisGameState; distance: number } {
  if (!state.current) return { state, distance: 0 };
  let y = state.current.y;
  while (canPlace(state, state.current.matrix, state.current.x, y + 1)) y++;
  return { state: { ...state, current: { ...state.current, y } }, distance: y - state.current.y };
}

export function stepDown(state: TetrisGameState): TetrisGameState {
  if (!state.current) return state;
  return { ...state, current: { ...state.current, y: state.current.y + 1 } };
}

export function lockPiece(state: TetrisGameState): TetrisGameState {
  if (!state.current) return state;
  const grid = state.grid.map((row) => [...row]);
  const { matrix, x, y, type } = state.current;
  matrix.forEach((row, r) => {
    row.forEach((filled, c) => {
      if (!filled) return;
      const gy = y + r;
      const gx = x + c;
      if (gy >= 0 && gy < state.rows && gx >= 0 && gx < state.cols) {
        grid[gy][gx] = type;
      }
    });
  });
  return { ...state, grid, current: null };
}

export function applyLineClear(
  state: TetrisGameState,
  rows: number[],
  baseDropInterval: number,
  minDropInterval: number,
  startLevel: number
): TetrisGameState {
  const grid = state.grid.filter((_, y) => !rows.includes(y));
  while (grid.length < state.rows) {
    grid.unshift(new Array<TetrominoType | null>(state.cols).fill(null));
  }
  const lines = state.lines + rows.length;
  const level = calcLevel(lines, startLevel);
  const dropInterval = calcDropInterval(baseDropInterval, minDropInterval, level);
  return { ...state, grid, lines, level, dropInterval, clearingRows: [] };
}

export function spawnPiece(
  state: TetrisGameState,
  random: RandomSource = Math.random
): { state: TetrisGameState; blocked: boolean } {
  const template = TETROMINOES[Math.floor(random() * TETROMINOES.length)];
  const matrix = template.matrix.map((row) => [...row]);
  const x = Math.floor((state.cols - matrix[0].length) / 2);
  const current: ActivePiece = { type: template.type, matrix, x, y: 0 };
  const blocked = !canPlace(state, matrix, x, 0);
  return { state: { ...state, current }, blocked };
}
