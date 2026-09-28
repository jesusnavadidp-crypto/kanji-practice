// Plain script (no ES modules), exposed as window.KanjiView — see state.js for why.

window.KanjiView = (() => {
  const { getAllRanks } = window.State;
  const { isKanjiUnlocked } = window.Data;
  const { icons, chipHtml, bindChips } = window.Ui;
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

  const renderList = () => {
    const sorted = sortedByJlpt(currentList());
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
              ${group.items.map((k) => chipHtml(k.char)).join('')}
            </div>
          </div>
        `
      )
      .join('');

    bindChips(container, (char) => openDetail(char, sortedChars));

    container.querySelector('#kanji-more').classList.toggle('hidden', visible.length >= sorted.length);
    container.querySelector('.kanji-count').textContent = `${sorted.length} kanji`;
  };

  // Any change to what's being listed (search, gate toggle) restarts pagination
  // from the first page, rather than keeping a "Show more" depth that belonged
  // to the previous list.
  const renderFromFirstPage = () => {
    visibleCount = PAGE_SIZE;
    renderList();
  };

  const renderKanjiView = (loadedDataset) => {
    dataset = loadedDataset;

    container.innerHTML = `
      <div class="kanji-toolbar">
        <div class="search-input-wrap">
          <input type="text" id="kanji-filter" placeholder="Search by character, reading, or meaning…" />
          <button id="kanji-filter-clear" class="input-clear-btn hidden" aria-label="Clear search">
            ${icons.close}
          </button>
        </div>
        <label><input type="checkbox" id="kanji-show-all" /> Show all kanji (ignore rank gate)</label>
        <span class="kanji-count"></span>
      </div>
      <div id="kanji-groups"></div>
      <button id="kanji-more" class="show-more-btn hidden">Show more</button>
    `;

    const filterInput = container.querySelector('#kanji-filter');
    const clearBtn = container.querySelector('#kanji-filter-clear');

    // Debounced: re-filtering rebuilds the whole (possibly thousands-of-chips)
    // #kanji-groups list, and doing that on every keystroke while a mobile
    // keyboard/IME is up is a heavy repaint right next to the focused input —
    // which is what was resetting the cursor to the start mid-typing on
    // mobile. Waiting for a short pause in typing avoids that.
    let filterDebounceTimer = null;
    filterInput.addEventListener('input', (e) => {
      const value = e.target.value;
      clearBtn.classList.toggle('hidden', value.length === 0);
      clearTimeout(filterDebounceTimer);
      filterDebounceTimer = setTimeout(() => {
        filterText = value.trim();
        renderFromFirstPage();
      }, 200);
    });

    clearBtn.addEventListener('click', () => {
      clearTimeout(filterDebounceTimer);
      filterInput.value = '';
      filterText = '';
      clearBtn.classList.add('hidden');
      renderFromFirstPage();
      filterInput.focus();
    });

    container.querySelector('#kanji-show-all').addEventListener('change', (e) => {
      showAll = e.target.checked;
      renderFromFirstPage();
    });

    container.querySelector('#kanji-more').addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      renderList();
    });

    renderList();
  };

  // Always recomputes, even while this tab isn't the visible one, so the
  // gate/filter is already current the moment the user switches to it.
  const refreshKanjiRanks = () => renderList();

  return { renderKanjiView, refreshKanjiRanks };
})();
