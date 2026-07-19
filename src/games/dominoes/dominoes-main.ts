import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { DominoesGame } from './DominoesGame.js';

bootstrapGame('dominoesGame', () => new DominoesGame());
