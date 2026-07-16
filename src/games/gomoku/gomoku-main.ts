import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { GomokuGame } from './GomokuGame.js';

bootstrapGame('gomokuGame', () => new GomokuGame());
