import { nextSeat, type Seat, type TurnRules } from '../../shared/turn/turnGame.js';

const SEAT_COUNT = 2;
/** Seat count, exported for the multiplayer panel capacity. */
export const SEATS = SEAT_COUNT;
export const POINT_COUNT = 24;
export const PIECES_PER_PLAYER = 9;

/**
 * The 24 board points, indexed 0–23, laid out as three nested squares. Pixel
 * coordinates (0–6 grid) for rendering live in the game controller; here only the
 * mill lines and adjacency matter.
 */
const MILLS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
  [12, 13, 14],
  [15, 16, 17],
  [18, 19, 20],
  [21, 22, 23],
  [0, 9, 21],
  [3, 10, 18],
  [6, 11, 15],
  [1, 4, 7],
  [16, 19, 22],
  [8, 12, 17],
  [5, 13, 20],
  [2, 14, 23],
];

const ADJACENCY: ReadonlyArray<readonly number[]> = [
  [1, 9],
  [0, 2, 4],
  [1, 14],
  [4, 10],
  [3, 5, 1, 7],
  [4, 13],
  [7, 11],
  [6, 8, 4],
  [7, 12],
  [0, 10, 21],
  [9, 11, 3, 18],
  [10, 6, 15],
  [13, 8, 17],
  [12, 14, 5, 20],
  [13, 2, 23],
  [16, 11],
  [15, 17, 19],
  [16, 12],
  [19, 10],
  [18, 20, 16, 22],
  [19, 13],
  [22, 9],
  [21, 23, 19],
  [22, 14],
];

export type MillMove =
  | { type: 'place'; to: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'remove'; at: number };

export interface MillState {
  board: Array<Seat | null>;
  current: Seat;
  /** Pieces each seat has placed during the placing phase (0–9). */
  placed: [number, number];
  /** True when the seat on turn has just formed a mill and must remove a piece. */
  mustRemove: boolean;
  winner: Seat | null;
}

export function createMillState(): MillState {
  return {
    board: Array.from({ length: POINT_COUNT }, () => null),
    current: 0,
    placed: [0, 0],
    mustRemove: false,
    winner: null,
  };
}

function pieceCount(board: Array<Seat | null>, seat: Seat): number {
  let n = 0;
  for (const cell of board) if (cell === seat) n++;
  return n;
}

function emptyPoints(board: Array<Seat | null>): number[] {
  const out: number[] = [];
  for (let i = 0; i < POINT_COUNT; i++) if (board[i] === null) out.push(i);
  return out;
}

/** True when the point at `index`, held by `seat`, is part of a completed mill. */
export function partOfMill(board: Array<Seat | null>, index: number, seat: Seat): boolean {
  return MILLS.some((mill) => mill.includes(index) && mill.every((cell) => board[cell] === seat));
}

/** Opponent pieces that may be removed: those outside a mill, else all of them. */
function removablePieces(board: Array<Seat | null>, opponent: Seat): number[] {
  const owned: number[] = [];
  for (let i = 0; i < POINT_COUNT; i++) if (board[i] === opponent) owned.push(i);
  const exposed = owned.filter((i) => !partOfMill(board, i, opponent));
  return exposed.length > 0 ? exposed : owned;
}

function isPlacingPhase(state: MillState, seat: Seat): boolean {
  return state.placed[seat] < PIECES_PER_PLAYER;
}

function canFly(board: Array<Seat | null>, placed: number, seat: Seat): boolean {
  return placed >= PIECES_PER_PLAYER && pieceCount(board, seat) === 3;
}

export function legalMillMoves(state: MillState): MillMove[] {
  if (state.winner !== null) return [];
  const me = state.current;
  const opponent = nextSeat(me, SEAT_COUNT);

  if (state.mustRemove) {
    return removablePieces(state.board, opponent).map((at) => ({ type: 'remove', at }) as const);
  }

  if (isPlacingPhase(state, me)) {
    return emptyPoints(state.board).map((to) => ({ type: 'place', to }) as const);
  }

  const flying = canFly(state.board, state.placed[me], me);
  const moves: MillMove[] = [];
  for (let from = 0; from < POINT_COUNT; from++) {
    if (state.board[from] !== me) continue;
    const targets = flying
      ? emptyPoints(state.board)
      : ADJACENCY[from].filter((t) => state.board[t] === null);
    for (const to of targets) moves.push({ type: 'move', from, to });
  }
  return moves;
}

