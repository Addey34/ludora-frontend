import { describe, expect, it } from 'vitest';
import {
  buildTemplateRenderState,
  collectTemplateTarget,
  createTemplateGameState,
  moveTemplatePlayer,
  stepTemplateGame,
} from './templateLogic.js';

describe('templateLogic', () => {
  it('creates deterministic state with an occupied-cell-safe target', () => {
    const state = createTemplateGameState(5, () => 0);

    expect(state.player).toEqual({ x: 3, y: 3 });
    expect(state.target).not.toEqual(state.player);
  });

  it('moves the player and clamps at board edges', () => {
    const state = createTemplateGameState(3, () => 0);

    const moved = moveTemplatePlayer(state, 'left');
    const clamped = moveTemplatePlayer({ ...moved, player: { x: 1, y: 2 } }, 'left');

    expect(moved.player).toEqual({ x: 1, y: 2 });
    expect(clamped.player).toEqual({ x: 1, y: 2 });
  });

  it('accumulates positive time only', () => {
    const state = createTemplateGameState(5, () => 0);

    expect(stepTemplateGame(state, 16).elapsedMs).toBe(16);
    expect(stepTemplateGame(state, -16).elapsedMs).toBe(0);
  });

  it('collects target and respawns it away from the player', () => {
    const state = {
      gridSize: 5,
      player: { x: 3, y: 3 },
      target: { x: 3, y: 3 },
      elapsedMs: 0,
    };

    const result = collectTemplateTarget(state, () => 0);

    expect(result.collected).toBe(true);
    expect(result.state.target).toEqual({ x: 1, y: 1 });
  });

  it('clamps render progress', () => {
    const state = createTemplateGameState(5, () => 0);

    expect(buildTemplateRenderState(state, state, -1).progress).toBe(0);
    expect(buildTemplateRenderState(state, state, 2).progress).toBe(1);
  });
});
