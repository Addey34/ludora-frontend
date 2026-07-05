import { ReversiGame } from './ReversiGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Reversi page: instantiates the game. */
bootstrapGame('reversiGame', () => new ReversiGame());
