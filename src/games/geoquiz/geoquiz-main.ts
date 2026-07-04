import { GeoGame } from './GeoGame.js';
import { bootstrapGame } from '../../shared/engine/bootstrap.js';

/** Entry point of the Geo Quiz page (starts on "Play"). */
bootstrapGame('geoquiz', () => new GeoGame());
