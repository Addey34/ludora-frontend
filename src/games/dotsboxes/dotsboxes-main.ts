import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { DotsBoxesGame } from './DotsBoxesGame.js';

bootstrapGame('dotsboxesGame', () => new DotsBoxesGame());
