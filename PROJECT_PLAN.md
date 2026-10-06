# PROJECT_PLAN — Arabic trivia party game (placeholder name: «ميدان» / Maydan)

This file is the hand-off note. A new session should read it first and continue from **Current status**.

## How to run locally
```
python tools/dev_server.py
```
Then open http://localhost:8080 (game) or http://localhost:8080/admin.html (admin panel; review.html redirects there).
The dev server is like `python -m http.server` plus a small API used only by admin.html (save questions/trash, upload + compress media with ffmpeg, delete media). Backups of every save go to .work/backups/.

## File map
| File | What it does |
|---|---|
| `index.html` | The game (one page; screens are shown/hidden: login → setup → board → question → winner) |
| `admin.html` + `css/admin.css` + `js/admin/*` | Owner-only admin panel (replaced the review page). User guide: ADMIN_GUIDE.md (Arabic) |
| `js/admin/store.js` | The ONLY module that knows where admin data is saved (local dev server now; add a Supabase backend here later) |
| `js/admin/state.js` | Shared admin state, batched saving (trash first, then questions), confirm popup, toast |
| `js/admin/questions-view.js` | Questions tab (list, filters in URL, quick review, editor, duplicates, delete → trash) + trash tab |
| `js/admin/media.js` | Editor media section (local preview, upload on save, show with question / with answer) |
| `js/admin/categories-view.js` | Categories tab: dashboard (red: <100 total or <6 per level) + add/rename/describe/hide + image |
| `js/admin/io-view.js` | Import CSV/Excel with preview + duplicates; export CSV + JSON backup |
| `js/admin/util.js` | Arabic normalisation, duplicate detection (trigram Dice + containment, answer-aware), ids, CSV |
| `data/trash.json` | Deleted questions (restorable). The game never reads it |
| `media/` | Question media (`<question id>.webp/mp4/mp3`) and `media/categories/<category id>.webp` |
| `templates/` | template.xlsx + template.csv for bulk import (made by `tools/make_templates.py`) |
| `js/auth.js` | Supabase Google sign-in, `getUser()`, `isOwner()` (before config: review works only on localhost) |
| `supabase/schema.sql` | Table `played_questions` + row-level security (user runs it in Supabase SQL editor) |
| `SETUP_LOGIN.md` | Step-by-step guide for the user: Supabase project, Google OAuth client, redirect URLs |
| `tools/dev_server.py` | Local server + admin API. API requires header `X-Admin: 1` and a localhost Origin (blocks other websites) |
| `css/style.css` | All game styles + design tokens |
| `js/config.js` | **Settings you can change**: timer lengths, owner email, Supabase keys |
| `js/questions.js` | The ONLY module that loads questions. Swap its source to Supabase later for paid packs |
| `js/history.js` | Remembers which questions each player has already played |
| `js/game.js` | Game rules/state (turns, scores, played tiles), saved to localStorage |
| `js/categoryArt.js` | Setup-card illustrations (SVG in code) + short category descriptions — rules in ILLUSTRATION_STYLE.md |
| `js/sound.js` | Sound effects (generated in the browser, no audio files) + mute |
| `js/app.js` | Connects the screens to the game logic |
| `data/questions.json` | All questions + category list |
| `tools/build_questions.py` | Source lists for flags/rivals/math/riddles/letters → writes questions.json (keeps existing ids unless `--fresh`) |
| `assets/flags/` | Flag SVGs (flag-icons, MIT licence) |

## Question format (`data/questions.json`)
```json
{ "id": "geo-e-01", "category": "geo", "difficulty": "easy", "points": 200,
  "question": "...", "answer": "...", "examples": [], "image": null,
  "source": "https://...", "verified": true, "note": "" }
```
- `difficulty`: easy=200, medium=400, hard=600.
- `examples`: only for the حروف category (answer is "any correct answer").
- `image`: path to a flag for أعلام الدول.
- `note`: e.g. the Marvel Rivals season a fact was checked in.
- `media` (optional): `{ "type": "image|video|audio", "src": "media/<id>.<ext>", "show": "question|answer", "bytes": n }` (added in the admin panel).
- Also optional: `createdAt`, `editedAt`, `importedAt`.
- Categories may have `description`, `image` (media/categories/...), `hidden: true` (game skips it), `type: "text|letters|flag"`.
- `review`: set by the owner in the admin panel — `"approved"`, `"rejected"`, or missing (= not reviewed). Also `reviewedAt`, `edited`.
- Game uses: `verified === true` AND `review !== "rejected"` (AND `review === "approved"` when `CONFIG.REQUIRE_REVIEW` is true — turn this on before launch).
- The game uses only `verified: true`.

