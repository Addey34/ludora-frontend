import { SudokuGame } from './SudokuGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Sudoku page (starts on "Play"). */
bootstrapGame('sudoku', () => new SudokuGame());
