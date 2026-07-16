import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { MillGame } from './MillGame.js';

bootstrapGame('millGame', () => new MillGame());
