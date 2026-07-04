import { HangmanGame } from './HangmanGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Hangman page (starts on "Play"). */
bootstrapGame('hangman', () => new HangmanGame());
