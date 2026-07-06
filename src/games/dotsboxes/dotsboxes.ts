import { TurnRules } from '../../shared/turn/turnGame.js';

export type Seat = 0 | 1;

export interface DBState {
  n: number;
  /** hEdges[r][c]: horizontal edge between dot(r,c) and dot(r,c+1). r in 0..n, c in 0..n-1 */
  hEdges: boolean[][];
  /** vEdges[r][c]: vertical edge between dot(r,c) and dot(r+1,c). r in 0..n-1, c in 0..n */
  vEdges: boolean[][];
  /** boxes[r][c]: owner of box at (r,c). r,c in 0..n-1 */
  boxes: (Seat | null)[][];
  scores: [number, number];
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
  readonly seats = 2;

  constructor(private readonly n: number = 4) {}

  initialState(): DBState {
    const n = this.n;
    const hEdges = Array.from({ length: n + 1 }, () => new Array(n).fill(false) as boolean[]);
    const vEdges = Array.from({ length: n }, () => new Array(n + 1).fill(false) as boolean[]);
    const boxes = Array.from({ length: n }, () => new Array(n).fill(null) as (Seat | null)[]);
    return {
      n,
      hEdges,
      vEdges,
      boxes,
      scores: [0, 0],
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
    const scores: [number, number] = [...state.scores];

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

    // Extra turn if a box was claimed; otherwise switch seat
    next.seat = boxesClaimed > 0 ? state.seat : (((state.seat + 1) % 2) as Seat);
    return next;
  }

  winner(state: DBState): Seat | null {
    if (state.filledEdges < state.totalEdges) return null;
    if (state.scores[0] > state.scores[1]) return 0;
    if (state.scores[1] > state.scores[0]) return 1;
    return null; // draw
  }
}

export function dotsBoxesRulesFor(n: number): DotsBoxesRules {
  return new DotsBoxesRules(n);
}
