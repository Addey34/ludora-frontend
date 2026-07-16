import { GameEngine } from '../../shared/engine/GameEngine.js';
import { keyboardDirection } from '../../shared/engine/input.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { {{Class}}DOMRenderer } from './{{Class}}DOMRenderer.js';
import {
  collect{{Class}}Target,
  create{{Class}}State,
  move{{Class}}Player,
} from './{{key}}Logic.js';

const TARGET_SCORE = 10;

export class {{Class}}Game extends GameEngine {
  private game = create{{Class}}State();
  private renderer: {{Class}}DOMRenderer | null = null;

  constructor() {
    super({ storageKey: '{{key}}-scores' });
  }

  initialize(): void {
    const board = document.getElementById('board');
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    if (board) this.renderer = new {{Class}}DOMRenderer(board);
    this.setupEventListeners();
    this.updateScoreDisplay();
    this.render();
  }

  update(_deltaTime: number): void {}

  render(): void {
    this.renderer?.render(this.game);
  }

  handleInput(event: KeyboardEvent): void {
    const direction = keyboardDirection(event);
    if (!direction || !this.state.isRunning || this.state.isGameOver) return;
    event.preventDefault();

    this.game = move{{Class}}Player(this.game, direction);
    const result = collect{{Class}}Target(this.game);
    this.game = result.state;
    if (result.collected) this.addScore(TARGET_SCORE);
    this.render();
  }

  reset(): void {
    this.resetState();
    this.game = create{{Class}}State();
    this.updateScoreDisplay();
    this.render();
  }
}
