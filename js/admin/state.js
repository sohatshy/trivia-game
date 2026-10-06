// ============================================================
//  Shared admin state + saving + small UI helpers used by every admin view.
// ============================================================

import { CONFIG } from '../config.js';
import * as store from './store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Loaded once by admin.js: { data: {categories, questions, ...}, trash: {items} } */
export const state = { data: null, trash: null };

export const catById = (id) => state.data.categories.find((c) => c.id === id);
export const catName = (id) => catById(id)?.name || `(فئة غير موجودة: ${id})`;
export const allIds = () => [...state.data.questions.map((q) => q.id), ...state.trash.items.map((t) => t.question.id)];

/** Same rule as the game (js/questions.js): would this question appear in a game? */
export function isPlayable(q) {
  const cat = catById(q.category);
  return (
    Boolean(cat) && !cat.hidden && q.verified === true && q.review !== 'rejected' && (!CONFIG.REQUIRE_REVIEW || q.review === 'approved')
  );
}

// ---------------------------------------------------------------- saving
let pending = { questions: false, trash: false };
let timer = null;
let inFlight = Promise.resolve();
const listeners = new Set();

export const onChange = (fn) => listeners.add(fn);
export const isDirty = () => pending.questions || pending.trash;

/** Mark data as changed; it is saved shortly after (batched). */
export function changed({ questions = true, trash = false } = {}) {
  pending.questions ||= questions;
  pending.trash ||= trash;
  status('جارٍ الحفظ…');
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
  listeners.forEach((fn) => fn());
}

/** Save now. Trash first, so a deleted question is never lost if the second save fails. */
export function flush() {
  clearTimeout(timer);
  const todo = pending;
  pending = { questions: false, trash: false };
  inFlight = inFlight.then(async () => {
    try {
      if (todo.trash) await store.saveTrash(state.trash);
      if (todo.questions) await store.saveQuestions(state.data);
      status('تم الحفظ', 'ok');
    } catch (err) {
      pending.questions ||= todo.questions;
      pending.trash ||= todo.trash;
      status(`لم يُحفظ: ${err.message}`, 'bad');
      toast(`لم يُحفظ: ${err.message}`, 'bad');
    }
  });
  return inFlight;
}

export function status(text, kind = '') {
  const el = $('#save-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

let toastTimer;
export function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), kind === 'bad' ? 6000 : 2800);
}

/** Promise-based confirmation popup (uses <dialog id="confirm-dialog">). */
export function confirmDialog({ title, text, ok = 'تأكيد', danger = false }) {
  const dlg = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  const okBtn = $('#confirm-ok');
  okBtn.textContent = ok;
  okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-t1'}`;
  return new Promise((resolve) => {
    // React to the button itself (not the dialog's "close" event, which browsers delay in background tabs)
    const form = dlg.querySelector('form');
    const done = (ok) => {
      form.removeEventListener('submit', onSubmit);
      dlg.removeEventListener('cancel', onCancel);
      if (dlg.open) dlg.close();
      resolve(ok);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      done(e.submitter?.value === 'ok');
    };
    const onCancel = (e) => {
      e.preventDefault(); // Esc key
      done(false);
    };
    form.addEventListener('submit', onSubmit);
    dlg.addEventListener('cancel', onCancel);
    dlg.showModal();
    $('#confirm-cancel').focus();
  });
}

/** Wrap the plain-text math expressions in left-to-right marks (same as the original questions). */
export function wrapMath(text) {
  return text.replace(/[⁦-⁩]/g, '').replace(/(\(?\d[\d\s×÷+−\-*/().%]*\d\)?)/g, '⁦$1⁩');
}
