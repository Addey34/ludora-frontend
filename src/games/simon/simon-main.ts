import { SimonGame } from './SimonGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Simon page: instantiates the game (starts on "Play"). */
bootstrapGame('simon', () => new SimonGame());
