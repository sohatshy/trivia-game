// ============================================================
//  App: connects the screens (HTML) to the game rules (game.js).
// ============================================================

import { CONFIG } from './config.js';
import { ICONS } from './icons.js';
import { getCategories, getAllCategories, getPlayableCategories, getQuestionById } from './questions.js';
import * as game from './game.js';
import { sound } from './sound.js';
import * as auth from './auth.js';
import { setPlayer, pickReplacement } from './history.js';
import { artFor, descFor } from './categoryArt.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let categories = [];     // all categories from questions.json
let catById = {};
let playableIds = new Set();
let user = null;         // signed-in account, or null for guests
const GUEST_KEY = 'maydan.guestGames';

// ---------- helpers ----------
function show(screenId) {
  $$('.screen').forEach((s) => {
    s.classList.toggle('is-active', s.id === screenId);
    s.hidden = s.id !== screenId; // only one <main> is exposed at a time
  });
  $('#btn-quit').hidden = !['screen-board', 'screen-question'].includes(screenId);
  // Copyright footer: on the menu screens only, so the TV board and questions stay clean
  const withFooter = ['screen-login', 'screen-setup', 'screen-winner'].includes(screenId);
  $('#site-footer').hidden = !withFooter;
  document.body.classList.toggle('has-footer', withFooter);
  if (screenId !== 'screen-question') clearMedia(); // stop any video/audio when leaving the question
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 2600);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function teamVars(i) {
  return i === 0 ? ['var(--t1)', 'var(--t1-ink)'] : ['var(--t2)', 'var(--t2-ink)'];
}

// ---------- boot ----------
async function boot() {
  $$('[data-icon]').forEach((el) => (el.outerHTML = ICONS[el.dataset.icon]));
  $$('[data-game-name]').forEach((el) => (el.textContent = CONFIG.GAME_NAME));
  setupMute();
  $('#btn-quit').innerHTML = ICONS.home;
  $('#btn-quit').addEventListener('click', quitGame);
  document.addEventListener('pointerdown', () => sound.unlock(), { once: true });

  try {
    categories = await getCategories(); // offered in setup (not hidden)
    catById = Object.fromEntries((await getAllCategories()).map((c) => [c.id, c])); // all, for saved games
    playableIds = new Set((await getPlayableCategories(CONFIG.BOARD)).map((c) => c.id));
  } catch (err) {
    document.body.innerHTML = `<p style="padding:2rem;font-size:1.5rem">تعذّر تحميل الأسئلة. شغّل اللعبة عبر خادم محلي: python tools/dev_server.py ثم افتح http://localhost:8080</p>`;
    console.error(err);
    return;
  }

  // Sign-in (only does anything once Supabase is configured in config.js)
  user = await auth.getUser();
  await setPlayer(user?.id || 'guest', user ? await auth.getClient() : null);

  initLogin();
  initSetup();

  const saved = game.load();
  if (saved && saved.phase === 'board') renderBoard();
  else if (saved && saved.phase === 'question') openQuestion(true);
  else if (saved && saved.phase === 'winner') renderWinner();
  else show('screen-login');
}

// ---------- mute ----------
function setupMute() {
  const btn = $('#btn-mute');
  const paint = () => {
    const m = sound.isMuted();
    btn.innerHTML = m ? ICONS.soundOff : ICONS.soundOn;
    btn.setAttribute('aria-pressed', String(m)); // label stays "كتم الصوت"; pressed = muted
  };
  btn.addEventListener('click', () => {
    sound.setMuted(!sound.isMuted());
    paint();
  });
  paint();
}

function quitGame() {
  if (!confirm('إنهاء هذه اللعبة والعودة لصفحة تجهيز الفريقين؟')) return;
  stopClock();
  game.clear();
  resetSetup();
  show('screen-setup');
}

