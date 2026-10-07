// ============================================================
//  Category icons + short descriptions (setup draft, board towers).
//  Style rules: ILLUSTRATION_STYLE.md — duotone line icons on a 48×48 grid:
//  one line colour (currentColor) + ONE accent shape in the category colour, no faces, no characters, no logos.
// ============================================================

const LINE = `fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"`;
const ACCENT = 'fill="var(--accent, #ec6142)"';

/** Shared 48×48 canvas. `accent` is drawn first (behind), `line` on top. */
const icon = (accent, line) =>
  `<svg class="cat-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <g ${ACCENT} stroke="none">${accent}</g>
    <g ${LINE}>${line}</g>
  </svg>`;

const ART = {
  // Globe: lime land masses under the meridian lines
  geo: icon(
    `<path d="M15 15c4-3 9-3 11 0 1 3-2 5-5 6-3 1-3 5-6 6-3 0-5-4-4-7 0-2 2-4 4-5z"/><path d="M29 28c3-2 7-1 7 2s-3 6-6 6c-2-1-3-5-1-8z"/>`,
    `<circle cx="24" cy="24" r="15"/><path d="M9 24h30"/><path d="M24 9c5 4 7 9 7 15s-2 11-7 15c-5-4-7-9-7-15s2-11 7-15z"/>`,
  ),
  // Flag on a pole: lime upper half
  flags: icon(
    `<path d="M14 9c6-2 11 3 18 1v9c-7 2-12-3-18-1z"/>`,
    `<path d="M14 41V8"/><path d="M14 9c6-2 11 3 18 1v17c-7 2-12-3-18-1"/>`,
  ),
  // Game controller with a lime lightning bolt above it (generic gaming idea, no characters)
  rivals: icon(
    `<path d="M26 4l-7 10h5l-3 8 8-11h-5l2-7z"/>`,
    `<path d="M10 26c0-3 2-5 5-5h18c3 0 5 2 5 5l2 9c0 3-3 5-6 3l-4-4H18l-4 4c-3 2-6 0-6-3z"/><path d="M17 27v6M14 30h6"/><circle cx="31" cy="28.5" r="1" fill="currentColor"/><circle cx="34" cy="32" r="1" fill="currentColor"/>`,
  ),
  // Four operations in a grid: lime plus
  math: icon(
    `<rect x="9" y="9" width="13" height="13" rx="3"/>`,
    `<rect x="7" y="7" width="34" height="34" rx="6"/><path d="M15.5 12v7M12 15.5h7"/><path d="M29 15.5h7"/><path d="M12.5 29l6 6M18.5 29l-6 6"/><path d="M29 30h7M29 34h7"/>`,
  ),
  // Light bulb: lime glass, question mark inside
  riddles: icon(
    `<path d="M24 7a12 12 0 0 0-7 21.6c1.3 1 2 2.4 2 3.9h10c0-1.5.7-2.9 2-3.9A12 12 0 0 0 24 7z" opacity=".35"/>`,
    `<path d="M24 7a12 12 0 0 0-7 21.6c1.3 1 2 2.4 2 3.9h10c0-1.5.7-2.9 2-3.9A12 12 0 0 0 24 7z"/><path d="M19 37h10M20.5 41h7"/><path d="M21 16.5a3.2 3.2 0 1 1 4.6 2.9c-1 .5-1.6 1.3-1.6 2.6"/><circle cx="24" cy="26" r=".9" fill="currentColor"/>`,
  ),
  // Letter tile with a lime corner and the letter ح
  letters: icon(
    `<path d="M9 15a6 6 0 0 1 6-6h8L9 23z"/>`,
    `<rect x="9" y="9" width="30" height="30" rx="6"/><path d="M17 19c3-2 7-2 10 0M27 19c-6 2-10 5-10 9 0 4 4 6 9 5 3-1 5-3 5-5"/>`,
  ),
};

// Placeholder for categories without their own icon or uploaded image
const FALLBACK = icon(
  `<path d="M24 12l12 12-12 12-12-12z"/>`,
  `<rect x="8" y="8" width="32" height="32" rx="7"/>`,
);

const DESC = {
  geo: 'عواصم وأنهار وجبال وقارات، مع نصيب كبير للعالم العربي.',
  flags: 'يظهر علم دولة وعليكم معرفة اسمها. الأصعب: أعلام متشابهة ودول صغيرة.',
  rivals: 'أسئلة عن لعبة مارفل رايفلز: الأبطال والمواسم والخرائط وعالم اللعبة.',
  math: 'حساب ذهني سريع بلا ورقة ولا قلم، ولكل سؤال إجابة واحدة.',
  riddles: 'ألغاز عربية قصيرة، فكّروا جيداً قبل أن تجيبوا.',
  letters: 'أسئلة جوابها كلمة تبدأ بحرف محدد.',
};

export const artFor = (id) => ART[id] || FALLBACK;
export const descFor = (id) => DESC[id] || '';
