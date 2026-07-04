import { PenduGame } from './PenduGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Hangman page (starts on "Play"). */
bootstrapGame('pendu', () => new PenduGame());
