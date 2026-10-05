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
  state.current = { catId, index, qid: tile.qid, points: tile.points, chooser: state.turn, stage: 'answer', awardedTo: undefined };
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
  if (team === 0 || team === 1) state.teams[team].score += cur.points;
  const tile = state.board[cur.catId][cur.index];
  tile.played = true;
  tile.wonBy = team;
  save();
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

export function useHelper(team, helperId) {
  const t = state.teams[team];
  if (t.helpersUsed.includes(helperId)) return false;
  t.helpersUsed.push(helperId);
  save();
  return true;
}
