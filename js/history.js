// ============================================================
//  Play history: which question ids a player has already seen.
//  Stored per player key ("guest" on this device, or the account id).
//  When a category+difficulty runs out, its history is reset so it can repeat.
// ============================================================

import { getQuestions } from './questions.js';

const PREFIX = 'maydan.history.';
let playerKey = 'guest';

export function setPlayer(key) {
  playerKey = key || 'guest';
}

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PREFIX + playerKey) || '[]'));
  } catch {
    return new Set();
  }
}

function write(set) {
  try {
    localStorage.setItem(PREFIX + playerKey, JSON.stringify([...set]));
  } catch {
    /* storage blocked: history just won't persist */
  }
}

export function markPlayed(id) {
  const set = read();
  set.add(id);
  write(set);
}

/**
 * Pick `count` questions, preferring ones this player hasn't seen.
 * If fewer than `count` unseen remain, forget the seen ones for that pool and reuse them.
 */
export async function pickFresh(categoryId, difficulty, count) {
  const pool = await getQuestions(categoryId, difficulty);
  const seen = read();
  let fresh = shuffle(pool.filter((q) => !seen.has(q.id)));
  if (fresh.length < count) {
    pool.forEach((q) => seen.delete(q.id));
    write(seen);
    const keep = new Set(fresh.map((q) => q.id));
    fresh = fresh.concat(shuffle(pool.filter((q) => !keep.has(q.id))));
  }
  return fresh.slice(0, count);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
