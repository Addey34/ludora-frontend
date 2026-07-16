import type { Direction } from '../../shared/engine/input.js';
import type { {{Class}}Position, {{Class}}State } from './{{key}}State.js';

export const BOARD_SIZE = 5;
type RandomSource = () => number;

export function create{{Class}}State(random: RandomSource = Math.random): {{Class}}State {
  const player = { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) };
  return { player, target: randomFreePosition(player, random) };
}

export function move{{Class}}Player(
  state: {{Class}}State,
  direction: Direction
): {{Class}}State {
  const delta: Record<Direction, {{Class}}Position> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const step = delta[direction];
  return {
    ...state,
    player: {
      x: clamp(state.player.x + step.x),
      y: clamp(state.player.y + step.y),
    },
  };
}

export function collect{{Class}}Target(
  state: {{Class}}State,
  random: RandomSource = Math.random
): { state: {{Class}}State; collected: boolean } {
  if (!samePosition(state.player, state.target)) return { state, collected: false };
  return {
    collected: true,
    state: { ...state, target: randomFreePosition(state.player, random) },
  };
}

function randomFreePosition(
  occupied: {{Class}}Position,
  random: RandomSource
): {{Class}}Position {
  const available: {{Class}}Position[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (x !== occupied.x || y !== occupied.y) available.push({ x, y });
    }
  }
  const index = Math.min(available.length - 1, Math.floor(random() * available.length));
  return available[Math.max(0, index)];
}

function samePosition(a: {{Class}}Position, b: {{Class}}Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(BOARD_SIZE - 1, value));
}
