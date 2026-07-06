import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { BinairoGame } from './BinairoGame.js';

bootstrapGame('binairoGame', () => new BinairoGame());
