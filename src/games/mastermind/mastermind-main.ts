import { MastermindGame } from './MastermindGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Mastermind page: instantiates the game. */
bootstrapGame('mastermindGame', () => new MastermindGame());