// ============================================================
//  LOGIN
// ============================================================
function guestGamesPlayed() {
  try {
    return Number(localStorage.getItem(GUEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Guests get CONFIG.GUEST_FREE_GAMES games, but only once sign-in exists. */
function guestBlocked() {
  return !user && auth.isConfigured() && guestGamesPlayed() >= CONFIG.GUEST_FREE_GAMES;
}

function paintLogin() {
  const note = $('#login-note');
  $('#btn-google').hidden = Boolean(user);
  $('#btn-signout').hidden = !user;
  $('#login-user').hidden = !user;
  $('#login-user').textContent = user ? `أهلاً ${user.name}` : '';
  const guest = $('#btn-guest');
  guest.textContent = user ? 'ابدأ اللعب' : 'العب كضيف';
  guest.disabled = guestBlocked();
  note.textContent = guestBlocked() ? 'انتهت لعبتك المجانية. سجّل الدخول بحساب Google لتكمل اللعب.' : '';
}

function initLogin() {
  $('#btn-guest').addEventListener('click', () => {
    if (guestBlocked()) return;
    resetSetup();
    show('screen-setup');
  });
  $('#btn-google').addEventListener('click', async () => {
    const note = $('#login-note');
    if (!auth.isConfigured()) {
      note.textContent = 'الدخول بحساب Google غير مفعّل بعد. العب كضيف الآن.';
      return;
    }
    note.textContent = 'جارٍ فتح Google…';
    try {
      await auth.signInWithGoogle(); // leaves the page and comes back signed in
    } catch {
      note.textContent = 'تعذّر فتح تسجيل الدخول. تحقّق من الاتصال وحاول مرة أخرى.';
    }
  });
  $('#btn-signout').addEventListener('click', async () => {
    await auth.signOut();
    user = null;
    await setPlayer('guest');
    paintLogin();
  });
  paintLogin();
}

// ---------- category pictures: the owner's uploaded image, else the built-in duotone icon / placeholder ----------
const categoryArt = (c) => (c.image ? `<img class="cat-img" src="${esc(c.image)}" alt="" loading="lazy">` : artFor(c.id));

/** Each category gets one of the palette colours (--cat-1 … --cat-6 in style.css), by its place in the list */
const CAT_COLOURS = 6;
const catStyle = (id) => {
  const n = (Math.max(0, categories.findIndex((c) => c.id === id)) % CAT_COLOURS) + 1;
  return `--cat: var(--cat-${n}); --cat-ink: var(--cat-${n}-ink)`;
};

/** Team shape (circle / diamond) so teams differ by shape as well as colour */
const teamMark = (i) => `<span class="team-mark" data-team="${i}" aria-hidden="true"></span>`;
const teamName = (i) => $(`#t${i}-name`).value.trim() || (i === 0 ? 'الفريق الأول' : 'الفريق الثاني');

// Simple Arabic-aware matching for the category search
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

// ============================================================
//  SETUP — category draft
//  Shared pool in the middle, 3 slots per team, fair pick order 1-2-2-1-1-2.
// ============================================================
const PICK_ORDER = [0, 1, 1, 0, 0, 1];
const picks = [[], []];
let poolFilter = 'all';
let poolQuery = '';

/** Whose turn it is to pick (null when both teams are full). Works after a team sends a card back. */
function nextPicker() {
  const need = [0, 0];
  for (const t of PICK_ORDER) {
    need[t]++;
    if (picks[t].length < need[t]) return t;
  }
  return null;
}

const isPicked = (id) => picks[0].includes(id) || picks[1].includes(id);

function initSetup() {
  $('#setup-form').addEventListener('submit', startGame);
  $('#pool').addEventListener('click', onPoolClick);
  $('#slots-0').addEventListener('click', onSlotClick);
  $('#slots-1').addEventListener('click', onSlotClick);
  $('#pool-search').addEventListener('input', (e) => {
    poolQuery = norm(e.target.value);
    renderPool();
  });
  $('#pool-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    poolFilter = chip.dataset.filter;
    renderFilters();
    renderPool();
  });
  for (const i of [0, 1]) $(`#t${i}-name`).addEventListener('input', () => renderDraft());
  renderFilters();
  renderDraft();
}

function renderFilters() {
  const groups = [...new Set(categories.map((c) => c.group).filter(Boolean))];
  const hasSoon = categories.some((c) => !playableIds.has(c.id));
  const chips = [
    ['all', 'الكل'],
    ['ready', 'جاهزة للعب'],
    ...(hasSoon ? [['soon', 'قريباً']] : []),
    ...groups.map((g) => [`g:${g}`, g]),
  ];
  $('#pool-filters').innerHTML = chips
    .map(([id, label]) => `<button type="button" class="chip" data-filter="${esc(id)}" aria-pressed="${poolFilter === id}">${esc(label)}</button>`)
    .join('');
}

function renderDraft() {
  renderTurn();
  renderSlots();
  renderPool();
  const done = picks[0].length === 3 && picks[1].length === 3;
  $('#btn-start').disabled = !done;
  $('#start-hint').textContent = done ? '' : `يختار كل فريق ${CONFIG.CATEGORIES_PER_TEAM} فئات ليبدأ اللعب.`;
}

function renderTurn() {
  const t = nextPicker();
  const text = $('#draft-turn-text');
  text.dataset.team = t ?? '';
  text.innerHTML = t === null ? 'اكتمل الاختيار' : `${teamMark(t)}<span>دور <strong>${esc(teamName(t))}</strong> في الاختيار</span>`;
  // Order track: which picks are done, which is now, which are next
  const used = [0, 0];
  let currentShown = false;
  $('#draft-order').innerHTML = PICK_ORDER.map((team, i) => {
    used[team]++;
    const done = picks[team].length >= used[team];
    const now = !done && !currentShown && team === t;
    if (now) currentShown = true;
    const state = done ? 'done' : now ? 'now' : 'next';
    const label = `الاختيار ${i + 1}: ${teamName(team)}${done ? ' (تم)' : now ? ' (الآن)' : ''}`;
    return `<li class="order-step is-${state}" data-team="${team}"><span class="visually-hidden">${esc(label)}</span>${teamMark(team)}</li>`;
  }).join('');
  $$('.draft-side').forEach((side) => side.classList.toggle('is-turn', Number(side.dataset.team) === t));
  $$('.team-field').forEach((f) => f.classList.toggle('is-turn', Number(f.dataset.team) === t));
}

function renderSlots() {
  const t = nextPicker();
  for (const team of [0, 1]) {
    const list = $(`#slots-${team}`);
    list.innerHTML = [0, 1, 2]
      .map((i) => {
        const id = picks[team][i];
        if (id) {
          const c = catById[id];
          return `<li><button type="button" class="slot is-filled" data-team="${team}" data-cat="${esc(id)}" style="${catStyle(id)}"
            aria-label="${esc(`${c.name}: اضغط لإرجاعها إلى القائمة`)}">
            <span class="slot-icon">${categoryArt(c)}</span><span class="slot-name">${esc(c.name)}</span>
            <span class="slot-remove" aria-hidden="true">×</span></button></li>`;
        }
        const isNext = team === t && i === picks[team].length;
        return `<li><div class="slot is-empty${isNext ? ' is-next' : ''}"><span class="slot-num">${i + 1}</span><span class="slot-hint">${
          isNext ? 'اختاروا فئة' : 'فارغ'
        }</span></div></li>`;
      })
      .join('');
  }
}

function renderPool() {
  const t = nextPicker();
  const shown = categories.filter((c) => {
    if (isPicked(c.id)) return false;
    const ready = playableIds.has(c.id);
    if (poolFilter === 'ready' && !ready) return false;
    if (poolFilter === 'soon' && ready) return false;
    if (poolFilter.startsWith('g:') && c.group !== poolFilter.slice(2)) return false;
    return !poolQuery || norm(c.name).includes(poolQuery) || norm(c.description || descFor(c.id)).includes(poolQuery);
  });
  $('#pool').innerHTML = shown
    .map((c) => {
      const ready = playableIds.has(c.id);
      const can = ready && t !== null;
      const descId = `desc-${c.id}`;
      return `<div class="cat-card${ready ? '' : ' is-soon'}" data-cat="${esc(c.id)}" style="${catStyle(c.id)}">
        <button type="button" class="cat-pick" data-cat="${esc(c.id)}" ${can ? '' : 'disabled'}
          aria-label="${esc(ready ? (t === null ? c.name : `اختيار ${c.name} لفريق ${teamName(t)}`) : `${c.name} (قريباً)`)}">
          <span class="cat-art">${categoryArt(c)}</span>
          <span class="cat-name">${esc(c.name)}</span>
          ${ready ? '' : '<span class="cat-soon">قريباً</span>'}
        </button>
        <button type="button" class="cat-info" aria-expanded="false" aria-controls="${descId}" aria-label="عن فئة ${esc(c.name)}">i</button>
        <p class="cat-desc" id="${descId}" role="note" hidden>${esc(c.description || descFor(c.id) || 'لا يوجد وصف لهذه الفئة.')}</p>
      </div>`;
    })
    .join('');
  const empty = $('#pool-empty');
  const left = categories.filter((c) => !isPicked(c.id)).length;
  empty.hidden = shown.length > 0;
  empty.textContent = left === 0 ? 'اختيرت كل الفئات.' : poolQuery ? 'لا توجد فئة بهذا الاسم. جرّبوا كلمة أخرى.' : 'لا توجد فئات في هذا التصنيف.';
}

// ---------- "i" description bubbles (one open at a time) ----------
function toggleInfo(btn, force) {
  const open = force ?? btn.getAttribute('aria-expanded') !== 'true';
  $$('.cat-info[aria-expanded="true"]').forEach((b) => {
    if (b !== btn) toggleInfo(b, false);
  });
  btn.setAttribute('aria-expanded', String(open));
  document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.cat-info, .cat-desc')) $$('.cat-info[aria-expanded="true"]').forEach((b) => toggleInfo(b, false));
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = $('.cat-info[aria-expanded="true"]');
  if (open) {
    toggleInfo(open, false);
    open.focus();
  }
});

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onPoolClick(e) {
  const info = e.target.closest('.cat-info');
  if (info) return toggleInfo(info);
  const btn = e.target.closest('.cat-pick');
  const team = nextPicker();
  if (!btn || btn.disabled || team === null) return;
  const id = btn.dataset.cat;
  const from = btn.closest('.cat-card').getBoundingClientRect();
  const ghost = btn.closest('.cat-card').cloneNode(true);
  picks[team].push(id);
  $('#setup-error').textContent = '';
  sound.open();
  renderDraft();
  flyToSlot(ghost, from, $(`#slots-${team} [data-cat="${CSS.escape(id)}"]`));
  // keep keyboard users in the pool: focus the first available card
  ($('#pool .cat-pick:not([disabled])') || $('#btn-start')).focus({ preventScroll: true });
}

/** The picked card glides from the pool into the team's slot (FLIP animation). */
function flyToSlot(ghost, from, slot) {
  if (!slot || reduceMotion()) return;
  const to = slot.getBoundingClientRect();
  slot.classList.add('is-arriving');
  ghost.classList.add('cat-ghost');
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.2 },
    ],
    { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' },
  );
  const done = () => {
    ghost.remove();
    slot.classList.remove('is-arriving');
  };
  anim.onfinish = done;
  anim.oncancel = done;
  setTimeout(done, 800); // safety net: animations pause in a hidden tab, never leave a copy on screen
}

