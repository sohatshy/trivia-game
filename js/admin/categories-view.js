// ============================================================
//  Categories tab: dashboard (counts per category and level, gaps in red)
//  + add / rename / describe / hide a category + its image.
// ============================================================

import { CONFIG } from '../config.js';
import { artFor, descFor } from '../categoryArt.js';
import { $, $$, esc, state, isPlayable, changed, toast, confirmDialog } from './state.js';
import { DIFFS, nextCategoryId } from './util.js';
import * as store from './store.js';
import * as questions from './questions-view.js';

const TARGET_TOTAL = 100;
const TARGET_PER_LEVEL = 6;
const PER_LEVEL_IN_GAME = Math.max(...CONFIG.BOARD.map((b) => b.count)); // a board needs this many per level

let editing = null; // category being edited (null = new)
let pickedFile = null;
let removeImage = false;
let objectUrl = null;

export function init() {
  $('#btn-add-cat').addEventListener('click', () => openEditor(null));
  $('#dash').addEventListener('click', onDashClick);
  const form = $('#cat-form');
  form.addEventListener('submit', onSave);
  form.addEventListener('input', () => (form.dataset.dirty = '1'));
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', close));
  $('#cat-editor').addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  $('#cat-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
      msg('اختر صورة (PNG أو JPG أو WebP أو SVG).', 'bad');
      e.target.value = '';
      return;
    }
    pickedFile = file;
    removeImage = false;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    preview(objectUrl);
    msg('ستُضغط الصورة (WebP بعرض 1600 بكسل كحد أقصى) وتُحفظ عند الضغط على «حفظ».');
  });
  $('#cat-image-remove').addEventListener('click', () => {
    pickedFile = null;
    removeImage = true;
    $('#cat-file').value = '';
    preview(null);
    msg('ستُزال الصورة عند الحفظ وتظهر الأيقونة البسيطة.');
  });
}

export function show() {
  renderDashboard();
}

// ---------------------------------------------------------------- dashboard
function counts(catId) {
  const qs = state.data.questions.filter((q) => q.category === catId);
  const by = Object.fromEntries(DIFFS.map((d) => [d.id, qs.filter((q) => q.difficulty === d.id).length]));
  const play = Object.fromEntries(DIFFS.map((d) => [d.id, qs.filter((q) => q.difficulty === d.id && isPlayable(q)).length]));
  return { total: qs.length, by, play, playTotal: Object.values(play).reduce((a, b) => a + b, 0) };
}

const thumb = (c) => (c.image ? `<img src="${esc(c.image)}" alt="" width="64" height="40">` : artFor(c.id));

export function renderDashboard() {
  const rows = state.data.categories.map((c) => {
    const n = counts(c.id);
    const lowTotal = n.total < TARGET_TOTAL;
    const lowLevels = DIFFS.filter((d) => n.by[d.id] < TARGET_PER_LEVEL);
    const low = lowTotal || lowLevels.length > 0;
    const playable = !c.hidden && DIFFS.every((d) => n.play[d.id] >= PER_LEVEL_IN_GAME);
    const missing = [
      lowTotal ? `ينقصها ${TARGET_TOTAL - n.total} سؤال للوصول إلى ${TARGET_TOTAL}` : '',
      ...lowLevels.map((d) => `${d.name}: ينقص ${TARGET_PER_LEVEL - n.by[d.id]}`),
    ].filter(Boolean);
    return `<tr class="${low ? 'is-low' : ''}${c.hidden ? ' is-hidden' : ''}" data-cat="${esc(c.id)}">
      <th scope="row"><span class="dash-cat"><span class="dash-thumb">${thumb(c)}</span><span>${esc(c.name)}${
        missing.length ? `<small class="dash-missing">${esc(missing.join(' · '))}</small>` : ''
      }</span></span></th>
      <td class="num${lowTotal ? ' low' : ''}">${n.total}</td>
      ${DIFFS.map((d) => `<td class="num${n.by[d.id] < TARGET_PER_LEVEL ? ' low' : ''}">${n.by[d.id]}</td>`).join('')}
      <td class="num">${n.playTotal}</td>
      <td>${c.hidden ? '<span class="ad-badge off">مخفية</span>' : playable ? '<span class="ad-badge ok">تظهر في اللعبة</span>' : `<span class="ad-badge warn" title="تحتاج ${PER_LEVEL_IN_GAME} أسئلة جاهزة على الأقل في كل مستوى">لا تكفي للعب</span>`}</td>
      <td class="dash-actions">
        <button type="button" class="btn btn-ghost" data-act="add-q">+ سؤال</button>
        <button type="button" class="btn btn-ghost" data-act="list">الأسئلة</button>
        <button type="button" class="btn btn-ghost" data-act="edit">تعديل</button>
        <button type="button" class="btn btn-ghost" data-act="toggle">${c.hidden ? 'إظهار' : 'إخفاء'}</button>
      </td>
    </tr>`;
  });
  $('#dash tbody').innerHTML = rows.join('');
  const all = state.data.questions;
  $('#dash tfoot').innerHTML = `<tr><th scope="row">كل الفئات</th><td class="num">${all.length}</td>${DIFFS.map(
    (d) => `<td class="num">${all.filter((q) => q.difficulty === d.id).length}</td>`,
  ).join('')}<td class="num">${all.filter(isPlayable).length}</td><td></td><td></td></tr>`;
}

