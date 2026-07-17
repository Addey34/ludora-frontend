import { nextSeat, type Seat, type TurnRules } from '../../shared/turn/turnGame.js';

export const BOARD_SIZE = 15;
const SEAT_COUNT = 2;
/** Seat count, exported for the multiplayer panel capacity. */
export const SEATS = SEAT_COUNT;
const WIN_LENGTH = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** The four line axes: horizontal, vertical, and both diagonals. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Score of a completed five (or more) — dominates every other pattern. */
const WIN_SCORE = 1e7;

export interface GomokuMove {
  index: number;
}

export interface GomokuState {
  cells: Array<Seat | null>;
  current: Seat;
  winner: Seat | null;
  last: number | null;
}

export function createGomokuState(): GomokuState {
  return {
    cells: Array.from({ length: CELL_COUNT }, () => null),
    current: 0,
    winner: null,
    last: null,
  };
}

export function legalGomokuMoves(state: GomokuState): GomokuMove[] {
  if (state.winner !== null) return [];
  return state.cells.flatMap((cell, index) => (cell === null ? [{ index }] : []));
}

export function applyGomokuMove(state: GomokuState, move: GomokuMove): GomokuState {
  const cells = state.cells.slice();
  cells[move.index] = state.current;
  const winner = makesLine(cells, move.index, state.current) ? state.current : null;
  return {
    cells,
    current: winner === null ? nextSeat(state.current, SEAT_COUNT) : state.current,
    winner,
    last: move.index,
  };
}

export function isGomokuDraw(state: GomokuState): boolean {
  return state.winner === null && state.cells.every((cell) => cell !== null);
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

/** True when the stone just placed at `index` completes a run of WIN_LENGTH. */
function makesLine(cells: Array<Seat | null>, index: number, seat: Seat): boolean {
  const x = index % BOARD_SIZE;
  const y = Math.floor(index / BOARD_SIZE);
  for (const [dx, dy] of DIRECTIONS) {
    const count = 1 + countRun(cells, x, y, dx, dy, seat) + countRun(cells, x, y, -dx, -dy, seat);
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

/** Consecutive `seat` stones stepping (dx,dy) from (x,y), excluding the origin. */
function countRun(
  cells: Array<Seat | null>,
  x: number,
  y: number,
  dx: number,
  dy: number,
  seat: Seat
): number {
  let n = 0;
  let cx = x + dx;
  let cy = y + dy;
  while (inBounds(cx, cy) && cells[cy * BOARD_SIZE + cx] === seat) {
    n++;
    cx += dx;
    cy += dy;
  }
  return n;
}

/**
 * Heuristic bot: no full search is feasible on a 15×15 board, so each candidate
 * cell is scored by the line patterns it would create (attack) and deny (defence).
 * Candidates are pruned to cells near an existing stone. The bot always completes
 * its own five and blocks an opponent four / open three.
 */
export function bestGomokuMove(state: GomokuState): GomokuMove | null {
  const candidates = candidateCells(state);
  if (candidates.length === 0) return null;
  const me = state.current;
  const opponent = nextSeat(me, SEAT_COUNT);

  let bestIndex = candidates[0];
  let bestScore = -Infinity;
  for (const index of candidates) {
    const attack = placementScore(state.cells, index, me);
    if (attack >= WIN_SCORE) return { index }; // take the win immediately
    const defence = placementScore(state.cells, index, opponent);
    const score = attack + defence * 0.9; // value own threats just above blocking
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return { index: bestIndex };
}

/** Empty cells within two steps of a stone (or the centre on an empty board). */
function candidateCells(state: GomokuState): number[] {
  const { cells } = state;
  if (!cells.some((cell) => cell !== null)) return [Math.floor(CELL_COUNT / 2)];

  const seen = new Set<number>();
  for (let i = 0; i < CELL_COUNT; i++) {
    if (cells[i] === null) continue;
    const x = i % BOARD_SIZE;
    const y = Math.floor(i / BOARD_SIZE);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const j = ny * BOARD_SIZE + nx;
        if (cells[j] === null) seen.add(j);
      }
    }
  }
  return [...seen];
}

/** Sum, over the four axes, of the pattern value of playing `seat` at `index`. */
function placementScore(cells: Array<Seat | null>, index: number, seat: Seat): number {
  const x = index % BOARD_SIZE;
  const y = Math.floor(index / BOARD_SIZE);
  let total = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const forward = directionalRun(cells, x, y, dx, dy, seat);
    const backward = directionalRun(cells, x, y, -dx, -dy, seat);
    const count = 1 + forward.run + backward.run;
    const openEnds = (forward.open ? 1 : 0) + (backward.open ? 1 : 0);
    total += patternValue(count, openEnds);
  }
  return total;
}

function directionalRun(
  cells: Array<Seat | null>,
  x: number,
  y: number,
  dx: number,
  dy: number,
  seat: Seat
): { run: number; open: boolean } {
  const run = countRun(cells, x, y, dx, dy, seat);
  const cx = x + dx * (run + 1);
  const cy = y + dy * (run + 1);
  return { run, open: inBounds(cx, cy) && cells[cy * BOARD_SIZE + cx] === null };
}

/** Value of a run of `count` stones with `openEnds` extendable ends (0–2). */
function patternValue(count: number, openEnds: number): number {
  if (count >= WIN_LENGTH) return WIN_SCORE;
  if (openEnds === 0) return 0; // dead line, cannot grow to five
  if (count === 4) return openEnds === 2 ? 1_000_000 : 10_000;
  if (count === 3) return openEnds === 2 ? 5_000 : 500;
  if (count === 2) return openEnds === 2 ? 200 : 20;
  return openEnds === 2 ? 5 : 1;
}

function currentSeat(state: GomokuState): Seat {
  return state.current;
}

function winner(state: GomokuState): Seat | null {
  return state.winner;
}

export const gomokuRules: TurnRules<GomokuState, GomokuMove> = {
  seats: SEAT_COUNT,
  initialState: createGomokuState,
  currentSeat,
  legalMoves: legalGomokuMoves,
  applyMove: applyGomokuMove,
  winner,
};
