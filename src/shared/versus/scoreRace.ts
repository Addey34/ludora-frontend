/**
 * Pure score-race state model for solo real-time games played side-by-side.
 * Each client owns its own simulation; the shared state only compares scores.
 */

export const OP_PROGRESS = 1;
export const OP_FINISHED = 2;
export const OP_RESTART = 3;

export type RaceFinish =
  | { kind: 'time'; seconds: number }
  | { kind: 'toDeath' }
  | { kind: 'target'; score: number };

export interface SeatRace {
  score: number;
  alive: boolean;
  finished: boolean;
}

export interface RaceState {
  seats: SeatRace[];
  finish: RaceFinish;
  winnerSeat: number | null;
}

export function initRaceState(seatCount: number, finish: RaceFinish): RaceState {
  return {
    seats: Array.from({ length: seatCount }, () => ({ score: 0, alive: true, finished: false })),
    finish,
    winnerSeat: null,
  };
}

export function applyProgress(
  state: RaceState,
  seat: number,
  score: number,
  alive: boolean
): RaceState {
  if (!state.seats[seat]) return state;
  const seats = state.seats.map((s, i) => (i === seat ? { ...s, score, alive } : s));
  return withTargetWinner({ ...state, seats }, seat, score);
}

export function applyFinished(state: RaceState, seat: number, score: number): RaceState {
  if (!state.seats[seat]) return state;
  const seats = state.seats.map((s, i) =>
    i === seat ? { ...s, score, alive: false, finished: true } : s
  );
  return withTargetWinner({ ...state, seats }, seat, score);
}

export function isRaceOver(state: RaceState): boolean {
  if (state.finish.kind === 'target') return state.winnerSeat !== null;
  return state.seats.every((seat) => seat.finished);
}

export function raceWinner(state: RaceState): number | null {
  if (!isRaceOver(state)) return null;
  if (state.finish.kind === 'target') return state.winnerSeat;

  const best = Math.max(...state.seats.map((seat) => seat.score));
  const winners = state.seats
    .map((seat, index) => ({ score: seat.score, index }))
    .filter((seat) => seat.score === best);
  return winners.length === 1 ? winners[0].index : null;
}

function withTargetWinner(state: RaceState, seat: number, score: number): RaceState {
  if (state.finish.kind !== 'target' || state.winnerSeat !== null) return state;
  return score >= state.finish.score ? { ...state, winnerSeat: seat } : state;
}
