import {
  nextSeat,
  type Seat,
  type TurnRules,
} from '../../shared/turn/turnGame.js';

export const BOARD_WIDTH = 3;
export const SEAT_COUNT = 2;
const LINE_LENGTH = 3;
const CELL_COUNT = BOARD_WIDTH * BOARD_WIDTH;

export interface {{Class}}Move {
  index: number;
}

export interface {{Class}}State {
  cells: Array<Seat | null>;
  current: Seat;
  winner: Seat | null;
}

export function create{{Class}}State(): {{Class}}State {
  return {
    cells: Array.from({ length: CELL_COUNT }, () => null),
    current: 0,
    winner: null,
  };
}

export function legal{{Class}}Moves(state: {{Class}}State): {{Class}}Move[] {
  if (state.winner !== null) return [];
  return state.cells.flatMap((cell, index) => (cell === null ? [{ index }] : []));
}

export function apply{{Class}}Move(
  state: {{Class}}State,
  move: {{Class}}Move
): {{Class}}State {
  const cells = state.cells.slice();
  cells[move.index] = state.current;
  const winner = find{{Class}}Winner(cells);
  return {
    cells,
    current: winner === null ? nextSeat(state.current, SEAT_COUNT) : state.current,
    winner,
  };
}

export function find{{Class}}Winner(cells: Array<Seat | null>): Seat | null {
  const lines: number[][] = [];
  for (let row = 0; row < BOARD_WIDTH; row++) {
    lines.push(Array.from({ length: LINE_LENGTH }, (_, column) => row * BOARD_WIDTH + column));
  }
  for (let column = 0; column < BOARD_WIDTH; column++) {
    lines.push(Array.from({ length: LINE_LENGTH }, (_, row) => row * BOARD_WIDTH + column));
  }
  lines.push(
    Array.from({ length: LINE_LENGTH }, (_, index) => index * (BOARD_WIDTH + 1)),
    Array.from({ length: LINE_LENGTH }, (_, index) => (index + 1) * (BOARD_WIDTH - 1))
  );

  for (const line of lines) {
    const seat = cells[line[0]];
    if (seat !== null && line.every((index) => cells[index] === seat)) return seat;
  }
  return null;
}

export function is{{Class}}Draw(state: {{Class}}State): boolean {
  return state.winner === null && state.cells.every((cell) => cell !== null);
}

function currentSeat(state: {{Class}}State): Seat {
  return state.current;
}

function winner(state: {{Class}}State): Seat | null {
  return state.winner;
}

export const {{camel}}Rules: TurnRules<{{Class}}State, {{Class}}Move> = {
  seats: SEAT_COUNT,
  initialState: create{{Class}}State,
  currentSeat,
  legalMoves: legal{{Class}}Moves,
  applyMove: apply{{Class}}Move,
  winner,
};
