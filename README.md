# Kanji Radicals

A minimal, static, offline-first app for drilling Japanese radicals and kanji:

- **Radicals** tab — all 253 KRADFILE/RADKFILE radicals grouped by stroke count.
- **Kanji** tab — kanji whose components you've ranked highly enough to be worth
  learning, grouped by JLPT level ascending (N5 → N1, then untagged). Toggle
  "Show all kanji" to browse everything, ~12,150 entries.
- Click any character to open its detail panel: on'yomi/kun'yomi/meaning (when
  known), an animated stroke-order diagram (Slow/Normal speed), sub-components
  (if any, drill in recursively), a link to Jisho, and a rank selector — also
  usable with the 1–4 keys while the panel is open.
- **AI Text** (in the ☰ menu) — builds a writing-practice prompt for an LLM
  from the kanji you've ranked Learning+, with a topic/length/chapter count
  form and a one-click Copy to Clipboard.

Rank scale: 0 Unknown (gray) · 1 Learning (orange) · 2 Familiar (yellow) · 3 Known (green).
A kanji shows up in the default Kanji view once every one of its components is
ranked high enough — plain radicals need rank ≥ 1, components that are themselves
full kanji need rank ≥ 2. Radicals that are themselves standalone kanji (水, 木,
人, ...) appear in both tabs and unlock based on their own rank, since they have
no sub-components to gate on.

## Running it

No build step, no install. Either:

- Double-click [index.html](index.html) and open it in any browser, or
- For local dev/testing, this repo's parent `.claude/launch.json` has a
  `kanji-radicals` static server entry (`python3 -m http.server`).

All `js/*.js` files are plain scripts (no ES modules) exposing namespaced
globals — `type="module"` is blocked by CORS on `file://`, which is how this
app is meant to be opened.

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
