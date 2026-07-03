import { GooseGame } from './GooseGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

bootstrapGame('gooseGame', () => new GooseGame());