function hasAnyMove(board: Array<Seat | null>, seat: Seat, placed: number): boolean {
  if (canFly(board, placed, seat)) return emptyPoints(board).length > 0;
  for (let from = 0; from < POINT_COUNT; from++) {
    if (board[from] !== seat) continue;
    if (ADJACENCY[from].some((t) => board[t] === null)) return true;
  }
  return false;
}

export function applyMillMove(state: MillState, move: MillMove): MillState {
  const board = state.board.slice();
  const placed: [number, number] = [state.placed[0], state.placed[1]];
  const me = state.current;
  const opponent = nextSeat(me, SEAT_COUNT);

  let mustRemove = false;
  let current = me;
  let winner: Seat | null = null;

  if (move.type === 'remove') {
    board[move.at] = null;
    if (placed[opponent] >= PIECES_PER_PLAYER && pieceCount(board, opponent) < 3) winner = me;
    current = opponent;
  } else {
    const to = move.to;
    if (move.type === 'place') {
      board[to] = me;
      placed[me]++;
    } else {
      board[move.from] = null;
      board[to] = me;
    }
    if (partOfMill(board, to, me) && removablePieces(board, opponent).length > 0) {
      mustRemove = true;
    } else {
      current = opponent;
    }
  }

  if (!mustRemove && winner === null && placed[current] >= PIECES_PER_PLAYER) {
    if (pieceCount(board, current) < 3 || !hasAnyMove(board, current, placed[current])) {
      winner = nextSeat(current, SEAT_COUNT);
    }
  }

  return { board, current, placed, mustRemove, winner };
}

function millWinner(state: MillState): Seat | null {
  return state.winner;
}

/**
 * Heuristic bot. Placing/moving: pick the move maximising a static board score,
 * with a strong bonus for forming a mill (which lets it capture next). Removing:
 * take the opponent piece defusing the most almost-complete mills. No deep search,
 * but it forms and blocks mills competently.
 */
export function bestMillMove(state: MillState): MillMove | null {
  const moves = legalMillMoves(state);
  if (moves.length === 0) return null;
  const me = state.current;

  if (state.mustRemove) {
    return moves.reduce((best, move) =>
      removalValue(state.board, (move as { at: number }).at, me) >
      removalValue(state.board, (best as { at: number }).at, me)
        ? move
        : best
    );
  }

  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMillMove(state, move);
    let score = evaluate(next.board, me);
    if (next.winner === me) score += 1e6;
    if (next.mustRemove) score += 60; // formed a mill — capture pending
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/** How dangerous the opponent piece at `at` is: almost-mills it participates in. */
function removalValue(board: Array<Seat | null>, at: number, me: Seat): number {
  const opponent = nextSeat(me, SEAT_COUNT);
  return MILLS.filter(
    (mill) =>
      mill.includes(at) &&
      mill.filter((c) => board[c] === opponent).length === 2 &&
      mill.some((c) => board[c] === null)
  ).length;
}

function evaluate(board: Array<Seat | null>, me: Seat): number {
  const opponent = nextSeat(me, SEAT_COUNT);
  let score = 10 * (pieceCount(board, me) - pieceCount(board, opponent));
  for (const mill of MILLS) {
    const mine = mill.filter((c) => board[c] === me).length;
    const theirs = mill.filter((c) => board[c] === opponent).length;
    if (mine === 3) score += 100;
    else if (mine === 2 && theirs === 0) score += 12;
    if (theirs === 3) score -= 100;
    else if (theirs === 2 && mine === 0) score -= 12;
  }
  return score;
}

function currentSeat(state: MillState): Seat {
  return state.current;
}

export const millRules: TurnRules<MillState, MillMove> = {
  seats: SEAT_COUNT,
  initialState: createMillState,
  currentSeat,
  legalMoves: legalMillMoves,
  applyMove: applyMillMove,
  winner: millWinner,
};
