// ============================================================
//  Media section of the question editor: pick a file → local preview →
//  uploaded (and compressed by the server) only when the question is saved.
// ============================================================

import { $, esc } from './state.js';
import * as store from './store.js';

const TYPE_NAME = { image: 'صورة', video: 'فيديو', audio: 'صوت' };
let original = null; // q.media when the editor opened
let picked = null; // File chosen but not uploaded yet
let removed = false;
let uploading = false;
let objectUrl = null;
let notes = '';

/** What the server changed in the last upload, e.g. "cut to 60 seconds" ('' if nothing). */
export const lastNotes = () => notes;

export const label = (m) => `${TYPE_NAME[m.type] || 'وسائط'}${m.show === 'answer' ? ' (مع الإجابة)' : ''}`;
export const busy = () => uploading;

export function init() {
  $('#media-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const kind = file.type.split('/')[0];
    if (!['image', 'video', 'audio'].includes(kind) && !file.name.toLowerCase().endsWith('.svg')) {
      msg('نوع الملف غير مدعوم. اختر صورة أو فيديو أو ملف صوت.', 'bad');
      e.target.value = '';
      return;
    }
    picked = file;
    removed = false;
    const big = file.size > 15 * 1024 * 1024;
    msg(
      `سيُضغط الملف ويُرفع عند الحفظ (${(file.size / 1024 / 1024).toFixed(1)} ميغابايت الآن).` +
        (big ? ' الملف كبير؛ إن بقي أكبر من 15 ميغابايت بعد الضغط فسيُرفض.' : ''),
    );
    preview({ type: kind === 'image' || file.name.toLowerCase().endsWith('.svg') ? 'image' : kind, src: localUrl(file) });
  });
  $('#media-remove').addEventListener('click', () => {
    picked = null;
    removed = true;
    $('#media-file').value = '';
    preview(null);
    msg(original ? 'ستُحذف الوسائط عند الحفظ.' : '');
  });
}

/** Called when the editor opens. */
export function load(q) {
  original = q?.media?.src ? { ...q.media } : null;
  picked = null;
  removed = false;
  uploading = false;
  $('#media-file').value = '';
  $('#editor-form').querySelector(`[name="mediaShow"][value="${original?.show || 'question'}"]`).checked = true;
  msg(q?.image && !original ? 'هذا السؤال يعرض صورة علم من ملفات اللعبة. أي وسائط تضيفها تظهر بالإضافة إليها.' : '');
  preview(original ? { ...original, src: `${original.src}?v=${Date.now()}` } : null);
}

function localUrl(file) {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  return objectUrl;
}

function preview(m) {
  const box = $('#media-preview');
  $('#media-remove').hidden = !m;
  $('#media-show').hidden = !m;
  if (!m) {
    box.innerHTML = '<p class="media-empty">لا توجد وسائط.</p>';
    return;
  }
  const src = esc(m.src);
  box.innerHTML =
    m.type === 'video'
      ? `<video src="${src}" controls preload="metadata" playsinline></video>`
      : m.type === 'audio'
        ? `<audio src="${src}" controls preload="metadata"></audio>`
        : `<img src="${src}" alt="معاينة الصورة المرفقة">`;
}

function msg(text, kind = '') {
  const el = $('#media-msg');
  el.textContent = text;
  el.dataset.kind = kind;
}

/**
 * Called when the question is saved, BEFORE the question itself changes.
 * Uploads/deletes as needed and returns the new q.media value (or undefined = no media).
 * Throws (with an Arabic message) if the upload is rejected, so the save can stop.
 */
export async function commit(id) {
  const show = $('#editor-form').querySelector('[name="mediaShow"]:checked').value;
  notes = '';
  if (picked) {
    uploading = true;
    const bar = progressBar();
    try {
      msg('جارٍ الرفع…');
      const res = await store.uploadMedia({
        target: 'question',
        id,
        file: picked,
        onProgress: (p) => {
          bar.value = p;
          if (p >= 1) msg('جارٍ الضغط… قد يستغرق الفيديو دقيقة.');
        },
      });
      if (original && original.src !== res.src) await store.deleteMedia(original.src).catch(() => {});
      notes = res.notes?.join(' ') || '';
      msg(notes);
      return { type: res.type, src: res.src, show, bytes: res.bytes };
    } catch (err) {
      msg(err.message, 'bad');
      throw err;
    } finally {
      uploading = false;
      bar.remove();
    }
  }
  if (removed) {
    if (original) await store.deleteMedia(original.src).catch(() => {});
    return undefined;
  }
  return original ? { ...original, show } : undefined;
}

/** Editor closed without saving: forget the picked file. */
export async function discard() {
  picked = null;
  removed = false;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  $('#media-preview').innerHTML = ''; // stops any playing preview
}

function progressBar() {
  const bar = document.createElement('progress');
  bar.max = 1;
  bar.value = 0;
  bar.className = 'media-progress';
  bar.setAttribute('aria-label', 'تقدّم رفع الملف');
  $('#media-msg').before(bar);
  return bar;
}
