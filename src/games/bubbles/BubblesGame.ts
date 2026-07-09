import { GameEngine } from '../../shared/engine/GameEngine.js';
import { t } from '../../shared/i18n/i18n.js';
import { setupHud } from '../../shared/ui/hud.js';
import { setupSettingsPanel, difficultyField } from '../../shared/ui/settingsPanel.js';
import { Difficulty } from '../../shared/bot/difficulty.js';
import { playSound } from '../../shared/fx/sound.js';
import { ParticleSystem } from '../../shared/fx/particles.js';

const W = 400;
const H = 480;
const COLS = 8;
// A full even row of COLS bubbles must span the canvas exactly, so the columns
// stay aligned with the walls and there is no dead strip on the right where a
// shot bubble would snap far away from where it landed.
const R = W / (COLS * 2);
const ROW_H = R * Math.sqrt(3);
const INIT_ROWS = 6;
const SHOOTER_X = W / 2;
const SHOOTER_Y = H - 30;
const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];
const SPEED = 0.55;

/** More distinct colours = harder to clear a group of three. */
const COLOR_COUNT: Record<Difficulty, number> = { easy: 4, medium: 5, hard: 6 };

type Color = 0 | 1 | 2 | 3 | 4 | 5;
type Grid = (Color | null)[][];

function colsForRow(row: number): number {
  return row % 2 === 0 ? COLS : COLS - 1;
}

function bubbleX(row: number, col: number): number {
  const offset = row % 2 === 1 ? R : 0;
  return R + col * R * 2 + offset;
}

function bubbleY(row: number): number {
  return R + row * ROW_H;
}

function randomColor(numColors: number): Color {
  return Math.floor(Math.random() * numColors) as Color;
}

