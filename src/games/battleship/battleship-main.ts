import { BattleshipGame } from './BattleshipGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

bootstrapGame('battleshipGame', () => new BattleshipGame());
