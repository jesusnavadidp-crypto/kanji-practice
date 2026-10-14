# Kanji Radicals

A minimal, static, offline-first app for drilling Japanese radicals and kanji:

- **Radicals** tab — all 253 KRADFILE/RADKFILE radicals grouped by stroke count;
  within a group, radicals that are also kanji come first by RTK number.
- **Kanji** tab — kanji you've unlocked, grouped by JLPT level ascending (N5 → N1,
  then untagged), and ordered by RTK (Heisig 6th ed.) number within each group
  (kanji without one go last, by code point). Toggle "Show all kanji" to browse everything, ~12,150 entries.
  Search matches an exact character, or as a substring against its
  on'yomi/kun'yomi readings or English meaning.
- Click any character to open its detail sheet: the **Studying** switch (top-left
  of the sheet, no label), the character (with its `RTK #N` when it has one), an animated stroke-order diagram (tap it to replay) in its own
  card, a merged readings card (concept/kun'yomi/on'yomi, when known), sub-components (if any, drill in recursively — a horizontal scroll
  row, not a wrapping grid), and a Jisho link. For a kanji it also shows the two
  SRS track lines, a per-kanji description (one line, up to 30 words, live
  counter) and, right under it, an optional RTK keyword and an RTK number override
  (empty = the KANJIDIC2 number shown as its placeholder). From the Kanji tab, move to the next/previous kanji without closing
  it via the arrow buttons (desktop), a swipe, or the ←/→ keys.
- **Studying switch** (replaces the old rank scale; lives only in the detail sheet) — a plain on/off flag per
  character. It alone decides what is shown and unlocked; it is decoupled from
  SRS. Not studying means never reviewed or tested.
- **Unlock rule** — a kanji shows up in the default Kanji view once every one of
  its components is being studied. Radicals that are themselves standalone kanji
  (水, 木, 人, ...) have no sub-components, so they unlock on their own flag.
- **SRS Review** (in the ☰ menu) — every studying kanji has two tracks:
  Meaning (kanji → meaning) and Writing (keyword or meaning → kanji). Steps default to
  1·3·7·14·30·60 days (configurable): ✓ moves up one step, ✗ goes back to 0 and the
  card is re-queued. A card is
  due by calendar day, not by hour. The session ends with a "done for today" report.
- **Practice Test** (in the ☰ menu) — free draw from your studying kanji, weighted
  by SRS band (new/mid/mature). It never changes SRS.
- **RTK keyword and number** — per kanji, both optional. The number you enter
  replaces the KANJIDIC2 one everywhere (detail subtitle, card corner, and the
  Radicals/Kanji ordering). On the Writing front the keyword, when set, is the
  large prompt (meanings and readings are left off; the Hint button stays); on the
  Meaning back it appears as a small line above the meanings.
- **Card behavior** (shared by both) — a small `#N` RTK number sits in the card's
  top-right corner when the kanji has one; the front offers only ✓ (I knew it); tap
  to reveal below the front, then ✗ and ✓ are both available. The back shows the
  glyph as written beside the stroke-order canvas, plus your description.
- **Header counters** — two compact badges left of ☰: kanji activated today (a
  plain count, no goal) and reviews due (tap to open SRS Review), plus a dot on ☰
  while reviews are pending.
