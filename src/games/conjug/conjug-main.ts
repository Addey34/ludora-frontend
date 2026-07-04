import { ConjugationGame } from './ConjugationGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Conjugation page (starts on "Play"). */
bootstrapGame('conjug', () => new ConjugationGame());