function onSlotClick(e) {
  const btn = e.target.closest('.slot.is-filled');
  if (!btn) return;
  const team = Number(btn.dataset.team);
  const id = btn.dataset.cat;
  picks[team].splice(picks[team].indexOf(id), 1);
  renderDraft();
  const card = $(`#pool .cat-card[data-cat="${CSS.escape(id)}"]`);
  if (card && !reduceMotion()) card.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
  (card?.querySelector('.cat-pick') || $('#pool-search')).focus({ preventScroll: true });
}

function resetSetup() {
  picks[0].length = 0;
  picks[1].length = 0;
  poolQuery = '';
  poolFilter = 'all';
  $('#pool-search').value = '';
  $('#setup-error').textContent = '';
  renderFilters();
  renderDraft();
}

async function startGame(e) {
  e.preventDefault();
  const names = [teamName(0), teamName(1)];
  if (names[0] === names[1]) {
    $('#setup-error').textContent = 'اختاروا اسمين مختلفين للفريقين.';
    $('#t1-name').focus();
    return;
  }
  const n = CONFIG.CATEGORIES_PER_TEAM;
  if (picks[0].length !== n || picks[1].length !== n) return;
  const btn = $('#btn-start');
  btn.disabled = true;
  btn.textContent = 'جارٍ التجهيز…';
  try {
    await game.newGame(names, [picks[0].slice(), picks[1].slice()]);
    sound.open();
    renderBoard();
  } finally {
    btn.disabled = false;
    btn.textContent = 'ابدأ اللعب';
  }
}

