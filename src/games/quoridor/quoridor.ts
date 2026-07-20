import { nextSeat, type Seat, type TurnRules } from '../../shared/turn/turnGame.js';

export const BOARD_SIZE = 9;
export const WALLS_PER_PLAYER = 10;
export const SEATS = 2;

const DIRECTIONS: ReadonlyArray<Readonly<Position>> = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export interface Position {
  row: number;
  col: number;
}

export type WallOrientation = 'horizontal' | 'vertical';

export interface QuoridorWall {
  row: number;
  col: number;
  orientation: WallOrientation;
}

export type QuoridorMove = { type: 'pawn'; to: Position } | { type: 'wall'; wall: QuoridorWall };

export interface QuoridorState {
  pawns: [Position, Position];
  walls: QuoridorWall[];
  wallsRemaining: [number, number];
  current: Seat;
  winner: Seat | null;
}

export function createQuoridorState(): QuoridorState {
  const center = Math.floor(BOARD_SIZE / 2);
  return {
    pawns: [
      { row: BOARD_SIZE - 1, col: center },
      { row: 0, col: center },
    ],
    walls: [],
    wallsRemaining: [WALLS_PER_PLAYER, WALLS_PER_PLAYER],
    current: 0,
    winner: null,
  };
}

export function legalPawnMoves(state: QuoridorState, seat: Seat = state.current): Position[] {
  if (state.winner !== null) return [];
  const from = state.pawns[seat];
  const opponent = state.pawns[nextSeat(seat, SEATS)];
  const moves: Position[] = [];

  for (const direction of DIRECTIONS) {
    const adjacent = add(from, direction);
    if (!inBounds(adjacent) || isBlocked(state.walls, from, adjacent)) continue;
    if (!samePosition(adjacent, opponent)) {
      moves.push(adjacent);
      continue;
    }

    const beyond = add(opponent, direction);
    if (inBounds(beyond) && !isBlocked(state.walls, opponent, beyond)) {
      moves.push(beyond);
      continue;
    }

    const diagonals =
      direction.row !== 0
        ? [
            { row: 0, col: -1 },
            { row: 0, col: 1 },
          ]
        : [
            { row: -1, col: 0 },
            { row: 1, col: 0 },
          ];
    for (const side of diagonals) {
      const diagonal = add(opponent, side);
      if (inBounds(diagonal) && !isBlocked(state.walls, opponent, diagonal)) {
        moves.push(diagonal);
      }
    }
  }

  return uniquePositions(moves);
}

export function legalQuoridorMoves(state: QuoridorState): QuoridorMove[] {
  if (state.winner !== null) return [];
  const moves: QuoridorMove[] = legalPawnMoves(state).map((to) => ({ type: 'pawn', to }));
  if (state.wallsRemaining[state.current] <= 0) return moves;

  for (let row = 0; row < BOARD_SIZE - 1; row++) {
    for (let col = 0; col < BOARD_SIZE - 1; col++) {
      for (const orientation of ['horizontal', 'vertical'] as const) {
        const wall = { row, col, orientation };
        if (isLegalWall(state, wall)) moves.push({ type: 'wall', wall });
      }
    }
  }
  return moves;
}

export function isLegalWall(
  state: QuoridorState,
  wall: QuoridorWall,
  seat: Seat = state.current
): boolean {
  if (state.winner !== null || state.wallsRemaining[seat] <= 0 || !wallInBounds(wall)) {
    return false;
  }
  for (const placed of state.walls) {
    if (wallsConflict(placed, wall)) return false;
  }

  const next = { ...state, walls: [...state.walls, wall] };
  return hasPathToGoal(next, 0) && hasPathToGoal(next, 1);
}

export function applyQuoridorMove(state: QuoridorState, move: QuoridorMove): QuoridorState {
  const seat = state.current;
  const pawns: [Position, Position] = [{ ...state.pawns[0] }, { ...state.pawns[1] }];
  const walls = state.walls.map((wall) => ({ ...wall }));
  const wallsRemaining: [number, number] = [state.wallsRemaining[0], state.wallsRemaining[1]];

  if (move.type === 'pawn') pawns[seat] = { ...move.to };
  else {
    walls.push({ ...move.wall });
    wallsRemaining[seat]--;
  }

  const won = move.type === 'pawn' && move.to.row === goalRow(seat);
  return {
    pawns,
    walls,
    wallsRemaining,
    current: won ? seat : nextSeat(seat, SEATS),
    winner: won ? seat : null,
  };
}

