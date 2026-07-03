import { MotusGame } from './MotusGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Motus page (starts on the "Play" overlay). */
bootstrapGame('motus', () => new MotusGame());
