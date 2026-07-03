/**
 * Procedural Web Audio sound system — zero audio files, zero licensing issues.
 * All sounds are synthesised on-the-fly with OscillatorNode + GainNode.
 * The AudioContext is lazy-initialised on first play (browser requires a prior
 * user interaction, which is guaranteed by the "Play" overlay or the first input).
 */

export type SoundId =
  | 'eat'
  | 'die'
  | 'combo'
  | 'bounce'
  | 'score'
  | 'clear'
  | 'tetris'
  | 'drop'
  | 'hit'
  | 'sunk'
  | 'miss'
  | 'match'
  | 'mismatch'
  | 'move'
  | 'dice'
  | 'win'
  | 'connect';

const STORAGE_KEY = 'gz-sound';

let _ctx: AudioContext | null = null;
let _muted = localStorage.getItem(STORAGE_KEY) === '0';

window.addEventListener('gz-sound-change', ((e: Event) => {
  const detail = (e as CustomEvent<{ muted: boolean }>).detail;
  _muted = detail.muted;
}) as EventListener);

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') void _ctx.resume();
  return _ctx;
}

/** Plays a single oscillator tone with an exponential fade-out. */
function tone(
  c: AudioContext,
  freqStart: number,
  freqEnd: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay = 0
): void {
  const t = c.currentTime + delay;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  g.connect(c.destination);

  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freqStart, t);
  if (freqEnd !== freqStart) o.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
  o.connect(g);
  o.start(t);
  o.stop(t + duration + 0.01);
}

/** Plays a burst of filtered white noise (hits, explosions). */
function noise(c: AudioContext, duration: number, volume: number, delay = 0): void {
  const t = c.currentTime + delay;
  const size = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, size, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 300;
  filter.Q.value = 0.8;

  const g = c.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t);
  src.stop(t + duration);
}

export function playSound(id: SoundId): void {
  if (_muted) return;
  const c = ctx();

  switch (id) {
    case 'eat':
      tone(c, 440, 880, 0.08, 0.22, 'sine');
      break;

    case 'die':
      tone(c, 380, 70, 0.45, 0.3, 'sawtooth');
      noise(c, 0.15, 0.12, 0.05);
      break;

    case 'combo':
      tone(c, 440, 440, 0.07, 0.22, 'square');
      tone(c, 550, 550, 0.07, 0.22, 'square', 0.08);
      tone(c, 660, 660, 0.07, 0.22, 'square', 0.16);
      tone(c, 880, 880, 0.1, 0.28, 'square', 0.24);
      break;

    case 'bounce':
      tone(c, 320, 280, 0.04, 0.14, 'sine');
      break;

    case 'score':
      tone(c, 600, 900, 0.1, 0.18, 'sine');
      break;

    case 'clear':
      tone(c, 330, 660, 0.18, 0.22, 'square');
      break;

    case 'tetris':
      [440, 554, 659, 880, 1108].forEach((f, i) => tone(c, f, f, 0.14, 0.28, 'square', i * 0.1));
      break;

    case 'drop':
      tone(c, 220, 110, 0.09, 0.2, 'square');
      break;

    case 'hit':
      noise(c, 0.12, 0.35);
      tone(c, 160, 60, 0.12, 0.2, 'sawtooth');
      break;

    case 'sunk':
      noise(c, 0.25, 0.4);
      tone(c, 200, 50, 0.3, 0.28, 'sawtooth');
      tone(c, 140, 40, 0.25, 0.2, 'sawtooth', 0.12);
      break;

    case 'miss':
      tone(c, 280, 230, 0.09, 0.1, 'sine');
      break;

    case 'match':
      tone(c, 660, 660, 0.1, 0.2, 'sine');
      tone(c, 880, 880, 0.14, 0.22, 'sine', 0.11);
      break;

    case 'mismatch':
      tone(c, 220, 185, 0.16, 0.2, 'sawtooth');
      break;

    case 'move':
      tone(c, 380, 360, 0.04, 0.08, 'sine');
      break;

    case 'dice':
      for (let i = 0; i < 5; i++) {
        tone(c, 280 + Math.random() * 220, 240, 0.03, 0.09, 'sine', i * 0.035);
      }
      break;

    case 'connect':
      tone(c, 420, 400, 0.06, 0.14, 'sine');
      break;

    case 'win':
      [440, 550, 660, 880, 1100].forEach((f, i) => tone(c, f, f, 0.18, 0.28, 'sine', i * 0.13));
      break;
  }
}

/**
 * Plays a single pure tone at `freq` Hz (respects the global mute). For
 * pitch-based games (e.g. Simon) that need a distinct note per element rather
 * than a named sound effect.
 */
export function playTone(freq: number, duration = 0.35, type: OscillatorType = 'sine'): void {
  if (_muted) return;
  tone(ctx(), freq, freq, duration, 0.25, type);
}

export function setMuted(v: boolean): void {
  _muted = v;
  localStorage.setItem(STORAGE_KEY, v ? '0' : '1');
  window.dispatchEvent(new CustomEvent('gz-sound-change', { detail: { muted: v } }));
}

export function isMuted(): boolean {
  return _muted;
}
