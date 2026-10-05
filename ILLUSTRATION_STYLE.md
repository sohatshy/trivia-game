# Category illustration style

Every category card on the setup page has a small picture. Follow these rules for every new
category so all the cards look like one set. The drawings live in `js/categoryArt.js`.

## Canvas
- SVG, `viewBox="0 0 160 100"`, drawn in code (no image files, no traced artwork).
- It sits on a lilac plate (`--tile`, `#f1ecff`) with rounded corners, made by CSS, not by the SVG.
  The plate is 16:10 (2:1 on short laptop/TV screens), so keep the important shapes inside
  **x 16–144, y 6–88** so nothing gets cut off.
- Mark it decorative: `aria-hidden="true" focusable="false"`. The category name below the picture is the label.

## Outlines
- Every shape has a dark outline: `stroke="#1e1650"` (the game's night colour; never pure black),
  `stroke-width="4"`, round joins and round caps. Use the `OUT` attributes from `categoryArt.js`.
- Small details (dots, inner stripes, the signature star): `stroke-width` 2–3.
- Thick lines without a fill (like the question mark): draw the line twice, first in ink at
  width ~17, then in colour at width ~9 on top. This gives the same outlined look.

## Colours (only these)
| Name | Hex | Use |
|---|---|---|
| ink | `#1e1650` | outlines, small dark details |
| night | `#2c2170` | rare dark fills |
| paper | `#fbf9ff` | white parts, snow, highlights |
| lilac | `#d6c9ff` | ground shadow, secondary fills |
| saffron | `#ffb627` | main accent (team 1 colour) |
| teal | `#1fc7b3` | main accent (team 2 colour) |
| rose | `#ff4f6e` | main accent |
- Flat fills only: no gradients, no textures, no drop shadows inside the SVG.
- Use at most the 3 accents (saffron, teal, rose) plus paper/lilac per picture.

## Shapes
- 1 to 3 main objects, big and simple, readable from across a room on a TV.
- Slight playful tilt (±4–10°) on tiles and cards is welcome. Keep everything else upright.
- **No faces** (no eyes or mouths on anything), no people, no hands.
- Text is allowed only when it *is* the subject (digits for math, Arabic letters for حروف),
  in the Lalezar font, ink colour, no outline.

## Every picture has these two
1. **Ground shadow**: a lilac ellipse at `cy="92"`, `ry="5"`, under the main object (added by `canvas()`).
2. **Signature star**: the game's small saffron 8-point star (`starPoints(x, y, 9, 5.5)`), placed
   in an empty corner (added by `canvas()`; move it with the `star` option).

## Not allowed
- Real people or recognisable characters (including Marvel, game, film or cartoon characters).
- Logos, brand marks, product shapes that belong to a company, or real controllers' exact designs.
- Real countries' flags or designs close to one. Use dots, corner squares or stars, not plain
  stripes, bands or a single disc, because those match real flags.
- Religious or political symbols.
- Copying or tracing another game's illustrations.

## Adding a new category
1. Add the category to `data/questions.json` (via `tools/build_questions.py`).
2. In `js/categoryArt.js`, add a drawing under the same id in `ART` using `canvas(...)`,
   and a one-line Arabic description in `DESC` (what kind of questions, in plain words).
3. Until a drawing exists, the card shows the fallback (a big saffron star), so nothing breaks.
4. Check it on the setup page at phone size and at 1280×720 / 1920×1080
   (`tests/setup-preview.html` opens setup with some cards picked and one description open).

## Current drawings
| Category | Drawing |
|---|---|
| جغرافيا | teal globe with saffron land, a lilac mountain with a snow cap, a teal river |
| أعلام الدول | three invented waving flags on poles (teal with saffron dots, rose with a lilac corner, lilac with a teal star) |
| مارفل رايفلز | rose shield with a saffron lightning bolt, behind a white game controller (generic hero idea, no Marvel art) |
| رياضيات | tilted saffron tile with "7", teal "+" circle, rose "÷" tile, and an "=" sign |
| ألغاز | big rose question mark and a saffron light bulb with rays |
| حروف | three tilted letter tiles spelling حرف (rose ف, teal ر, saffron ح) |