// ============================================================
//  BOARD — one card per category: picture + name in the middle, 3 questions on each side
// ============================================================
function renderTeamPanels(bumpTeam = null) {
  const st = game.getState();
  $$('.team-card').forEach((card) => {
    const i = Number(card.dataset.team);
    const t = st.teams[i];
    card.classList.toggle('is-turn', st.turn === i);
    card.innerHTML = `
      <div class="team-id">${teamMark(i)}<span class="team-name">${esc(t.name)}</span></div>
      <span class="team-score${bumpTeam === i ? ' bump' : ''}" aria-label="نقاط ${esc(t.name)}">${t.score}</span>
      <span class="helpers" role="group" aria-label="مساعدات ${esc(t.name)}">${CONFIG.HELPERS.map((h) => boardHelperHtml(i, h)).join('')}</span>`;
  });
  const ti = $('#turn-indicator');
  ti.dataset.team = st.turn;
  ti.innerHTML = `<span class="turn-label">الدور على</span><span class="turn-team">${teamMark(st.turn)}${esc(st.teams[st.turn].name)}</span>`;
}

function boardHelperHtml(team, h) {
  const st = game.getState();
  const used = game.helperUsed(team, h.id);
  const armed = h.id === 'bet' && st.betArmed === team;
  // On the board only الرهان can be pressed, and only by the team whose turn it is
  const usable = h.id === 'bet' && st.turn === team && (!used || armed);
  const note = armed ? 'مفعّل، اضغط للإلغاء' : used ? 'مُستخدم' : h.when === 'question' ? 'يُستخدم أثناء السؤال' : '';
  return `<button type="button" class="helper-btn${used && !armed ? ' is-used' : ''}${armed ? ' is-armed' : ''}"
    data-team="${team}" data-helper="${h.id}" ${usable ? '' : 'disabled'}
    aria-label="${esc(`${h.name}: ${h.desc}${note ? ` (${note})` : ''}`)}" title="${esc(`${h.name}: ${h.desc}${note ? ` (${note})` : ''}`)}">${ICONS[h.id]}</button>`;
}

