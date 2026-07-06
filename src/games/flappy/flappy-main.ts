import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { FlappyBirdGame } from './FlappyBirdGame.js';

bootstrapGame('flappyGame', () => new FlappyBirdGame());
