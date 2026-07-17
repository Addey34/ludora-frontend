/**
 * Unified live-stats bar ("HUD") for the `.game-details` strip above the board.
 *
 * Every game shows the same kind of readouts — time, score, best score, lives,
 * turn… — but each used to hand-roll its own markup, class names and text
 * formats. This is the **single** way to declare and update them: a game lists
 * its stats once ({@link setupHud}) and updates a value by key
 * ({@link HudHandle.set}). Each stat renders as a uniform chip — a Font Awesome
 * icon + its value — so the "time" stat's clock icon is the shared time logo.
 * The game owns only the values; the markup and styling are identical everywhere.
 */
import { t } from '../i18n/i18n.js';

/**
 * Maps the common cross-game HUD labels to their i18n key, so the aria-labels
 * are localised (a screen reader announces "Temps" on a French page). A label
 * with no mapping falls through to `t()`, which returns the literal unchanged —
 * so game-specific labels (Yahtzee categories, player codes) stay as authored.
 */
const LABEL_KEYS: Record<string, string> = {
  Time: 'hudTime',
  Score: 'score',
  Best: 'hudBest',
};

/**
 * Canonical left→right priority for the topbar chips. A game declares its stats
 * in whatever order reads best in its own code; {@link setupHud} then renders
 * them in this **single shared order** so the strip is laid out the same way in
 * every game (least effort, maximum consistency). The scheme reads as a sentence
 * — *whose turn · the live board · what you've built · your reserves · the clock ·
 * your record · the rival* — grouped into tiers (gaps left for future keys):
 *
 *  0  turn / active player — the "who" that frames everything to its right
 *  10 per-side live board counters (your side, then the opponent's)
 *  20 the run's primary metric (score and its single-number equivalents)
 *  30 reserves / streak / secondary counters spent during the run
 *  40 time
 *  50 personal best
 *  60 the versus opponent's score — always the far right
 *
 * A key that isn't listed defaults to {@link DEFAULT_ORDER} (just after the
 * primary metric), so a brand-new game-specific stat still lands sensibly with no
 * change here. Ties keep the game's declaration order (a stable sort).
 */
const STAT_ORDER: Record<string, number> = {
  turn: 0,
  // per-side board counters
  mine: 10,
  enemy: 11,
  pip: 12,
  // primary run metric (only one of these is usually present)
  score: 20,
  chips: 20,
  found: 20,
  filled: 20,
  solved: 20,
  puzzle: 20,
  moves: 20,
  tries: 20,
  guesses: 20,
  progress: 20,
  level: 20,
  lines: 21,
  // reserves / streaks / secondary counters
  bet: 30,
  lives: 30,
  rolls: 30,
  streak: 31,
  mines: 32,
  off: 33,
  pushes: 33,
  errors: 34,
  status: 35,
  // trailing group
  time: 40,
  high: 50,
  opponent: 60,
  opp: 60,
};
/** Unlisted keys sort just after the primary metric, before reserves. */
const DEFAULT_ORDER = 25;

/** The canonical rank of a stat key (see {@link STAT_ORDER}). */
function statRank(key: string): number {
  return STAT_ORDER[key] ?? DEFAULT_ORDER;
}

interface StatDef {
  /** Stable key used to update the stat (e.g. 'time', 'score', 'high'). */
  key: string;
  /** Font Awesome icon name without the `fa-` prefix (e.g. 'clock', 'trophy'). */
  icon: string;
  /** Accessible label (the icon alone isn't announced), e.g. 'Time'. */
  label: string;
}

export interface HudHandle {
  /**
   * Sets a stat's value. An empty string or `null` hides the chip (to clear a
   * transient readout, e.g. Ludo's turn timer between turns). No-op for an
   * undeclared key.
   */
  set(key: string, value: string | number | null): void;
  /** Toggles a modifier class on a stat chip (e.g. 'is-low' for a warning). */
  toggle(key: string, className: string, on: boolean): void;
}

/**
 * Renders the given stats into `host` (default: the page's `.game-details`) and
 * returns a handle to update them. Idempotent: removes chips from a previous run
 * first, leaving sibling markup (e.g. Ludo's player badges) untouched. The chips
 * are laid out in the shared canonical order ({@link STAT_ORDER}), not the order
 * the game declared them, so every topbar reads the same way left→right.
 */
export function setupHud(defs: StatDef[], host?: HTMLElement | null): HudHandle {
  const bar = host ?? document.querySelector<HTMLElement>('.game-details');
  const chips = new Map<string, HTMLElement>();
  const values = new Map<string, HTMLElement>();
  const visibilityClass = (key: string): string => `has-${key}-stat`;
  // Stable sort into the canonical order: ties keep the declaration order.
  const ordered = defs
    .map((def, index) => ({ def, index }))
    .sort((a, b) => statRank(a.def.key) - statRank(b.def.key) || a.index - b.index)
    .map((entry) => entry.def);

  if (bar) {
    bar.querySelectorAll('.game-stat').forEach((el) => el.remove());
    Array.from(bar.classList)
      .filter((className) => /^has-.+-stat$/.test(className))
      .forEach((className) => bar.classList.remove(className));

    for (const def of ordered) {
      const chip = document.createElement('span');
      chip.className = 'game-stat';
      chip.dataset.stat = def.key;
      chip.hidden = true;
      chip.setAttribute('aria-label', t(LABEL_KEYS[def.label] ?? def.label));

      const icon = document.createElement('i');
      icon.className = `fas fa-${def.icon}`;
      icon.setAttribute('aria-hidden', 'true');

      const value = document.createElement('span');
      value.className = 'game-stat-value';

      chip.append(icon, value);
      bar.appendChild(chip);
      chips.set(def.key, chip);
      values.set(def.key, value);
    }
  }

  return {
    set(key, value): void {
      const chip = chips.get(key);
      const valueEl = values.get(key);
      if (!chip || !valueEl) return;
      const empty = value === null || value === '';
      chip.hidden = empty;
      valueEl.textContent = empty ? '' : String(value);
      bar?.classList.toggle(visibilityClass(key), !empty);
    },
    toggle(key, className, on): void {
      chips.get(key)?.classList.toggle(className, on);
    },
  };
}
