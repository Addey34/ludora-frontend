import { MathGame } from './MathGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Mental Math page (starts on "Play"). */
bootstrapGame('math', () => new MathGame());
