import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../fx/sound.js', () => ({ playSound: vi.fn() }));
import { QuizGame } from './QuizGame.js';
import {
  OP_ANSWER,
  OP_QUESTION,
  OP_RESULT,
  type RaceQuestion,
  type RaceResult,
} from './quizRace.js';
import type { Question } from './quiz.js';
import type { MatchMessage, MatchRole, NetMatch } from '../net/match.js';

class FakeNet implements NetMatch {
  matchId = 'match';
  code = 'TEST';
  capacity = 2;
  selfId = 'self';
  seat = 0;
  players = 2;
  sent: { op: number; data: unknown }[] = [];
  private msgCb: ((m: MatchMessage) => void) | null = null;

  constructor(public role: MatchRole) {}

  startMatch(): void {}
  lobby() {
    return { count: 2, capacity: 2, started: true };
  }
  send(op: number, data: unknown): void {
    this.sent.push({ op, data });
  }
  onMessage(cb: (m: MatchMessage) => void): void {
    this.msgCb = cb;
  }
  onLobby(): void {}
  onPeerLeave(): void {}
  onClose(): void {}
  async leave(): Promise<void> {}

  deliver(opCode: number, data: unknown): void {
    this.msgCb?.({ opCode, data, senderId: 'peer' });
  }
}

class TypedToyQuizGame extends QuizGame {
  private next = 0;

  constructor() {
    super({ storageKey: 'typed-toy-quiz-test', rounds: 2, basePoints: 100 });
  }

  protected makeQuestion(): Question {
    this.next += 1;
    return {
      prompt: 'Typed question ' + this.next,
      answer: '42',
    };
  }
}

class ToyQuizGame extends QuizGame {
  private next = 0;

  constructor(answerSeconds = 20) {
    super({ storageKey: 'toy-quiz-test', rounds: 2, basePoints: 100, answerSeconds });
  }

  protected makeQuestion(): Question {
    this.next += 1;
    return {
      prompt: 'Question ' + this.next,
      answer: 'A',
      choices: ['A', 'B'],
    };
  }

  setModeForTest(mode: 'classic' | 'timed' | 'survival'): void {
    this.mode = mode;
  }

  beginNetForTest(net: FakeNet): void {
    this.net = net;
    this.netMode = 'net';
    this.mySeat = net.seat;
    (this as unknown as { netPlayers: number }).netPlayers = net.players;
    net.onMessage((msg) =>
      (this as unknown as { handleNetMessage(msg: MatchMessage): void }).handleNetMessage(msg)
    );
  }

  currentQuestionForTest(): Question | null {
    return this.current;
  }

  isLockedForTest(): boolean {
    return this.locked;
  }

  restartRoundForTest(forceStart = false): void {
    this.restartRound(forceStart);
  }
}

class ConfigToyQuizGame extends QuizGame {
  constructor(config: Record<string, unknown>) {
    super({ storageKey: 'config-toy-quiz-test', ...config });
  }

  protected makeQuestion(): Question {
    return { prompt: 'Q', answer: 'A', choices: ['A', 'B'] };
  }

  setModeForTest(mode: 'classic' | 'timed' | 'survival'): void {
    this.mode = mode;
  }

  readNumber(key: 'rounds' | 'timedSeconds' | 'answerSeconds' | 'survivalLives' | 'lives'): number {
    return (this as unknown as Record<string, number>)[key];
  }
}

describe('QuizGame configurable settings', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="game-details"></div><div id="board"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('defaults each value to the first choice when no explicit value is given', async () => {
    const game = new ConfigToyQuizGame({
      roundChoices: [7, 10, 20],
      timeChoices: [45, 60],
      answerChoices: [15, 30],
      livesChoices: [2, 4],
    });
    await game.initialize();

    expect(game.readNumber('rounds')).toBe(7);
    expect(game.readNumber('timedSeconds')).toBe(45);
    expect(game.readNumber('answerSeconds')).toBe(15);
    expect(game.readNumber('survivalLives')).toBe(2);
  });

  it('keeps an explicit value even when choices are provided', async () => {
    const game = new ConfigToyQuizGame({ rounds: 10, roundChoices: [5, 10, 20] });
    await game.initialize();
    expect(game.readNumber('rounds')).toBe(10);
  });

  it('falls back to the fixed defaults when no choices are provided (backward compatible)', async () => {
    const game = new ConfigToyQuizGame({});
    await game.initialize();
    expect(game.readNumber('rounds')).toBe(10);
    expect(game.readNumber('timedSeconds')).toBe(60);
    expect(game.readNumber('answerSeconds')).toBe(20);
    expect(game.readNumber('survivalLives')).toBe(3);
  });

  it('starts survival mode with the configured number of lives', async () => {
    const game = new ConfigToyQuizGame({ livesChoices: [5, 3, 1] });
    await game.initialize();
    game.setModeForTest('survival');
    game.start();
    expect(game.readNumber('lives')).toBe(5);
  });
});

