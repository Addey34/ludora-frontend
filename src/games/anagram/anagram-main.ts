import { AnagramGame } from './AnagramGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Anagrams page (starts on "Play"). */
bootstrapGame('anagram', () => new AnagramGame());
