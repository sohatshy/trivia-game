// ============================================================
//  Import / export tab.
//  Import: CSV or Excel (columns: category, difficulty, question, answer, source)
//          → preview with errors and duplicates → add the ticked rows.
//  Export: CSV (opens in Excel) and JSON (full backup incl. categories + trash).
// ============================================================

import { $, esc, state, catById, allIds, changed, toast } from './state.js';
import { diffById, parseDifficulty, parseCsv, toCsv, findSimilar, similarity, nextId, plain, normalize } from './util.js';
import * as questions from './questions-view.js';
import * as categories from './categories-view.js';

const SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
const TEMPLATE_PLACEHOLDER = 'اكتب نص السؤال هنا';

// Accepted header names (English template names, Arabic alternatives)
const COLUMNS = {
  category: ['category', 'الفئة', 'فئة'],
  difficulty: ['difficulty', 'level', 'الصعوبة', 'المستوى'],
  question: ['question', 'السؤال', 'نص السؤال'],
  answer: ['answer', 'answers', 'الإجابة', 'الاجابة', 'الإجابات'],
  source: ['source', 'المصدر', 'رابط المصدر'],
  note: ['note', 'notes', 'ملاحظات', 'ملاحظة'],
  examples: ['examples', 'أمثلة'], // optional (the exported CSV has it); used for حروف
};

let rows = []; // parsed preview rows

export function init() {
  $('#import-file').addEventListener('change', onFile);
  $('#import-go').addEventListener('click', doImport);
  $('#import-cancel').addEventListener('click', resetPreview);
  $('#preview-body').addEventListener('change', (e) => {
    const box = e.target.closest('input[data-row]');
    if (box) rows[Number(box.dataset.row)].include = box.checked;
    updateSummary();
  });
  $('#export-csv').addEventListener('click', exportCsv);
  $('#export-json').addEventListener('click', exportJson);
}

// ---------------------------------------------------------------- reading files
async function onFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  msg(`جارٍ قراءة ${file.name}…`);
  try {
    const table = /\.xlsx?$/i.test(file.name) ? await readExcel(file) : parseCsv(await file.text());
    buildPreview(table, file.name);
  } catch (err) {
    resetPreview();
    msg(err.message, 'bad');
  }
}

async function readExcel(file) {
  let XLSX;
  try {
    XLSX = await import(SHEETJS);
  } catch {
    throw new Error('تعذّر تحميل قارئ ملفات Excel (يحتاج اتصالاً بالإنترنت). احفظ الملف بصيغة CSV وجرّب مرة أخرى.');
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }).filter((r) => r.some((v) => String(v).trim()));
}

function findCategory(value) {
  const v = normalize(value);
  if (!v) return null;
  return state.data.categories.find((c) => c.id.toLowerCase() === String(value).trim().toLowerCase() || normalize(c.name) === v) || null;
}