## Design plan (frontend-design skill)
- **Subject**: family/friends game night around a TV, Arabic-speaking audience.
- **Colour**: Night indigo `#1E1650` (background), Deep indigo `#2C2170` (panels), Lilac tile `#F1ECFF`, Saffron `#FFB627` (team 1), Turquoise `#1FC7B3` (team 2), Pomegranate `#FF4F6E` (timer danger / wrong).
- **Type**: Lalezar (chunky Arabic display: points, titles, logo), Readex Pro (body, questions, buttons).
- **Motif**: 8-point star (khatam) from Arabic geometric tiles. Used in the logo, the faint background pattern and the timer.
- **Layout**: the board is a wall of tiles (6 columns). Team panels sit at the top corners and the active team's panel glows. The question screen is full-bleed with a giant question and a star-shaped countdown.
- **Boldness spent on**: the board tiles and the star timer. Everything else stays quiet.

## Build order / status
- [x] Step 0 — skills installed (frontend-design, web-design-guidelines) in ~/.claude/skills
- [x] Step 1 — board with geography (30 verified questions)
- [x] Step 2 — full flow setup → board → question → winner + helpers
- [x] Step 3 — all 6 categories (180 questions, all verified with sources)
- [x] Step 4 — review page
- [x] Step 5 — design polish + web-design-guidelines review
- [~] Step 6 — Supabase Google login: code done & tested with fake config; WAITING for user to create Supabase + Google OAuth (SETUP_LOGIN.md) and paste URL + anon key into js/config.js, then test a real sign-in

