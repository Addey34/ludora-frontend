import { GameEngine, type GameConfig } from '../../shared/engine/GameEngine.js';
import type { IRenderer } from '../../shared/engine/IRenderer.js';
import { keyboardDirection } from '../../shared/engine/input.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import {
  buildTemplateRenderState,
  collectTemplateTarget,
  createTemplateGameState,
  moveTemplatePlayer,
  stepTemplateGame,
} from './templateLogic.js';
import type { TemplateGameState, TemplateRenderState } from './templateState.js';
import { TemplateDOMRenderer } from './TemplateDOMRenderer.js';

interface TemplateConfig extends GameConfig {
  gridSize?: number;
  visualMode?: TemplateVisualMode;
}

type TemplateVisualMode = '2d' | 'three';

async function createTemplateRenderer(
  playBoard: HTMLElement,
  visualMode: TemplateVisualMode
): Promise<IRenderer<TemplateRenderState>> {
  if (visualMode === 'three') {
    const { TemplateThreeRenderer } = await import('./TemplateThreeRenderer.js');
    return new TemplateThreeRenderer(playBoard);
  }
  return new TemplateDOMRenderer(playBoard);
}

export class TemplateGame extends GameEngine {
  private readonly gridSize: number;
  private templateState: TemplateGameState;
  private previousTemplateState: TemplateGameState;
  private playBoard: HTMLElement | null = null;
  private renderer: IRenderer<TemplateRenderState> | null = null;
  private visualMode: TemplateVisualMode;
  private rendererRequestId = 0;
  private dirty = true;

  constructor(config: TemplateConfig = {}) {
    super({ ...config, storageKey: 'template-high-scores' });
    this.gridSize = config.gridSize ?? 12;
    this.visualMode = config.visualMode ?? '2d';
    this.templateState = createTemplateGameState(this.gridSize);
    this.previousTemplateState = this.templateState;
  }

  async initialize(): Promise<void> {
    this.playBoard = document.querySelector('.play-board');
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);

    if (this.playBoard) {
      this.renderer = await createTemplateRenderer(this.playBoard, this.visualMode);
    }

    this.setupEventListeners();
    this.updateScoreDisplay();
    this.renderScoreTable();
    this.render();
  }

  update(deltaTime: number): void {
    if (this.state.isPaused || this.state.isGameOver) return;

    this.previousTemplateState = this.templateState;
    this.templateState = stepTemplateGame(this.templateState, deltaTime);
    const result = collectTemplateTarget(this.templateState);
    this.templateState = result.state;

    if (result.collected) {
      this.addScore(10);
    }

    this.dirty = true;
  }

  render(): void {
    if (!this.dirty && !this.renderer?.continuousRender) return;
    this.dirty = false;
    this.renderer?.render(this.renderState());
  }

  handleInput(event: KeyboardEvent): void {
    const direction = keyboardDirection(event);
    if (!direction) return;

    event.preventDefault();
    this.previousTemplateState = this.templateState;
    this.templateState = moveTemplatePlayer(this.templateState, direction);
    this.dirty = true;
  }

  reset(): void {
    this.resetState();
    this.templateState = createTemplateGameState(this.gridSize);
    this.previousTemplateState = this.templateState;
    this.renderer?.reset?.();
    this.dirty = true;
    this.updateScoreDisplay();
    this.render();
  }

  private renderState(): TemplateRenderState {
    return buildTemplateRenderState(this.previousTemplateState, this.templateState, 1);
  }

  async switchVisualMode(visualMode: TemplateVisualMode): Promise<void> {
    if (this.visualMode === visualMode || !this.playBoard) return;

    this.visualMode = visualMode;
    const requestId = ++this.rendererRequestId;
    this.renderer?.dispose?.();
    this.renderer = null;

    const renderer = await createTemplateRenderer(this.playBoard, visualMode);
    if (requestId !== this.rendererRequestId) {
      renderer.dispose?.();
      return;
    }

    this.renderer = renderer;
    this.dirty = true;
    this.render();
  }
}