describe('QuizGame lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div class="game-details"></div><div id="board"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('keeps the quiz idle after initialization until Play starts it', async () => {
    const game = new ToyQuizGame();
    await game.initialize();

    expect(game.getState().isRunning).toBe(false);
    expect(document.querySelector('[data-stat="score"]')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('[data-stat="progress"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('does not start the quiz when settings restart before Play', async () => {
    const game = new ToyQuizGame();
    await game.initialize();

    game.restartRoundForTest();

    expect(game.getState().isRunning).toBe(false);
    expect(game.currentQuestionForTest()).toBeNull();
  });

  it('clears typed answer result classes before rendering the next question', async () => {
    const game = new TypedToyQuizGame();
    await game.initialize();

    game.start();
    (game as unknown as { answer(given: string): void }).answer('wrong');

    const answer = document.querySelector('.quiz-answer');
    expect(answer?.classList.contains('is-wrong')).toBe(true);

    vi.advanceTimersByTime(1_150);

    expect(answer?.classList.contains('is-wrong')).toBe(false);
    expect(answer?.classList.contains('is-correct')).toBe(false);
  });
});

describe('QuizGame multiplayer race', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div class="game-details"></div><div id="board"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('uses fixed-round race completion in net mode even when the solo mode is timed', async () => {
    const game = new ToyQuizGame();
    await game.initialize();
    game.setModeForTest('timed');
    const net = new FakeNet('host');
    game.beginNetForTest(net);

    game.start();
    expect(net.sent[0]?.op).toBe(OP_QUESTION);
    expect((net.sent[0]?.data as RaceQuestion).roundIndex).toBe(1);
    expect((net.sent[0]?.data as RaceQuestion).prompt).toBe('Question 1');

    (game as unknown as { answer(given: string): void }).answer('A');
    net.deliver(OP_ANSWER, { roundIndex: 1, answer: 'A', seat: 1 });
    expect((net.sent.find((m) => m.op === OP_RESULT)?.data as RaceResult).final).toBe(false);

    vi.advanceTimersByTime(600);
    expect(net.sent[2]?.op).toBe(OP_QUESTION);
    expect((net.sent[2]?.data as RaceQuestion).roundIndex).toBe(2);

    (game as unknown as { answer(given: string): void }).answer('A');
    net.deliver(OP_ANSWER, { roundIndex: 2, answer: 'A', seat: 1 });
    const results = net.sent.filter((m) => m.op === OP_RESULT).map((m) => m.data as RaceResult);
    expect(results[1]?.final).toBe(true);
  });

  it('uses the configured multiplayer answer timeout', async () => {
    const game = new ToyQuizGame(5);
    await game.initialize();
    const net = new FakeNet('host');
    game.beginNetForTest(net);

    game.start();
    vi.advanceTimersByTime(4_999);
    expect(net.sent.some((m) => m.op === OP_RESULT)).toBe(false);

    vi.advanceTimersByTime(1);
    const result = net.sent.find((m) => m.op === OP_RESULT)?.data as RaceResult;
    expect(result.correct).toEqual([false, false]);
  });

  it('shows the multiplayer answer countdown for the host', async () => {
    const game = new ToyQuizGame(5);
    await game.initialize();
    const net = new FakeNet('host');
    game.beginNetForTest(net);

    game.start();

    const time = document.querySelector('[data-stat="time"] .game-stat-value');
    expect(time?.textContent).toBe('5s');

    vi.advanceTimersByTime(1000);
    expect(time?.textContent).toBe('4s');
  });

  it('shows the multiplayer answer countdown for the guest', async () => {
    const game = new ToyQuizGame(5);
    await game.initialize();
    const net = new FakeNet('guest');
    net.seat = 1;
    game.beginNetForTest(net);
    game.start();

    net.deliver(OP_QUESTION, { roundIndex: 1, prompt: 'Remote question', choices: ['A', 'B'] });

    const time = document.querySelector('[data-stat="time"] .game-stat-value');
    expect(time?.textContent).toBe('5s');

    vi.advanceTimersByTime(1000);
    expect(time?.textContent).toBe('4s');
  });
  it('locks answers after an authoritative result arrives', async () => {
    const game = new ToyQuizGame();
    await game.initialize();
    const net = new FakeNet('guest');
    net.seat = 1;
    game.beginNetForTest(net);
    game.start();

    net.deliver(OP_QUESTION, { roundIndex: 1, prompt: 'Remote question', choices: ['A', 'B'] });
    expect(game.currentQuestionForTest()?.answer).toBe('');

    net.deliver(OP_RESULT, {
      roundIndex: 1,
      correctAnswer: 'A',
      correct: [true, false],
      scores: [100, 0],
      final: false,
    } satisfies RaceResult);

    expect(game.isLockedForTest()).toBe(true);
  });
});