export function hasPathToGoal(state: QuoridorState, seat: Seat): boolean {
  return Number.isFinite(shortestPathLength(state, seat));
}

export function shortestPathLength(state: QuoridorState, seat: Seat): number {
  const start = state.pawns[seat];
  const targetRow = goalRow(seat);
  const queue: Array<{ position: Position; distance: number }> = [{ position: start, distance: 0 }];
  const visited = new Set<string>([positionKey(start)]);

  for (let index = 0; index < queue.length; index++) {
    const { position, distance } = queue[index];
    if (position.row === targetRow) return distance;
    for (const direction of DIRECTIONS) {
      const next = add(position, direction);
      const key = positionKey(next);
      if (!inBounds(next) || visited.has(key) || isBlocked(state.walls, position, next)) {
        continue;
      }
      visited.add(key);
      queue.push({ position: next, distance: distance + 1 });
    }
  }
  return Infinity;
}

export function quoridorMoveEquals(a: QuoridorMove, b: QuoridorMove): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'pawn' && b.type === 'pawn') return samePosition(a.to, b.to);
  if (a.type === 'wall' && b.type === 'wall') return sameWall(a.wall, b.wall);
  return false;
}

function currentSeat(state: QuoridorState): Seat {
  return state.current;
}

function winner(state: QuoridorState): Seat | null {
  return state.winner;
}

export const quoridorRules: TurnRules<QuoridorState, QuoridorMove> = {
  seats: SEATS,
  initialState: createQuoridorState,
  currentSeat,
  legalMoves: legalQuoridorMoves,
  applyMove: applyQuoridorMove,
  winner,
};

function isBlocked(walls: QuoridorWall[], from: Position, to: Position): boolean {
  if (from.col === to.col) {
    const boundaryRow = Math.min(from.row, to.row);
    return walls.some(
      (wall) =>
        wall.orientation === 'horizontal' &&
        wall.row === boundaryRow &&
        (wall.col === from.col || wall.col + 1 === from.col)
    );
  }
  const boundaryCol = Math.min(from.col, to.col);
  return walls.some(
    (wall) =>
      wall.orientation === 'vertical' &&
      wall.col === boundaryCol &&
      (wall.row === from.row || wall.row + 1 === from.row)
  );
}

function wallsConflict(a: QuoridorWall, b: QuoridorWall): boolean {
  if (a.orientation !== b.orientation) return a.row === b.row && a.col === b.col;
  const aSegments = wallSegments(a);
  const bSegments = new Set(wallSegments(b));
  return aSegments.some((segment) => bSegments.has(segment));
}

function wallSegments(wall: QuoridorWall): string[] {
  return wall.orientation === 'horizontal'
    ? [`h:${wall.row}:${wall.col}`, `h:${wall.row}:${wall.col + 1}`]
    : [`v:${wall.row}:${wall.col}`, `v:${wall.row + 1}:${wall.col}`];
}

function wallInBounds(wall: QuoridorWall): boolean {
  return (
    Number.isInteger(wall.row) &&
    Number.isInteger(wall.col) &&
    wall.row >= 0 &&
    wall.row < BOARD_SIZE - 1 &&
    wall.col >= 0 &&
    wall.col < BOARD_SIZE - 1
  );
}

function goalRow(seat: Seat): number {
  return seat === 0 ? 0 : BOARD_SIZE - 1;
}

function add(position: Position, delta: Readonly<Position>): Position {
  return { row: position.row + delta.row, col: position.col + delta.col };
}

function inBounds(position: Position): boolean {
  return (
    position.row >= 0 && position.row < BOARD_SIZE && position.col >= 0 && position.col < BOARD_SIZE
  );
}

function uniquePositions(positions: Position[]): Position[] {
  const seen = new Set<string>();
  return positions.filter((position) => {
    const key = positionKey(position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function sameWall(a: QuoridorWall, b: QuoridorWall): boolean {
  return a.row === b.row && a.col === b.col && a.orientation === b.orientation;
}
