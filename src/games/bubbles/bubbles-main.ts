import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { BubblesGame } from './BubblesGame.js';

bootstrapGame('bubblesGame', () => new BubblesGame());
