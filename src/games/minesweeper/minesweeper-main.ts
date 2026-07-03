import { MinesweeperGame } from './MinesweeperGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Minesweeper page (starts on the "Play" overlay). */
bootstrapGame('minesweeper', () => new MinesweeperGame());
