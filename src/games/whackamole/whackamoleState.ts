export type MoleKind = 'normal' | 'golden';

export interface Mole {
  hole: number;
  kind: MoleKind;
}

export interface WhackamoleState {
  active: Mole | null;
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  lastHole: number | null;
}
