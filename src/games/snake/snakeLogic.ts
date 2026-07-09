import { type Direction, DIRECTION_DELTAS, OPPOSITE_DIRECTION } from '../../shared/engine/input.js';
import {
  FOOD_VARIANTS,
  type FoodState,
  type FoodVariant,
  type Position,
  type SnakeGameState,
  type SnakeRenderState,
  type SnakeState,
} from './snakeState.js';

const MAX_QUEUED_DIRECTIONS = 2;
const FIRST_COLLIDABLE_SEGMENT = 4;

export type RandomSource = () => number;

export function createSnakeGameState(
  gridSize: number,
  moveInterval: number,
  random: RandomSource = Math.random
): SnakeGameState {
  const snake: SnakeState = {
    body: [randomCell(gridSize, random)],
    direction: 'right',
    directionQueue: [],
    started: false,
  };

  return {
    gridSize,
    snake,
    food: randomFood(snake.body, gridSize, random),
    moveInterval,
    lastEatTime: 0,
    comboCount: 0,
  };
}

export function queueSnakeDirection(state: SnakeGameState, direction: Direction): SnakeGameState {
  const queue = [...state.snake.directionQueue];
  const reference = queue[queue.length - 1] ?? state.snake.direction;

  if (
    direction !== reference &&
    OPPOSITE_DIRECTION[direction] !== reference &&
    queue.length < MAX_QUEUED_DIRECTIONS
  ) {
    queue.push(direction);
  }

  return {
    ...state,
    snake: {
      ...state.snake,
      directionQueue: queue,
      started: true,
    },
  };
}

export function stepSnake(state: SnakeGameState): { state: SnakeGameState; ateFood: boolean } {
  const [nextDirection, ...remainingQueue] = state.snake.directionQueue;
  const direction = state.snake.started && nextDirection ? nextDirection : state.snake.direction;
  const step = state.snake.started ? DIRECTION_DELTAS[direction] : { x: 0, y: 0 };
  const head = state.snake.body[0];
  const newHead = {
    x: wrapPosition(head.x + step.x, state.gridSize),
    y: wrapPosition(head.y + step.y, state.gridSize),
  };
  const ateFood = samePosition(newHead, state.food.position);
  const body = ateFood
    ? [newHead, ...state.snake.body]
    : [newHead, ...state.snake.body.slice(0, -1)];

  return {
    ateFood,
    state: {
      ...state,
      snake: {
        ...state.snake,
        body,
        direction,
        directionQueue: state.snake.started ? remainingQueue : state.snake.directionQueue,
      },
    },
  };
}

export function buildSnakeRenderState(
  previous: SnakeGameState,
  current: SnakeGameState,
  progress: number
): SnakeRenderState {
  const clampedProgress = clamp01(progress);
  return {
    gridSize: current.gridSize,
    snake: {
      body: current.snake.body.map((segment, index) =>
        interpolateCell(
          previous.snake.body[index] ?? segment,
          segment,
          current.gridSize,
          clampedProgress
        )
      ),
      direction: current.snake.direction,
    },
    food: current.food,
    moveInterval: current.moveInterval,
    progress: clampedProgress,
  };
}
export function hasSnakeCollision(snake: SnakeState): boolean {
  const head = snake.body[0];
  return snake.body.slice(FIRST_COLLIDABLE_SEGMENT).some((segment) => samePosition(head, segment));
}

export function respawnFood(
  state: SnakeGameState,
  random: RandomSource = Math.random
): SnakeGameState {
  return {
    ...state,
    food: randomFood(state.snake.body, state.gridSize, random),
  };
}

export function increaseSnakeSpeed(
  state: SnakeGameState,
  minInterval: number,
  factor: number
): SnakeGameState {
  return {
    ...state,
    moveInterval: Math.max(minInterval, state.moveInterval * factor),
  };
}

export function recordSnakeEat(
  state: SnakeGameState,
  now: number,
  comboWindow: number,
  comboMax: number
): SnakeGameState {
  const elapsed = now - state.lastEatTime;
  const comboCount =
    state.lastEatTime > 0 && elapsed <= comboWindow ? Math.min(state.comboCount + 1, comboMax) : 1;

  return {
    ...state,
    lastEatTime: now,
    comboCount,
  };
}

function interpolateCell(
  from: Position,
  to: Position,
  gridSize: number,
  progress: number
): Position {
  if (isWrapMove(from, to, gridSize)) return to;
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function isWrapMove(from: Position, to: Position, gridSize: number): boolean {
  return Math.abs(from.x - to.x) > gridSize / 2 || Math.abs(from.y - to.y) > gridSize / 2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
function randomFood(body: Position[], gridSize: number, random: RandomSource): FoodState {
  let position = randomCell(gridSize, random);
  while (body.some((segment) => samePosition(segment, position))) {
    position = randomCell(gridSize, random);
  }

  return {
    position,
    variant: randomVariant(random),
  };
}

function randomCell(gridSize: number, random: RandomSource): Position {
  return {
    x: Math.floor(random() * gridSize) + 1,
    y: Math.floor(random() * gridSize) + 1,
  };
}

function randomVariant(random: RandomSource): FoodVariant {
  return FOOD_VARIANTS[Math.floor(random() * FOOD_VARIANTS.length)] ?? FOOD_VARIANTS[0];
}

function wrapPosition(position: number, gridSize: number): number {
  if (position <= 0) return gridSize;
  if (position > gridSize) return 1;
  return position;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
