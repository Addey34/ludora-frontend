import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { BackgammonGame } from './BackgammonGame.js';

bootstrapGame('backgammonGame', () => new BackgammonGame());
