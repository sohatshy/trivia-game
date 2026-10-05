// ============================================================
//  Question source — the ONLY place that knows where questions come from.
//  Today: the public file data/questions.json.
//  Later: paid packs can be fetched from Supabase here, without touching the game.
// ============================================================

import { CONFIG } from './config.js';

// For testing, ?data=tests/some-file.json loads another local file instead.
const override = new URLSearchParams(location.search).get('data');
const SOURCE_URL = override && /^[\w/-]+\.json$/.test(override) ? override : 'data/questions.json';
let cache = null;

async function loadAll() {
  if (!cache) {
    const res = await fetch(SOURCE_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not load questions (${res.status})`);
    cache = await res.json();
  }
  return cache;
}

/** All categories (id, name, type). */
export async function getCategories() {
  return (await loadAll()).categories;
}

/** Categories that have enough verified questions to fill a board column. */
export async function getPlayableCategories(boardSpec) {
  const { categories, questions } = await loadAll();
  return categories.filter((c) =>
    boardSpec.every(
      (slot) => verified(questions).filter((q) => q.category === c.id && q.difficulty === slot.difficulty).length >= slot.count,
    ),
  );
}

/** Verified questions for one category + difficulty. */
export async function getQuestions(categoryId, difficulty) {
  const { questions } = await loadAll();
  return verified(questions).filter((q) => q.category === categoryId && q.difficulty === difficulty);
}

/** Look up one question by id (any verification state). */
export async function getQuestionById(id) {
  return (await loadAll()).questions.find((q) => q.id === id) || null;
}

/** Full raw data, for the review page. */
export async function getRawData() {
  return loadAll();
}

/** Questions allowed in the game: fact-checked, not marked wrong in review (and approved, if required). */
function verified(questions) {
  return questions.filter(
    (q) => q.verified === true && q.review !== 'rejected' && (!CONFIG.REQUIRE_REVIEW || q.review === 'approved'),
  );
}
