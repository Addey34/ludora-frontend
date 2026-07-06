import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { SolitaireGame } from './SolitaireGame.js';

bootstrapGame('solitaireGame', () => new SolitaireGame());
