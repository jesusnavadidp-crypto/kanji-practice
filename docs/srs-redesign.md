# SRS redesign — decisions

Working notes from the 2026-10-14 brainstorm. All phases are now implemented;
this was the agreed direction (now built).

## Studying vs. not studying (replaces the rank scale)

- The 4-step rank (Unknown/Learning/Familiar/Known) goes away.
- Every character gets a plain **studying** flag (true/false), set with a
  switch in the detail sheet. Icons: stop (⊘) when off, pencil when on.
- The flag is **decoupled from SRS**: it alone decides what is shown and
  unlocked. A kanji appears in the default Kanji view once every one of its
  components (radical or kanji) is flagged studying — e.g. 木 off hides 森,
  机, ... by default.
- Radicals have no SRS. A studying radical is painted with the top color of
  the SRS scale, statically.
- The switch's "on" color is from the blue scale (a band dark enough to read
  as clearly on, not the palest one).
- The exclude-from-test pencil toggle is removed; not studying = never tested.

## Colors

- Chips use a **single-hue blue scale** by SRS level (light = just started,
  deep = most mature), matching the blue-gray background. Single hue keeps it
  minimal (no "Christmas tree") and avoids red: learning isn't an error state.
  The color is a light visual hint only — exact progress lives in the detail
  sheet.
- At most ~4 visible bands (not studying / levels 0-1 / 2-3 / 4-6); 7 shades
  of one hue aren't distinguishable.
- Watch salience: the background is blue-gray and unstudied chips are white,
  so the lightest blue band must still read as *more* marked than white (lean
  on the chip's thick same-hue border, not just the fill).
- Answer buttons keep pastel green/red: those are actions, not states.
- Not studying = neutral (surface + border), as Unknown is today.
- A kanji's chip shows the **lower** of its two track levels.
- Adding these tones is a deliberate change to the "pastel palette defined
  once" guideline — define the scale once in `:root` and update README's
  Design guidelines in the same change.

## SRS

- Steps (days): 1, 3, 7, 14, 30, 60. Correct moves up one step, incorrect
  resets to 0. At the last step it stays at 60 days indefinitely.
- Due is by **calendar day** (local date), not hours: reviewed at 22:00,
  due again at 05:00 the next day counts.
- Store per track: `level`, `lastReviewed` (YYYY-MM-DD) and `due`
  (YYYY-MM-DD), so later changes to the step ladder don't move existing
  schedules.
- **Two tracks per kanji**: Meaning (kanji → meaning) and Writing
  (meaning/keyword → kanji). Flagging studying activates both.
- Recall front: the user's RTK keyword when present, else meanings +
  on/kun readings (meanings alone are ambiguous).
- Detail sheet shows each track compactly, one line each: label + 6-segment
  bar filled in the blue scale + due, e.g. `意 ▰▰▰▱▱▱ 7d` — read by length,
  not counted.

## Review card (shared by SRS Review and Practice Test)

- One shared card component, two modes:
  - **SRS Review**: queue of due cards, updates levels, ends in "done for today".
  - **Practice Test**: free draw from studying kanji, **never touches SRS**.
- Answer buttons: front shows only ✓ (I knew it); after flipping, both ✓ and ✗.
- Reveal-below instead of replacing the front; no "Show character" button.
- Back: the glyph as written (font) **beside** the stroke-order canvas
  (stacked on mobile), then readings, meaning and the user's description.
- Configurations' Learning/Familiar/Known weights get replaced by SRS-level
  bands (new / mid / mature).

## Header counters

- **Activated today**: plain count of kanji flagged studying today, e.g.
  `✎ 7` — no goal, no `/20`; the pace is the user's call. Deactivating one
  activated today decrements it. Store `activatedOn` per kanji.
- **SRS due count**: tapping opens SRS Review; muted when 0. A dot on ☰ when
  reviews are pending.
- Both must stay compact — the mobile header only has the title and ☰.

## Description

- Optional per-kanji note, one line, max 30 words (live counter, can't save
  over the limit), stored in progress.json.
- Shown on the card back; on the Writing track also available as an optional
  hint before flipping.
- Always HTML-escaped before rendering (everything renders via innerHTML).

## RTK / Heisig (later)

- KANJIDIC2 already ships 6th-edition numbers (`dic_ref dr_type="heisig6"`,
  3,000 entries = Vol. 1 + Vol. 3). Extract them in `scripts/build-kanjidic.js`.
- The number is a user-overridable default; the RTK **keyword** is a short
  user-entered field (keywords are copyrighted, not in KANJIDIC). Empty
  keyword → Writing front falls back to meanings + readings.

## Migration

- The progress format changes. Provide an **explicit option to convert an
  existing progress.json** to the new format (not only silent upgrade):
  rank 0 → not studying; 1/2/3 → studying, SRS levels 0/2/4, all due today.
- Config ladder (later): add/remove steps and edit values (in days); changes
  don't affect existing schedules; reject invalid values (non-integers,
  < 1, non-increasing, empty ladder).

