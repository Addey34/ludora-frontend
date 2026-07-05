import { CheckersGame } from './CheckersGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Checkers page: instantiates the game. */
bootstrapGame('checkersGame', () => new CheckersGame());
