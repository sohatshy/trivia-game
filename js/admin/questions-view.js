// ============================================================
//  Questions tab: list + filters + quick review, the editor popup,
//  delete → trash, and the trash tab.
// ============================================================

import { $, $$, esc, state, catById, catName, allIds, isPlayable, changed, toast, confirmDialog, wrapMath } from './state.js';
import { diffById, plain, normalize, findSimilar, nextId } from './util.js';
import * as store from './store.js';
import * as media from './media.js';

let editing = null; // the question object being edited, or null for a new one

export function init() {
  fillCategorySelects();
  readFiltersFromUrl();
  $('#filters').addEventListener('input', () => {
    writeFiltersToUrl();
    renderList();
  });
  $('#filters').addEventListener('submit', (e) => e.preventDefault());
  $('#list').addEventListener('click', onListClick);
  $('#btn-add').addEventListener('click', () => openEditor(null));

  // editor
  const form = $('#editor-form');
  form.addEventListener('submit', onSave);
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', closeEditor));
  $('#editor').addEventListener('cancel', (e) => {
    e.preventDefault(); // Esc → same as the close button (asks if there are unsaved edits)
    closeEditor();
  });
  $('#e-category').addEventListener('change', updateEditorForCategory);
  let dupTimer;
  for (const el of ['#e-question', '#e-answer']) {
    $(el).addEventListener('input', () => {
      clearTimeout(dupTimer);
      dupTimer = setTimeout(showDuplicates, 200);
    });
  }
  $('#editor-delete').addEventListener('click', () => editing && deleteQuestion(editing, true));
  form.addEventListener('input', () => (form.dataset.dirty = '1'));
  media.init();

  // trash
  $('#trash-list').addEventListener('click', onTrashClick);
  $('#btn-empty-trash').addEventListener('click', emptyTrash);

  renderList();
  renderTrash();
}

export function show() {
  renderList();
}

