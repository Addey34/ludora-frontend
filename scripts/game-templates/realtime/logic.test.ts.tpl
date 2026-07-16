import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  collect{{Class}}Target,
  create{{Class}}State,
  move{{Class}}Player,
} from './{{key}}Logic.js';

describe('{{key}} logic', () => {
  it('creates a target away from the player', () => {
    const state = create{{Class}}State(() => 0);
    expect(state.target).not.toEqual(state.player);
  });

  it('moves and clamps the player to the board', () => {
    const state = {
      player: { x: 0, y: 0 },
      target: { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1 },
    };
    expect(move{{Class}}Player(state, 'left').player).toEqual({ x: 0, y: 0 });
    expect(move{{Class}}Player(state, 'down').player).toEqual({ x: 0, y: 1 });
  });

  it('collects and respawns a target', () => {
    const state = {
      player: { x: 2, y: 2 },
      target: { x: 2, y: 2 },
    };
    const result = collect{{Class}}Target(state, () => 0);
    expect(result.collected).toBe(true);
    expect(result.state.target).not.toEqual(result.state.player);
  });
});
