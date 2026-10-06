// ============================================================
//  Admin panel shell: access check, loading, tabs.
//  Each tab lives in its own module (questions, categories, import/export).
// ============================================================

import { CONFIG } from '../config.js';
import { ICONS } from '../icons.js';
import { isOwner } from '../auth.js';
import * as store from './store.js';
import { $, $$, state, isDirty, flush } from './state.js';
import * as questions from './questions-view.js';
import * as categories from './categories-view.js';
import * as io from './io-view.js';

const views = { questions, categories, io };

async function boot() {
  $$('[data-icon]').forEach((el) => (el.outerHTML = ICONS[el.dataset.icon]));
  $$('[data-game-name]').forEach((el) => (el.textContent = CONFIG.GAME_NAME));

  // 1) Who? Only the owner (before Supabase login exists: only on this computer).
  // 2) Where to save? Needs a backend (today: the local dev server).
  const conn = await store.connect();
  if (!(await isOwner()) || conn.mode === 'none') {
    $('#gate-msg').textContent = conn.reason || 'هذه الصفحة لصاحب اللعبة فقط.';
    $('#gate').hidden = false;
    return;
  }

  try {
    Object.assign(state, await store.loadAll());
  } catch (err) {
    $('#gate-msg').textContent = err.message;
    $('#gate').hidden = false;
    return;
  }

  $('#app').hidden = false;
  for (const v of Object.values(views)) v.init?.();
  setupTabs();
  window.addEventListener('beforeunload', (e) => {
    if (isDirty() || document.querySelector('dialog[open]#editor')) e.preventDefault();
  });
  // save immediately when the tab is hidden (e.g. closing the laptop)
  document.addEventListener('visibilitychange', () => document.hidden && isDirty() && flush());
}

// ---------------------------------------------------------------- tabs
function setupTabs() {
  const tabs = $$('[role="tab"]');
  const select = (tab, focus = true) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (focus) tab.focus();
    const name = tab.id.replace('tab-', '');
    views[name]?.show?.();
    const u = new URL(location.href);
    u.searchParams.set('tab', name);
    history.replaceState(null, '', u);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      // RTL: ArrowLeft moves to the next tab, ArrowRight to the previous one
      const step = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
      if (step) select(tabs[(i + step + tabs.length) % tabs.length]);
      if (e.key === 'Home') select(tabs[0]);
      if (e.key === 'End') select(tabs[tabs.length - 1]);
    });
  });
  const start = new URLSearchParams(location.search).get('tab');
  select($(`#tab-${start}`) || tabs[0], false);
}

boot();
