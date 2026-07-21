import type { MoleKind, WhackamoleState } from './whackamoleState.js';

export const HOLE_COUNT = 9;
export const NORMAL_POINTS = 100;
export const GOLDEN_POINTS = 250;
const COMBO_STEP_POINTS = 10;
const MAX_COMBO_BONUS_STEPS = 10;
const GOLDEN_CHANCE = 0.12;

export type HitOutcome = 'normal' | 'golden' | 'miss';

interface HitResult {
  state: WhackamoleState;
  outcome: HitOutcome;
  points: number;
}

export function createWhackamoleState(): WhackamoleState {
  return {
    active: null,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    lastHole: null,
  };
}

export function spawnMole(state: WhackamoleState, hole: number, kind: MoleKind): WhackamoleState {
  if (!Number.isInteger(hole) || hole < 0 || hole >= HOLE_COUNT) {
    throw new RangeError('Mole hole is outside the board');
  }
  return {
    ...state,
    active: { hole, kind },
    lastHole: hole,
  };
}

export function hitMole(state: WhackamoleState, hole: number): HitResult {
  const mole = state.active;
  if (!mole || mole.hole !== hole) {
    return {
      state: {
        ...state,
        combo: 0,
        misses: state.misses + 1,
      },
      outcome: 'miss',
      points: 0,
    };
  }

  const combo = state.combo + 1;
  const base = mole.kind === 'golden' ? GOLDEN_POINTS : NORMAL_POINTS;
  const comboSteps = Math.min(combo - 1, MAX_COMBO_BONUS_STEPS);
  return {
    state: {
      ...state,
      active: null,
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      hits: state.hits + 1,
    },
    outcome: mole.kind,
    points: base + comboSteps * COMBO_STEP_POINTS,
  };
}

export function expireMole(state: WhackamoleState): WhackamoleState {
  if (!state.active) return state;
  return {
    ...state,
    active: null,
    combo: 0,
    misses: state.misses + 1,
  };
}

export function chooseNextHole(
  previous: number | null,
  random: () => number = Math.random
): number {
  const holes = Array.from({ length: HOLE_COUNT }, (_, hole) => hole).filter(
    (hole) => hole !== previous
  );
  const index = Math.min(holes.length - 1, Math.floor(Math.max(0, random()) * holes.length));
  return holes[index] ?? 0;
}

export function chooseMoleKind(random: () => number = Math.random): MoleKind {
  return random() < GOLDEN_CHANCE ? 'golden' : 'normal';
}