/** Refresh selects after categories change (called by the categories tab). */
export function fillCategorySelects() {
  const opts = state.data.categories
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.hidden ? ' (مخفية)' : ''}</option>`)
    .join('');
  const f = $('#f-category');
  const keep = f.value;
  f.innerHTML = `<option value="">الكل</option>${opts}`;
  f.value = keep;
  $('#e-category').innerHTML = opts;
}

// ---------------------------------------------------------------- filters
const FILTER_NAMES = ['q', 'category', 'difficulty', 'status', 'media'];

function readFiltersFromUrl() {
  const p = new URLSearchParams(location.search);
  for (const n of FILTER_NAMES) if (p.has(n)) $('#filters').elements[n].value = p.get(n);
}

function writeFiltersToUrl() {
  const u = new URL(location.href);
  for (const [k, v] of new FormData($('#filters'))) v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
  history.replaceState(null, '', u);
}

const hasMedia = (q) => Boolean(q.media?.src || q.image);
const reviewOf = (q) => (q.review === 'approved' || q.review === 'rejected' ? q.review : 'pending');

function filtered() {
  const f = Object.fromEntries(new FormData($('#filters')));
  const term = normalize(f.q);
  return state.data.questions.filter(
    (q) =>
      (!f.category || q.category === f.category) &&
      (!f.difficulty || q.difficulty === f.difficulty) &&
      (!f.status ||
        (f.status === 'unverified' ? !q.verified : f.status === 'hidden' ? !isPlayable(q) : reviewOf(q) === f.status)) &&
      (!f.media || (f.media === 'yes') === hasMedia(q)) &&
      (!term || q.id.includes(f.q.trim()) || [q.question, q.answer, ...(q.examples || [])].some((t) => normalize(t).includes(term))),
  );
}

// ---------------------------------------------------------------- list
export function renderList() {
  const list = filtered();
  const total = state.data.questions.length;
  $('#count').textContent = list.length === total ? `${total} سؤال` : `${list.length} من ${total} سؤال`;
  $('#list').innerHTML = list.length
    ? list.map(cardHtml).join('')
    : `<li class="ad-empty">لا توجد أسئلة بهذه التصفية. غيّر الفلاتر أو أضف سؤالاً جديداً.</li>`;
}

function cardHtml(q) {
  const st = reviewOf(q);
  const playable = isPlayable(q);
  const m = q.media?.src ? media.label(q.media) : q.image ? 'صورة علم' : '';
  return `<li class="ad-card" data-id="${esc(q.id)}" data-status="${st}">
    <div class="ad-meta">
      <span class="ad-cat">${esc(catName(q.category))}</span>
      <span class="ad-pts">${q.points}</span>
      <code dir="ltr">${esc(q.id)}</code>
      ${m ? `<span class="ad-badge media">${esc(m)}</span>` : ''}
      ${q.verified ? '' : '<span class="ad-badge warn">غير مُتحقق منه</span>'}
      ${playable ? '' : '<span class="ad-badge off">لا يظهر في اللعبة</span>'}
    </div>
    <p class="ad-q">${esc(plain(q.question))}</p>
    <p class="ad-a"><span>الإجابة:</span> ${esc(q.answer) || '—'}${q.examples?.length ? ` <span>· أمثلة:</span> ${q.examples.map(esc).join('، ')}` : ''}</p>
    <div class="ad-actions">
      <button type="button" class="btn btn-ok" data-act="approve" aria-pressed="${st === 'approved'}">✓ صحيح</button>
      <button type="button" class="btn btn-bad" data-act="reject" aria-pressed="${st === 'rejected'}">✗ خطأ</button>
      <button type="button" class="btn btn-ghost" data-act="edit">تعديل</button>
      <button type="button" class="btn btn-ghost btn-del" data-act="delete" aria-label="حذف السؤال ${esc(q.id)}">حذف</button>
    </div>
  </li>`;
}

function onListClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const q = state.data.questions.find((x) => x.id === b.closest('[data-id]').dataset.id);
  if (!q) return;
  const act = b.dataset.act;
  if (act === 'approve' || act === 'reject') {
    const value = act === 'approve' ? 'approved' : 'rejected';
    setReview(q, q.review === value ? '' : value); // press again to undo
    changed();
    renderList();
  } else if (act === 'edit') openEditor(q);
  else if (act === 'delete') deleteQuestion(q);
}

function setReview(q, value) {
  if (value) {
    q.review = value;
    q.reviewedAt = new Date().toISOString();
  } else {
    delete q.review;
    delete q.reviewedAt;
  }
}

// ---------------------------------------------------------------- editor
export function openEditor(q, preset = {}) {
  editing = q;
  const form = $('#editor-form');
  form.reset();
  delete form.dataset.dirty;
  $('#editor-title').textContent = q ? 'تعديل سؤال' : 'سؤال جديد';
  $('#editor-id').textContent = q ? q.id : '';
  $('#editor-delete').hidden = !q;
  $('#editor-error').textContent = '';
  const f = form.elements;
  const filt = Object.fromEntries(new FormData($('#filters')));
  f.category.value = q?.category || preset.category || filt.category || state.data.categories.find((c) => !c.hidden)?.id;
  form.querySelector(`[name="difficulty"][value="${q?.difficulty || preset.difficulty || filt.difficulty || 'easy'}"]`).checked = true;
  f.question.value = plain(q?.question ?? '');
  f.answer.value = q?.answer ?? '';
  f.examples.value = (q?.examples || []).join('\n');
  f.source.value = q?.source ?? '';
  f.note.value = q?.note ?? '';
  form.querySelector(`[name="review"][value="${q ? (q.review === 'approved' || q.review === 'rejected' ? q.review : '') : ''}"]`).checked = true;
  // Rule: saving an edit clears "verified" unless the owner ticks it again.
  f.verified.checked = false;
  $('#verified-hint').textContent = q?.verified
    ? 'كان السؤال مُتحققاً منه. إن لم تضع العلامة مجدداً فلن يظهر في اللعبة.'
    : 'بدون هذه العلامة لن يظهر السؤال في اللعبة.';
  updateEditorForCategory();
  media.load(q);
  showDuplicates();
  $('#editor').showModal();
  f.question.focus();
}

function updateEditorForCategory() {
  const isLetters = catById($('#e-category').value)?.type === 'letters';
  $('#e-examples-wrap').hidden = !isLetters;
  $('#e-answer-text').textContent = isLetters ? 'الإجابة (اختياري — أو اكتب الأمثلة بالأسفل)' : 'الإجابة';
}

function showDuplicates() {
  const text = $('#e-question').value;
  const hits = findSimilar(text, state.data.questions, { exceptId: editing?.id, answer: $('#e-answer').value });
  const box = $('#dup-box');
  box.hidden = !hits.length;
  box.innerHTML = hits.length
    ? `<strong>تنبيه: يوجد سؤال مشابه جداً</strong><ul>${hits
        .map(
          (h) =>
            `<li><span class="pct">${Math.round(h.score * 100)}٪</span> ${esc(plain(h.q.question))} <small>(${esc(catName(h.q.category))} · ${h.q.points} · <code dir="ltr">${esc(h.q.id)}</code>)</small></li>`,
        )
        .join('')}</ul><p>يمكنك الحفظ على أي حال إن كان سؤالك مختلفاً.</p>`
    : '';
}

async function closeEditor() {
  const form = $('#editor-form');
  if (form.dataset.dirty && !(await confirmDialog({ title: 'إغلاق بدون حفظ؟', text: 'التغييرات التي كتبتها في هذا السؤال ستضيع.', ok: 'إغلاق بدون حفظ', danger: true }))) return;
  await media.discard();
  $('#editor').close();
}

async function onSave(e) {
  e.preventDefault();
  const form = $('#editor-form');
  const f = form.elements;
  const err = $('#editor-error');
  const category = f.category.value;
  const difficulty = form.querySelector('[name="difficulty"]:checked')?.value;
  const text = f.question.value.trim();
  const isLetters = catById(category)?.type === 'letters';
  const examples = f.examples.value.split(/\n|،|,/).map((s) => s.trim()).filter(Boolean);
  const answer = f.answer.value.trim();

  if (!text) return fail('اكتب نص السؤال.', f.question);
  if (!isLetters && !answer) return fail('اكتب الإجابة.', f.answer);
  if (isLetters && !answer && !examples.length) return fail('اكتب الإجابة أو مثالاً واحداً على الأقل.', f.examples);
  if (f.source.value.trim() && !/^https?:\/\/\S+$/i.test(f.source.value.trim())) return fail('رابط المصدر يجب أن يبدأ بـ https://', f.source);
  if (media.busy()) return fail('انتظر حتى ينتهي رفع الملف.', null);

  const isNew = !editing;
  const id = editing?.id || nextId(category, difficulty, allIds());
  // Media first: if the upload is rejected (e.g. still >15 MB), nothing else is saved.
  const saveBtn = $('#editor-save');
  saveBtn.disabled = true;
  let newMedia;
  try {
    newMedia = await media.commit(id);
  } catch {
    return fail('لم يُحفظ السؤال لأن ملف الوسائط رُفض (السبب مكتوب في قسم الوسائط).', null);
  } finally {
    saveBtn.disabled = false;
  }
  const q = editing || { id, image: null, createdAt: new Date().toISOString() };
  if (newMedia) q.media = newMedia;
  else delete q.media;
  q.category = category;
  q.difficulty = difficulty;
  q.points = diffById[difficulty].points;
  q.question = category === 'math' ? wrapMath(text) : text;
  q.answer = answer;
  q.examples = isLetters ? examples : q.examples || [];
  q.source = f.source.value.trim() || null;
  q.note = f.note.value.trim();
  q.verified = f.verified.checked;
  setReview(q, form.querySelector('[name="review"]:checked').value);
  if (!isNew) {
    q.edited = true;
    q.editedAt = new Date().toISOString();
  }
  if (isNew) state.data.questions.push(q);
  changed();
  delete form.dataset.dirty;
  $('#editor').close();
  renderList();
  toast(isNew ? `أُضيف السؤال ${q.id}` : `حُفظ السؤال ${q.id}${q.verified ? '' : ' — غير مُتحقق منه، فلن يظهر في اللعبة'}`);

  function fail(msg, el) {
    err.textContent = msg;
    el?.focus();
  }
}

// ---------------------------------------------------------------- delete / trash
async function deleteQuestion(q, fromEditor = false) {
  const ok = await confirmDialog({
    title: 'حذف هذا السؤال؟',
    text: `«${plain(q.question).slice(0, 80)}» سينتقل إلى سلة المحذوفات، ويمكنك استرجاعه من هناك.`,
    ok: 'حذف',
    danger: true,
  });
  if (!ok) return;
  state.data.questions = state.data.questions.filter((x) => x !== q);
  state.trash.items.unshift({ question: q, deletedAt: new Date().toISOString() });
  changed({ questions: true, trash: true });
  if (fromEditor) {
    delete $('#editor-form').dataset.dirty;
    await media.discard();
    $('#editor').close();
  }
  renderList();
  renderTrash();
  toast('نُقل السؤال إلى سلة المحذوفات');
}

export function renderTrash() {
  const items = state.trash.items;
  $('#trash-count').textContent = items.length ? `(${items.length})` : '';
  $('#btn-empty-trash').disabled = !items.length;
  $('#trash-list').innerHTML = items.length
    ? items
        .map(
          ({ question: q, deletedAt }, i) => `<li class="ad-card" data-index="${i}">
      <div class="ad-meta"><span class="ad-cat">${esc(catName(q.category))}</span><span class="ad-pts">${q.points}</span><code dir="ltr">${esc(q.id)}</code>
        <span>حُذف ${new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(deletedAt))}</span></div>
      <p class="ad-q">${esc(plain(q.question))}</p>
      <p class="ad-a"><span>الإجابة:</span> ${esc(q.answer) || '—'}</p>
      <div class="ad-actions">
        <button type="button" class="btn btn-ok" data-act="restore">استرجاع</button>
        <button type="button" class="btn btn-ghost btn-del" data-act="purge">حذف نهائي</button>
      </div></li>`,
        )
        .join('')
    : '<li class="ad-empty">السلة فارغة.</li>';
}

async function onTrashClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const i = Number(b.closest('[data-index]').dataset.index);
  const item = state.trash.items[i];
  if (b.dataset.act === 'restore') {
    state.trash.items.splice(i, 1);
    state.data.questions.push(item.question);
    changed({ questions: true, trash: true });
    toast(`استُرجع السؤال ${item.question.id}`);
  } else {
    const ok = await confirmDialog({
      title: 'حذف نهائي؟',
      text: 'سيُحذف السؤال وملف الوسائط المرفق به نهائياً، ولا يمكن التراجع.',
      ok: 'حذف نهائي',
      danger: true,
    });
    if (!ok) return;
    state.trash.items.splice(state.trash.items.indexOf(item), 1);
    await purgeMedia(item.question);
    changed({ questions: false, trash: true });
    toast('حُذف السؤال نهائياً');
  }
  renderTrash();
  renderList();
}

async function emptyTrash() {
  const n = state.trash.items.length;
  const ok = await confirmDialog({
    title: `حذف ${n} سؤال نهائياً؟`,
    text: 'ستُحذف كل الأسئلة في السلة وملفات الوسائط المرفقة بها، ولا يمكن التراجع.',
    ok: 'إفراغ السلة',
    danger: true,
  });
  if (!ok) return;
  for (const it of state.trash.items) await purgeMedia(it.question);
  state.trash.items = [];
  changed({ questions: false, trash: true });
  renderTrash();
}

async function purgeMedia(q) {
  if (!q.media?.src) return;
  try {
    await store.deleteMedia(q.media.src);
  } catch (err) {
    toast(`تعذّر حذف ملف الوسائط: ${err.message}`, 'bad');
  }
}

