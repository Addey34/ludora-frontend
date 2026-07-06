import { bootstrapGame } from '../../shared/engine/bootstrap.js';
import { KakuroGame } from './KakuroGame.js';

bootstrapGame('kakuroGame', () => new KakuroGame());
