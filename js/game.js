// ============================================================
//  Game rules and state. No DOM code here.
//  State is saved to localStorage so a page refresh doesn't lose the game.
// ============================================================

import { CONFIG } from './config.js';
import { pickFresh, markPlayed } from './history.js';

const KEY = 'maydan.game';
let state = null;

export function getState() {
  return state;
}

export function load() {
  try {
    state = JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    state = null;
  }
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: game still works, just won't survive a refresh */
  }
}

export function clear() {
  state = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Start a new game.
 * @param {string[]} names - [team1, team2]
 * @param {string[][]} picks - [[3 category ids], [3 category ids]]
 */
export async function newGame(names, picks) {
  // Board order: team 1's picks then team 2's picks
  const categories = [...picks[0], ...picks[1]];
  const board = {};
  for (const catId of categories) {
    const tiles = [];
    for (const slot of CONFIG.BOARD) {
      const qs = await pickFresh(catId, slot.difficulty, slot.count);
      qs.forEach((q) => tiles.push({ qid: q.id, points: slot.points, played: false, wonBy: null }));
    }
    board[catId] = tiles;
  }
  state = {
    phase: 'board',
    teams: names.map((name, i) => ({ name, score: 0, categories: picks[i], helpersUsed: [] })),
    categories,
    board,
    turn: 0,
    betArmed: null, // team index that armed الرهان for its next question
    current: null,
  };
  save();
  return state;
}

export function ownerOf(catId) {
  return state.teams.findIndex((t) => t.categories.includes(catId));
}

export function openTile(catId, index) {
  const tile = state.board[catId][index];
  if (!tile || tile.played) return null;
  const bet = state.betArmed === state.turn;
  state.betArmed = null;
  state.current = { catId, index, qid: tile.qid, points: tile.points, chooser: state.turn, stage: 'answer', bet, awardedTo: undefined };
  state.phase = 'question';
  markPlayed(tile.qid);
  save();
  return state.current;
}

export function setStage(stage) {
  state.current.stage = stage;
  save();
}

/** @param {0|1|null} team - who gets the points (null = nobody) */
export function award(team) {
  const cur = state.current;
  if (!cur || cur.awardedTo !== undefined) return;
  cur.awardedTo = team;
  const delta = scoreChanges(cur, team);
  delta.forEach((d, i) => (state.teams[i].score += d));
  const tile = state.board[cur.catId][cur.index];
  tile.played = true;
  tile.wonBy = team;
  save();
}

/** Points each team gains/loses for this award, e.g. [400, 0]. Handles الرهان. */
export function scoreChanges(cur, team) {
  const d = [0, 0];
  if (team === 0 || team === 1) d[team] += cur.bet && team === cur.chooser ? cur.points * 2 : cur.points;
  if (cur.bet && team !== cur.chooser) d[cur.chooser] -= cur.points;
  return d;
}

export function backToBoard() {
  const cur = state.current;
  state.turn = cur ? 1 - cur.chooser : 1 - state.turn;
  state.current = null;
  state.phase = isFinished() ? 'winner' : 'board';
  save();
}

export function isFinished() {
  return Object.values(state.board).every((tiles) => tiles.every((t) => t.played));
}

/** 0, 1, or null for a draw */
export function winner() {
  const [a, b] = state.teams.map((t) => t.score);
  return a === b ? null : a > b ? 0 : 1;
}

export function helperUsed(team, helperId) {
  return state.teams[team].helpersUsed.includes(helperId);
}

export function useHelper(team, helperId) {
  if (helperUsed(team, helperId)) return false;
  state.teams[team].helpersUsed.push(helperId);
  if (helperId === 'bet') state.betArmed = team;
  save();
  return true;
}

/** Undo an armed bet before a tile is opened (gives the helper back). */
export function cancelBet(team) {
  if (state.betArmed !== team) return;
  state.betArmed = null;
  const used = state.teams[team].helpersUsed;
  used.splice(used.indexOf('bet'), 1);
  save();
}
