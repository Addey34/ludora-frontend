import { describe, expect, it } from 'vitest';

import {
  createSnakeGameState,
  hasSnakeCollision,
  queueSnakeDirection,
  respawnFood,
  stepSnake,
} from './snakeLogic.js';
import type { Position, SnakeGameState } from './snakeState.js';

function randomSequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

function snakeAt(value: number, gridSize: number): SnakeGameState {
  const foodValue = value === 0 ? 0.5 : 0;
  return createSnakeGameState(
    gridSize,
    100,
    randomSequence([value, value, foodValue, foodValue, 0])
  );
}

function moveWithFood(
  state: SnakeGameState,
  food: Position = { x: -1, y: -1 }
): { state: SnakeGameState; ateFood: boolean } {
  return stepSnake({ ...state, food: { ...state.food, position: food } });
}

function growRight(state: SnakeGameState, segments: number): SnakeGameState {
  let next = queueSnakeDirection(state, 'right');
  for (let i = 0; i < segments; i++) {
    const head = next.snake.body[0];
    next = moveWithFood(next, { x: head.x + 1, y: head.y }).state;
  }
  return next;
}

describe('Snake movement', () => {
  it('starts with a single segment, facing right', () => {
    const state = snakeAt(0, 10);

    expect(state.snake.body).toHaveLength(1);
    expect(state.snake.direction).toBe('right');
  });

  it('applies a direction change only on the next move', () => {
    let state = snakeAt(0, 10);

    state = queueSnakeDirection(state, 'up');
    expect(state.snake.direction).toBe('right');

    state = moveWithFood(state).state;
    expect(state.snake.direction).toBe('up');
  });

  it('forbids the U-turn', () => {
    let state = snakeAt(0, 10);

    state = queueSnakeDirection(state, 'right');
    state = moveWithFood(state).state;
    state = queueSnakeDirection(state, 'left');
    state = moveWithFood(state).state;

    expect(state.snake.direction).toBe('right');
    expect(state.snake.body[0]).toEqual({ x: 3, y: 1 });
  });

  it('queues two quick turns and applies them on successive moves', () => {
    let state = snakeAt(0, 10);

    state = queueSnakeDirection(state, 'right');
    state = moveWithFood(state).state;
    state = queueSnakeDirection(state, 'up');
    state = queueSnakeDirection(state, 'left');

    state = moveWithFood(state).state;
    expect(state.snake.direction).toBe('up');

    state = moveWithFood(state).state;
    expect(state.snake.direction).toBe('left');
  });

  it('rejects a reversal queued behind a turn', () => {
    let state = snakeAt(0, 10);

    state = queueSnakeDirection(state, 'right');
    state = moveWithFood(state).state;
    state = queueSnakeDirection(state, 'up');
    state = queueSnakeDirection(state, 'down');

    state = moveWithFood(state).state;
    state = moveWithFood(state).state;

    expect(state.snake.direction).toBe('up');
  });

  it('crosses the right edge and reappears on the left', () => {
    let state = snakeAt(0.95, 10);

    state = queueSnakeDirection(state, 'right');
    state = moveWithFood(state).state;

    expect(state.snake.body[0]).toEqual({ x: 1, y: 10 });
  });

  it('crosses the top edge and reappears at the bottom', () => {
    let state = snakeAt(0, 10);

    state = queueSnakeDirection(state, 'up');
    state = moveWithFood(state).state;

    expect(state.snake.body[0]).toEqual({ x: 1, y: 10 });
  });

  it('grows when eating and keeps its length otherwise', () => {
    let state = snakeAt(0, 10);

    state = queueSnakeDirection(state, 'right');
    const eaten = moveWithFood(state, { x: 2, y: 1 });
    expect(eaten.ateFood).toBe(true);
    expect(eaten.state.snake.body).toHaveLength(2);

    const missed = moveWithFood(eaten.state, { x: 9, y: 9 });
    expect(missed.ateFood).toBe(false);
    expect(missed.state.snake.body).toHaveLength(2);
  });

  it('does not report a collision while it is 4 segments or fewer', () => {
    const state = growRight(snakeAt(0, 10), 3);

    expect(state.snake.body).toHaveLength(4);
    expect(hasSnakeCollision(state.snake)).toBe(false);
  });
});

describe('Snake food', () => {
  it('never appears on the snake body', () => {
    const gridSize = 6;
    const state = growRight(snakeAt(0, gridSize), 3);

    const next = respawnFood(state, randomSequence([0, 0, 0.5, 0.5, 0]));
    const overlaps = state.snake.body.some(
      (segment) => segment.x === next.food.position.x && segment.y === next.food.position.y
    );

    expect(overlaps).toBe(false);
  });
});
