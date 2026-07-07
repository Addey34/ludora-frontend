import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

class ToyQuizGame extends QuizGame {
  private next = 0;

  constructor() {
    super({ storageKey: 'toy-quiz-test', rounds: 2, basePoints: 100 });
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
}

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
