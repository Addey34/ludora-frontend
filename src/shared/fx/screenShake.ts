/**
 * Shakes the `.game-shell` card with a decaying CSS transform.
 * Safe to call rapidly: a shake in progress is not interrupted (guards via dataset).
 */
export function screenShake(intensity = 6, duration = 280): void {
  const shell = document.querySelector<HTMLElement>('.game-shell');
  if (!shell || shell.dataset.shaking) return;
  shell.dataset.shaking = '1';

  const start = performance.now();

  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    if (t >= 1) {
      shell.style.transform = '';
      delete shell.dataset.shaking;
      return;
    }
    const decay = 1 - t;
    const dx = (Math.random() - 0.5) * 2 * intensity * decay;
    const dy = (Math.random() - 0.5) * intensity * decay;
    shell.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