function buildPreview(table, fileName) {
  if (table.length < 2) throw new Error('الملف فارغ أو لا يحتوي إلا على صف العناوين.');
  const header = table[0].map((h) => normalize(h));
  const idx = {};
  for (const [key, names] of Object.entries(COLUMNS)) idx[key] = header.findIndex((h) => names.some((n) => normalize(n) === h));
  const missing = ['category', 'difficulty', 'question', 'answer'].filter((k) => idx[k] < 0);
  if (missing.length) {
    throw new Error(`لم أجد هذه الأعمدة في الصف الأول: ${missing.join('، ')}. استخدم القالب (category, difficulty, question, answer, source).`);
  }
  const cell = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');

  const accepted = []; // rows already accepted from this file, for in-file duplicates
  rows = table.slice(1).map((r, i) => {
    const row = {
      line: i + 2,
      categoryText: cell(r, 'category'),
      difficultyText: cell(r, 'difficulty'),
      question: cell(r, 'question'),
      answerText: cell(r, 'answer') || cell(r, 'examples'),
      source: cell(r, 'source'),
      note: cell(r, 'note'),
      problems: [],
      dup: null,
    };
    row.cat = findCategory(row.categoryText);
    row.difficulty = parseDifficulty(row.difficultyText);
    const isLetters = row.cat?.type === 'letters';
    const parts = row.answerText.split(/\s*[|،]\s*/).filter(Boolean);
    row.answer = isLetters && parts.length > 1 ? '' : row.answerText;
    row.examples = isLetters && parts.length > 1 ? parts : [];

    if (row.question.startsWith(TEMPLATE_PLACEHOLDER)) row.template = true;
    if (!row.question) row.problems.push('السؤال فارغ');
    if (!row.cat) row.problems.push(row.categoryText ? `لا توجد فئة اسمها «${row.categoryText}»` : 'الفئة فارغة');
    if (!row.difficulty) row.problems.push(row.difficultyText ? `صعوبة غير معروفة «${row.difficultyText}»` : 'الصعوبة فارغة');
    if (!row.answerText) row.problems.push('الإجابة فارغة');
    if (row.source && !/^https?:\/\/\S+$/i.test(row.source)) row.problems.push('رابط المصدر لا يبدأ بـ https://');

    if (!row.problems.length && !row.template) {
      const hit = findSimilar(row.question, state.data.questions, { answer: row.answerText, limit: 1 })[0];
      if (hit) row.dup = { text: plain(hit.q.question), where: `${hit.q.id}`, score: hit.score };
      else {
        const twin = accepted.find((a) => similarity(a.question, row.question) >= 0.85);
        if (twin) row.dup = { text: twin.question, where: `الصف ${twin.line} في نفس الملف`, score: similarity(twin.question, row.question) };
      }
      accepted.push(row);
    }
    row.include = !row.problems.length && !row.template && !row.dup; // duplicates: unticked, but you can tick them
    return row;
  });

  renderPreview();
  msg(`قُرئ ${rows.length} صف من ${fileName}.`);
  $('#import-preview').hidden = false;
  $('#import-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function statusOf(r) {
  if (r.template) return ['skip', 'مثال من القالب (يُتجاهل)'];
  if (r.problems.length) return ['bad', r.problems.join('، ')];
  if (r.dup) return ['dup', `مكرر؟ ${Math.round(r.dup.score * 100)}٪ يشبه: «${r.dup.text.slice(0, 60)}» (${r.dup.where})`];
  return ['ok', 'جاهز'];
}

function renderPreview() {
  $('#preview-body').innerHTML = rows
    .map((r, i) => {
      const [kind, label] = statusOf(r);
      const canTick = kind === 'ok' || kind === 'dup';
      return `<tr class="pv-${kind}">
        <td><input type="checkbox" data-row="${i}" ${r.include ? 'checked' : ''} ${canTick ? '' : 'disabled'} aria-label="استيراد الصف ${r.line}"></td>
        <td class="num">${r.line}</td>
        <td class="pv-status">${esc(label)}</td>
        <td>${esc(r.cat?.name || r.categoryText)}</td>
        <td>${esc(r.difficulty ? `${diffById[r.difficulty].name} ${diffById[r.difficulty].points}` : r.difficultyText)}</td>
        <td class="pv-text">${esc(r.question)}</td>
        <td class="pv-text">${esc(r.examples.length ? r.examples.join('، ') : r.answer)}</td>
        <td class="pv-src">${r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noopener">رابط</a>` : '—'}</td>
      </tr>`;
    })
    .join('');
  updateSummary();
}

function updateSummary() {
  const count = (k) => rows.filter((r) => statusOf(r)[0] === k).length;
  const n = rows.filter((r) => r.include).length;
  $('#preview-summary').textContent = `جاهز ${count('ok')} · مكرر محتمل ${count('dup')} · فيه أخطاء ${count('bad')}${count('skip') ? ` · أمثلة القالب ${count('skip')}` : ''} — سيُستورد ${n}`;
  $('#import-go').textContent = n ? `استيراد ${n} سؤال` : 'لا يوجد ما يُستورد';
  $('#import-go').disabled = !n;
}

function resetPreview() {
  rows = [];
  $('#import-preview').hidden = true;
  $('#preview-body').innerHTML = '';
  msg('');
}

function doImport() {
  const ready = $('#import-ready').checked;
  const now = new Date().toISOString();
  const chosen = rows.filter((r) => r.include);
  const taken = allIds();
  for (const r of chosen) {
    const id = nextId(r.cat.id, r.difficulty, taken);
    taken.push(id);
    const q = {
      id,
      category: r.cat.id,
      difficulty: r.difficulty,
      points: diffById[r.difficulty].points,
      question: r.question,
      answer: r.answer,
      examples: r.examples,
      image: null,
      source: r.source || null,
      verified: ready,
      note: r.note,
      createdAt: now,
      importedAt: now,
    };
    if (ready) {
      q.review = 'approved';
      q.reviewedAt = now;
    }
    state.data.questions.push(q);
  }
  changed();
  resetPreview();
  questions.renderList();
  categories.renderDashboard();
  toast(`استُورد ${chosen.length} سؤال${ready ? '' : ' — راجعها في تبويب الأسئلة (فلتر: لم يُراجع)'}`);
  msg(`استُورد ${chosen.length} سؤال.`, 'ok');
}

// ---------------------------------------------------------------- export
function download(name, content, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type })), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function exportCsv() {
  const head = ['category', 'difficulty', 'question', 'answer', 'source', 'id', 'category_id', 'points', 'examples', 'note', 'verified', 'review', 'media_type', 'media_show', 'media_file', 'flag_image'];
  const body = state.data.questions.map((q) => [
    catById(q.category)?.name || q.category,
    q.difficulty,
    plain(q.question),
    q.answer,
    q.source || '',
    q.id,
    q.category,
    q.points,
    (q.examples || []).join(' | '),
    q.note || '',
    q.verified ? 'yes' : 'no',
    q.review || 'pending',
    q.media?.type || '',
    q.media?.show || '',
    q.media?.src || '',
    q.image || '',
  ]);
  download(`maydan-questions-${stamp()}.csv`, toCsv([head, ...body]), 'text/csv;charset=utf-8');
  toast(`نُزّل ملف CSV فيه ${body.length} سؤال`);
}

function exportJson() {
  const backup = { exportedAt: new Date().toISOString(), ...state.data, trash: state.trash.items };
  download(`maydan-backup-${stamp()}.json`, JSON.stringify(backup, null, 1), 'application/json');
  toast(`نُزّلت نسخة احتياطية كاملة (${state.data.questions.length} سؤال)`);
}

function msg(text, kind = '') {
  const el = $('#import-msg');
  el.textContent = text;
  el.dataset.kind = kind;
}