- **Configurations** (in the ☰ menu) — the SRS steps editor (add/remove steps, 1–12
  steps of 1–365 days, strictly increasing; nothing is stored until Save, "Reset to
  default" restores 1·3·7·14·30·60), practice weights by band, and "Convert old
  progress file" for pre-SRS progress files. Changing the ladder never moves existing
  schedules: it applies from the next review, and a level above a shortened ladder
  counts as its last step.
- **AI Text** (in the ☰ menu) — builds a writing-practice prompt for an LLM
  from your studying kanji, with a topic/length/chapter count form and a
  one-click Copy to Clipboard.

On mobile, Radicals/Kanji live in a bottom tab bar (swipe left/right to move
between them) instead of competing with the title for header space; SRS Review,
Practice Test and AI Text are menu-triggered, full-screen destinations rather
than primary tabs, so they don't fight over that footer space with the other two.

Chip colors: a single blue scale by SRS band — neutral (not studying), then
bands 1–3 from light to deep (relative to the ladder length: the first third of
the steps is band 1, the second band 2, the rest band 3). A kanji shows the lower of its two track levels; a
studying radical is painted with the deepest band. See "Design guidelines" below
before picking a new color anywhere in the app.

## Design guidelines

The UI overhaul (bilingual title, bottom tab bar, full-screen sheets, band
colors, background pattern) followed a few conventions worth keeping
consistent as the app grows:

- **One mobile breakpoint.** Every mobile-specific layout change — bottom tab
  bar, full-screen detail sheet, stacked card back, fixed answer bar — switches
  at `max-width: 700px`. Don't introduce a second breakpoint without a real
  reason; it makes the responsive behavior harder to reason about.
- **State color is one single-hue blue scale, defined once.** The
  `--band-{0..3}-bg/-border/-ink` triples in `styles.css`'s `:root` are the only
  source of "state" color: neutral = not studying, bands 1–3 run light → deep
  with SRS maturity (bands are relative to the ladder length, so the colors keep
  their meaning with any ladder; the 6-step default gives levels 0–1 / 2–3 / 4–6).
  Chips, the Studying switch, the track bars and the
  Configurations swatches all reference them; a new state-colored element reuses
  a band, not a new hex value. Band 1 must read as more marked than a white
  chip, so it leans on its thicker border, not just the fill. The pastel
  green/red are only for answer actions (✓/✗), never states, and there is no red
  in states: learning isn't an error.
- **Shared view pieces live in `js/ui.js`.** Anything rendered in more than
  one place — the inline icon set, the band chip (`chipHtml`/`bindChips`),
  horizontal-swipe wiring — is defined once there and imported off `window.Ui`.
  `js/state.js` is the store and holds no markup. A new piece of UI that two
  views both need belongs in `ui.js` rather than being copied into the second one.
- **Shared components.** The Studying switch and the SRS track lines
  (`studyToggleHtml`, `srsTracksHtml`) are shared `Ui` pieces (the switch has a
  `compact` no-label form, used in the detail sheet's top bar). The flashcard is
  one shared component (`js/flashcard.js`) used by SRS Review and Practice Test,
  so the two can't visually drift apart.
- **User text is always escaped.** Everything renders via `innerHTML`, so any
  user-entered text (e.g. the description) goes through `Ui.escapeHtml` first.
- **Primary vs. secondary navigation.** Only destinations meant for frequent,
  quick switching (Radicals, Kanji) belong in the tab row / bottom tab bar and
  the swipe cycle (see `PRIMARY_TABS` in `js/app.js`). Everything else
  (SRS Review, Practice Test, Configurations, AI Text, and anything added later
  along those lines) is a `☰` menu item that takes over the full view instead;
  the header due badge is a shortcut to SRS Review. The bottom tab bar stays
  visible on every one of those *except* while an actual card is up (see
  `setBottomTabsHidden` in `js/flashcard.js`) — that's the one moment the extra
  room for the card matters more than an always-present way back; the empty
  state and the report screen still show it. `--bottom-tabs-h` exists for
  exactly this kind of case, if a future fixed bottom bar ever needs to coexist
  with the tab bar instead.
- **Full-screen sheets, not floating modals, on mobile.** The detail overlay
  is a centered card above 700px and a full-height sheet below it (back/
  position/close in a slim top bar). Any new modal-like view should follow
  the same pattern rather than shrinking a desktop modal down to fit.
- **The background pattern is decoration, not a canvas.** The seigaiha (wave)
  pattern behind all content (`body::before` in `styles.css`) is intentionally
  low-opacity (`0.06`) and monochrome-tinted — it should never be raised high
  enough to compete with foreground text or chip colors. If it's ever swapped
  for a different motif, keep it as a small tiled SVG data URI (no external
  image request) at a similarly low opacity, and keep it a `position: fixed`
  pseudo-element so content scrolls over it rather than the pattern moving
  with the page.

## Running it

No build step, no install. Either:

- Double-click [index.html](index.html) and open it in any browser, or
- For local dev/testing, this repo's parent `.claude/launch.json` has a
  `kanji-radicals` static server entry (`python3 -m http.server`).

All `js/*.js` files are plain scripts (no ES modules) exposing namespaced
globals — `type="module"` is blocked by CORS on `file://`, which is how this
app is meant to be opened. That makes `index.html`'s `<script>` order the
dependency graph: each file reads the globals it needs at load time, so
`srs.js` → `state.js` → `ui.js` → everything else, with `app.js` last.

## Syncing progress across devices

Your progress is always cached in the browser's `localStorage`. To carry them
across devices, put this whole folder in iCloud Drive and use one of:

- **Config Folder** (Chrome/Edge on Mac): grants write access to `progress.json`
  right here in the folder via the File System Access API. Once linked, every
  change writes through automatically, and iCloud syncs the file to your
  other Macs. Not supported in Safari or any iOS browser — the button is hidden in browsers
  without the File System Access API.
- **Export / Import** (works everywhere, including iPhone/iPad Safari): Export
  downloads your current progress as `progress.json`; Import loads one back in.
  On mobile this is the practical sync path — export, move the file into the
  iCloud folder via Files, and Import it on the next device.

`progress.json` is format v2. Old (rank-based) files are converted when loaded or
imported; the original is kept in `localStorage` under
`kanji-radicals:progress-v1-backup`.

## Regenerating the data

Everything under `data/` is pre-built from source files in `raw/` — none of it
is fetched at runtime as JSON, since fetching a local file is blocked by CORS
on `file://`. Each is shipped as a plain `<script>`-loaded global instead:

| File | Source | Built by |
|---|---|---|
| `data/radicals.js`, `data/kanji.js` | EDRDG KRADFILE/RADKFILE | `scripts/build-data.js` |
| `data/jlpt.js` | Jonathan Waller's JLPT lists (old Anki sqlite decks) | `scripts/build-jlpt.js` |
| `data/kanjidic.js` | EDRDG KANJIDIC2 (on'yomi/kun'yomi/meanings, plus the Heisig RTK 6th-edition frame number `rtk`, ~3,000 kanji) | `scripts/build-kanjidic.js` |
| `data/strokes.js` | KanjiVG's combined dump (stroke path data, ~6,400 of our 12,162 characters) | `scripts/build-strokes.js` |

To rebuild all of it from a fresh copy of the sources (`build-strokes.js` reads
`data/radicals.js`/`data/kanji.js`, so `build-data.js` must run first):

```bash
raw/convert.sh              # re-downloads and converts everything in raw/
node scripts/build-data.js      # -> data/radicals.js, data/kanji.js
node scripts/build-jlpt.js      # -> data/jlpt.js (needs the sqlite3 CLI)
node scripts/build-kanjidic.js  # -> data/kanjidic.js
node scripts/build-strokes.js   # -> data/strokes.js
```

Stroke order was originally live-fetched per character from KanjiVG (GitHub's
raw CDN allows cross-origin `fetch()`, unlike jisho.org itself — verified, its
page and unofficial API both reject cross-origin requests) and cached in
IndexedDB. It's bundled instead now: KanjiVG publishes one combined data dump
per release, so parsing it once here avoids ~6,400 requests happening once per
user instead of once, total, at build time — and the app now assumes the data
is simply there, with no fetch/cache logic left at runtime at all.

## Attribution

- Radical/kanji decomposition, readings/meanings and RTK numbers from
  [KRADFILE/RADKFILE & KANJIDIC2](https://www.edrdg.org/krad/kradinf.html),
  © Michael Raine, James Breen and the Electronic Dictionary Research &
  Development Group, used under the [EDRDG Licence](https://www.edrdg.org/edrdg/licence.html).
- JLPT levels from [Jonathan Waller's JLPT Resources](http://www.tanos.co.uk/jlpt/)
  — the same source jisho.org itself credits for its JLPT tags.
- Stroke order diagrams from [KanjiVG](https://kanjivg.tagaini.net/),
  © Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