## Decisions / open questions
- Helpers chosen by user: الرهان (bet: before opening a tile; right = double, wrong/stolen/nobody = lose the points; stealer gets normal points; can be cancelled before opening), نَفَس (+20s, `BREATHER_SECONDS` in config), لمحة (first letter + dash per letter; text in parentheses is ignored; disabled for حروف).
- Rejected helper ideas: الدرع (no-steal shield), الدور الذهبي (two turns in a row).
- Removed a "Strait of Hormuz" question (the gulf's name is a political dispute). Keep questions away from disputed names/borders.

## Testing tips
- `?data=tests/sample-6cats.json` loads a fake 6-category file (geography copied) so the full board can be tested before real data exists.
- `tests/load-state.html?state=board|question|winner&data=...` jumps straight to a screen using `tests/states/*.json`.
- Screenshots: the in-app browser pane was tiny (400x225), so headless Edge was used:
  `msedge --headless=new --window-size=1280,720 --virtual-time-budget=4000 --screenshot=out.png <url>`
- In the console you can shorten timers: `(await import('/js/config.js')).CONFIG.ANSWER_TIME = 2`

## Current status
(updated after every step)
- Owner review finished: all 180 approved, 57 edited by the owner (owner chose to keep every edit exactly as written, in the same categories — do NOT change questions). REQUIRE_REVIEW is now true.
- 2026-10-04: Steps 1–2 done (minus helpers). Tested: setup validation, board, timers (answer → steal → auto reveal), إنهاء, award, رجوع + turn change, greyed tiles, full 36-question game → winner, no-repeat history.
- When the steal timer also runs out, the answer is shown automatically (host still picks who gets points).
- Helpers built & tested (bet double/lose, breather +20, glimpse pattern).
- Step 3 done: 180 questions. How each category was verified:
  - flags: flag-icons (MIT) SVGs in assets/flags; ISO codes checked against flag-icons country.json; look-alike notes checked on Wikipedia.
  - rivals: Wikipedia + marvelrivals.fandom.com via its API (`.work/mr.py`; the normal web page returns HTTP 402). Avoided team-up names (they rotate per season). Every question notes "checked in Season 10, Oct 2026".
  - math: answers computed by the build script.
  - riddles: answers matched on mawdoo3.com / sayidaty.net collections; dropped riddles with disputed answers (comb vs zipper). Letter-trick riddles checked by code.
  - letters: every example checked to exist on Arabic Wikipedia (`.work/wiki.py`).
- Step 4 done: review page tested (approve/reject/undo/edit, saves to file, rejected questions leave the game, filters, progress bar).
- Owner check: before Supabase exists, review.html opens only on localhost. After step 6 it requires the owner's Google account. NOTE: questions.json is a public file, so this check hides the editor, it does not hide the questions; paid questions must come from Supabase with row-level security.
- The in-app preview tool reads launch.json from the session's ORIGINAL scratch folder; it was updated to run tools/dev_server.py.
- Step 5 done (web-design-guidelines review, fixes): one visible <main> at a time (hidden attr), safe-area padding for phone notches, translate="no" on the game name, mute button keeps one label + aria-pressed, focus moves to إنهاء / award buttons, long team names truncate/wrap, text-wrap: balance on headings, flag image height fix on phones, review page: content-visibility for 180 cards, filters in URL, leave-page warning, scroll-margin under sticky header, flag alt text.
- Headless Edge has a minimum window width (~500px), so phone screenshots must be taken in the in-app browser with resize_window preset "mobile".
- Step 6 code: auth.js loads supabase-js from jsdelivr only when configured; login screen shows Google button / welcome + sign out; guest limit (GUEST_FREE_GAMES=1, counted when a guest reaches the winner screen, only enforced when Supabase is configured); history synced to Supabase for signed-in users; review gate with sign-in button.
- Tested: without config (unchanged behaviour) and with FAKE config (guest blocked after 1 game, new game → login, review gate shows sign-in). Real Google round trip NOT tested yet (needs the user's Supabase project).
- NEXT: user follows SETUP_LOGIN.md → paste URL + anon key → test real sign-in (the Cloudflare URL is already written into SETUP_LOGIN.md).
- PUBLISHED 2026-10-04: repo https://github.com/sohatshy/trivia-game (public — the owner decided to KEEP IT PUBLIC; do not make it private).
- HOSTING 2026-10-06: Cloudflare Pages https://trivia-game-1br.pages.dev (connected to GitHub main, no build command, output "/"; every push redeploys). Cloudflare shortens /admin.html → /admin (308), which works. The old GitHub Pages site https://sohatshy.github.io/trivia-game/ is still on too (also updates on every push).
  - GitHub CLI installed at C:\Program Files\GitHub CLI\gh.exe, logged in as sohatshy (keyring). Always ask the user before pushing.
  - Before the first push the history was rewritten: commit emails → 266081240+sohatshy@users.noreply.github.com, and the Gmail removed from old js/config.js versions (owner check now uses OWNER_EMAIL_SHA256). Pre-rewrite backup: .work/before-rewrite.bundle (local only). Never commit the Gmail address.
- Later ideas: review verdicts saved to Supabase when online; paid packs from Supabase (questions.js is the only loader); daily video generator from questions.json.
- Note: Windows Python can't open files in the long scratchpad path; helper scripts live in `.work/` (gitignored).
- 2026-10-05: setup cards became picture cards (illustration + name + "i" description button). Rules for new drawings: ILLUSTRATION_STYLE.md. Test page: tests/setup-preview.html. Checked at 1920×1080, 1280×720 and phone 375px.
- 2026-10-06: ADMIN PANEL built (6 commits "Admin part 1..5" + docs). Tested in the browser with test questions, all removed afterwards; data/questions.json verified byte-identical to before (sha256 in .work/questions-before-admin.sha256).
  - Rules: saving an edit clears `verified` unless re-ticked; deleted questions go to data/trash.json; ids never reused (nextId checks trash too); media uploaded only on save (rejected >15 MB after compression → nothing saved).
  - Live site: admin.html shows a lock screen unless on localhost (and later: Supabase owner). The static host has no API, so nothing can be written there. Tested with headless Edge + --host-resolver-rules "MAP fakelive.test 127.0.0.1".
  - Pushed to GitHub 2026-10-06 (live admin.html shows the lock screen; checked).
  - Later: implement a Supabase backend in js/admin/store.js (tables for questions/categories/trash + Storage bucket for media), and make the game's js/questions.js read from Supabase.
- Copyright: footer "© 2026 Sohatshy. All rights reserved." on login/setup/winner screens (hidden on board/question). LICENSE = all rights reserved, with third-party exceptions (flag-icons MIT in assets/flags/LICENSE.txt must stay; fonts/SheetJS/supabase-js loaded from CDNs).
- "نشر التحديثات" button (admin header): GET /api/publish compares data/questions.json, data/trash.json and media/ on this computer with origin/main (after git fetch) → added/edited/deleted questions, category and media changes, other unpushed commits. POST /api/publish stages ONLY those content paths, commits "Publish content update (+a ~e -d questions)" and pushes HEAD:main. git errors are translated to Arabic (explain_git_error). Tested against a local practice remote (PUBLISH_REMOTE env var / clone pointing at a bare repo): happy path, rejected push, missing repo, no internet. CONFIG.SITE_URL is the link shown after publishing (update it when hosting moves).

