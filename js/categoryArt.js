// ============================================================
//  Category illustrations + short descriptions for the setup cards.
//  Every drawing follows ILLUSTRATION_STYLE.md: 160×100 canvas, thick dark outlines,
//  flat fills from the game palette only, no faces, no characters, no logos,
//  and the game's 8-point star as a small signature.
// ============================================================

import { starPoints } from './icons.js';

// Palette (same values as the tokens in css/style.css)
const C = {
  ink: '#1e1650', // outlines (never pure black)
  night: '#2c2170', // dark fills
  paper: '#fbf9ff', // white fills / snow
  lilac: '#d6c9ff', // shadows, secondary fills
  saffron: '#ffb627',
  teal: '#1fc7b3',
  rose: '#ff4f6e',
};

const OUT = `stroke="${C.ink}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const OUT_THIN = `stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"`;

/** Wraps a drawing in the shared canvas: ground shadow first, signature star last. */
const canvas = (body, { shadow = [80, 46], star = [134, 18] } = {}) =>
  `<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${shadow[0]}" cy="92" rx="${shadow[1]}" ry="5" fill="${C.lilac}"/>
    <g ${OUT}>${body}</g>
    <polygon points="${starPoints(star[0], star[1], 9, 5.5)}" fill="${C.saffron}" ${OUT_THIN}/>
  </svg>`;

/** A flag with a wavy edge, hanging from a pole at (x, y). */
const wave = (x, y, w, h) =>
  `M${x} ${y} C${x + w * 0.33} ${y - 6} ${x + w * 0.62} ${y + 6} ${x + w} ${y} L${x + w} ${y + h} ` +
  `C${x + w * 0.62} ${y + h + 6} ${x + w * 0.33} ${y + h - 6} ${x} ${y + h} Z`;

/** A rounded tile, rotated around its centre. */
const tile = (cx, cy, size, deg, fill, inner = '') =>
  `<g transform="rotate(${deg} ${cx} ${cy})">
     <rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="${size * 0.22}" fill="${fill}"/>
     ${inner}
   </g>`;

/** Arabic letter on a tile (uses the game's display font). */
const glyph = (cx, cy, ch) =>
  `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-family="Lalezar, 'Readex Pro', sans-serif" font-size="28" fill="${C.ink}" stroke="none">${ch}</text>`;

