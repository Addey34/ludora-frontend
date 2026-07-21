import type { IRenderer } from '../../shared/engine/IRenderer.js';
import { t } from '../../shared/i18n/i18n.js';
import { HOLE_COUNT, type HitOutcome } from './whackamoleLogic.js';
import type { WhackamoleState } from './whackamoleState.js';

const HIT_ANIMATION_MS = 180;
const MISS_ANIMATION_MS = 240;

export class WhackamoleDOMRenderer implements IRenderer<WhackamoleState> {
  private readonly holes: HTMLButtonElement[] = [];
  private readonly moles: HTMLElement[] = [];

  constructor(
    private readonly board: HTMLElement,
    onHole: (hole: number) => void
  ) {
    this.board.replaceChildren();
    this.board.setAttribute('role', 'group');
    this.board.setAttribute('aria-label', t('whackBoardLabel'));
    for (let hole = 0; hole < HOLE_COUNT; hole++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'whackamole-hole';
      button.setAttribute('aria-label', t('whackHole', { number: hole + 1 }));

      const burrow = document.createElement('span');
      burrow.className = 'whackamole-burrow';
      burrow.setAttribute('aria-hidden', 'true');
      const mole = document.createElement('span');
      mole.className = 'whackamole-mole';
      mole.setAttribute('aria-hidden', 'true');
      button.append(burrow, mole);
      button.addEventListener('click', () => onHole(hole));
      this.board.append(button);
      this.holes.push(button);
      this.moles.push(mole);
    }
  }

  render(state: WhackamoleState): void {
    this.holes.forEach((hole, index) => {
      const active = state.active?.hole === index;
      const golden = active && state.active?.kind === 'golden';
      hole.classList.toggle('is-active', active);
      hole.classList.toggle('is-golden', golden);
      hole.setAttribute(
        'aria-label',
        active
          ? t(golden ? 'whackGoldenMoleAt' : 'whackMoleAt', { number: index + 1 })
          : t('whackHole', { number: index + 1 })
      );
    });
  }

  animate(hole: number, outcome: HitOutcome): void {
    const element = this.holes[hole];
    if (!element) return;
    const className = outcome === 'miss' ? 'is-miss' : 'is-hit';
    element.classList.remove('is-hit', 'is-miss');
    element.getBoundingClientRect();
    element.classList.add(className);
    window.setTimeout(
      () => element.classList.remove(className),
      outcome === 'miss' ? MISS_ANIMATION_MS : HIT_ANIMATION_MS
    );
  }

  holeCenter(hole: number): { x: number; y: number } | null {
    const rect = this.holes[hole]?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  }

  dispose(): void {
    this.board.replaceChildren();
    this.holes.length = 0;
    this.moles.length = 0;
  }
}
