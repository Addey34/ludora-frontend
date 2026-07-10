import type { GameEngine } from '../engine/GameEngine.js';
import type { NetMatch, MatchMessage } from '../net/match.js';
import { t } from '../i18n/i18n.js';
import { GameOverlay, type GameOverlayButton } from '../ui/gameOverlay.js';
import { setupMultiplayerPanel, type MultiplayerHandle } from './multiplayerPanel.js';
import {
  OP_FINISHED,
  OP_PROGRESS,
  OP_RESTART,
  type RaceFinish,
  type RaceState,
  applyFinished,
  applyProgress,
  initRaceState,
  isRaceOver,
  raceWinner,
} from './scoreRace.js';

const PROGRESS_MIN_INTERVAL_MS = 250;

interface ScoreRaceOptions {
  finish: RaceFinish;
  getScore: () => number;
  isAlive?: () => boolean;
  finishLocalRace: () => void;
  restartLocalRace: () => void;
  onOpponentProgress?: (score: number, alive: boolean) => void;
  onSessionEnd?: () => void;
}

export interface ScoreRaceHandle {
  reportProgress(score?: number, alive?: boolean): void;
  reportFinished(score?: number): boolean;
  reset(): void;
  isNetActive(): boolean;
}

export function setupScoreRace(_game: GameEngine, opts: ScoreRaceOptions): ScoreRaceHandle {
  let net: NetMatch | null = null;
  let multiplayer: MultiplayerHandle | null = null;
  let currentFinish = opts.finish;
  let race: RaceState = initRaceState(2, currentFinish);
  let lastProgressAt = Number.NEGATIVE_INFINITY;
  let localFinished = false;
  let raceSettled = false;
  let timeTimer: ReturnType<typeof setTimeout> | null = null;
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

  function clearTimeTimer(): void {
    if (timeTimer !== null) {
      clearTimeout(timeTimer);
      timeTimer = null;
    }
  }

  function beginSession(nextNet: NetMatch): void {
    net = nextNet;
    currentFinish = opts.finish;
    race = initRaceState(nextNet.players, currentFinish);
    localFinished = false;
    raceSettled = false;
    lastProgressAt = Number.NEGATIVE_INFINITY;
    overlay.hide();
    opts.onOpponentProgress?.(0, true);
    nextNet.onMessage(handleMessage);
    opts.restartLocalRace();
    reportProgress(0, true);
    startTimeLimit();
  }

  function endSession(): void {
    clearTimeTimer();
    overlay.hide();
    net = null;
    currentFinish = opts.finish;
    race = initRaceState(2, currentFinish);
    localFinished = false;
    raceSettled = false;
    opts.onOpponentProgress?.(0, true);
    opts.onSessionEnd?.();
  }

  function startTimeLimit(): void {
    clearTimeTimer();
    if (currentFinish.kind !== 'time') return;
    const { seconds } = currentFinish;
    timeTimer = setTimeout(() => {
      if (!net || localFinished) return;
      opts.finishLocalRace();
    }, seconds * 1000);
  }

  function handleMessage(msg: MatchMessage): void {
    if (!net) return;
    if (msg.opCode === OP_PROGRESS) {
      const data = msg.data as { seat?: number; score?: number; alive?: boolean } | null;
      if (!data || typeof data.seat !== 'number' || typeof data.score !== 'number') return;
      const alive = data.alive !== false;
      race = applyProgress(race, data.seat, data.score, alive);
      if (data.seat === opponentSeat()) opts.onOpponentProgress?.(data.score, alive);
      settleIfOver();
      return;
    }

    if (msg.opCode === OP_FINISHED) {
      const data = msg.data as { seat?: number; score?: number } | null;
      if (!data || typeof data.seat !== 'number' || typeof data.score !== 'number') return;
      race = applyFinished(race, data.seat, data.score);
      if (data.seat === opponentSeat()) opts.onOpponentProgress?.(data.score, false);
      settleIfOver();
      return;
    }

    if (msg.opCode === OP_RESTART) {
      const data = msg.data as { finish?: RaceFinish } | null;
      restartRace(data?.finish ?? opts.finish);
    }
  }

  function reportProgress(score = opts.getScore(), alive = opts.isAlive?.() ?? true): void {
    if (!net || localFinished || raceSettled) return;
    const now = performance.now();
    if (now - lastProgressAt < PROGRESS_MIN_INTERVAL_MS && score < targetScore()) return;
    lastProgressAt = now;
    const seat = mySeat();
    race = applyProgress(race, seat, score, alive);
    send(OP_PROGRESS, { seat, score, alive });
    if (isRaceOver(race)) {
      opts.finishLocalRace();
      settleIfOver();
    }
  }

  function reportFinished(score = opts.getScore()): boolean {
    if (!net) return false;
    if (!localFinished) {
      localFinished = true;
      const seat = mySeat();
      race = applyFinished(race, seat, score);
      send(OP_FINISHED, { seat, score });
    }
    clearTimeTimer();
    if (!settleIfOver()) showWaitingOverlay();
    return true;
  }

  function targetScore(): number {
    return currentFinish.kind === 'target' ? currentFinish.score : Number.POSITIVE_INFINITY;
  }

  function settleIfOver(): boolean {
    if (!isRaceOver(race)) return false;
    if (raceSettled) return true;
    raceSettled = true;
    clearTimeTimer();
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
          send(OP_RESTART, { finish: opts.finish });
          restartRace(opts.finish);
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
    const local = race.seats[localSeat]?.score ?? 0;
    const opponent = race.seats[opponentSeat()]?.score ?? 0;
    const waiting =
      net?.role === 'host' ? '' : `<p class="mp-status">${t('waitingForRematch')}</p>`;
    overlay.show({
      title,
      bodyHtml: `<p>${t('scoreRaceResult', { score: local, opponent })}</p>${waiting}`,
      buttons,
    });
  }

  function restartRace(finish: RaceFinish): void {
    clearTimeTimer();
    overlay.hide();
    currentFinish = finish;
    race = initRaceState(net?.players ?? 2, currentFinish);
    localFinished = false;
    raceSettled = false;
    lastProgressAt = Number.NEGATIVE_INFINITY;
    opts.onOpponentProgress?.(0, true);
    opts.restartLocalRace();
    reportProgress(0, true);
    startTimeLimit();
  }

  multiplayer = setupMultiplayerPanel({
    capacity: 2,
    onSessionStart: beginSession,
    onSessionEnd: endSession,
  });

  return {
    reportProgress,
    reportFinished,
    reset() {
      if (!net) return;
      race = initRaceState(net.players, currentFinish);
      localFinished = false;
      raceSettled = false;
      lastProgressAt = Number.NEGATIVE_INFINITY;
      opts.onOpponentProgress?.(0, true);
      startTimeLimit();
    },
    isNetActive() {
      return net !== null;
    },
  };
}
