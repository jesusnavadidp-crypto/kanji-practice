# Kanji Radicals

A minimal, static, offline-first app for drilling Japanese radicals and kanji:

- **Radicals** tab — all 253 KRADFILE/RADKFILE radicals grouped by stroke count.
- **Kanji** tab — kanji whose components you've ranked highly enough to be worth
  learning, grouped by JLPT level ascending (N5 → N1, then untagged). Toggle
  "Show all kanji" to browse everything, ~12,150 entries. Search matches an
  exact character, or as a substring against its on'yomi/kun'yomi readings or
  English meaning.
- Click any character to open its detail sheet: rank selector, the character,
  an animated stroke-order diagram (with a Replay/Fast/Slow icon menu beside
  it) in its own card, a merged readings card (concept/kun'yomi/on'yomi, when
  known), sub-components (if any, drill in recursively — a horizontal scroll
  row, not a wrapping grid), and a Jisho link — the rank selector is also
  usable with the 1–4 keys while the sheet is open. From the Kanji tab, move
  to the next/previous kanji without closing it via the arrow buttons (desktop),
  a swipe, or the ←/→ keys.
- **Practice Test** (in the ☰ menu) — flashcard drill over the kanji you've
  ranked Learning+: tap the card to reveal its readings, meaning and stroke
  order, mark yourself Correct/Incorrect, and keep going. The rank pills above
  the card adjust the learn status right from there. The ✕ button ends the
  session and shows a report (total tested, correct, incorrect).
- **AI Text** (in the ☰ menu) — builds a writing-practice prompt for an LLM
  from the kanji you've ranked Learning+, with a topic/length/chapter count
  form and a one-click Copy to Clipboard.

On mobile, Radicals/Kanji live in a bottom tab bar (swipe left/right to move
between them) instead of competing with the title for header space; Practice
Test and AI Text are menu-triggered, full-screen destinations rather than
primary tabs, so they don't fight over that footer space with the other two.

Rank scale: 0 Unknown (gray) · 1 Learning (pastel amber) · 2 Familiar (pastel
yellow) · 3 Known (pastel green) — see "Design guidelines" below before
picking a new color anywhere in the app.
A kanji shows up in the default Kanji view once every one of its components is
ranked high enough — plain radicals need rank ≥ 1, components that are themselves
full kanji need rank ≥ 2. Radicals that are themselves standalone kanji (水, 木,
人, ...) appear in both tabs and unlock based on their own rank, since they have
no sub-components to gate on.

## Design guidelines

The UI overhaul (bilingual title, bottom tab bar, full-screen sheets, pastel
rank colors, background pattern) followed a few conventions worth keeping
consistent as the app grows:

- **One mobile breakpoint.** Every mobile-specific layout change — bottom tab
  bar, full-screen detail sheet, circular initials-only rank pills, fixed test
  answer bar — switches at `max-width: 700px`. Don't introduce a second
  breakpoint without a real reason; it makes the responsive behavior harder to
  reason about.
- **Rank colors are pastel and defined once.** `--pastel-amber/yellow/green/red`
  in `styles.css`'s `:root` are the only source of "state" color in the app —
  the chip grid, the rank-selector (detail sheet + test view), and the test
  view's correct/incorrect buttons all reference the same `--rank-N-bg/
  -border/-ink` triples built from them. A new rank-colored element should
  reuse an existing pastel variable, not introduce a new hex value. Unknown
  (rank 0) is the one exception: neutral surface + neutral border, not a tint,
  since "no progress yet" shouldn't read as a color.
- **Shared view pieces live in `js/ui.js`.** Anything rendered in more than
  one place — the inline icon set, the rank chip (`chipHtml`/`bindChips`), the
  rank row (`rankRowHtml`/`bindRankRow`) and horizontal-swipe wiring — is
  defined once there and imported off `window.Ui`. `js/state.js` is the store
  and holds no markup. A new piece of UI that two views both need belongs in
  `ui.js` rather than being copied into the second one.
- **The rank-selector is one shared component.** `window.Ui.rankRowHtml()` /
  `bindRankRow()` render and wire up the 4-pill rank row (plus the
  exclude-from-test toggle beside it); both the detail sheet and the test view
  use it so they can't visually drift apart.
  Every rank pill always shows its own color — `.selected` only adds a border,
  it never re-colors. On narrow screens the label collapses to its first
  letter via CSS (`font-size: 0` + `::after { content: attr(data-short) }`),
  keeping the full word in the DOM for screen readers instead of swapping
  markup.
- **Primary vs. secondary navigation.** Only destinations meant for frequent,
  quick switching (Radicals, Kanji) belong in the tab row / bottom tab bar and
  the swipe cycle (see `PRIMARY_TABS` in `js/app.js`). Everything else
  (Practice Test, Configurations, AI Text, and anything added later along
  those lines) is a `☰` menu item that takes over the full view instead. The
  bottom tab bar stays visible on every one of those *except* while an actual
  test card is up (see `setBottomTabsHidden` in `js/testView.js`) — that's
  the one moment the extra room for the card matters more than an
  always-present way back; the empty state and the report screen still show
  it. `--bottom-tabs-h` exists for exactly this kind of case, if a future
  fixed bottom bar ever needs to coexist with the tab bar instead.
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
`state.js` → `ui.js` → everything else, with `app.js` last.

## Syncing progress across devices

Your ranks are always cached in the browser's `localStorage`. To carry them
across devices, put this whole folder in iCloud Drive and use one of:

- **Config Folder** (Chrome/Edge on Mac): grants write access to `progress.json`
  right here in the folder via the File System Access API. Once linked, every
  rank change writes through automatically, and iCloud syncs the file to your
  other Macs. Not supported in Safari/iOS — the button disables itself there.
- **Export / Import** (works everywhere, including iPhone/iPad Safari): Export
  downloads your current ranks as `progress.json`; Import loads one back in.
  On mobile this is the practical sync path — export, move the file into the
  iCloud folder via Files, and Import it on the next device.

## Regenerating the data

Everything under `data/` is pre-built from source files in `raw/` — none of it
is fetched at runtime as JSON, since fetching a local file is blocked by CORS
on `file://`. Each is shipped as a plain `<script>`-loaded global instead:

| File | Source | Built by |
|---|---|---|
| `data/radicals.js`, `data/kanji.js` | EDRDG KRADFILE/RADKFILE | `scripts/build-data.js` |
| `data/jlpt.js` | Jonathan Waller's JLPT lists (old Anki sqlite decks) | `scripts/build-jlpt.js` |
| `data/kanjidic.js` | EDRDG KANJIDIC2 (on'yomi/kun'yomi/meanings) | `scripts/build-kanjidic.js` |
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

- Radical/kanji decomposition and readings/meanings from
  [KRADFILE/RADKFILE & KANJIDIC2](https://www.edrdg.org/krad/kradinf.html),
  © Michael Raine, James Breen and the Electronic Dictionary Research &
  Development Group, used under the [EDRDG Licence](https://www.edrdg.org/edrdg/licence.html).
- JLPT levels from [Jonathan Waller's JLPT Resources](http://www.tanos.co.uk/jlpt/)
  — the same source jisho.org itself credits for its JLPT tags.
- Stroke order diagrams from [KanjiVG](https://kanjivg.tagaini.net/),
  © Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
