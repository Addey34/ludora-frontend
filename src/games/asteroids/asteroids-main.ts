import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { AsteroidsGame } from './AsteroidsGame.js';

/** Entry point for Asteroids. */
bootstrapGame('asteroidsGame', () => new AsteroidsGame());