const ART = {
  // Globe with land, a snowy mountain and a river
  geo: canvas(`
    <circle cx="80" cy="48" r="38" fill="${C.teal}"/>
    <path d="M50 32 C58 22 76 20 86 27 C94 33 89 42 81 46 C72 51 75 61 64 66 C55 70 45 61 45 50 C44 43 46 37 50 32 Z" fill="${C.saffron}"/>
    <path d="M95 58 C103 51 114 54 115 62 C115 71 106 79 98 77 C91 75 90 64 95 58 Z" fill="${C.saffron}"/>
    <path d="M53 50 L65 31 L77 50 Z" fill="${C.lilac}"/>
    <path d="M60 39 L65 31 L70 39 L65 42 Z" fill="${C.paper}" stroke-width="2.5"/>
    <path d="M69 50 C66 56 73 59 67 66" stroke="${C.teal}" stroke-width="4" fill="none"/>
  `, { shadow: [80, 34] }),

  // Three made-up waving flags. Patterns are deliberately NOT stripes/bands/discs,
  // so none of them reads as a real country's flag.
  flags: canvas(`
    <path d="M36 92 V20 M76 92 V32 M116 92 V24" fill="none"/>
    <circle cx="36" cy="18" r="3.5" fill="${C.saffron}"/><circle cx="76" cy="30" r="3.5" fill="${C.saffron}"/><circle cx="116" cy="22" r="3.5" fill="${C.saffron}"/>
    <path d="${wave(36, 22, 32, 24)}" fill="${C.teal}"/>
    <circle cx="45" cy="34" r="3.2" fill="${C.saffron}" stroke-width="2"/><circle cx="53" cy="35" r="3.2" fill="${C.saffron}" stroke-width="2"/><circle cx="61" cy="34" r="3.2" fill="${C.saffron}" stroke-width="2"/>
    <path d="${wave(76, 34, 32, 24)}" fill="${C.rose}"/>
    <path d="M76 34 C81 32 86 33 90 35 L90 46 L76 46 Z" fill="${C.lilac}" stroke-width="3"/>
    <path d="${wave(116, 26, 30, 22)}" fill="${C.lilac}"/>
    <polygon points="${starPoints(131, 37, 7, 4)}" fill="${C.teal}" stroke-width="2.5"/>
  `, { shadow: [76, 52], star: [20, 70] }),

  // Gaming hero idea: shield + lightning behind a game controller
  rivals: canvas(`
    <path d="M80 8 L106 17 C106 39 97 52 80 61 C63 52 54 39 54 17 Z" fill="${C.rose}"/>
    <path d="M85 15 L72 37 L81 37 L76 54 L92 29 L83 29 Z" fill="${C.saffron}" stroke-width="3"/>
    <path d="M46 69 C46 60 55 58 63 60 L97 60 C105 58 114 60 114 69 L118 83 C119 91 109 94 104 87 L98 79 L62 79 L56 87 C51 94 41 91 42 83 Z" fill="${C.paper}"/>
    <path d="M60 64 V76 M54 70 H66" stroke-width="4.5"/>
    <circle cx="97" cy="66" r="3.6" fill="${C.teal}" stroke-width="2.5"/>
    <circle cx="105" cy="73" r="3.6" fill="${C.saffron}" stroke-width="2.5"/>
  `, { shadow: [80, 40] }),

  // Number and symbol tiles
  math: canvas(`
    ${tile(60, 48, 42, -8, C.saffron, `<path d="M51 36 H69 L57 62" fill="none" stroke-width="6"/>`)}
    <circle cx="106" cy="38" r="18" fill="${C.teal}"/>
    <path d="M106 29 V47 M97 38 H115" stroke-width="5"/>
    ${tile(110, 76, 24, 10, C.rose, `<path d="M102 76 H118" stroke-width="3.5"/><circle cx="110" cy="70" r="1.8" fill="${C.ink}"/><circle cx="110" cy="82" r="1.8" fill="${C.ink}"/>`)}
    <path d="M24 70 H40 M24 79 H40" stroke-width="4.5"/>
  `, { shadow: [76, 44], star: [132, 14] }),

  // Big question mark and a glowing light bulb
  riddles: canvas(`
    <path d="M44 34 C44 16 74 14 74 33 C74 45 60 45 60 58" fill="none" stroke-width="17"/>
    <path d="M44 34 C44 16 74 14 74 33 C74 45 60 45 60 58" fill="none" stroke="${C.rose}" stroke-width="9"/>
    <circle cx="60" cy="74" r="7" fill="${C.rose}"/>
    <path d="M106 18 C121 18 129 31 123 44 C120 51 114 53 114 62 L98 62 C98 53 92 51 89 44 C83 31 91 18 106 18 Z" fill="${C.saffron}"/>
    <path d="M100 62 H112 V71 C112 75 100 75 100 71 Z" fill="${C.teal}" stroke-width="3.5"/>
    <path d="M101 66 H111" stroke-width="2.5"/>
    <path d="M106 8 V3 M128 16 L132 12 M84 16 L80 12 M134 36 H139 M78 36 H73" stroke-width="3.5"/>
  `, { shadow: [84, 44], star: [26, 80] }),

  // Arabic letter tiles spelling حرف (read right to left)
  letters: canvas(`
    ${tile(116, 50, 34, 6, C.saffron, glyph(116, 50, 'ح'))}
    ${tile(80, 44, 34, -5, C.teal, glyph(80, 44, 'ر'))}
    ${tile(44, 52, 34, 7, C.rose, glyph(44, 52, 'ف'))}
  `, { shadow: [80, 52], star: [80, 84] }),
};

// Used for any new category until it gets its own drawing
const FALLBACK = canvas(`
  <polygon points="${starPoints(80, 48, 34, 24)}" fill="${C.saffron}"/>
  <circle cx="80" cy="48" r="16" fill="${C.paper}"/>
`);

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
