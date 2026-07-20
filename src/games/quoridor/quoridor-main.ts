import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { QuoridorGame } from './QuoridorGame.js';

bootstrapGame('quoridorGame', () => new QuoridorGame());
