/**
 * Sokoban — pure warehouse logic (no DOM, no time), unit-tested in isolation
 * (`sokoban.test.ts`, which also BFS-solves every shipped level to prove it is
 * winnable). The controller (`SokobanGame`) owns the rendering, the input and the
 * level/undo bookkeeping.
 *
 * The player pushes boxes onto the targets; a box can only be pushed (never
 * pulled) and only into an empty square. A level is solved once every target
 * holds a box. {@link move} is a pure reducer returning the next state — or the
 * **same reference** when the step is blocked, so a caller can cheaply tell
 * whether anything changed (and skip the undo push / sound).
 *
 * A level is authored as rows of characters: `#` wall, ` ` floor, `.` target,
 * `@` player, `+` player on a target, `$` box, `*` box on a target.
 */

export interface Pos {
  r: number;
  c: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DELTA: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export interface SokobanState {
  rows: number;
  cols: number;
  /** Static across a level (shared between states). */
  walls: boolean[][];
  /** Static across a level (shared between states). */
  targets: boolean[][];
  boxes: boolean[][];
  player: Pos;
  moves: number;
  pushes: number;
}

/** Parses a level's character rows into a fresh {@link SokobanState}. */
export function parseLevel(rows: string[]): SokobanState {
  const cols = Math.max(...rows.map((r) => r.length));
  const walls: boolean[][] = [];
  const targets: boolean[][] = [];
  const boxes: boolean[][] = [];
  let player: Pos = { r: 0, c: 0 };
  for (let r = 0; r < rows.length; r++) {
    const wRow: boolean[] = [];
    const tRow: boolean[] = [];
    const bRow: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = rows[r][c] ?? ' ';
      wRow.push(ch === '#');
      tRow.push(ch === '.' || ch === '*' || ch === '+');
      bRow.push(ch === '$' || ch === '*');
      if (ch === '@' || ch === '+') player = { r, c };
    }
    walls.push(wRow);
    targets.push(tRow);
    boxes.push(bRow);
  }
  return { rows: rows.length, cols, walls, targets, boxes, player, moves: 0, pushes: 0 };
}

const inBounds = (state: SokobanState, r: number, c: number): boolean =>
  r >= 0 && r < state.rows && c >= 0 && c < state.cols;

/** One step in `dir`: walks, pushes a box, or (if blocked) returns `state` as-is. */
export function move(state: SokobanState, dir: Dir): SokobanState {
  const [dr, dc] = DELTA[dir];
  const nr = state.player.r + dr;
  const nc = state.player.c + dc;
  if (!inBounds(state, nr, nc) || state.walls[nr][nc]) return state;

  if (state.boxes[nr][nc]) {
    const br = nr + dr;
    const bc = nc + dc;
    if (!inBounds(state, br, bc) || state.walls[br][bc] || state.boxes[br][bc]) return state;
    const boxes = state.boxes.map((row) => row.slice());
    boxes[nr][nc] = false;
    boxes[br][bc] = true;
    return {
      ...state,
      boxes,
      player: { r: nr, c: nc },
      moves: state.moves + 1,
      pushes: state.pushes + 1,
    };
  }
  return { ...state, player: { r: nr, c: nc }, moves: state.moves + 1 };
}

/** Whether every target holds a box. */
export function isSolved(state: SokobanState): boolean {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.targets[r][c] && !state.boxes[r][c]) return false;
    }
  }
  return true;
}