async function onDashClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const c = state.data.categories.find((x) => x.id === b.closest('[data-cat]').dataset.cat);
  const act = b.dataset.act;
  if (act === 'edit') openEditor(c);
  else if (act === 'add-q') questions.openEditor(null, { category: c.id });
  else if (act === 'list') {
    const f = $('#filters');
    f.elements.category.value = c.id;
    f.dispatchEvent(new Event('input'));
    $('#tab-questions').click();
  } else if (act === 'toggle') {
    if (!c.hidden) {
      const ok = await confirmDialog({
        title: `إخفاء «${c.name}»؟`,
        text: 'لن تظهر الفئة في صفحة اختيار الفئات في اللعبة. أسئلتها تبقى محفوظة، ويمكنك إظهارها في أي وقت.',
        ok: 'إخفاء',
      });
      if (!ok) return;
      c.hidden = true;
    } else delete c.hidden;
    changed();
    renderDashboard();
    questions.fillCategorySelects();
    toast(c.hidden ? `أُخفيت «${c.name}»` : `«${c.name}» تظهر في اللعبة الآن`);
  }
}

// ---------------------------------------------------------------- editor
function openEditor(c) {
  editing = c;
  pickedFile = null;
  removeImage = false;
  const form = $('#cat-form');
  form.reset();
  delete form.dataset.dirty;
  const id = c?.id || nextCategoryId(state.data.categories);
  form.dataset.id = id;
  $('#cat-title').textContent = c ? `تعديل «${c.name}»` : 'فئة جديدة';
  $('#cat-id').textContent = id;
  $('#cat-error').textContent = '';
  form.elements.name.value = c?.name || '';
  form.elements.type.value = c?.type || 'text';
  form.elements.type.disabled = c?.type === 'flag'; // the flags category keeps its special type
  form.elements.description.value = c?.description ?? '';
  form.elements.description.placeholder = descFor(id) || 'مثال: أسئلة عن الأفلام العربية القديمة.';
  form.elements.hidden.checked = Boolean(c?.hidden);
  $('#cat-file').value = '';
  preview(c?.image ? `${c.image}?v=${Date.now()}` : null);
  msg('بدون صورة تظهر أيقونة بسيطة. أفضل مقاس: صورة عرضية 16:10 بخلفية فاتحة.');
  $('#cat-editor').showModal();
  form.elements.name.focus();
}

function preview(src) {
  const id = $('#cat-form').dataset.id;
  $('#cat-preview').innerHTML = src ? `<img src="${esc(src)}" alt="معاينة صورة الفئة">` : artFor(id);
  $('#cat-image-remove').hidden = !src;
}

function msg(text, kind = '') {
  const el = $('#cat-msg');
  el.textContent = text;
  el.dataset.kind = kind;
}

async function close() {
  const form = $('#cat-form');
  if (form.dataset.dirty && !(await confirmDialog({ title: 'إغلاق بدون حفظ؟', text: 'التغييرات على هذه الفئة ستضيع.', ok: 'إغلاق بدون حفظ', danger: true }))) return;
  $('#cat-editor').close();
}

async function onSave(e) {
  e.preventDefault();
  const form = $('#cat-form');
  const f = form.elements;
  const id = form.dataset.id;
  const name = f.name.value.trim();
  const err = $('#cat-error');
  if (!name) {
    err.textContent = 'اكتب اسم الفئة.';
    return f.name.focus();
  }
  if (state.data.categories.some((c) => c !== editing && c.name.trim() === name)) {
    err.textContent = 'يوجد فئة بهذا الاسم.';
    return f.name.focus();
  }

  // Image first: if it is rejected, nothing else changes.
  let image = editing?.image;
  const btn = $('#cat-save');
  btn.disabled = true;
  try {
    if (pickedFile) {
      msg('جارٍ رفع الصورة وضغطها…');
      const res = await store.uploadMedia({ target: 'category', id, file: pickedFile });
      image = res.src;
    } else if (removeImage && image) {
      await store.deleteMedia(image).catch(() => {});
      image = undefined;
    }
  } catch (ex) {
    msg(ex.message, 'bad');
    err.textContent = 'لم تُحفظ الفئة لأن الصورة رُفضت.';
    return;
  } finally {
    btn.disabled = false;
  }

  const c = editing || { id, icon: '' };
  c.name = name;
  if (c.type !== 'flag') c.type = f.type.value;
  const desc = f.description.value.trim();
  if (desc) c.description = desc;
  else delete c.description;
  if (image) c.image = image;
  else delete c.image;
  if (f.hidden.checked) c.hidden = true;
  else delete c.hidden;
  if (!editing) state.data.categories.push(c);

  changed();
  delete form.dataset.dirty;
  $('#cat-editor').close();
  renderDashboard();
  questions.fillCategorySelects();
  questions.renderList();
  toast(editing ? `حُفظت الفئة «${name}»` : `أُضيفت الفئة «${name}». أضف أسئلتها من زر «+ سؤال».`);
}