export class BubblesGame extends GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private fx: ParticleSystem | null = null;

  private grid: Grid = [];
  private numColors = 4;
  private difficulty: Difficulty = 'medium';

  private shooter = { color: 0 as Color, nextColor: 1 as Color };
  private flying: { x: number; y: number; vx: number; vy: number; color: Color } | null = null;
  private aimAngle = -Math.PI / 2;

  private mouseX = SHOOTER_X;
  private mouseY = SHOOTER_Y - 100;

  constructor() {
    super({ storageKey: 'bubbles', leaderboardId: 'bubbles' });
  }

  initialize(): void {
    const board = document.getElementById('board');
    if (!board) return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:crosshair;';
    board.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.fx = new ParticleSystem();
    this.hud = setupHud([
      { key: 'score', icon: 'star', label: t('score') },
      { key: 'high', icon: 'trophy', label: t('hudBest') },
    ]);
    this.hud.set('high', this.scoreManager.getHighScore());
    setupSettingsPanel([
      difficultyField(this.difficulty, (v) => {
        this.difficulty = v as Difficulty;
        this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
      }),
    ]);
    this.setLeaderboardVariant(this.difficulty, t(this.difficulty));
    this.canvas.addEventListener('mousemove', (e) => this.updateAim(e.clientX, e.clientY));
    this.canvas.addEventListener('click', () => this.shoot());
    this.canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      if (touch) this.updateAim(touch.clientX, touch.clientY);
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) this.updateAim(touch.clientX, touch.clientY);
    });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.shoot();
    });
    this.setupEventListeners();
    this.buildGrid();
    this.render();
  }

  start(): void {
    if (this.state.isRunning) return;
    this.numColors = COLOR_COUNT[this.difficulty];
    this.resetState();
    this.buildGrid();
    super.start();
  }

  reset(): void {
    this.numColors = COLOR_COUNT[this.difficulty];
    this.flying = null;
    this.resetState();
    this.buildGrid();
  }

  handleInput(e: KeyboardEvent): void {
    if (e.key === ' ' || e.key === 'Enter') this.shoot();
    if (e.key === 'ArrowLeft') this.aimAngle = Math.max(-Math.PI + 0.3, this.aimAngle - 0.1);
    if (e.key === 'ArrowRight') this.aimAngle = Math.min(-0.3, this.aimAngle + 0.1);
  }

  private buildGrid(): void {
    this.grid = [];
    for (let r = 0; r < INIT_ROWS; r++) {
      const row: (Color | null)[] = [];
      for (let c = 0; c < colsForRow(r); c++) {
        row.push(randomColor(this.numColors));
      }
      this.grid.push(row);
    }
    this.shooter.color = randomColor(this.numColors);
    this.shooter.nextColor = randomColor(this.numColors);
  }

  private updateAim(clientX: number, clientY: number): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    this.mouseX = (clientX - rect.left) * scaleX;
    this.mouseY = (clientY - rect.top) * scaleY;
    const dx = this.mouseX - SHOOTER_X;
    const dy = this.mouseY - SHOOTER_Y;
    this.aimAngle = Math.atan2(dy, dx);
    if (this.aimAngle > -0.2) this.aimAngle = -0.2;
    if (this.aimAngle < -Math.PI + 0.2) this.aimAngle = -Math.PI + 0.2;
  }

  private shoot(): void {
    if (!this.state.isRunning || this.flying) return;
    this.flying = {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      vx: Math.cos(this.aimAngle) * SPEED,
      vy: Math.sin(this.aimAngle) * SPEED,
      color: this.shooter.color,
    };
    this.shooter.color = this.shooter.nextColor;
    this.shooter.nextColor = randomColor(this.numColors);
    playSound('bounce');
  }

  update(dt: number): void {
    if (!this.state.isRunning || this.state.isGameOver || !this.flying) return;
    const b = this.flying;
    // Advance in small sub-steps so the bubble can never tunnel through a row on
    // a laggy frame (dt is capped at 100ms → up to ~55px, wider than a bubble).
    let remaining = SPEED * dt; // pixels to travel this frame
    const stepLen = R * 0.5;
    while (remaining > 0) {
      const step = Math.min(stepLen, remaining);
      remaining -= step;
      const inv = step / SPEED;
      b.x += b.vx * inv;
      b.y += b.vy * inv;

      // Wall bounce
      if (b.x - R < 0) {
        b.x = R;
        b.vx = Math.abs(b.vx);
      } else if (b.x + R > W) {
        b.x = W - R;
        b.vx = -Math.abs(b.vx);
      }
      // Reached the ceiling — settle on the top row.
      if (b.y - R < 0) {
        this.snapBubble(b.x, b.y, b.color);
        return;
      }
      // Touched a grid bubble — settle next to it.
      if (this.checkGridCollision(b.x, b.y, b.color)) return;
    }
  }

  private checkGridCollision(bx: number, by: number, color: Color): boolean {
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] === null) continue;
        const cx = bubbleX(r, c);
        const cy = bubbleY(r);
        const dx = bx - cx;
        const dy = by - cy;
        if (dx * dx + dy * dy < (R * 2 - 2) * (R * 2 - 2)) {
          this.snapBubble(bx, by, color);
          return true;
        }
      }
    }
    return false;
  }

  private snapBubble(bx: number, by: number, color: Color): void {
    this.flying = null;
    // Snap next to the contact point, not to the globally-nearest empty cell:
    // derive the row the bubble reached, then pick the closest free cell within
    // one row of it. This keeps the placement visually where the bubble landed.
    const approxRow = Math.max(0, Math.round((by - R) / ROW_H));
    // Search the empty cells around the contact point (allowing one brand-new
    // row below the grid, index === grid.length) and pick the closest one that
    // actually touches an existing bubble or the ceiling. Falling back to the
    // globally-closest empty cell only if nothing adjacent exists keeps a bubble
    // from ever snapping into a floating, disconnected slot.
    let bestR = -1,
      bestC = -1,
      bestDist = Infinity;
    let adjR = -1,
      adjC = -1,
      adjDist = Infinity;
    const lastRow = Math.min(approxRow + 1, this.grid.length);
    for (let r = Math.max(0, approxRow - 1); r <= lastRow; r++) {
      const numC = colsForRow(r);
      for (let c = 0; c < numC; c++) {
        if (this.cellFilled(r, c)) continue;
        const cx = bubbleX(r, c);
        const cy = bubbleY(r);
        const d = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
        if (d < bestDist) {
          bestDist = d;
          bestR = r;
          bestC = c;
        }
        if (d < adjDist && this.cellHasSupport(r, c)) {
          adjDist = d;
          adjR = r;
          adjC = c;
        }
      }
    }
    if (adjR >= 0) {
      bestR = adjR;
      bestC = adjC;
    }
    if (bestR < 0) {
      bestR = 0;
      bestC = 0;
    }

    // Ensure grid has enough rows
    while (this.grid.length <= bestR) {
      this.grid.push(new Array(colsForRow(this.grid.length)).fill(null) as (Color | null)[]);
    }
    this.grid[bestR][bestC] = color;

    // Find connected same-color group
    const group = this.floodFill(bestR, bestC, color);
    if (group.length >= 3) {
      let pts = 0;
      for (const [gr, gc] of group) {
        this.grid[gr][gc] = null;
        pts += 10;
      }
      this.addScore(pts);
      playSound('combo');
      this.spawnPopParticles(group);
      this.dropOrphans();
      if (this.grid.every((row) => row.every((c) => c === null))) {
        this.addScore(200);
        playSound('win');
        this.gameOver();
        return;
      }
    }

    // Drop the trailing all-empty rows the search may have materialised, so the
    // lose test below measures the lowest *real* bubble, not a phantom row.
    this.trimGrid();

    // Check lose condition: the lowest bubble reaches the danger line.
    const lowestRow = this.lowestFilledRow();
    if (lowestRow >= 0 && bubbleY(lowestRow) + R > SHOOTER_Y - R * 3) {
      this.gameOver();
    }
  }

  /** True when (r, c) is inside the grid and holds a bubble. */
  private cellFilled(r: number, c: number): boolean {
    return r >= 0 && r < this.grid.length && this.grid[r]?.[c] != null;
  }

  /** A cell can hold a snapped bubble if it hangs from the ceiling or a neighbour. */
  private cellHasSupport(r: number, c: number): boolean {
    if (r === 0) return true;
    return this.getNeighbors(r, c).some(([nr, nc]) => this.cellFilled(nr, nc));
  }

  private trimGrid(): void {
    while (this.grid.length > 0 && this.grid[this.grid.length - 1].every((c) => c === null)) {
      this.grid.pop();
    }
  }

  private lowestFilledRow(): number {
    for (let r = this.grid.length - 1; r >= 0; r--) {
      if (this.grid[r].some((c) => c !== null)) return r;
    }
    return -1;
  }

  private floodFill(startR: number, startC: number, color: Color): [number, number][] {
    const visited = new Set<string>();
    const group: [number, number][] = [];
    const queue: [number, number][] = [[startR, startC]];
    while (queue.length > 0) {
      const [r, c] = queue.pop()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (r < 0 || r >= this.grid.length || c < 0 || c >= (this.grid[r]?.length ?? 0)) continue;
      if (this.grid[r][c] !== color) continue;
      group.push([r, c]);
      for (const [nr, nc] of this.getNeighbors(r, c)) {
        queue.push([nr, nc]);
      }
    }
    return group;
  }

  private getNeighbors(r: number, c: number): [number, number][] {
    const isOdd = r % 2 === 1;
    const neighbors: [number, number][] = [
      [r, c - 1],
      [r, c + 1],
      [r - 1, c],
      [r - 1, isOdd ? c + 1 : c - 1],
      [r + 1, c],
      [r + 1, isOdd ? c + 1 : c - 1],
    ];
    return neighbors;
  }

  private dropOrphans(): void {
    // Find all bubbles connected to the top row
    const connected = new Set<string>();
    const queue: [number, number][] = [];
    if (this.grid.length === 0) return;
    for (let c = 0; c < this.grid[0].length; c++) {
      if (this.grid[0][c] !== null) {
        queue.push([0, c]);
        connected.add(`0,${c}`);
      }
    }
    while (queue.length > 0) {
      const [r, c] = queue.pop()!;
      for (const [nr, nc] of this.getNeighbors(r, c)) {
        const key = `${nr},${nc}`;
        if (connected.has(key)) continue;
        if (nr < 0 || nr >= this.grid.length || nc < 0 || nc >= (this.grid[nr]?.length ?? 0))
          continue;
        if (this.grid[nr][nc] === null) continue;
        connected.add(key);
        queue.push([nr, nc]);
      }
    }

    // Drop orphans
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] !== null && !connected.has(`${r},${c}`)) {
          this.grid[r][c] = null;
          this.addScore(5);
        }
      }
    }
  }

  private spawnPopParticles(group: [number, number][]): void {
    if (!this.fx || !this.canvas) return;
    for (const [r, c] of group) {
      const cx = bubbleX(r, c);
      const cy = bubbleY(r);
      const scaleX = this.canvas.clientWidth / W;
      const scaleY = this.canvas.clientHeight / H;
      const rect = this.canvas.getBoundingClientRect();
      this.fx.emit(rect.left + cx * scaleX, rect.top + cy * scaleY, {
        count: 6,
        speed: 3,
        spread: Math.PI * 2,
        gravity: 0.12,
        duration: 350,
        size: 5,
        colors: [COLORS[this.grid[r]?.[c] ?? 0] ?? '#fff', '#ffffff'],
      });
    }
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Aim line
    if (!this.flying) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(SHOOTER_X, SHOOTER_Y);
      ctx.lineTo(
        SHOOTER_X + Math.cos(this.aimAngle) * 120,
        SHOOTER_Y + Math.sin(this.aimAngle) * 120
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Grid bubbles
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        const color = this.grid[r][c];
        if (color === null) continue;
        this.drawBubble(ctx, bubbleX(r, c), bubbleY(r), color);
      }
    }

    // Flying bubble
    if (this.flying) {
      this.drawBubble(ctx, this.flying.x, this.flying.y, this.flying.color);
    }

    // Shooter
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y + 8, R + 6, 0, Math.PI * 2);
    ctx.fill();
    this.drawBubble(ctx, SHOOTER_X, SHOOTER_Y, this.shooter.color);

    // Next bubble preview
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px sans-serif';
    ctx.fillText('next', SHOOTER_X + 36, SHOOTER_Y + 5);
    this.drawBubble(ctx, SHOOTER_X + 52, SHOOTER_Y, this.shooter.nextColor, R * 0.65);

    // Danger line
    const dangerY = SHOOTER_Y - R * 3;
    ctx.strokeStyle = 'rgba(239,68,68,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(W, dangerY);
    ctx.stroke();
  }

  private drawBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: Color,
    radius = R
  ): void {
    const hex = COLORS[color] ?? '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = hex;
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    // Stroke
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
