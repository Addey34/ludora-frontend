import { describe, expect, it } from 'vitest';

import {
  applyFinished,
  applyProgress,
  initRaceState,
  isRaceOver,
  raceWinner,
} from './scoreRace.js';

describe('scoreRace', () => {
  it('ends a time race once every seat has a forced final score', () => {
    let state = initRaceState(2, { kind: 'time', seconds: 60 });
    state = applyFinished(state, 0, 120);
    expect(isRaceOver(state)).toBe(false);

    state = applyFinished(state, 1, 90);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBe(0);
  });

  it('ends a toDeath race once every seat has finished', () => {
    let state = initRaceState(2, { kind: 'toDeath' });
    state = applyFinished(state, 0, 50);
    expect(isRaceOver(state)).toBe(false);
    expect(raceWinner(state)).toBeNull();

    state = applyFinished(state, 1, 80);
    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBe(1);
  });

  it('keeps a toDeath race alive when one player is finished and another is alive', () => {
    let state = initRaceState(2, { kind: 'toDeath' });
    state = applyFinished(state, 0, 100);
    state = applyProgress(state, 1, 20, true);
    expect(isRaceOver(state)).toBe(false);
  });

  it('ends a target race as soon as the first seat reaches the target', () => {
    let state = initRaceState(2, { kind: 'target', score: 100 });
    state = applyProgress(state, 1, 100, true);
    state = applyProgress(state, 0, 130, true);

    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBe(1);
  });

  it('returns null for a tied finished race', () => {
    let state = initRaceState(2, { kind: 'toDeath' });
    state = applyFinished(state, 0, 100);
    state = applyFinished(state, 1, 100);

    expect(isRaceOver(state)).toBe(true);
    expect(raceWinner(state)).toBeNull();
  });
});