$('.scorebar').addEventListener('click', (e) => {
  const b = e.target.closest('.helper-btn');
  if (!b || b.disabled || b.dataset.helper !== 'bet') return;
  const team = Number(b.dataset.team);
  const st = game.getState();
  if (st.betArmed === team) {
    game.cancelBet(team);
    toast('أُلغي الرهان');
  } else if (game.useHelper(team, 'bet')) {
    sound.helper();
    toast(`رهان ${st.teams[team].name}! السؤال القادم بضعف النقاط… أو خصمها`);
  }
  renderTeamPanels();
});

function renderBoard(bumpTeam = null) {
  const st = game.getState();
  renderTeamPanels(bumpTeam);
  $('#board').innerHTML = st.categories
    .map((catId) => {
      const cat = catById[catId];
      const tiles = st.board[catId];
      const owner = game.ownerOf(catId);
      // Two columns of questions (one on each side of the picture), each 200 → 400 → 600 from top to bottom
      const sides = [0, 1].map((side) =>
        CONFIG.BOARD.map((slot) => {
          const i = tiles.map((t, n) => (t.points === slot.points ? n : -1)).filter((n) => n >= 0)[side];
          return i === undefined ? '' : tileHtml(cat, tiles[i], i);
        }).join(''),
      );
      return `<section class="bcard" style="${catStyle(catId)}" aria-label="${esc(cat.name)}">
        <div class="bcard-col">${sides[0]}</div>
        <div class="bcard-mid">
          <span class="bcard-art">${categoryArt(cat)}</span>
          <h2 class="bcard-name">${esc(cat.name)}</h2>
        </div>
        <div class="bcard-col">${sides[1]}</div>${
          owner >= 0 ? `<span class="bcard-owner" data-team="${owner}" title="${esc(`اختارها ${st.teams[owner].name}`)}">${teamMark(owner)}<span class="visually-hidden">اختارها ${esc(st.teams[owner].name)}</span></span>` : ''
        }
      </section>`;
    })
    .join('');
  show('screen-board');
}

function tileHtml(cat, t, index) {
  const st = game.getState();
  if (t.played) {
    const won = t.wonBy === 0 || t.wonBy === 1;
    const label = `${cat.name} ${t.points}: ${won ? `أخذ النقاط ${st.teams[t.wonBy].name}` : 'لم يأخذ أحد النقاط'}`;
    return `<button type="button" class="tile is-played" data-points="${t.points}" data-won="${won ? t.wonBy : 'none'}" disabled aria-label="${esc(label)}">
      <span class="tile-pts">${t.points}</span>${won ? teamMark(t.wonBy) : ''}</button>`;
  }
  return `<button type="button" class="tile" data-cat="${cat.id}" data-index="${index}" data-points="${t.points}"
    aria-label="${esc(`${cat.name}، ${t.points} نقطة`)}"><span class="tile-pts">${t.points}</span></button>`;
}

$('#board').addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile || tile.disabled) return;
  if (!game.openTile(tile.dataset.cat, Number(tile.dataset.index))) return;
  sound.open();
  openQuestion();
});

// ============================================================
//  QUESTION
//  No time limit: a stopwatch counts up and the host controls it (pause / resume / reset).
//  The host passes the question to the other team with "سرقة", and reveals it with "إنهاء".
// ============================================================
let clockTimer = null;
let currentQ = null;

async function openQuestion(resumed = false) {
  const st = game.getState();
  const cur = st.current;
  const q = await getQuestionById(cur.qid);
  const cat = catById[cur.catId];

  $('#screen-question').setAttribute('style', catStyle(cur.catId));
  $('#q-cat').textContent = cat.name;
  $('#q-points').textContent = cur.points;
  $('#q-bet').hidden = !cur.bet;
  showQuestionContent(q);
  if (!cur.clock) game.setClock({ elapsed: 0, since: Date.now() }); // a new question starts at 0:00 and runs
  show('screen-question');

  if (cur.awardedTo !== undefined) return showAnswer(true);
  if (cur.stage === 'revealed') return showAnswer();
  startStage(cur.stage === 'steal' ? 'steal' : 'answer');
}

