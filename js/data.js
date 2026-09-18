// Loads the pre-built radical/kanji datasets and exposes lookup + gating helpers.
// The datasets are plain <script>-loaded globals (see index.html) rather than
// fetched JSON, since fetching a local file is blocked by CORS on file://.
// Plain script (no ES modules), exposed as window.Data — see state.js for why.

window.Data = (() => {
  const loadDataset = () => {
    const radicals = window.RADICALS_DATA;
    const kanji = window.KANJI_DATA;

    const radicalChars = new Set(radicals.map((r) => r.char));
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
      getEntry: (char) => byChar.get(char),
      // 5 (N5, easiest) .. 1 (N1, hardest), or undefined if untagged.
      getJlptLevel: (char) => window.JLPT_DATA[char],
      getReadings: (char) => window.KANJIDIC_DATA[char],
    };
  };

  // A component that is a plain radical needs rank >= 1 (Learning) to count as
  // known-enough; a component that is itself a full kanji needs rank >= 2 (Familiar).
  const requiredRankFor = (dataset, componentChar) =>
    dataset.isRadicalChar(componentChar) ? 1 : 2;

  const isKanjiUnlocked = (dataset, ranks, kanjiEntry) => {
    // Atomic (no sub-components) means this is a radical that's also a
    // standalone kanji (e.g. 水) — nothing to gate on, so it's ready as soon
    // as you've started ranking it directly, rather than always hidden.
    if (kanjiEntry.components.length === 0) return (ranks[kanjiEntry.char] || 0) >= 1;
    return kanjiEntry.components.every(
      (c) => (ranks[c] || 0) >= requiredRankFor(dataset, c)
    );
  };

  return { loadDataset, requiredRankFor, isKanjiUnlocked };
})();
