/**
 * Die-face pip layout, shared by every die in the app (the turn-based
 * {@link createDice} component and Yahtzee's five-dice tray) so a "3" always
 * looks the same and the layout lives in exactly one place.
 *
 * Positions are the 9 cells of a 3×3 grid, numbered 1..9 row-major:
 *   1 2 3
 *   4 5 6
 *   7 8 9
 */
export const DIE_PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

/**
 * Builds the 9-span pip grid for `value` as an HTML string. Lit cells carry the
 * `is-on` modifier; render inside an element styled as a `repeat(3, 1fr)` grid
 * (see the shared `.dice-pip` rules in `dice.css`).
 */
export function dieFaceHtml(value: number): string {
  const on = DIE_PIPS[value] ?? [];
  let html = '';
  for (let cell = 1; cell <= 9; cell++) {
    html += `<span class="dice-pip${on.includes(cell) ? ' is-on' : ''}"></span>`;
  }
  return html;
}
