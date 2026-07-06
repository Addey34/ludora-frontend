import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { BlackjackGame } from './BlackjackGame.js';

bootstrapGame('blackjackGame', () => new BlackjackGame());
