// Plain script (no ES modules), exposed as window.KanjiView — see state.js for why.

window.KanjiView = (() => {
  const { getRank, getAllRanks } = window.State;
  const { isKanjiUnlocked } = window.Data;
  const { openDetail } = window.DetailPanel;

  const container = document.getElementById('kanji-view');
  const PAGE_SIZE = 300;

  let dataset = null;
  let showAll = false;
  let filterText = '';
  let visibleCount = PAGE_SIZE;
  // Full sorted char list behind whatever's currently rendered, so the detail
  // panel's Prev/Next can move beyond just the paginated/visible slice.
  let sortedChars = [];

  // Matches by exact character, or as a case-insensitive substring against
  // the on'yomi/kun'yomi readings (furigana) or English meaning.
  const matchesFilter = (entry) => {
    if (!filterText) return true;
    if (entry.char === filterText) return true;
    const readings = dataset.getReadings(entry.char);
    if (!readings) return false;
    const needle = filterText.toLowerCase();
    return (
      readings.on.some((r) => r.toLowerCase().includes(needle)) ||
      readings.kun.some((r) => r.toLowerCase().includes(needle)) ||
      readings.meanings.some((m) => m.toLowerCase().includes(needle))
    );
  };

  const currentList = () => {
    const ranks = getAllRanks();
    return dataset.kanji.filter(
      (entry) => (showAll || isKanjiUnlocked(dataset, ranks, entry)) && matchesFilter(entry)
    );
  };

  // Ascending by JLPT difficulty: N5 (easiest) first, ... N1 (hardest), then
  // everything Waller's lists don't tag at all, last.
  const jlptSortWeight = (char) => {
    const level = dataset.getJlptLevel(char);
    return level ? 6 - level : 999;
  };

  const jlptGroupLabel = (char) => {
    const level = dataset.getJlptLevel(char);
    return level ? `JLPT N${level}` : 'Not JLPT-tagged';
  };

  const sortedByJlpt = (list) =>
    [...list].sort(
      (a, b) => jlptSortWeight(a.char) - jlptSortWeight(b.char) || a.char.codePointAt(0) - b.char.codePointAt(0)
    );

  const renderChips = (list) => {
    const sorted = sortedByJlpt(list);
    sortedChars = sorted.map((entry) => entry.char);
    const visible = sorted.slice(0, visibleCount);

    const groups = [];
    for (const entry of visible) {
      const label = jlptGroupLabel(entry.char);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) lastGroup.items.push(entry);
      else groups.push({ label, items: [entry] });
    }

    container.querySelector('#kanji-groups').innerHTML = groups
      .map(
        (group) => `
          <div class="stroke-group">
            <h2>${group.label}</h2>
            <div class="chip-grid">
              ${group.items
                .map((k) => `<button class="chip rank-${getRank(k.char)}" data-char="${k.char}">${k.char}</button>`)
                .join('')}
            </div>
          </div>
        `
      )
      .join('');

    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => openDetail(chip.dataset.char, sortedChars));
    });

    const moreBtn = container.querySelector('#kanji-more');
    moreBtn.classList.toggle('hidden', visible.length >= sorted.length);

    container.querySelector('.kanji-count').textContent = `${sorted.length} kanji`;
  };

  const renderList = () => {
    renderChips(currentList());
  };

  const renderKanjiView = (loadedDataset) => {
    dataset = loadedDataset;

    container.innerHTML = `
      <div class="kanji-toolbar">
        <input type="text" id="kanji-filter" placeholder="Search by character, reading, or meaning…" />
        <label><input type="checkbox" id="kanji-show-all" /> Show all kanji (ignore rank gate)</label>
        <span class="kanji-count"></span>
      </div>
      <div id="kanji-groups"></div>
      <button id="kanji-more" class="show-more-btn hidden">Show more</button>
    `;

    container.querySelector('#kanji-filter').addEventListener('input', (e) => {
      filterText = e.target.value.trim();
      visibleCount = PAGE_SIZE;
      renderList();
    });

    container.querySelector('#kanji-show-all').addEventListener('change', (e) => {
      showAll = e.target.checked;
      visibleCount = PAGE_SIZE;
      renderList();
    });

    container.querySelector('#kanji-more').addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      renderList();
    });

    renderList();
  };

  // Always recomputes, even while this tab isn't the visible one, so the
  // gate/filter is already current the moment the user switches to it.
  const refreshKanjiRanks = () => {
    renderList();
  };

  return { renderKanjiView, refreshKanjiRanks };
})();