/** Question text, flag and media (also used when تبديل swaps the question) */
function showQuestionContent(q) {
  currentQ = q;
  $('#q-text').textContent = q.question;
  const flag = $('#q-flag');
  if (q.image) {
    flag.src = q.image;
    flag.hidden = false;
  } else {
    flag.hidden = true;
    flag.removeAttribute('src');
  }
  $('#q-answer').hidden = true;
  $('#q-glimpse').hidden = true;
  clearMedia();
  if (q.media?.src && q.media.show !== 'answer') renderMedia(q.media);
}

function startStage(stage) {
  const st = game.getState();
  const cur = st.current;
  game.setStage(stage);
  const team = stage === 'answer' ? cur.chooser : 1 - cur.chooser;
  $('#screen-question').dataset.team = team;
  const who = $('#q-who');
  who.innerHTML = `${teamMark(team)}<span>${stage === 'answer' ? 'يجيب' : 'فرصة سرقة'}: ${esc(st.teams[team].name)}</span>`;
  who.dataset.team = team;
  who.classList.toggle('is-steal', stage === 'steal');
  renderQuestionHelpers(team);
  $('#stopwatch').classList.remove('is-done');
  $$('#stopwatch button').forEach((b) => (b.disabled = false));
  runClock();

  const other = st.teams[1 - cur.chooser].name;
  $('#q-actions').innerHTML = `${
    stage === 'answer'
      ? `<button type="button" class="btn btn-big btn-steal" id="btn-steal" data-team="${1 - cur.chooser}">${ICONS.steal}<span>سرقة: ${esc(other)}</span></button>`
      : ''
  }<button type="button" class="btn btn-big btn-primary" id="btn-end">إنهاء وإظهار الإجابة</button>`;
  if (!document.activeElement?.closest('#q-helpers, #stopwatch')) $('#btn-end').focus({ preventScroll: true });
  $('#btn-end').addEventListener('click', () => showAnswer());
  $('#btn-steal')?.addEventListener('click', () => {
    sound.steal();
    toast(`فرصة سرقة لـ ${other}`);
    startStage('steal'); // the stopwatch keeps running; the host can reset it
  });
}

function renderQuestionHelpers(team) {
  const box = $('#q-helpers');
  const cur = game.getState().current;
  const isLetters = catById[currentQ.category]?.type === 'letters';
  const name = game.getState().teams[team].name;
  box.innerHTML = CONFIG.HELPERS.filter((h) => h.when === 'question')
    .map((h) => {
      const used = game.helperUsed(team, h.id);
      // لمحة can't work when any word is a right answer; تبديل is only for the team that picked the question
      const why = h.id === 'glimpse' && isLetters ? 'غير متاح في هذه الفئة' : h.id === 'swap' && cur.stage === 'steal' ? 'غير متاح عند السرقة' : '';
      return `<button type="button" class="btn q-helper" data-helper="${h.id}" data-team="${team}" ${used || why ? 'disabled' : ''}
        aria-label="${esc(`${h.name} لفريق ${name}: ${h.desc}${used ? ' (مُستخدم)' : why ? ` (${why})` : ''}`)}" title="${esc(h.desc)}">${ICONS[h.id]}<span>${esc(h.name)}</span></button>`;
    })
    .join('');
}

$('#q-helpers').addEventListener('click', async (e) => {
  const b = e.target.closest('.q-helper');
  const cur = game.getState()?.current;
  if (!b || b.disabled || !cur || cur.stage === 'revealed') return;
  const team = Number(b.dataset.team);
  if (b.dataset.helper === 'swap') {
    b.disabled = true;
    const slot = CONFIG.BOARD.find((s) => s.points === cur.points);
    const q = await pickReplacement(cur.catId, slot.difficulty, game.boardQuestionIds());
    if (!q) {
      b.disabled = false;
      return toast('لا يوجد سؤال بديل في هذه الفئة الآن');
    }
    if (!game.useHelper(team, 'swap')) return;
    sound.helper();
    game.swapQuestion(q.id);
    showQuestionContent(q);
    resetClock();
    toast(`سؤال جديد لـ ${game.getState().teams[team].name}`);
    return renderQuestionHelpers(team);
  }
  if (!game.useHelper(team, b.dataset.helper)) return;
  sound.helper();
  b.disabled = true;
  if (b.dataset.helper === 'glimpse') {
    const g = $('#q-glimpse');
    g.innerHTML = glimpseHtml(currentQ.answer);
    g.hidden = false;
  }
});

