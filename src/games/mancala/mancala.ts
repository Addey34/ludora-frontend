/**
 * Mancala (Kalah variant) — pure rules (no DOM, no time), unit-testable in
 * isolation. Plugs into the generic turn engine as a {@link TurnRules}.
 *
 * 14 pits in a ring:
 *   0-5  = seat 0 pockets (bottom row, left → right)
 *   6    = seat 0 store   (right side)
 *   7-12 = seat 1 pockets (top row, right → left from P0's view)
 *   13   = seat 1 store   (left side)
 *
 * Sowing is counter-clockwise (index+1 mod 14), skipping the opponent's store.
 * Extra-turn rule: last seed in own store → same seat plays again.
 * Capture rule: last seed in an empty own pit whose opposite is non-empty →
 * take both groups into own store.
 * End condition: either side's pits all empty → sweep remaining seeds, compare
 * stores.
 */

import { Seat, TurnRules } from '../../shared/turn/turnGame.js';

export const SEATS = 2;
export const PITS_PER_SIDE = 6;
export const STORE_0 = 6;
export const STORE_1 = 13;
const P0_PITS = [0, 1, 2, 3, 4, 5] as const;
const P1_PITS = [7, 8, 9, 10, 11, 12] as const;

export interface MancalaState {
  pits: readonly number[];
  current: Seat;
  /** True once either side's row is empty and final scores are tallied. */
  gameOver: boolean;
  /** The winning seat, or null on a draw (only meaningful when gameOver). */
  winner: Seat | null;
}

export interface MancalaMove {
  /** Absolute pit index (0-5 for seat 0, 7-12 for seat 1). */
  pit: number;
}

export const eqMove = (a: MancalaMove, b: MancalaMove): boolean => a.pit === b.pit;

export const storeOf = (seat: Seat): number => (seat === 0 ? STORE_0 : STORE_1);
export const pitsOf = (seat: Seat): readonly number[] => (seat === 0 ? P0_PITS : P1_PITS);
/** The pit directly across the board from `pit` (only valid for 0-5 and 7-12). */
export const oppositeOf = (pit: number): number => 12 - pit;

export function initialState(): MancalaState {
  const pits = new Array<number>(14).fill(4);
  pits[STORE_0] = 0;
  pits[STORE_1] = 0;
  return { pits, current: 0, gameOver: false, winner: null };
}

export function applyMove(state: MancalaState, move: MancalaMove): MancalaState {
  const pits = [...state.pits] as number[];
  const seat = state.current as Seat;
  const store = storeOf(seat);
  const opStore = seat === 0 ? STORE_1 : STORE_0;

  let seeds = pits[move.pit];
  pits[move.pit] = 0;
  let idx = move.pit;
  while (seeds > 0) {
    idx = (idx + 1) % 14;
    if (idx === opStore) continue;
    pits[idx]++;
    seeds--;
  }

  const myPits = seat === 0 ? P0_PITS : P1_PITS;
  let next: Seat = (seat === 0 ? 1 : 0) as Seat;

  if (idx === store) {
    next = seat; // extra turn
  } else if ((myPits as readonly number[]).includes(idx) && pits[idx] === 1) {
    const opp = oppositeOf(idx);
    if (pits[opp] > 0) {
      pits[store] += pits[opp] + 1;
      pits[idx] = 0;
      pits[opp] = 0;
    }
  }

  const p0Empty = P0_PITS.every((i) => pits[i] === 0);
  const p1Empty = P1_PITS.every((i) => pits[i] === 0);

  if (p0Empty || p1Empty) {
    for (const i of P0_PITS) {
      pits[STORE_0] += pits[i];
      pits[i] = 0;
    }
    for (const i of P1_PITS) {
      pits[STORE_1] += pits[i];
      pits[i] = 0;
    }
    let winner: Seat | null = null;
    if (pits[STORE_0] > pits[STORE_1]) winner = 0;
    else if (pits[STORE_1] > pits[STORE_0]) winner = 1;
    return { pits, current: next, gameOver: true, winner };
  }

  return { pits, current: next, gameOver: false, winner: null };
}

export function legalMoves(state: MancalaState): MancalaMove[] {
  if (state.gameOver) return [];
  return (pitsOf(state.current) as number[])
    .filter((i) => state.pits[i] > 0)
    .map((pit) => ({ pit }));
}

export const rules: TurnRules<MancalaState, MancalaMove> = {
  seats: SEATS,
  initialState,
  currentSeat: (s) => s.current,
  legalMoves,
  applyMove,
  winner: (s) => s.winner,
};
