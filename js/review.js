// ============================================================
//  Review page: approve / reject / edit every question.
//  Saves into data/questions.json through the local dev server (tools/dev_server.py).
//  If that isn't available, changes stay in this browser and can be downloaded.
// ============================================================

import { CONFIG } from './config.js';
import { ICONS } from './icons.js';
import { getRawData } from './questions.js';
import { isOwner } from './auth.js';

const $ = (s, r = document) => r.querySelector(s);
const DRAFT_KEY = 'maydan.review.draft';
const DIFF = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

let data = null;
let catName = {};
let editingId = null;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Remove the invisible left-to-right marks used around math so the edit box shows plain text
const plain = (s) => String(s ?? '').replace(/[⁦-⁩]/g, '');

async function boot() {
  document.querySelectorAll('[data-icon]').forEach((el) => (el.outerHTML = ICONS[el.dataset.icon]));
  document.querySelectorAll('[data-game-name]').forEach((el) => (el.textContent = CONFIG.GAME_NAME));
  if (!(await isOwner())) {
    $('#gate').hidden = false;
    return;
  }
  data = structuredClone(await getRawData());
  restoreDraft();
  catName = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
  $('#f-category').insertAdjacentHTML('beforeend', data.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join(''));
  $('#app').hidden = false;
  readFiltersFromUrl();
  $('#filters').addEventListener('input', () => {
    writeFiltersToUrl();
    render();
  });
  // Warn before leaving with an open edit form or a save that hasn't finished
  window.addEventListener('beforeunload', (e) => {
    if (editingId || saving) e.preventDefault();
  });
  $('#filters').addEventListener('submit', (e) => e.preventDefault());
  $('#list').addEventListener('click', onListClick);
  $('#list').addEventListener('submit', onEditSubmit);
  $('#btn-download').addEventListener('click', download);
  render();
}

// ---------- filters live in the URL (?category=geo&status=pending…) so a reload keeps them ----------
function readFiltersFromUrl() {
  const p = new URLSearchParams(location.search);
  for (const el of $('#filters').elements) if (el.name && p.has(el.name)) el.value = p.get(el.name);
}

function writeFiltersToUrl() {
  const p = new URLSearchParams();
  for (const [k, v] of new FormData($('#filters'))) if (v) p.set(k, v);
  history.replaceState(null, '', `${location.pathname}${p.size ? `?${p}` : ''}`);
}

// ---------- filtering + rendering ----------
function statusOf(q) {
  return q.review === 'approved' || q.review === 'rejected' ? q.review : 'pending';
}

function filtered() {
  const f = Object.fromEntries(new FormData($('#filters')));
  const term = f.q.trim();
  return data.questions.filter(
    (q) =>
      (!f.category || q.category === f.category) &&
      (!f.difficulty || q.difficulty === f.difficulty) &&
      (!f.status || (f.status === 'unverified' ? !q.verified : statusOf(q) === f.status)) &&
      (!term || [q.question, q.answer, ...(q.examples || [])].some((t) => plain(t).includes(term))),
  );
}

function render() {
  const all = data.questions;
  const ok = all.filter((q) => q.review === 'approved').length;
  const bad = all.filter((q) => q.review === 'rejected').length;
  $('#bar-ok').style.width = `${(ok / all.length) * 100}%`;
  $('#bar-bad').style.width = `${(bad / all.length) * 100}%`;
  $('#progress-text').textContent = `راجعت ${ok + bad} من ${all.length} — صحيح ${ok}، خطأ ${bad}`;

  const list = filtered();
  $('#count').textContent = list.length ? `${list.length} سؤال` : '';
  $('#list').innerHTML = list.length
    ? list.map((q) => (q.id === editingId ? editHtml(q) : cardHtml(q))).join('')
    : '<li class="rv-empty">لا توجد أسئلة بهذه التصفية. غيّر «الحالة» إلى «الكل» لرؤية كل الأسئلة.</li>';
}

function cardHtml(q) {
  const st = statusOf(q);
  const isLetters = data.categories.find((c) => c.id === q.category)?.type === 'letters';
  return `<li class="rv-card" data-id="${q.id}" data-status="${st}">
    <div class="rv-meta">
      <span class="rv-cat">${esc(catName[q.category])}</span>
      <span class="rv-pts">${q.points}</span>
      <span class="rv-diff">${DIFF[q.difficulty]}</span>
      <code class="rv-id" dir="ltr">${q.id}</code>
      ${q.verified ? '' : '<span class="rv-flag-bad">غير مُتحقق منه</span>'}
      <span class="rv-status" data-status="${st}">${st === 'approved' ? 'صحيح' : st === 'rejected' ? 'خطأ' : 'لم يُراجع'}</span>
    </div>
    <div class="rv-body">
      ${q.image ? `<img class="rv-img" src="${esc(q.image)}" alt="${esc(`العلم المعروض في السؤال (${q.answer})`)}" width="160" height="120" loading="lazy">` : ''}
      <div class="rv-text">
        <p class="rv-q">${esc(q.question)}</p>
        <p class="rv-a"><span>${isLetters ? 'القاعدة' : 'الإجابة'}:</span> ${esc(q.answer)}</p>
        ${q.examples?.length ? `<p class="rv-ex"><span>أمثلة:</span> ${q.examples.map(esc).join('، ')}</p>` : ''}
        ${q.note ? `<p class="rv-note">${esc(q.note)}</p>` : ''}
        ${q.source ? `<a class="rv-src" href="${esc(q.source)}" target="_blank" rel="noopener">فتح المصدر</a>` : '<span class="rv-src none">بلا مصدر</span>'}
      </div>
    </div>
    <div class="rv-actions">
      <button type="button" class="btn btn-ok" data-act="approve" aria-pressed="${st === 'approved'}" aria-label="صحيح: ${esc(plain(q.question))}">✓ صحيح</button>
      <button type="button" class="btn btn-bad" data-act="reject" aria-pressed="${st === 'rejected'}" aria-label="خطأ: ${esc(plain(q.question))}">✗ خطأ</button>
      <button type="button" class="btn btn-ghost" data-act="edit" aria-label="تعديل: ${esc(plain(q.question))}">تعديل</button>
    </div>
  </li>`;
}

