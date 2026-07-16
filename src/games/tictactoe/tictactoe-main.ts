import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { TictactoeGame } from './TictactoeGame.js';

bootstrapGame('tictactoeGame', () => new TictactoeGame());
