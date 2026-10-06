// ============================================================
//  "نشر التحديثات": show what changed compared with the live site, then commit + push
//  the content (questions, trash, media) through the local server. Errors in plain Arabic.
// ============================================================

import { CONFIG } from '../config.js';
import { $, $$, esc, state, flush, isDirty } from './state.js';
import * as store from './store.js';

let busy = false;

export function init() {
  $('#btn-publish').addEventListener('click', open);
  $('#publish-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doPublish();
  });
  $$('#publish-dialog [data-close]').forEach((b) => b.addEventListener('click', () => !busy && $('#publish-dialog').close()));
  $('#publish-dialog').addEventListener('cancel', (e) => busy && e.preventDefault());
}

const n = (arr) => arr.length;
const title = (id) => {
  const q = state.data.questions.find((x) => x.id === id) || state.trash.items.find((t) => t.question.id === id)?.question;
  return q ? q.question.replace(/[⁦-⁩]/g, '') : id;
};
const size = (b) => (b < 100 * 1024 ? `${Math.max(1, Math.round(b / 1024))} كيلوبايت` : `${(b / 1024 / 1024).toFixed(1)} ميغابايت`);

async function open() {
  const body = $('#publish-body');
  $('#publish-go').hidden = true;
  body.innerHTML = '<p>جارٍ مقارنة جهازك بالموقع…</p>';
  $('#publish-dialog').showModal();
  try {
    if (isDirty()) await flush(); // make sure the latest edits are in the file first
    const s = await store.publishStatus();
    body.innerHTML = summaryHtml(s);
    $('#publish-go').hidden = !s.hasChanges;
    if (s.hasChanges) $('#publish-go').focus();
  } catch (err) {
    body.innerHTML = errorHtml(err.message);
  }
}

function list(ids, label) {
  if (!ids.length) return '';
  const shown = ids.slice(0, 5).map((id) => `<li>${esc(title(id).slice(0, 70))} <code dir="ltr">${esc(id)}</code></li>`).join('');
  const more = ids.length > 5 ? `<li class="more">و${ids.length - 5} غيرها</li>` : '';
  return `<details><summary>${label}</summary><ul>${shown}${more}</ul></details>`;
}

function summaryHtml(s) {
  if (!s.hasChanges) {
    return `<p class="pub-none">لا توجد تحديثات جديدة. الموقع مطابق لما على جهازك.</p>`;
  }
  const q = s.questions;
  const m = s.media;
  const stats = [
    ['أسئلة جديدة', n(q.added)],
    ['أسئلة معدّلة', n(q.edited)],
    ['أسئلة محذوفة', n(q.deleted)],
    ['ملفات وسائط جديدة أو مستبدلة', n(m.added) + n(m.changed)],
    ['ملفات وسائط محذوفة', n(m.deleted)],
  ];
  const cats = [
    s.categories.added.length ? `فئات جديدة: ${s.categories.added.map(esc).join('، ')}` : '',
    s.categories.changed.length ? `فئات معدّلة: ${s.categories.changed.map(esc).join('، ')}` : '',
  ].filter(Boolean);
  return `
    <p>هذه التغييرات على جهازك ولم تظهر على الموقع بعد:</p>
    <ul class="pub-stats">${stats.map(([k, v]) => `<li class="${v ? '' : 'zero'}"><strong>${v}</strong><span>${k}</span></li>`).join('')}</ul>
    ${cats.length ? `<p>${cats.join('<br>')}</p>` : ''}
    ${list(q.added, 'عرض الأسئلة الجديدة')}${list(q.edited, 'عرض الأسئلة المعدّلة')}${list(q.deleted, 'عرض الأسئلة المحذوفة')}
    ${s.mediaBytes ? `<p class="ad-hint">حجم الوسائط التي ستُرفع: ${size(s.mediaBytes)}.</p>` : ''}
    ${
      s.otherCommits.length
        ? `<p class="pub-note">سيُرفع معها أيضاً ${s.otherCommits.length} تحديث برمجي محفوظ مسبقاً على جهازك (ليس من لوحة التحكم).</p>`
        : ''
    }
    <p class="ad-hint">بعد «نشر الآن» يظهر التحديث على الموقع خلال دقيقة أو دقيقتين.</p>`;
}

function errorHtml(text) {
  return `<p class="pub-error" role="alert"><strong>لم يتم النشر.</strong><br>${esc(text)}</p>
    <p class="ad-hint">تغييراتك ما زالت محفوظة على جهازك، ولم يضع شيء.</p>`;
}

async function doPublish() {
  if (busy) return;
  busy = true;
  const body = $('#publish-body');
  const go = $('#publish-go');
  go.disabled = true;
  go.textContent = 'جارٍ النشر…';
  $('#publish-close').disabled = true;
  try {
    if (isDirty()) await flush();
    const res = await store.publish();
    go.hidden = true;
    body.innerHTML = res.nothing
      ? '<p class="pub-none">لا توجد تحديثات جديدة.</p>'
      : `<p class="pub-ok"><strong>تم النشر.</strong> سيظهر التحديث على الموقع خلال دقيقة أو دقيقتين.</p>
         <p><a href="${esc(CONFIG.SITE_URL)}" target="_blank" rel="noopener">فتح الموقع</a></p>`;
  } catch (err) {
    body.innerHTML = errorHtml(err.message);
  } finally {
    busy = false;
    go.disabled = false;
    go.textContent = 'نشر الآن';
    $('#publish-close').disabled = false;
    $('#publish-close').focus();
  }
}
