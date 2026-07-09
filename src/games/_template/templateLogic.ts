import type { Direction } from '../../shared/engine/input.js';
import type { TemplateGameState, TemplatePosition, TemplateRenderState } from './templateState.js';

export type RandomSource = () => number;

export function createTemplateGameState(
  gridSize: number,
  random: RandomSource = Math.random
): TemplateGameState {
  const player = centerCell(gridSize);
  return {
    gridSize,
    player,
    target: randomFreeCell(gridSize, [player], random),
    elapsedMs: 0,
  };
}

export function moveTemplatePlayer(
  state: TemplateGameState,
  direction: Direction
): TemplateGameState {
  return {
    ...state,
    player: clampToGrid(stepPosition(state.player, direction), state.gridSize),
  };
}

export function stepTemplateGame(state: TemplateGameState, deltaTime: number): TemplateGameState {
  return {
    ...state,
    elapsedMs: state.elapsedMs + Math.max(0, deltaTime),
  };
}

export function collectTemplateTarget(
  state: TemplateGameState,
  random: RandomSource = Math.random
): { state: TemplateGameState; collected: boolean } {
  if (!samePosition(state.player, state.target)) return { state, collected: false };

  return {
    collected: true,
    state: {
      ...state,
      target: randomFreeCell(state.gridSize, [state.player], random),
    },
  };
}

export function buildTemplateRenderState(
  _previous: TemplateGameState,
  current: TemplateGameState,
  progress: number
): TemplateRenderState {
  return {
    ...current,
    progress: clamp01(progress),
  };
}

function centerCell(gridSize: number): TemplatePosition {
  return {
    x: Math.ceil(gridSize / 2),
    y: Math.ceil(gridSize / 2),
  };
}

function stepPosition(position: TemplatePosition, direction: Direction): TemplatePosition {
  switch (direction) {
    case 'up':
      return { x: position.x, y: position.y - 1 };
    case 'down':
      return { x: position.x, y: position.y + 1 };
    case 'left':
      return { x: position.x - 1, y: position.y };
    case 'right':
      return { x: position.x + 1, y: position.y };
  }
}

function clampToGrid(position: TemplatePosition, gridSize: number): TemplatePosition {
  return {
    x: Math.max(1, Math.min(gridSize, position.x)),
    y: Math.max(1, Math.min(gridSize, position.y)),
  };
}

function randomFreeCell(
  gridSize: number,
  occupied: TemplatePosition[],
  random: RandomSource
): TemplatePosition {
  let position = randomCell(gridSize, random);
  while (occupied.some((cell) => samePosition(cell, position))) {
    position = randomCell(gridSize, random);
  }
  return position;
}

function randomCell(gridSize: number, random: RandomSource): TemplatePosition {
  return {
    x: Math.floor(random() * gridSize) + 1,
    y: Math.floor(random() * gridSize) + 1,
  };
}

function samePosition(a: TemplatePosition, b: TemplatePosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
