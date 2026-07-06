import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { TaquinGame } from './TaquinGame.js';

bootstrapGame('taquinGame', () => new TaquinGame());
