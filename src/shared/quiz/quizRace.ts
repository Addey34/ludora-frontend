/**
 * Pure state model and logic for the QuizGame multiplayer race mode.
 * No DOM, no side effects — fully unit-testable, shared by every quiz-race game
 * (Trivia pilot, then Geo Quiz, Mental Math, Anagrams, Conjugation).
 *
 * Protocol (op codes < SYS_OP_BASE = 1000):
 *   OP_QUESTION  host → all   : RaceQuestion (prompt + choices, NO answer)
 *   OP_ANSWER    guest → host : { roundIndex, answer, seat }
 *   OP_RESULT    host → all   : RaceResult  (scores, correct flags, correct answer)
 *   OP_RESTART   host → all   : null (start a fresh game)
 */

import type { Difficulty } from '../bot/difficulty.js';
import { type Question, isCorrect, scoreForCorrect } from './quiz.js';

export const OP_QUESTION = 1;
export const OP_ANSWER = 2;
export const OP_RESULT = 3;
export const OP_RESTART = 4;

/** Broadcast to guests — answer field intentionally absent. */
export interface RaceQuestion {
  roundIndex: number;
  prompt: string;
  choices?: string[];
}

/** Host-only: live state while waiting for all players to answer. */
export interface RaceRound {
  roundIndex: number;
  question: Question;
  /**
   * Per-seat answer:
   *   undefined = not yet received
   *   null      = timed out (no answer submitted)
   *   string    = answer submitted
   */
  answers: (string | null | undefined)[];
  /** True when this is the last question of the match. */
  final: boolean;
}

/** Broadcast after all answers received (or timeout). Carries the reveal. */
export interface RaceResult {
  roundIndex: number;
  correctAnswer: string;
  hint?: string;
  /** Whether each seat answered correctly (index = seat). */
  correct: boolean[];
  /** Cumulative score per seat after this round. */
  scores: number[];
  final: boolean;
}

/** Removes the answer before broadcasting to guests. */
export function stripAnswer(question: Question, roundIndex: number): RaceQuestion {
  const q: RaceQuestion = { roundIndex, prompt: question.prompt };
  if (question.choices) q.choices = [...question.choices];
  return q;
}

/** True when every seat (0 … playerCount-1) has submitted (string or null). */
export function allAnswered(round: RaceRound, playerCount: number): boolean {
  for (let i = 0; i < playerCount; i++) {
    if (round.answers[i] === undefined) return false;
  }
  return true;
}

/**
 * Scores the round for all seats.
 * Returns the RaceResult (ready to broadcast) plus the updated per-seat scores
 * and streaks (host keeps these as authoritative state for the next round).
 */
export function scoreRound(
  round: RaceRound,
  playerCount: number,
  basePoints: number,
  difficulty: Difficulty,
  currentScores: readonly number[],
  currentStreaks: readonly number[]
): { result: RaceResult; newScores: number[]; newStreaks: number[] } {
  const correct: boolean[] = [];
  const newScores = [...currentScores];
  const newStreaks = [...currentStreaks];

  for (let i = 0; i < playerCount; i++) {
    const given = round.answers[i] ?? null;
    const ok = given !== null && isCorrect(given, round.question.answer);
    correct.push(ok);
    if (ok) {
      newStreaks[i] = (newStreaks[i] ?? 0) + 1;
      newScores[i] = (newScores[i] ?? 0) + scoreForCorrect(basePoints, difficulty, newStreaks[i]);
    } else {
      newStreaks[i] = 0;
    }
  }

  return {
    result: {
      roundIndex: round.roundIndex,
      correctAnswer: round.question.answer,
      hint: round.question.hint,
      correct,
      scores: newScores,
      final: round.final,
    },
    newScores,
    newStreaks,
  };
}