function editHtml(q) {
  return `<li class="rv-card is-editing" data-id="${q.id}">
    <form class="rv-edit" aria-label="تعديل السؤال ${q.id}">
      <label>السؤال<textarea name="question" rows="2" required>${esc(plain(q.question))}</textarea></label>
      <label>الإجابة<input name="answer" value="${esc(q.answer)}" required autocomplete="off"></label>
      <label>أمثلة (افصل بينها بفاصلة «،»)<input name="examples" value="${esc((q.examples || []).join('، '))}" autocomplete="off"></label>
      <label>رابط المصدر<input name="source" type="url" dir="ltr" value="${esc(q.source || '')}" autocomplete="off" spellcheck="false"></label>
      <label>ملاحظة<input name="note" value="${esc(q.note || '')}" autocomplete="off"></label>
      <label class="rv-check"><input type="checkbox" name="verified" ${q.verified ? 'checked' : ''}> مُتحقق منه (يظهر في اللعبة)</label>
      <div class="rv-actions">
        <button type="submit" class="btn btn-ok">حفظ واعتماد</button>
        <button type="button" class="btn btn-ghost" data-act="cancel">إلغاء</button>
      </div>
    </form>
  </li>`;
}

// ---------- actions ----------
function onListClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = b.closest('[data-id]').dataset.id;
  const q = data.questions.find((x) => x.id === id);
  const act = b.dataset.act;
  if (act === 'approve' || act === 'reject') {
    const value = act === 'approve' ? 'approved' : 'rejected';
    q.review = q.review === value ? undefined : value; // press again to undo
    q.reviewedAt = q.review ? new Date().toISOString() : undefined;
    persist();
    render();
    focusNext(id);
  } else if (act === 'edit') {
    editingId = id;
    render();
    $(`[data-id="${id}"] textarea`).focus();
  } else if (act === 'cancel') {
    editingId = null;
    render();
  }
}

function onEditSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.closest('[data-id]').dataset.id;
  const q = data.questions.find((x) => x.id === id);
  const f = new FormData(form);
  const text = f.get('question').trim();
  // Keep math expressions left-to-right: re-wrap anything that looks like "12 × 5" or "100 − 37"
  q.question = q.category === 'math' ? text.replace(/(\(?\d[\d\s×÷+−\-().]*\d\)?)/g, '⁦$1⁩') : text;
  q.answer = f.get('answer').trim();
  q.examples = f.get('examples').split(/[،,]/).map((s) => s.trim()).filter(Boolean);
  q.source = f.get('source').trim() || null;
  q.note = f.get('note').trim();
  q.verified = f.get('verified') === 'on';
  q.review = 'approved';
  q.reviewedAt = new Date().toISOString();
  q.edited = true;
  editingId = null;
  persist();
  render();
  focusNext(id, true);
}

function focusNext(id, same = false) {
  const el = $(`[data-id="${id}"]`);
  const target = same ? el : el?.nextElementSibling || el;
  (target?.querySelector('[data-act="approve"]') || $('#list [data-act="approve"]'))?.focus({ preventScroll: false });
}

// ---------- saving ----------
let saveTimer;
let saving = false;
function persist() {
  saving = true;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  setStatus('جارٍ الحفظ…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToFile, 400);
}

async function saveToFile() {
  try {
    const res = await fetch('api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(res.status);
    localStorage.removeItem(DRAFT_KEY);
    saving = false;
    setStatus('تم الحفظ في data/questions.json', 'ok');
  } catch {
    setStatus('لم يُحفظ في الملف — التغييرات محفوظة في هذا المتصفح. استخدم «تنزيل».', 'bad');
  }
}

function restoreDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    /* ignore */
  }
  if (draft?.questions && confirm('توجد تغييرات لم تُحفظ في الملف من زيارة سابقة. هل تريد استرجاعها؟')) {
    data = draft;
    setTimeout(persist, 0);
  } else {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function setStatus(text, kind = '') {
  const el = $('#save-status');
  el.textContent = text;
  el.dataset.kind = kind;
}

function download() {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'questions.json' });
  a.click();
  URL.revokeObjectURL(a.href);
}

boot();