/** "جبل إيفرست" → first letter + one dash per remaining letter, words kept apart */
function glimpseHtml(answer) {
  const clean = String(answer).replace(/\(.*?\)/g, '').replace(/[ً-ْـ]/g, '').trim();
  const words = clean.split(/\s+/);
  const count = words.join('').length;
  const pattern = words
    .map((w, wi) => [...w].map((ch, ci) => (wi === 0 && ci === 0 ? `<b>${esc(ch)}</b>` : '<i></i>')).join(''))
    .join('<span class="gap"></span>');
  return `<span class="visually-hidden">لمحة: تبدأ الإجابة بحرف ${esc(clean[0])} وعدد حروفها ${count}</span>
    <span class="glimpse-pattern" aria-hidden="true">${pattern}</span><span class="glimpse-count" aria-hidden="true">${count} حروف</span>`;
}

// ---------- stopwatch ----------
const elapsedMs = (c) => c.elapsed + (c.since ? Date.now() - c.since : 0);
let clockPaused = null;

function paintClock() {
  const c = game.getState()?.current?.clock;
  if (!c) return;
  const s = Math.floor(elapsedMs(c) / 1000);
  $('#sw-num').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#stopwatch .fill').style.strokeDashoffset = String(60 - (s % 60)); // the ring fills once a minute
  const paused = !c.since;
  if (paused !== clockPaused) {
    clockPaused = paused;
    $('#stopwatch').classList.toggle('is-paused', paused);
    const t = $('#sw-toggle');
    t.innerHTML = paused ? `${ICONS.play}<span>استئناف</span>` : `${ICONS.pause}<span>إيقاف مؤقت</span>`;
    t.setAttribute('aria-label', paused ? 'استئناف الوقت' : 'إيقاف الوقت مؤقتاً');
  }
}

function runClock() {
  stopClock();
  clockPaused = null;
  paintClock();
  clockTimer = setInterval(paintClock, 250);
}

function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

function resetClock() {
  const c = game.getState().current.clock;
  game.setClock({ elapsed: 0, since: c?.since ? Date.now() : null });
  paintClock();
}

$('#sw-reset').innerHTML = `${ICONS.reset}<span>من الصفر</span>`;
$('#sw-toggle').addEventListener('click', () => {
  const c = game.getState()?.current?.clock;
  if (!c) return;
  game.setClock(c.since ? { elapsed: elapsedMs(c), since: null } : { elapsed: c.elapsed, since: Date.now() });
  paintClock();
});
$('#sw-reset').addEventListener('click', resetClock);

// ---------- question media (image / video / audio attached in the admin panel) ----------
function renderMedia(m) {
  const box = $('#q-media');
  const src = esc(m.src);
  box.dataset.type = m.type;
  box.innerHTML =
    m.type === 'video'
      ? `<video src="${src}" controls autoplay playsinline preload="auto"></video>`
      : m.type === 'audio'
        ? `<div class="q-audio">${ICONS.soundOn}<audio src="${src}" controls autoplay preload="auto"></audio></div>`
        : `<img src="${src}" alt="صورة مرفقة بالسؤال">`;
  box.hidden = false;
  // Browsers may block autoplay with sound; the controls stay visible so the host can press play.
  box.querySelector('video, audio')?.play().catch(() => {});
}

function clearMedia() {
  const box = $('#q-media');
  box.querySelectorAll('video, audio').forEach((el) => el.pause());
  box.innerHTML = '';
  box.hidden = true;
}

const mediaPlaying = () => [...$('#q-media').querySelectorAll('video, audio')].some((el) => !el.paused && !el.ended);

function answerHtml(q) {
  const isLetters = catById[q.category]?.type === 'letters';
  const examples = q.examples?.length ? `<span class="ans-examples">أمثلة: ${q.examples.map(esc).join('، ')}</span>` : '';
  const source = q.source ? `<span class="ans-source"><a href="${esc(q.source)}" target="_blank" rel="noopener">المصدر</a></span>` : '';
  if (isLetters) {
    return `<span class="ans-label">أي إجابة صحيحة تُحتسب — القرار للمقدّم</span>${examples || esc(q.answer)}`;
  }
  return `<span class="ans-label">الإجابة</span>${esc(q.answer)}${examples}${source}`;
}

