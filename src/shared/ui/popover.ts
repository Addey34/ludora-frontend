/**
 * Generic click-driven popover used by the game-shell action buttons (Levels,
 * Settings, Leaderboard, Multiplayer, Feedback) and the help panel.
 *
 * Interaction (consistent everywhere in the app): **click the button to open**,
 * and it stays open until you **click outside**, press **Escape**, or **click the
 * button again**. No hover-pin / focus-pin to second-guess — opening one panel
 * closes any other (each panel's outside-click dismisses the rest).
 *
 * Markup convention (see `shell-open.hbs` / `panels.css` / `info.css`): a wrapper
 * (`.game-pop` or `.game-info`) holds a toggle button and a panel; the open state
 * is the `.is-open` class on the wrapper.
 */

/** A wired popover: its DOM nodes plus programmatic open/close. */
interface Popover {
  control: HTMLElement;
  toggle: HTMLElement;
  panel: HTMLElement;
  open(): void;
  close(): void;
}

/** ids of the three popover nodes (control / toggle / panel). */
interface PopoverIds {
  control: string;
  toggle: string;
  panel: string;
}

/** Wires click-to-toggle + close on outside-click / Escape onto a control trio. */
function wire(control: HTMLElement, toggle: HTMLElement, panel: HTMLElement): Popover {
  const setOpen = (open: boolean): void => {
    control.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!control.classList.contains('is-open')));
  panel.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', (event) => {
    if (!control.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  return { control, toggle, panel, open: () => setOpen(true), close: () => setOpen(false) };
}

/**
 * Wires a popover from its element ids. Returns null when any node is absent (a
 * game that did not opt into this panel), so callers can ignore the result.
 */
export function setupPopover(ids: PopoverIds): Popover | null {
  const control = document.getElementById(ids.control);
  const toggle = document.getElementById(ids.toggle);
  const panel = document.getElementById(ids.panel);
  if (!control || !toggle || !panel) return null;
  return wire(control, toggle, panel);
}

/**
 * Wires the shell's "How to play" help panel (`.game-info`) the same way, found
 * by class (it has no ids). No-op when the shell isn't present.
 */
export function setupInfoPanel(): void {
  const control = document.querySelector<HTMLElement>('.game-info');
  const toggle = control?.querySelector<HTMLElement>('.game-info-toggle');
  const panel = control?.querySelector<HTMLElement>('.game-info-panel');
  if (control && toggle && panel) wire(control, toggle, panel);
}
