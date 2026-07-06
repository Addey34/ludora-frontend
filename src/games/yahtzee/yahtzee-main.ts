import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { YahtzeeGame } from './YahtzeeGame.js';

bootstrapGame('yahtzeeGame', () => new YahtzeeGame());
