// Loads the pre-built radical/kanji datasets and exposes lookup + gating helpers.
// The datasets are plain <script>-loaded globals (see index.html) rather than
// fetched JSON, since fetching a local file is blocked by CORS on file://.
// Plain script (no ES modules), exposed as window.Data — see state.js for why.

window.Data = (() => {
  const loadDataset = () => {
    const radicals = window.RADICALS_DATA;
    const kanji = window.KANJI_DATA;

    const radicalChars = new Set(radicals.map((r) => r.char));
    const kanjiChars = new Set(kanji.map((k) => k.char));
    // A radical that's also a standalone kanji (e.g. 水, 木, 人) appears in both
    // arrays; merge so its detail view keeps the radical facts (stroke count,
    // kanjiUsing) it'd otherwise lose to whichever array was inserted last.
    const byChar = new Map();
    for (const k of kanji) byChar.set(k.char, { ...k, isRadical: false });
    for (const r of radicals) byChar.set(r.char, { ...byChar.get(r.char), ...r, isRadical: true });

    return {
      radicals,
      kanji,
      isRadicalChar: (char) => radicalChars.has(char),
      // Whether `char` is ever drawn by the Test view — i.e. it's in
      // dataset.kanji, regardless of whether it's *also* a radical.
      isKanjiChar: (char) => kanjiChars.has(char),
      getEntry: (char) => byChar.get(char),
      // 5 (N5, easiest) .. 1 (N1, hardest), or undefined if untagged.
      getJlptLevel: (char) => window.JLPT_DATA[char],
      getReadings: (char) => window.KANJIDIC_DATA[char],
      // The one RTK number resolver (subtitle, card corner, list ordering): the
      // user's override when set, else the KANJIDIC2 Heisig 6th-ed. frame
      // number, or undefined if neither exists.
      getRtkNumber: (char) => window.State.getRtkOverride(char) ?? window.KANJIDIC_DATA[char]?.rtk,
      // The KANJIDIC2 number alone — what an empty override falls back to.
      getDefaultRtkNumber: (char) => window.KANJIDIC_DATA[char]?.rtk,
    };
  };

  // A kanji is unlocked once every one of its components is being studied.
  // Atomic (no sub-components) means this is a radical that's also a
  // standalone kanji (e.g. 水) — nothing to gate on, so it's unlocked as soon
  // as it is itself studied, rather than always hidden.
  const isKanjiUnlocked = (dataset, isStudying, kanjiEntry) => {
    if (kanjiEntry.components.length === 0) return isStudying(kanjiEntry.char);
    return kanjiEntry.components.every(isStudying);
  };

  return { loadDataset, isKanjiUnlocked };
})();
