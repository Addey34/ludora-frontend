import { TriviaGame } from './TriviaGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Trivia page (starts on "Play"). */
bootstrapGame('trivia', () => new TriviaGame());
