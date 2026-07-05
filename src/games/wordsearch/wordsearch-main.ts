import { WordSearchGame } from './WordSearchGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Word Search page: instantiates the game. */
bootstrapGame('wordSearchGame', () => new WordSearchGame());
