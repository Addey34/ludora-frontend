/**
 * "Ludora Points" (LP) — the fair cross-game currency behind the global
 * ranking. A run's contribution is bounded by the log of its score, so a big
 * Tetris score and a modest Snake score weigh comparably and no single game can
 * dominate the global board. Points are cumulative: the global leaderboard is an
 * incremental Nakama board, so every finished run adds its LP to the player's
 * running total (rewarding breadth + regularity, not one lucky score).
 *
 * Pure → unit-tested. Keep this the single definition; the client submits it and
 * a change here would silently re-weight everyone, so treat it as a fixed rule.
 */
export function ludoraPoints(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.round(10 * Math.log10(1 + score));
}
