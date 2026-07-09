import { describe, expect, it } from 'vitest';

import {
  applyFailed,
  applySolved,
  initCompletionState,
  isRaceOver,
  raceWinner,
} from './completionRace.js';

describe('completionRace', () => {
  it('ends a firstToSolve race the instant one seat solves', () => {
    let state = initCompletionState(2, { kind: 'firstToSolve' });
    expect(isRaceOver(state)).toBe(false);

    state = applySolved(state, 1, 4200);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBe(1);
  });

  it('ends a firstToSolve race as a tie when everyone fails', () => {
    let state = initCompletionState(2, { kind: 'firstToSolve' });
    state = applyFailed(state, 0);
    expect(isRaceOver(state)).toBe(false);

    state = applyFailed(state, 1);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBeNull();
  });

  it('waits for every seat in a bestTime race, then picks the fastest solve', () => {
    let state = initCompletionState(2, { kind: 'bestTime' });
    state = applySolved(state, 0, 9000);
    expect(isRaceOver(state)).toBe(false);

    state = applySolved(state, 1, 6000);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBe(1);
  });

  it('lets a solver beat a failer in bestTime', () => {
    let state = initCompletionState(2, { kind: 'bestTime' });
    state = applySolved(state, 0, 12000);
    state = applyFailed(state, 1);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBe(0);
  });

  it('breaks a double solve by the lower time', () => {
    let state = initCompletionState(2, { kind: 'firstToSolve' });
    state = applySolved(state, 0, 5000);
    state = applySolved(state, 1, 3000);
    expect(raceWinner(state)).toBe(1);
  });

  it('returns null when two solves tie on time', () => {
    let state = initCompletionState(2, { kind: 'bestTime' });
    state = applySolved(state, 0, 5000);
    state = applySolved(state, 1, 5000);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBeNull();
  });

  it('ignores a duplicate finish for a seat', () => {
    let state = initCompletionState(2, { kind: 'bestTime' });
    state = applySolved(state, 0, 5000);
    state = applySolved(state, 0, 1); // already solved — must not overwrite
    expect(state.seats[0].timeMs).toBe(5000);
  });
});
