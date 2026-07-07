import { DBState, DBMove, Seat } from './dotsboxes.js';
import { DotsBoxesRules } from './dotsboxes.js';

function countBoxesCompleted(state: DBState, move: DBMove): number {
  const rules = new DotsBoxesRules(state.n, state.players);
  const next = rules.applyMove(state, move);
  const gained = next.scores[state.seat] - state.scores[state.seat];
  return gained;
}

export function decideBotMove(state: DBState, legalMoves: DBMove[], _seat: Seat): DBMove {
  // First priority: take any move that completes one or more boxes
  const completers = legalMoves.filter((m) => countBoxesCompleted(state, m) > 0);
  if (completers.length > 0) {
    return completers[Math.floor(Math.random() * completers.length)];
  }

  // Second priority: avoid moves that give 3 edges to a box (would let opponent score)
  const safe = legalMoves.filter((m) => !givesOpponentBox(state, m));
  const pool = safe.length > 0 ? safe : legalMoves;
  return pool[Math.floor(Math.random() * pool.length)];
}

function adjacentBoxEdgeCount(state: DBState, br: number, bc: number): number {
  if (br < 0 || br >= state.n || bc < 0 || bc >= state.n) return 0;
  let count = 0;
  if (state.hEdges[br][bc]) count++;
  if (state.hEdges[br + 1][bc]) count++;
  if (state.vEdges[br][bc]) count++;
  if (state.vEdges[br][bc + 1]) count++;
  return count;
}

function givesOpponentBox(state: DBState, move: DBMove): boolean {
  // Check if this move would give a box 3 edges (opponent can complete it next)
  const boxesToCheck: [number, number][] = [];
  if (move.dir === 'h') {
    if (move.row > 0) boxesToCheck.push([move.row - 1, move.col]);
    if (move.row < state.n) boxesToCheck.push([move.row, move.col]);
  } else {
    if (move.col > 0) boxesToCheck.push([move.row, move.col - 1]);
    if (move.col < state.n) boxesToCheck.push([move.row, move.col]);
  }
  return boxesToCheck.some(([br, bc]) => adjacentBoxEdgeCount(state, br, bc) === 3);
}