## Phases

All four phases are implemented.

1. Data model + migration + studying switch + chip colors + new unlock rule.
2. SRS with two tracks + shared card + SRS Review view.
3. Header counters + description.
4. Configurable ladder + RTK numbers/keywords (implemented).

---

# Implementation plan (phases 1–3)

Phase 4 (configurable ladder, RTK number/keyword) is also implemented; the
data model below gained `keyword` and `rtk` per char record, and bands became
relative to the ladder length (`bandForLevel(level, stepsLength)`).

## Data model — progress bundle v2

```js
{
  version: 2,
  chars: {
    // one record per character the user ever touched
    '水': {
      studying: true,
      activatedOn: '2026-10-14',        // local date of the last off→on; null after migration
      srs: {                             // kanji only (never on radicals); kept when studying goes off
        meaning: { level: 0, lastReviewed: null, due: '2026-10-14' },
        writing: { level: 0, lastReviewed: null, due: '2026-10-14' },
      },
      description: '',                   // ≤ 30 words, one line
    },
  },
  practiceSettings: { weights: { new: 50, mid: 30, mature: 20 } },
  srsSettings: { steps: [1, 3, 7, 14, 30, 60] },
}
```

- `level` 0..steps.length. Correct: `level = min(level + 1, steps.length)`,
  `due = today + steps[level - 1]`. Incorrect: `level = 0`, `due = today`
  (re-queued at the end of the current session).
- Bands for color / practice weights: off · new (0–1) · mid (2–3) · mature (4–6).
  Kanji chip band = band of `min(meaning.level, writing.level)`; a studying
  radical = mature.
- Legacy bundles (flat `char → rank`, or `{ ranks, testSettings }`) are
  converted on load/import: rank 0 → dropped; 1/2/3 → studying, both tracks at
  level 0/2/4, due today, `activatedOn: null`; weights 1/2/3 → new/mid/mature.
  The raw legacy blob is backed up to `kanji-radicals:progress-v1-backup`
  once. Configurations also gets an explicit "Convert old progress file"
  action reporting what was converted.

## Modules

| File | Change |
|---|---|
| `js/srs.js` (new) | Pure logic: `today()`, `addDays()`, `isDue()`, `grade()`, `bandForLevel()`. No DOM, no storage. |
| `js/state.js` | v2 store + legacy migration; `isStudying/setStudying`, `getSrs/gradeTrack`, `getDescription/setDescription`, `getActivatedTodayCount`, `getDueCards`, practice weights. |
| `js/data.js` | Unlock = every component studying (atomic kanji: itself studying). |
| `js/ui.js` | `escapeHtml`, band-classed `chipHtml`, `studyToggleHtml/bind`, `srsTracksHtml` (label + 6-segment bar + due), icons (stop, pencil, flame-less counters). Rank row removed. |
| `js/detailPanel.js` | Switch, SRS track lines (kanji), description field with live word counter. |
| `js/flashcard.js` (new) | Shared card: front per direction, reveal-below back (font glyph beside stroke canvas, readings, meaning, description), ✓ only before reveal, ✗+✓ after. |
| `js/testView.js` | Practice Test on the shared card; draws studying kanji weighted by band; never writes SRS. |
| `js/srsView.js` (new) | SRS Review: queue of due (char, track) cards, same char's two tracks never adjacent, failures re-queued, "Done for today" report. |
| `js/configView.js` | Practice weights by band; "Convert old progress file"; excluded list removed. |
| `js/aiText.js` | Uses studying kanji. |
| `js/app.js`, `index.html` | SRS Review menu item + view, header counters (`✎ N` activated today, `⟳ N` due → opens SRS Review), dot on ☰ when reviews are pending. |
| `styles.css` | Blue scale `--srs-band-{0..3}-{bg,border,ink}` defined once; switch, track bars, card back layout, header counters; old rank styles removed. |
| `README.md` | Features + Design guidelines updated. |

## Slices (sequential — they share state.js/ui.js/styles.css)

1. **Foundation** — srs.js, state v2 + migration, unlock rule, ui.js pieces,
   blue scale + chips, detail panel (switch, tracks, description), config
   weights + convert action, AI Text; Practice Test minimally adapted so the
   app keeps loading.
2. **Cards** — flashcard.js, Practice Test rewrite, SRS Review view + menu item.
3. **Header & docs** — counters, ☰ dot, README.

Verification after each slice in the browser preview (console clean, views
render, flows clickable on desktop and 375px mobile).