function showAnswer(alreadyAwarded = false) {
  const st = game.getState();
  const cur = st.current;
  if (cur.clock?.since) game.setClock({ elapsed: elapsedMs(cur.clock), since: null }); // freeze the time on the answer
  if (cur.stage !== 'revealed') game.setStage('revealed');
  paintClock();
  stopClock();
  $('#stopwatch').classList.add('is-done');
  $$('#stopwatch button').forEach((b) => (b.disabled = true));
  $('#q-who').classList.remove('is-steal');
  $('#q-helpers').innerHTML = '';
  const ans = $('#q-answer');
  ans.innerHTML = answerHtml(currentQ);
  ans.hidden = false;
  if (currentQ.media?.src && currentQ.media.show === 'answer') renderMedia(currentQ.media);

  if (alreadyAwarded) return showBack();

  const betNote = cur.bet ? ` (رهان ${esc(st.teams[cur.chooser].name)}: ${cur.points * 2} إن أصابوا، وخصم ${cur.points} إن أخطؤوا)` : ` (${cur.points} نقطة)`;
  $('#q-actions').innerHTML = `
    <p class="award-label" id="award-label">من يأخذ النقاط؟${betNote}</p>
    <button type="button" class="btn btn-big btn-t1" data-award="0">${esc(st.teams[0].name)}</button>
    <button type="button" class="btn btn-big btn-t2" data-award="1">${esc(st.teams[1].name)}</button>
    <button type="button" class="btn btn-big btn-ghost" data-award="none">لا أحد</button>`;
  $('#q-actions').addEventListener('click', onAward);
  $('#q-actions [data-award]').focus({ preventScroll: true });
}

function onAward(e) {
  const b = e.target.closest('[data-award]');
  if (!b) return;
  $('#q-actions').removeEventListener('click', onAward);
  const team = b.dataset.award === 'none' ? null : Number(b.dataset.award);
  const st = game.getState();
  const delta = game.scoreChanges(st.current, team);
  game.award(team);
  if (team === null) sound.wrong();
  else sound.correct();
  const parts = delta.map((d, i) => (d ? `${d > 0 ? '+' : '−'}${Math.abs(d)} لـ ${st.teams[i].name}` : '')).filter(Boolean);
  toast(parts.length ? parts.join('، ') : 'لا نقاط لأحد هذه المرة');
  showBack();
}

function showBack() {
  $('#q-actions').innerHTML = `<button type="button" class="btn btn-big" id="btn-back">رجوع</button>`;
  const btn = $('#btn-back');
  btn.focus();
  btn.addEventListener('click', () => {
    const awarded = game.getState().current.awardedTo;
    game.backToBoard();
    if (game.getState().phase === 'winner') renderWinner();
    else renderBoard(awarded ?? null);
  });
}

// ============================================================
//  WINNER
// ============================================================
function renderWinner() {
  const st = game.getState();
  const w = game.winner();
  $('#win-kicker').textContent = w === null ? 'انتهت اللعبة' : 'الفائز';
  const name = $('#win-name');
  name.textContent = w === null ? 'تعادل!' : st.teams[w].name;
  name.style.setProperty('--win-color', w === null ? 'var(--text)' : teamVars(w)[0]);
  $('#win-scores').innerHTML = st.teams
    .map((t, i) => `<div class="win-score" data-team="${i}"><span class="n">${esc(t.name)}</span><span class="s">${t.score}</span></div>`)
    .join('');
  if (!user && !st.guestCounted) {
    // count this finished game against the guest's free games (once)
    st.guestCounted = true;
    game.save();
    try {
      localStorage.setItem(GUEST_KEY, String(guestGamesPlayed() + 1));
    } catch {
      /* ignore */
    }
  }
  show('screen-winner');
  sound.win();
  confetti(w);
}

$('#btn-new').addEventListener('click', () => {
  stopConfetti();
  game.clear();
  resetSetup();
  if (guestBlocked()) {
    paintLogin();
    show('screen-login');
  } else show('screen-setup');
});

let confettiRaf = null;
function confetti(w) {
  const canvas = $('#confetti');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  const colors = w === 1 ? ['#2a6bcf', '#f0bf33', '#8fb3ea', '#ec6142'] : w === 0 ? ['#c92a68', '#f0bf33', '#e88aad', '#1a97aa'] : ['#c92a68', '#2a6bcf', '#f0bf33', '#23996a'];
  const parts = Array.from({ length: reduce ? 40 : 160 }, () => ({
    x: Math.random() * canvas.width,
    y: reduce ? Math.random() * canvas.height : -Math.random() * canvas.height,
    r: (6 + Math.random() * 10) * dpr,
    vy: (1.5 + Math.random() * 3) * dpr,
    vx: (Math.random() - 0.5) * 2 * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.1,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const drawStar = (p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
    ctx.restore();
  };
  stopConfetti();
  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      if (!reduce) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.vr;
        if (p.y > canvas.height + 20) p.y = -20;
      }
      drawStar(p);
    });
    if (!reduce) confettiRaf = requestAnimationFrame(frame);
  };
  frame();
}
function stopConfetti() {
  cancelAnimationFrame(confettiRaf);
  const c = $('#confetti');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

boot();
