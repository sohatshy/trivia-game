# Category picture style

Every category has one small picture. It appears in three places: the draft cards, the team
slots, and the middle of each board card. Follow these rules so a new category looks like part of
the same set. The drawings live in `js/categoryArt.js`.

## The look in one line
A simple duotone line icon: dark plum lines plus **one** filled accent shape in the category's
own colour, sitting in a round badge.

## Canvas
- SVG, `viewBox="0 0 48 48"`, drawn in code with the `icon(accent, line)` helper (no image files,
  no traced artwork). Keep shapes inside **x 6–42, y 6–42**; the badge is a circle, so corners get cut.
- Mark it decorative: `aria-hidden="true" focusable="false"`. The category name is the label.

## Lines
- One line colour only: `currentColor` (the game's plum text colour `#45293a`), never black.
- `stroke-width="2.25"`, round caps, round joins, no fill (the `LINE` attributes in `categoryArt.js`).
- Tiny dots (buttons, the dot of a question mark): a small circle with `fill="currentColor"`.

## The accent shape
- Exactly **one** filled shape (or a small group that reads as one), drawn *behind* the lines.
- Fill `var(--accent)`. The game sets `--accent` to the category's colour, so the same drawing
  turns orange, green, purple… automatically. Never hard-code a colour inside the SVG.
- For a soft glow (like the bulb glass) use the accent with `opacity=".35"`.

## Category colours (set by the game, not by the drawing)
Each category gets one of six warm colours from `css/style.css`, by its place in the category list
(the 7th category starts again at colour 1):

| # | Name | Hex | Text on it |
|---|---|---|---|
| 1 | tomato | `#ec6142` | light |
| 2 | tangerine | `#ee9b34` | dark |
| 3 | grape | `#8655d8` | light |
| 4 | leaf | `#23996a` | light |
| 5 | sun | `#f0bf33` | dark |
| 6 | lagoon | `#1a97aa` | light |

Where the colour shows:
- **Draft card**: the whole card is the category colour; the picture sits in an off-white badge.
- **Board card**: the card stays off-white. The colour appears only on the name strip and as a
  light tint and ring around the picture. Question buttons are never filled with it.
- Team colours (berry `#c92a68` with a circle, cobalt `#2a6bcf` with a diamond) are never used in
  category pictures.

## Shapes
- 1 or 2 main objects, big and simple, readable from across a room on a TV.
- **No faces** (no eyes or mouths), no people, no hands.
- Text only when it *is* the subject (digits for math, the letter ح for حروف), drawn as lines.

## Not allowed
- Real people or recognisable characters (including Marvel, game, film or cartoon characters).
- Logos, brand marks, or the exact design of a real product.
- Real countries' flags or designs close to one.
- Religious or political symbols.
- Copying or tracing another game's illustrations.

## Uploaded pictures
A category can also get an uploaded image in the admin panel (Categories tab). It is shown cropped
to a circle in the same badge, so pick a picture whose subject sits in the middle. Warm, flat,
simple images match best.

## Adding a new category
1. Add the category in the admin panel (or `data/questions.json`).
2. In `js/categoryArt.js`, add a drawing under the same id in `ART` with `icon(accent, line)`,
   and a one-line Arabic description in `DESC` (what kind of questions, in plain words).
3. Until a drawing exists, the card shows the fallback (a diamond in a rounded square), so nothing breaks.
4. Check it on the draft page (`tests/setup-preview.html`) and on the board
   (`tests/load-state.html?state=board-mid`) at 1920×1080, 1366×768 and phone size.

## Current drawings
| Category | Drawing (accent in brackets) |
|---|---|
| جغرافيا | globe with meridian lines (land masses) |
| أعلام الدول | flag on a pole (upper half of the flag) |
| مارفل رايفلز | generic game controller (lightning bolt above it) |
| رياضيات | grid of + − × = signs (the + square) |
| ألغاز | light bulb with a question mark (glowing glass) |
| حروف | letter tile with ح (one corner) |
