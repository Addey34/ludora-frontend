import { describe, expect, it } from 'vitest';
import {
  chooseMoleKind,
  chooseNextHole,
  createWhackamoleState,
  expireMole,
  GOLDEN_POINTS,
  hitMole,
  NORMAL_POINTS,
  spawnMole,
} from './whackamoleLogic.js';

describe('whack-a-mole logic', () => {
  it('starts without an active mole or a combo', () => {
    expect(createWhackamoleState()).toEqual({
      active: null,
      combo: 0,
      bestCombo: 0,
      hits: 0,
      misses: 0,
      lastHole: null,
    });
  });

  it('spawns a mole without mutating the previous state', () => {
    const state = createWhackamoleState();
    const next = spawnMole(state, 4, 'normal');

    expect(state.active).toBeNull();
    expect(next.active).toEqual({ hole: 4, kind: 'normal' });
    expect(next.lastHole).toBe(4);
  });

  it('never immediately selects the previous hole', () => {
    expect(chooseNextHole(null, () => 0)).toBe(0);
    expect(chooseNextHole(0, () => 0)).toBe(1);
    expect(chooseNextHole(8, () => 0.999)).toBe(7);
  });

  it('uses the golden probability boundary', () => {
    expect(chooseMoleKind(() => 0.119)).toBe('golden');
    expect(chooseMoleKind(() => 0.12)).toBe('normal');
  });

  it('scores hits and grows the combo bonus', () => {
    const first = hitMole(spawnMole(createWhackamoleState(), 2, 'normal'), 2);
    const second = hitMole(spawnMole(first.state, 5, 'normal'), 5);

    expect(first.points).toBe(NORMAL_POINTS);
    expect(second.points).toBe(NORMAL_POINTS + 10);
    expect(second.state).toMatchObject({ combo: 2, bestCombo: 2, hits: 2 });
  });

  it('awards the golden base score', () => {
    const result = hitMole(spawnMole(createWhackamoleState(), 3, 'golden'), 3);

    expect(result.outcome).toBe('golden');
    expect(result.points).toBe(GOLDEN_POINTS);
  });

  it('counts a wrong hole and preserves the active mole', () => {
    const state = spawnMole({ ...createWhackamoleState(), combo: 4 }, 6, 'normal');
    const result = hitMole(state, 1);

    expect(result.outcome).toBe('miss');
    expect(result.state.active).toEqual(state.active);
    expect(result.state.combo).toBe(0);
    expect(result.state.misses).toBe(1);
  });

  it('expires an unhit mole as a miss', () => {
    const state = spawnMole(createWhackamoleState(), 7, 'normal');
    const next = expireMole(state);

    expect(next.active).toBeNull();
    expect(next.misses).toBe(1);
    expect(expireMole(next)).toBe(next);
  });
});
