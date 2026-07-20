import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { SciencequizGame } from './SciencequizGame.js';

bootstrapGame('sciencequizGame', () => new SciencequizGame());
