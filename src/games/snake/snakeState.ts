import type { Direction } from '../../shared/engine/input.js';

export interface Position {
  x: number;
  y: number;
}

export type FoodVariant = 'gray' | 'brown' | 'white';

export interface SnakeState {
  body: Position[];
  direction: Direction;
  directionQueue: Direction[];
  started: boolean;
}

export interface FoodState {
  position: Position;
  variant: FoodVariant;
}

export interface SnakeGameState {
  gridSize: number;
  snake: SnakeState;
  food: FoodState;
  moveInterval: number;
  lastEatTime: number;
  comboCount: number;
}

export const FOOD_VARIANTS: readonly FoodVariant[] = ['gray', 'brown', 'white'];

export interface SnakeRenderState {
  gridSize: number;
  snake: {
    body: Position[];
    direction: Direction;
  };
  food: FoodState;
  moveInterval: number;
  progress: number;
}
