import { NonogramGame } from './NonogramGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Nonogram page: instantiates the game. */
bootstrapGame('nonogramGame', () => new NonogramGame());
