/**
 * Pure completion-race state model for solve-to-win games played on the same
 * shared challenge (Taquin, Word Search, Minesweeper, Motus, Hangman). Both
 * seats attack an identical host-authoritative puzzle; the shared state only
 * tracks who solved (and how fast) to decide the winner. No DOM, no I/O.
 */

export const OP_CHALLENGE = 1;
export const OP_SOLVED = 2;
export const OP_FAILED = 3;
export const OP_RESTART = 4;

export type CompletionFinish =
  | { kind: 'firstToSolve' } // first correct solve wins immediately
  | { kind: 'bestTime' }; // all seats must finish; lowest solve time wins

export interface SeatCompletion {
  solved: boolean;
  failed: boolean;
  timeMs: number;
}

export interface CompletionState {
  seats: SeatCompletion[];
  finish: CompletionFinish;
}

export function initCompletionState(seatCount: number, finish: CompletionFinish): CompletionState {
  return {
    seats: Array.from({ length: seatCount }, () => ({ solved: false, failed: false, timeMs: 0 })),
    finish,
  };
}

export function applySolved(state: CompletionState, seat: number, timeMs: number): CompletionState {
  if (!state.seats[seat] || state.seats[seat].solved || state.seats[seat].failed) return state;
  const seats = state.seats.map((s, i) => (i === seat ? { ...s, solved: true, timeMs } : s));
  return { ...state, seats };
}

export function applyFailed(state: CompletionState, seat: number): CompletionState {
  if (!state.seats[seat] || state.seats[seat].solved || state.seats[seat].failed) return state;
  const seats = state.seats.map((s, i) => (i === seat ? { ...s, failed: true } : s));
  return { ...state, seats };
}

/** Every seat has reached a terminal state (solved or failed). */
function allFinished(state: CompletionState): boolean {
  return state.seats.every((seat) => seat.solved || seat.failed);
}

export function isRaceOver(state: CompletionState): boolean {
  if (state.finish.kind === 'firstToSolve' && state.seats.some((seat) => seat.solved)) return true;
  return allFinished(state);
}

/**
 * Winner = the solved seat with the lowest time. `null` when the race is still
 * running, nobody solved, or two seats tie on time. The min-time rule makes the
 * result deterministic on both clients regardless of message arrival order.
 */
export function raceWinner(state: CompletionState): number | null {
  if (!isRaceOver(state)) return null;
  const solved = state.seats
    .map((seat, index) => ({ timeMs: seat.timeMs, index, solved: seat.solved }))
    .filter((seat) => seat.solved);
  if (solved.length === 0) return null;
  const best = Math.min(...solved.map((seat) => seat.timeMs));
  const winners = solved.filter((seat) => seat.timeMs === best);
  return winners.length === 1 ? winners[0].index : null;
}
