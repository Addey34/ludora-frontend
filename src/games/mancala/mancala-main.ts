import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { MancalaGame } from './MancalaGame.js';

bootstrapGame('mancalaGame', () => new MancalaGame());
