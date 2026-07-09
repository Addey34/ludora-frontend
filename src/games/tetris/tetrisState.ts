export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type CellValue = TetrominoType | 'ghost' | null;

export interface Tetromino {
  type: TetrominoType;
  matrix: number[][];
}

export interface ActivePiece {
  type: TetrominoType;
  matrix: number[][];
  x: number;
  y: number;
}

export interface TetrisGameState {
  cols: number;
  rows: number;
  grid: (TetrominoType | null)[][];
  current: ActivePiece | null;
  dropInterval: number;
  lines: number;
  level: number;
  clearingRows: number[];
}
