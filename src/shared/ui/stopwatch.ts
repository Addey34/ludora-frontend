/**
 * A tiny elapsed-seconds stopwatch shared by the timed games (Minesweeper,
 * Sudoku, Word Search, Nonogram). It owns the 1 s interval and the counter and
 * calls back on every tick so the game can refresh its HUD — replacing the
 * copy-pasted `startTimer` / `clearTimer` / `formatTime` trio each game carried.
 */
export class Stopwatch {
  private elapsedS = 0;
  private id: ReturnType<typeof setInterval> | null = null;

  /** @param onTick called every second with the new elapsed count. */
  constructor(private readonly onTick: (seconds: number) => void) {}

  /** Elapsed whole seconds since construction or the last {@link reset}. */
  get seconds(): number {
    return this.elapsedS;
  }

  /** (Re)starts ticking from the current count. */
  start(): void {
    this.stop();
    this.id = setInterval(() => {
      this.elapsedS += 1;
      this.onTick(this.elapsedS);
    }, 1000);
  }

  /** Stops ticking (keeps the elapsed count). */
  stop(): void {
    if (this.id !== null) {
      clearInterval(this.id);
      this.id = null;
    }
  }

  /** Stops ticking and zeroes the count. */
  reset(): void {
    this.stop();
    this.elapsedS = 0;
  }
}

/** Formats a duration in seconds as `m:ss` (e.g. 75 → "1:15"). */
export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
