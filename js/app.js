// ============================================================
//  App: connects the screens (HTML) to the game rules (game.js).
// ============================================================

import { CONFIG } from './config.js';
import { ICONS, starPoints } from './icons.js';
import { getCategories, getPlayableCategories, getQuestionById } from './questions.js';
import * as game from './game.js';
import { sound } from './sound.js';
import * as auth from './auth.js';
import { setPlayer } from './history.js';
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
    categories = await getCategories();
    catById = Object.fromEntries(categories.map((c) => [c.id, c]));
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
  stopTimer();
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

// ============================================================
//  SETUP
// ============================================================
const picks = [[], []];

function initSetup() {
  $$('.team-setup').forEach((section) => {
    const team = Number(section.dataset.team);
    const grid = $('.cat-grid', section);
    grid.innerHTML = categories
      .map((c) => {
        const ready = playableIds.has(c.id);
        const descId = `desc-${team}-${c.id}`;
        // The "i" button is a sibling of the pick button (a button can't contain another button)
        return `<div class="cat-card" data-cat="${c.id}">
          <button type="button" class="cat-chip" data-cat="${c.id}" aria-pressed="false" ${ready ? '' : 'disabled'}>
            <span class="cat-art">${artFor(c.id)}</span>
            <span class="cat-name">${esc(c.name)}</span>
            <span class="taken-by">${ready ? '' : 'قريباً'}</span>
          </button>
          <button type="button" class="cat-info" aria-expanded="false" aria-controls="${descId}" aria-label="عن فئة ${esc(c.name)}">i</button>
          <p class="cat-desc" id="${descId}" role="note" hidden>${esc(descFor(c.id))}</p>
        </div>`;
      })
      .join('');
    grid.addEventListener('click', (e) => {
      const info = e.target.closest('.cat-info');
      if (info) return toggleInfo(info);
      const chip = e.target.closest('.cat-chip');
      if (!chip || chip.disabled) return;
      togglePick(team, chip.dataset.cat);
    });
  });
  $('#setup-form').addEventListener('submit', startGame);
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

function togglePick(team, catId) {
  const mine = picks[team];
  const other = picks[1 - team];
  $('#setup-error').textContent = '';
  if (mine.includes(catId)) {
    mine.splice(mine.indexOf(catId), 1);
  } else if (other.includes(catId)) {
    return;
  } else if (mine.length >= CONFIG.CATEGORIES_PER_TEAM) {
    $('#setup-error').textContent = 'كل فريق يختار 3 فئات فقط. ألغِ واحدة أولاً.';
    return;
  } else {
    mine.push(catId);
  }
  paintPicks();
}

function paintPicks() {
  $$('.team-setup').forEach((section) => {
    const team = Number(section.dataset.team);
    $('[data-count]', section).textContent = picks[team].length;
    $$('.cat-chip', section).forEach((chip) => {
      const id = chip.dataset.cat;
      if (!playableIds.has(id)) return;
      const mine = picks[team].includes(id);
      const taken = picks[1 - team].includes(id);
      chip.setAttribute('aria-pressed', String(mine));
      chip.classList.toggle('is-taken', taken);
      chip.closest('.cat-card').classList.toggle('is-taken', taken);
      chip.disabled = taken;
      $('.taken-by', chip).textContent = taken ? 'اختارها الفريق الآخر' : '';
    });
  });
}

function resetSetup() {
  picks[0].length = 0;
  picks[1].length = 0;
  $('#setup-error').textContent = '';
  paintPicks();
}

async function startGame(e) {
  e.preventDefault();
  const names = [
    $('#t0-name').value.trim() || 'الفريق الأول',
    $('#t1-name').value.trim() || 'الفريق الثاني',
  ];
  if (names[0] === names[1]) {
    $('#setup-error').textContent = 'اختاروا اسمين مختلفين للفريقين.';
    $('#t1-name').focus();
    return;
  }
  const n = CONFIG.CATEGORIES_PER_TEAM;
  if (picks[0].length !== n || picks[1].length !== n) {
    const who = picks[0].length !== n ? names[0] : names[1];
    $('#setup-error').textContent = `${who}: اختاروا ${n} فئات.`;
    return;
  }
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
//  BOARD
// ============================================================
function renderTeamPanels(bumpTeam = null) {
  const st = game.getState();
  $$('.team-panel').forEach((panel) => {
    const i = Number(panel.dataset.team);
    const t = st.teams[i];
    panel.classList.toggle('is-turn', st.turn === i);
    panel.innerHTML = `
      <span class="team-name">${esc(t.name)}</span>
      <span class="helpers" role="group" aria-label="مساعدات ${esc(t.name)}">${CONFIG.HELPERS.map((h) => boardHelperHtml(i, h)).join('')}</span>
      <span class="team-score${bumpTeam === i ? ' bump' : ''}" aria-label="نقاط ${esc(t.name)}">${t.score}</span>`;
  });
  const [color, ink] = teamVars(st.turn);
  const pill = $('#turn-pill');
  pill.style.setProperty('--turn-color', color);
  pill.style.setProperty('--turn-ink', ink);
  pill.textContent = `الدور على: ${st.teams[st.turn].name}`;
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
    aria-label="${esc(`${h.name}: ${h.desc}${note ? ` (${note})` : ''}`)}" title="${esc(`${h.name}: ${h.desc}`)}">${ICONS[h.id]}</button>`;
}

$('.topbar').addEventListener('click', (e) => {
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
  const board = $('#board');
  board.innerHTML = st.categories
    .map((catId) => {
      const cat = catById[catId];
      const tiles = st.board[catId];
      const rows = [];
      for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2).map((t, k) => tileHtml(cat, t, i + k)).join(''));
      return `<section class="board-col" aria-label="${esc(cat.name)}">
        <h2 class="col-head" data-owner="${game.ownerOf(catId)}">${ICONS[cat.icon] || ''}<span>${esc(cat.name)}</span></h2>
        ${rows.map((r) => `<div class="tile-row">${r}</div>`).join('')}
      </section>`;
    })
    .join('');
  show('screen-board');
}

function tileHtml(cat, t, index) {
  const label = t.played ? `${cat.name} ${t.points} — تم لعبه` : `${cat.name}، ${t.points} نقطة`;
  return `<button type="button" class="tile${t.played ? ' is-played' : ''}" data-cat="${cat.id}" data-index="${index}"
    data-points="${t.points}" ${t.played ? `disabled data-won="${t.wonBy ?? ''}"` : ''} aria-label="${esc(label)}">${t.points}</button>`;
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
// ============================================================
let timer = null;
let currentQ = null;

const STAR = starPoints(100, 100, 100, 78);
$('#timer .track').setAttribute('points', STAR);
$('#timer .fill').setAttribute('points', STAR);

async function openQuestion(resumed = false) {
  const st = game.getState();
  const cur = st.current;
  const q = await getQuestionById(cur.qid);
  currentQ = q;
  const cat = catById[cur.catId];

  $('#q-cat').textContent = cat.name;
  $('#q-points').textContent = cur.points;
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
  $('#q-bet').hidden = !cur.bet;
  const answering = cur.stage === 'steal' ? 1 - cur.chooser : cur.chooser;
  $('#screen-question').dataset.team = answering;
  $('#q-who').textContent = `${cur.stage === 'steal' ? 'فرصة سرقة' : 'يجيب'}: ${st.teams[answering].name}`;
  show('screen-question');

  if (cur.awardedTo !== undefined) return showAnswer(true);
  if (cur.stage === 'revealed') return showAnswer();
  if (cur.stage === 'steal') return startStage('steal');
  startStage('answer');
}

function startStage(stage) {
  const st = game.getState();
  const cur = st.current;
  game.setStage(stage);
  const team = stage === 'answer' ? cur.chooser : 1 - cur.chooser;
  const seconds = stage === 'answer' ? CONFIG.ANSWER_TIME : CONFIG.STEAL_TIME;
  const screen = $('#screen-question');
  screen.dataset.team = team;
  const who = $('#q-who');
  who.textContent = stage === 'answer' ? `يجيب: ${st.teams[team].name}` : `فرصة سرقة: ${st.teams[team].name}`;
  who.classList.toggle('is-steal', stage === 'steal');
  renderQuestionHelpers(team);

  $('#q-actions').innerHTML = `<button type="button" class="btn btn-big" id="btn-end">إنهاء وإظهار الإجابة</button>`;
  if (!document.activeElement?.closest('#q-helpers')) $('#btn-end').focus({ preventScroll: true });
  $('#btn-end').addEventListener('click', () => {
    stopTimer();
    showAnswer();
  });

  runTimer(seconds, () => {
    sound.timeUp();
    if (stage === 'answer') {
      toast(`انتهى الوقت! فرصة ${st.teams[1 - cur.chooser].name} للسرقة`);
      startStage('steal');
    } else {
      showAnswer();
    }
  });
}

function renderQuestionHelpers(team) {
  const box = $('#q-helpers');
  const isLetters = catById[currentQ.category]?.type === 'letters';
  const name = game.getState().teams[team].name;
  box.innerHTML = CONFIG.HELPERS.filter((h) => h.when === 'question')
    .map((h) => {
      const used = game.helperUsed(team, h.id);
      const blocked = h.id === 'glimpse' && isLetters;
      const label = h.id === 'breather' ? `${h.name} +${CONFIG.BREATHER_SECONDS}ث` : h.name;
      return `<button type="button" class="btn q-helper" data-helper="${h.id}" data-team="${team}" ${used || blocked ? 'disabled' : ''}
        aria-label="${esc(`${label} لفريق ${name}: ${h.desc}${used ? ' (مُستخدم)' : blocked ? ' (غير متاح في هذه الفئة)' : ''}`)}">${ICONS[h.id]}<span>${esc(label)}</span></button>`;
    })
    .join('');
}

$('#q-helpers').addEventListener('click', (e) => {
  const b = e.target.closest('.q-helper');
  if (!b || b.disabled || !timer) return;
  const team = Number(b.dataset.team);
  if (!game.useHelper(team, b.dataset.helper)) return;
  sound.helper();
  b.disabled = true;
  if (b.dataset.helper === 'breather') {
    addTime(CONFIG.BREATHER_SECONDS);
    toast(`+${CONFIG.BREATHER_SECONDS} ثانية لـ ${game.getState().teams[team].name}`);
  } else if (b.dataset.helper === 'glimpse') {
    const g = $('#q-glimpse');
    g.innerHTML = glimpseHtml(currentQ.answer);
    g.hidden = false;
  }
});

/** "جبل إيفرست" → first letter + one dash per remaining letter, words kept apart */
function glimpseHtml(answer) {
  const clean = String(answer).replace(/\(.*?\)/g, '').replace(/[\u064B-\u0652\u0640]/g, '').trim();
  const words = clean.split(/\s+/);
  const count = words.join('').length;
  const pattern = words
    .map((w, wi) => [...w].map((ch, ci) => (wi === 0 && ci === 0 ? `<b>${esc(ch)}</b>` : '<i></i>')).join(''))
    .join('<span class="gap"></span>');
  return `<span class="visually-hidden">لمحة: تبدأ الإجابة بحرف ${esc(clean[0])} وعدد حروفها ${count}</span>
    <span class="glimpse-pattern" aria-hidden="true">${pattern}</span><span class="glimpse-count" aria-hidden="true">${count} حروف</span>`;
}

let endAt = 0;
let timerTotal = 0;

function addTime(seconds) {
  endAt += seconds * 1000;
  timerTotal += seconds;
}

function runTimer(total, onEnd) {
  stopTimer();
  const el = $('#timer');
  const num = $('#timer-num');
  const fill = $('#timer .fill');
  el.classList.remove('is-low', 'is-done');
  endAt = Date.now() + total * 1000;
  timerTotal = total;
  let last = null;

  // jump the ring to full instantly, then let CSS animate each second
  fill.style.transition = 'none';
  fill.style.strokeDashoffset = '0';
  fill.getBoundingClientRect();
  fill.style.transition = '';

  const step = () => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (left !== last) {
      last = left;
      num.textContent = left;
      fill.style.strokeDashoffset = String(100 * (1 - Math.max(0, left - 1) / timerTotal));
      const low = left <= CONFIG.TICK_WARNING_AT;
      el.classList.toggle('is-low', low && left > 0);
      if (left > 0) sound.tick(low);
    }
    if (left <= 0) {
      stopTimer();
      el.classList.add('is-done');
      onEnd();
    }
  };
  step();
  timer = setInterval(step, 200);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

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
  stopTimer();
  const st = game.getState();
  const cur = st.current;
  if (cur.stage !== 'revealed') game.setStage('revealed');
  $('#timer').classList.add('is-done');
  $('#q-who').classList.remove('is-steal');
  $('#q-helpers').innerHTML = '';
  const ans = $('#q-answer');
  ans.innerHTML = answerHtml(currentQ);
  ans.hidden = false;

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
  const colors = w === 1 ? ['#1fc7b3', '#f1ecff', '#7fe8da'] : w === 0 ? ['#ffb627', '#f1ecff', '#ffd77a'] : ['#ffb627', '#1fc7b3', '#f1ecff'];
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
