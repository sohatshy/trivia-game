// ============================================================
//  Play history: which question ids a player has already seen.
//  Stored per player key ("guest" on this device, or the account id).
//  Signed-in players are also synced to Supabase (table played_questions), so their
//  history follows the account to other devices.
//  When a category+difficulty runs out, its history is reset so it can repeat.
// ============================================================

import { getQuestions } from './questions.js';

const PREFIX = 'maydan.history.';
let playerKey = 'guest';
let remote = null; // { sb, userId } when signed in

/**
 * Choose whose history to use. With a Supabase client, the account's server history is
 * merged into the local copy.
 */
export async function setPlayer(key, sb = null) {
  playerKey = key || 'guest';
  remote = sb && key ? { sb, userId: key } : null;
  if (!remote) return;
  const { data, error } = await sb.from('played_questions').select('question_id').eq('user_id', key);
  if (error) return console.warn('Could not load play history', error.message);
  const set = read();
  data.forEach((r) => set.add(r.question_id));
  write(set);
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
  remote?.sb
    .from('played_questions')
    .upsert({ user_id: remote.userId, question_id: id }, { onConflict: 'user_id,question_id' })
    .then(({ error }) => error && console.warn('Could not save play history', error.message));
}

function forget(ids) {
  remote?.sb
    .from('played_questions')
    .delete()
    .eq('user_id', remote.userId)
    .in('question_id', ids)
    .then(({ error }) => error && console.warn('Could not reset play history', error.message));
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
    forget(pool.map((q) => q.id));
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
