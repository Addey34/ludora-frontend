import { describe, expect, it } from 'vitest';

import {
  buildSnakeRenderState,
  createSnakeGameState,
  hasSnakeCollision,
  increaseSnakeSpeed,
  queueSnakeDirection,
  recordSnakeEat,
  respawnFood,
  stepSnake,
} from './snakeLogic.js';
import type { SnakeGameState } from './snakeState.js';

function randomSequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

function baseState(): SnakeGameState {
  return {
    gridSize: 5,
    snake: {
      body: [{ x: 3, y: 3 }],
      direction: 'right',
      directionQueue: [],
      started: false,
    },
    food: { position: { x: 5, y: 5 }, variant: 'gray' },
    moveInterval: 100,
    lastEatTime: 0,
    comboCount: 0,
  };
}

describe('snake logic', () => {
  it('keeps the snake still until a direction is queued', () => {
    const state = baseState();

    const move = stepSnake(state);

    expect(move.ateFood).toBe(false);
    expect(move.state.snake.body).toEqual([{ x: 3, y: 3 }]);
    expect(move.state.snake.started).toBe(false);
  });

  it('queues responsive turns while rejecting reversals', () => {
    let state = baseState();

    state = queueSnakeDirection(state, 'left');
    state = queueSnakeDirection(state, 'up');
    state = queueSnakeDirection(state, 'left');
    state = queueSnakeDirection(state, 'down');

    expect(state.snake.started).toBe(true);
    expect(state.snake.directionQueue).toEqual(['up', 'left']);

    const firstMove = stepSnake(state).state;
    expect(firstMove.snake.direction).toBe('up');
    expect(firstMove.snake.directionQueue).toEqual(['left']);

    const secondMove = stepSnake(firstMove).state;
    expect(secondMove.snake.direction).toBe('left');
    expect(secondMove.snake.directionQueue).toEqual([]);
  });

  it('wraps at the board edge and grows when food is eaten', () => {
    const state: SnakeGameState = {
      ...baseState(),
      snake: {
        body: [{ x: 5, y: 1 }],
        direction: 'right',
        directionQueue: [],
        started: true,
      },
      food: { position: { x: 1, y: 1 }, variant: 'brown' },
    };

    const move = stepSnake(state);

    expect(move.ateFood).toBe(true);
    expect(move.state.snake.body).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 1 },
    ]);
  });

  it('detects only reachable self-collisions', () => {
    const state: SnakeGameState = {
      ...baseState(),
      snake: {
        body: [
          { x: 2, y: 2 },
          { x: 2, y: 3 },
          { x: 1, y: 3 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
        ],
        direction: 'up',
        directionQueue: [],
        started: true,
      },
    };

    expect(hasSnakeCollision(state.snake)).toBe(true);
    expect(hasSnakeCollision({ ...state.snake, body: state.snake.body.slice(0, 4) })).toBe(false);
  });

  it('respawns food outside the snake body', () => {
    const state: SnakeGameState = {
      ...baseState(),
      snake: {
        ...baseState().snake,
        body: [{ x: 1, y: 1 }],
      },
    };

    const next = respawnFood(state, randomSequence([0, 0, 0.5, 0.5, 0.1]));

    expect(next.food.position).toEqual({ x: 3, y: 3 });
    expect(next.food.variant).toBe('gray');
  });

  it('tracks combo and speed as pure state updates', () => {
    let state = createSnakeGameState(5, 100, randomSequence([0, 0, 0.5, 0.5, 0]));

    state = recordSnakeEat(state, 1_000, 2_500, 5);
    state = recordSnakeEat(state, 2_000, 2_500, 5);
    state = increaseSnakeSpeed(state, 70, 0.9);

    expect(state.comboCount).toBe(2);
    expect(state.moveInterval).toBe(90);
  });

  it('builds interpolated render positions between logic steps', () => {
    const previous = baseState();
    const current: SnakeGameState = {
      ...previous,
      snake: {
        ...previous.snake,
        body: [{ x: 4, y: 3 }],
        started: true,
      },
    };

    const render = buildSnakeRenderState(previous, current, 0.5);

    expect(render.snake.body[0]).toEqual({ x: 3.5, y: 3 });
    expect(render.progress).toBe(0.5);
  });

  it('snaps wrapped render positions instead of crossing the board', () => {
    const previous: SnakeGameState = {
      ...baseState(),
      snake: { ...baseState().snake, body: [{ x: 5, y: 3 }], started: true },
    };
    const current: SnakeGameState = {
      ...previous,
      snake: { ...previous.snake, body: [{ x: 1, y: 3 }] },
    };

    const render = buildSnakeRenderState(previous, current, 0.5);

    expect(render.snake.body[0]).toEqual({ x: 1, y: 3 });
  });

  it('clamps render progress', () => {
    const previous = baseState();
    const current: SnakeGameState = {
      ...previous,
      snake: { ...previous.snake, body: [{ x: 4, y: 3 }], started: true },
    };

    expect(buildSnakeRenderState(previous, current, -1).progress).toBe(0);
    expect(buildSnakeRenderState(previous, current, 2).progress).toBe(1);
  });
});
