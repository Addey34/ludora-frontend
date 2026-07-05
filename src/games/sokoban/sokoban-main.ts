import { SokobanGame } from './SokobanGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Sokoban page: instantiates the game. */
bootstrapGame('sokobanGame', () => new SokobanGame());
