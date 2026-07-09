import type { GameEngine } from '../engine/GameEngine.js';
import type { NetMatch, MatchMessage } from '../net/match.js';
import { t } from '../i18n/i18n.js';
import { dismissStartOverlay } from '../ui/startOverlay.js';
import { formatClock } from '../ui/stopwatch.js';
import { GameOverlay, type GameOverlayButton } from '../ui/gameOverlay.js';
import { setupMultiplayerPanel, type MultiplayerHandle } from './multiplayerPanel.js';
import {
  OP_CHALLENGE,
  OP_FAILED,
  OP_RESTART,
  OP_SOLVED,
  type CompletionFinish,
  type CompletionState,
  applyFailed,
  applySolved,
  initCompletionState,
  isRaceOver,
  raceWinner,
} from './completionRace.js';

/**
 * Wires the shared completion-race contract into a solve-to-win game: both seats
 * attack the same host-authoritative challenge and the fastest solve wins.
 * Composition (like {@link setupScoreRace}), not a base class — the game keeps
 * its own loop and rendering and only supplies the seed plumbing.
 */
export interface CompletionRaceOptions<Seed> {
  finish: CompletionFinish;
  /** Host only: build the shared challenge payload (must be JSON-serialisable). */
  generateChallenge: () => Seed;
  /** Both seats: build and start the identical local round from the challenge. */
  applyChallenge: (seed: Seed) => void;
  /** Elapsed time of the local run, in ms (used as the solve time to compare). */
  getElapsedMs: () => number;
  /** Opponent progress: their solve time (ms) once solved, or null while playing. */
  onOpponentStatus?: (timeMs: number | null) => void;
  onSessionEnd?: () => void;
}

export interface CompletionRaceHandle {
  reportSolved(timeMs?: number): boolean;
  reportFailed(): boolean;
  isNetActive(): boolean;
}

export function setupCompletionRace<Seed>(
  _game: GameEngine,
  opts: CompletionRaceOptions<Seed>
): CompletionRaceHandle {
  let net: NetMatch | null = null;
  let multiplayer: MultiplayerHandle | null = null;
  let race: CompletionState = initCompletionState(2, opts.finish);
  let localFinished = false;
  let raceSettled = false;
  const overlay = new GameOverlay();

  function mySeat(): number {
    return net?.seat ?? 0;
  }

  function opponentSeat(): number {
    return mySeat() === 0 ? 1 : 0;
  }

  function send(opCode: number, data: unknown): void {
    net?.send(opCode, data);
  }

  function beginSession(nextNet: NetMatch): void {
    net = nextNet;
    race = initCompletionState(nextNet.players, opts.finish);
    localFinished = false;
    raceSettled = false;
    overlay.hide();
    opts.onOpponentStatus?.(null);
    nextNet.onMessage(handleMessage);
    if (nextNet.role === 'host') {
      const seed = opts.generateChallenge();
      send(OP_CHALLENGE, { seed });
      startLocalRound(seed);
    }
  }

  function endSession(): void {
    overlay.hide();
    net = null;
    race = initCompletionState(2, opts.finish);
    localFinished = false;
    raceSettled = false;
    opts.onOpponentStatus?.(null);
    opts.onSessionEnd?.();
  }

  function handleMessage(msg: MatchMessage): void {
    if (!net) return;

    if (msg.opCode === OP_CHALLENGE) {
      const data = msg.data as { seed?: Seed } | null;
      if (data?.seed !== undefined) startLocalRound(data.seed);
      return;
    }

    if (msg.opCode === OP_SOLVED) {
      const data = msg.data as { seat?: number; timeMs?: number } | null;
      if (!data || typeof data.seat !== 'number' || typeof data.timeMs !== 'number') return;
      race = applySolved(race, data.seat, data.timeMs);
      if (data.seat === opponentSeat()) opts.onOpponentStatus?.(data.timeMs);
      settleIfOver();
      return;
    }

    if (msg.opCode === OP_FAILED) {
      const data = msg.data as { seat?: number } | null;
      if (!data || typeof data.seat !== 'number') return;
      race = applyFailed(race, data.seat);
      settleIfOver();
      return;
    }

    if (msg.opCode === OP_RESTART) {
      const data = msg.data as { seed?: Seed } | null;
      if (data?.seed !== undefined) restartRace(data.seed);
    }
  }

  function startLocalRound(seed: Seed): void {
    localFinished = false;
    raceSettled = false;
    dismissStartOverlay();
    overlay.hide();
    opts.onOpponentStatus?.(null);
    opts.applyChallenge(seed);
  }

  function reportSolved(timeMs = opts.getElapsedMs()): boolean {
    if (!net) return false;
    if (!localFinished) {
      localFinished = true;
      const seat = mySeat();
      race = applySolved(race, seat, timeMs);
      send(OP_SOLVED, { seat, timeMs });
    }
    if (!settleIfOver()) showWaitingOverlay();
    return true;
  }

  function reportFailed(): boolean {
    if (!net) return false;
    if (!localFinished) {
      localFinished = true;
      const seat = mySeat();
      race = applyFailed(race, seat);
      send(OP_FAILED, { seat });
    }
    if (!settleIfOver()) showWaitingOverlay();
    return true;
  }

  function settleIfOver(): boolean {
    if (!isRaceOver(race)) return false;
    if (raceSettled) return true;
    raceSettled = true;
    showResultOverlay();
    return true;
  }

  function showWaitingOverlay(): void {
    overlay.show({
      title: t('scoreRaceWaitingTitle'),
      bodyHtml: `<p class="mp-status">${t('scoreRaceWaitingBody')}</p>`,
      buttons: [
        {
          text: t('quit'),
          primary: true,
          onClick: () => {
            overlay.hide();
            multiplayer?.leave();
          },
        },
      ],
    });
  }

  function seatTime(seat: number): string {
    const s = race.seats[seat];
    return s?.solved ? formatClock(Math.round(s.timeMs / 1000)) : '—';
  }

  function showResultOverlay(): void {
    const winner = raceWinner(race);
    const localSeat = mySeat();
    const title =
      winner === null
        ? t('scoreRaceTie')
        : winner === localSeat
          ? t('scoreRaceWin')
          : t('scoreRaceLose');
    const buttons: GameOverlayButton[] = [];
    if (net?.role === 'host') {
      buttons.push({
        text: t('rematch'),
        primary: true,
        onClick: () => {
          const seed = opts.generateChallenge();
          send(OP_RESTART, { seed });
          restartRace(seed);
        },
      });
    }
    buttons.push({
      text: t('quit'),
      primary: net?.role !== 'host',
      onClick: () => {
        overlay.hide();
        multiplayer?.leave();
      },
    });
    const waiting =
      net?.role === 'host' ? '' : `<p class="mp-status">${t('waitingForRematch')}</p>`;
    overlay.show({
      title,
      bodyHtml: `<p>${t('completionRaceResult', {
        you: seatTime(localSeat),
        opponent: seatTime(opponentSeat()),
      })}</p>${waiting}`,
      buttons,
    });
  }

  function restartRace(seed: Seed): void {
    race = initCompletionState(net?.players ?? 2, opts.finish);
    startLocalRound(seed);
  }

  multiplayer = setupMultiplayerPanel({
    capacity: 2,
    onSessionStart: beginSession,
    onSessionEnd: endSession,
  });

  return {
    reportSolved,
    reportFailed,
    isNetActive() {
      return net !== null;
    },
  };
}
