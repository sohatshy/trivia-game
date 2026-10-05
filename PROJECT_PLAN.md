# PROJECT_PLAN — Arabic trivia party game (placeholder name: «ميدان» / Maydan)

This file is the hand-off note. A new session should read it first and continue from **Current status**.

## How to run locally
```
python -m http.server 8080
```
Then open http://localhost:8080 (the app uses ES modules + fetch, so it must be served, not opened as a file).

## File map
| File | What it does |
|---|---|
| `index.html` | The game (one page; screens are shown/hidden: login → setup → board → question → winner) |
| `review.html` | Owner-only question review page |
| `css/style.css` | All game styles + design tokens |
| `js/config.js` | **Settings you can change**: timer lengths, owner email, Supabase keys |
| `js/questions.js` | The ONLY module that loads questions. Swap its source to Supabase later for paid packs |
| `js/history.js` | Remembers which questions each player has already played |
| `js/game.js` | Game rules/state (turns, scores, played tiles), saved to localStorage |
| `js/sound.js` | Sound effects (generated in the browser, no audio files) + mute |
| `js/app.js` | Connects the screens to the game logic |
| `data/questions.json` | All questions + category list |
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
- [~] Step 2 — full flow setup → board → question → winner ✅ done & tested; helpers NOT built yet (waiting for user's pick)
- [ ] Step 3 — all 6 categories (180 questions)
- [ ] Step 4 — review page
- [ ] Step 5 — design polish + web-design-guidelines review
- [ ] Step 6 — Supabase Google login

## Decisions / open questions
- Helpers: 5 ideas proposed, waiting for the user to pick 3.
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
- NEXT: build helpers once the user picks 3 of the 5 ideas, then Step 3 (other 5 categories).
