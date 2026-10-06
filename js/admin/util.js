// ============================================================
//  Admin helpers: Arabic text matching (duplicates), ids, CSV.
//  Pure functions — no DOM, no saving.
// ============================================================

export const DIFFS = [
  { id: 'easy', points: 200, name: 'سهل', letter: 'e' },
  { id: 'medium', points: 400, name: 'متوسط', letter: 'm' },
  { id: 'hard', points: 600, name: 'صعب', letter: 'h' },
];
export const diffById = Object.fromEntries(DIFFS.map((d) => [d.id, d]));

/** Read "easy" / "سهل" / "200" / "e" (any case/spaces) → "easy" | null */
export function parseDifficulty(v) {
  const s = String(v ?? '').trim().toLowerCase();
  const d = DIFFS.find((x) => [x.id, x.name, String(x.points), x.letter].includes(s));
  return d ? d.id : null;
}

/** Strip the invisible left-to-right marks used around math expressions */
export const plain = (s) => String(s ?? '').replace(/[⁦-⁩]/g, '');

/**
 * Normalise Arabic for comparison: no diacritics/tatweel, one form of alef/ya/ta-marbuta,
 * Arabic-Indic digits → Western, punctuation removed, single spaces.
 */
export function normalize(s) {
  return plain(s)
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trigrams(s) {
  const t = ` ${normalize(s)} `;
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

/** Similarity 0..1 between two questions (Dice coefficient on character trigrams). */
export function similarity(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const g of A) if (B.has(g)) common++;
  return (2 * common) / (A.size + B.size);
}

export const DUPLICATE_AT = 0.72; // warn at or above this similarity

/** Questions very similar to `text` (best first). `exceptId` skips the question being edited. */
export function findSimilar(text, questions, { exceptId = null, limit = 3, min = DUPLICATE_AT } = {}) {
  if (normalize(text).length < 6) return [];
  const mine = trigrams(text);
  return questions
    .filter((q) => q.id !== exceptId)
    .map((q) => {
      const other = trigrams(q.question);
      let common = 0;
      for (const g of mine) if (other.has(g)) common++;
      return { q, score: (2 * common) / (mine.size + other.size || 1) };
    })
    .filter((r) => r.score >= min)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** Next free id like "geo-e-31" (checks live questions AND trash so ids never repeat). */
export function nextId(category, difficulty, takenIds) {
  const prefix = `${category}-${diffById[difficulty].letter}-`;
  let n = 1;
  for (const id of takenIds) {
    if (id.startsWith(prefix)) {
      const k = parseInt(id.slice(prefix.length), 10);
      if (k >= n) n = k + 1;
    }
  }
  return `${prefix}${String(n).padStart(2, '0')}`;
}

/** Id for a new category from its name: "cat-1", "cat-2", … */
export function nextCategoryId(categories) {
  let n = 1;
  while (categories.some((c) => c.id === `cat-${n}`)) n++;
  return `cat-${n}`;
}

// ---------------------------------------------------------------- CSV
/** Parse CSV text (handles quotes, commas/newlines inside quotes, BOM, ; or tab separators). */
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const csvCell = (v) => {
  const s = Array.isArray(v) ? v.join(' | ') : String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows (arrays) → CSV text with a BOM so Excel opens Arabic correctly. */
export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
