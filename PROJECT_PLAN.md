# PROJECT_PLAN — Arabic trivia party game (placeholder name: «ميدان» / Maydan)

This file is the hand-off note. A new session should read it first and continue from **Current status**.

## How to run locally
```
python tools/dev_server.py
```
Then open http://localhost:8080 (game) or http://localhost:8080/review.html (review).
The dev server is like `python -m http.server` but also lets review.html save into data/questions.json (backups go to .work/backups/).

## File map
| File | What it does |
|---|---|
| `index.html` | The game (one page; screens are shown/hidden: login → setup → board → question → winner) |
| `review.html` + `js/review.js` + `css/review.css` | Owner-only question review page (approve / wrong / edit) |
| `js/auth.js` | Sign-in + `isOwner()` (placeholder until step 6: review only works on localhost) |
| `tools/dev_server.py` | Local server with the save endpoint for the review page |
| `css/style.css` | All game styles + design tokens |
| `js/config.js` | **Settings you can change**: timer lengths, owner email, Supabase keys |
| `js/questions.js` | The ONLY module that loads questions. Swap its source to Supabase later for paid packs |
| `js/history.js` | Remembers which questions each player has already played |
| `js/game.js` | Game rules/state (turns, scores, played tiles), saved to localStorage |
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
- `review`: set by the owner on review.html — `"approved"`, `"rejected"`, or missing (= not reviewed). Also `reviewedAt`, `edited`.
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
- [ ] Step 6 — Supabase Google login

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
- NEXT: Step 6 Supabase Google login (user creates the Supabase project + Google OAuth client; guide step by step, never ask for passwords).
- Note: Windows Python can't open files in the long scratchpad path; helper scripts live in `.work/` (gitignored).
