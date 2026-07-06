import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { InvadersGame } from './InvadersGame.js';

bootstrapGame('invadersGame', () => new InvadersGame());
