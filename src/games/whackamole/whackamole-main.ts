import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { WhackamoleGame } from './WhackamoleGame.js';

/** Entry point for Whack-a-Mole. */
bootstrapGame('whackamoleGame', () => new WhackamoleGame());
