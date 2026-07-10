import { TurnRules } from '../../shared/turn/turnGame.js';

/** A player index (0-based). 2 to 4 players are supported. */
export type Seat = number;

export interface DBState {
  n: number;
  /** Number of players in this game (2–4). */
  players: number;
  /** hEdges[r][c]: horizontal edge between dot(r,c) and dot(r,c+1). r in 0..n, c in 0..n-1 */
  hEdges: boolean[][];
  /** vEdges[r][c]: vertical edge between dot(r,c) and dot(r+1,c). r in 0..n-1, c in 0..n */
  vEdges: boolean[][];
  /** boxes[r][c]: owner seat of box at (r,c), or null. r,c in 0..n-1 */
  boxes: (Seat | null)[][];
  /** Boxes claimed per seat (length = players). */
  scores: number[];
  seat: Seat;
  totalEdges: number;
  filledEdges: number;
}

export type DBMove =
  | { dir: 'h'; row: number; col: number }
  | { dir: 'v'; row: number; col: number };

function isBoxComplete(state: DBState, r: number, c: number): boolean {
  return (
    state.hEdges[r][c] && state.hEdges[r + 1][c] && state.vEdges[r][c] && state.vEdges[r][c + 1]
  );
}

export class DotsBoxesRules implements TurnRules<DBState, DBMove> {
  readonly seats: number;

  constructor(
    private readonly n: number = 4,
    players = 2
  ) {
    this.seats = players;
  }

  initialState(): DBState {
    const n = this.n;
    const hEdges = Array.from({ length: n + 1 }, () => new Array(n).fill(false) as boolean[]);
    const vEdges = Array.from({ length: n }, () => new Array(n + 1).fill(false) as boolean[]);
    const boxes = Array.from({ length: n }, () => new Array(n).fill(null) as (Seat | null)[]);
    return {
      n,
      players: this.seats,
      hEdges,
      vEdges,
      boxes,
      scores: new Array(this.seats).fill(0) as number[],
      seat: 0,
      totalEdges: 2 * n * (n + 1),
      filledEdges: 0,
    };
  }

  currentSeat(state: DBState): Seat {
    return state.seat;
  }

  legalMoves(state: DBState): DBMove[] {
    if (state.filledEdges >= state.totalEdges) return [];
    const moves: DBMove[] = [];
    const { n, hEdges, vEdges } = state;
    for (let r = 0; r <= n; r++)
      for (let c = 0; c < n; c++) if (!hEdges[r][c]) moves.push({ dir: 'h', row: r, col: c });
    for (let r = 0; r < n; r++)
      for (let c = 0; c <= n; c++) if (!vEdges[r][c]) moves.push({ dir: 'v', row: r, col: c });
    return moves;
  }

  applyMove(state: DBState, move: DBMove): DBState {
    const hEdges = state.hEdges.map((r) => [...r]);
    const vEdges = state.vEdges.map((r) => [...r]);
    const boxes = state.boxes.map((r) => [...r]);
    const scores = [...state.scores];

    if (move.dir === 'h') hEdges[move.row][move.col] = true;
    else vEdges[move.row][move.col] = true;

    const next: DBState = {
      ...state,
      hEdges,
      vEdges,
      boxes,
      scores,
      filledEdges: state.filledEdges + 1,
    };

    let boxesClaimed = 0;
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (boxes[r][c] === null && isBoxComplete(next, r, c)) {
          boxes[r][c] = state.seat;
          scores[state.seat]++;
          boxesClaimed++;
        }
      }
    }

    // Claiming a box grants another turn; otherwise the turn moves to the next
    // seat (wrapping around all players).
    next.seat = boxesClaimed > 0 ? state.seat : (state.seat + 1) % state.players;
    return next;
  }

  winner(state: DBState): Seat | null {
    if (state.filledEdges < state.totalEdges) return null;
    const best = Math.max(...state.scores);
    const leaders = state.scores.filter((s) => s === best).length;
    if (leaders > 1) return null; // tie
    return state.scores.indexOf(best);
  }
}
