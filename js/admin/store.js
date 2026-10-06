// ============================================================
//  Admin data store — the ONLY module that knows where admin data is saved.
//
//  Today:  "local" backend → tools/dev_server.py on this computer
//          (data/questions.json, data/trash.json, media/).
//  Later:  a "supabase" backend can implement the same functions (database + storage)
//          so the panel works on the live site for the signed-in owner. Nothing else changes.
//
//  On the live site without Supabase there is NO backend, so the panel refuses to open
//  (and GitHub Pages has no API anyway, so nothing could be written).
// ============================================================

import { isConfigured } from '../auth.js';

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const API_HEADERS = { 'X-Admin': '1' }; // the dev server rejects API calls without this header

/** Which backend can be used here: { mode: 'local' | 'supabase' | 'none', reason } */
export async function connect() {
  if (isLocal) {
    try {
      const res = await fetch('api/status', { headers: API_HEADERS, cache: 'no-store' });
      const s = await res.json();
      if (res.ok && s.ok) return { mode: 'local', ffmpeg: s.ffmpeg };
    } catch {
      /* fall through */
    }
    return { mode: 'none', reason: 'شغّل الخادم المحلي أولاً: python tools/dev_server.py ثم افتح http://localhost:8080/admin.html' };
  }
  if (isConfigured()) {
    return { mode: 'none', reason: 'لوحة التحكم على الموقع المباشر لم تُربط بـ Supabase بعد. استخدمها على جهازك الآن.' };
  }
  return { mode: 'none', reason: 'لوحة التحكم تعمل على جهازك فقط حتى يُفعَّل تسجيل الدخول.' };
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `خطأ ${res.status}`);
  return out;
}

async function getJson(path, fallback) {
  const res = await fetch(path, { cache: 'no-store' });
  if (res.status === 404) return fallback;
  if (!res.ok) throw new Error(`تعذّر تحميل ${path} (${res.status})`);
  return res.json();
}

/** Everything the panel needs: { data: {version, categories, questions}, trash: {items} } */
export async function loadAll() {
  const [data, trash] = await Promise.all([
    getJson('data/questions.json', null),
    getJson('data/trash.json', { items: [] }),
  ]);
  if (!data) throw new Error('لم يُعثر على data/questions.json');
  return { data, trash };
}

export const saveQuestions = (data) => api('api/questions', data);

/** What changed compared with the live site: { questions: {added, edited, deleted}, media, categories, ... } */
export async function publishStatus() {
  const res = await fetch('api/publish', { headers: API_HEADERS, cache: 'no-store' });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `خطأ ${res.status}`);
  return out;
}

/** Commit the content (questions, trash, media) and push it to the live site. */
export const publish = () => api('api/publish', {});
export const saveTrash = (trash) => api('api/trash', trash);
export const deleteMedia = (path) => api('api/media-delete', { path });

/**
 * Upload one file. The server compresses it (WebP / MP4 720p ≤60s / MP3) and rejects >15 MB.
 * @param {{target: 'question'|'category', id: string, file: File, onProgress?: (0..1) => void}} o
 * @returns {Promise<{src, type, bytes, original, notes: string[]}>}
 */
export function uploadMedia({ target, id, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const q = new URLSearchParams({ for: target, id, name: file.name });
    xhr.open('POST', `api/media?${q}`);
    xhr.setRequestHeader('X-Admin', '1');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let out = {};
      try {
        out = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status === 200) resolve(out);
      else reject(new Error(out.error || `فشل الرفع (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال بالخادم المحلي أثناء الرفع.'));
    xhr.send(file);
  });
}
