// The "chunk container" detail panel, shared by radicals and kanji: shows
// sub-components (drill-down), a link to Jisho for stroke order, the rank
// selector, and (for actual kanji only — see dataset.isKanjiChar) the
// exclude-from-test toggle. Both entry types render through the same
// renderDetail() function.
// Plain script (no ES modules), exposed as window.DetailPanel — see state.js for why.

window.DetailPanel = (() => {
  const { getRank, setRank, isExcludedFromTest, setExcludedFromTest } = window.State;
  const { chipHtml, bindChips, rankRowHtml, bindRankRow, onHorizontalSwipe } = window.Ui;

  const SWIPE_THRESHOLD_PX = 40;

  let dataset = null;
  let stack = [];
  // Ordered list of chars the panel was opened from (e.g. the current Kanji
  // tab listing), letting Prev/Next and swipe move through it without closing
  // the panel. Empty when opened from a context with no such ordering (e.g.
  // Radicals), or once the user has drilled into a sub-component.
  let navList = [];

  const overlay = document.getElementById('detail-overlay');
  const content = document.getElementById('detail-content');
  const backBtn = document.getElementById('detail-back');
  const closeBtn = document.getElementById('detail-close');
  const prevBtn = document.getElementById('detail-prev');
  const nextBtn = document.getElementById('detail-next');
  const positionEl = document.getElementById('detail-position');
  const panel = document.querySelector('.detail-panel');

  // The "#kanji" filter routes to Jisho's kanji-detail page (stroke order, readings,
  // meanings) instead of the general dictionary search results.
  const jishoUrl = (char) => `https://jisho.org/search/${encodeURIComponent(`${char} #kanji`)}`;

  const render = () => {
    const char = stack[stack.length - 1];
    const entry = dataset.getEntry(char);
    if (!entry) return;

    const jlptLevel = dataset.getJlptLevel(char);
    const readings = dataset.getReadings(char);
    const subtitle = [
      entry.isRadical ? `Radical · ${entry.strokeCount} strokes` : 'Kanji',
      jlptLevel ? `JLPT N${jlptLevel}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const readingRows = [
      readings?.meanings.length ? ['Concept', readings.meanings.join(', ')] : null,
      readings?.kun.length ? ["Kun'yomi", readings.kun.join('、 ')] : null,
      readings?.on.length ? ["On'yomi", readings.on.join('、 ')] : null,
    ].filter(Boolean);

    const excluded = isExcludedFromTest(char);

    content.innerHTML = `
      <div class="detail-char">${char}</div>
      <p class="detail-subtitle">${subtitle}</p>

      ${rankRowHtml(getRank(char), excluded, dataset.isKanjiChar(char))}

      <div class="detail-section">
        <div class="stroke-order-card" id="stroke-order-container"></div>
      </div>

      ${
        readingRows.length
          ? `<div class="detail-section">
              <div class="readings-card">
                ${readingRows
                  .map(([label, value]) => `<div class="readings-row"><span>${label}</span><span>${value}</span></div>`)
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <div class="detail-section">
        <h3>Sub-components</h3>
        ${
          entry.components.length > 0
            ? `<div class="chip-grid chip-row-scroll">${entry.components.map((c) => chipHtml(c)).join('')}</div>`
            : '<p class="stat-line">No further decomposition in this dataset.</p>'
        }
        ${
          entry.isRadical
            ? `<p class="stat-line">Used in ${entry.kanjiUsing.length} kanji.</p>`
            : ''
        }
      </div>

      <a class="jisho-link" href="${jishoUrl(char)}" target="_blank" rel="noopener">Open on Jisho ↗</a>
    `;

    window.StrokeOrder.renderInto(content.querySelector('#stroke-order-container'), char);

    bindRankRow(content, {
      onSelectRank: (newRank) => {
        setRank(char, newRank);
        render();
      },
      onToggleExclude: () => {
        setExcludedFromTest(char, !isExcludedFromTest(char));
        render();
      },
    });

    bindChips(content, (char) => {
      stack.push(char);
      render();
      backBtn.classList.remove('hidden');
    });

    backBtn.classList.toggle('hidden', stack.length <= 1);

    // Prev/Next only make sense at the root of the stack (not while drilled
    // into a sub-component) and when opened with an ordered list to move through.
    const navIndex = stack.length === 1 ? navList.indexOf(char) : -1;
    prevBtn.classList.toggle('hidden', navIndex <= 0);
    nextBtn.classList.toggle('hidden', navIndex === -1 || navIndex >= navList.length - 1);
    positionEl.textContent = navIndex === -1 ? '' : `${navIndex + 1} of ${navList.length}`;
  };

  const goToOffset = (delta) => {
    if (stack.length !== 1) return;
    const idx = navList.indexOf(stack[0]);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= navList.length) return;
    stack = [navList[newIdx]];
    render();
  };

  const initDetailPanel = (loadedDataset) => {
    dataset = loadedDataset;

    backBtn.addEventListener('click', () => {
      stack.pop();
      render();
    });

    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      stack = [];
      navList = [];
    });

    prevBtn.addEventListener('click', () => goToOffset(-1));
    nextBtn.addEventListener('click', () => goToOffset(1));
    onHorizontalSwipe(panel, SWIPE_THRESHOLD_PX, goToOffset);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeBtn.click();
    });

    // Keyboard shortcuts for ranking the character currently open: 1 Unknown,
    // 2 Learning, 3 Familiar, 4 Known. Left/Right move through navList.
    document.addEventListener('keydown', (e) => {
      if (overlay.classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') return goToOffset(-1);
      if (e.key === 'ArrowRight') return goToOffset(1);
      const rank = { '1': 0, '2': 1, '3': 2, '4': 3 }[e.key];
      if (rank === undefined) return;
      setRank(stack[stack.length - 1], rank);
      render();
    });
  };

  // `navList`, when given, is the ordered list of chars this was opened from
  // (e.g. the current Kanji tab listing), enabling Prev/Next and swipe.
  const openDetail = (char, navListArg = []) => {
    stack = [char];
    navList = navListArg;
    overlay.classList.remove('hidden');
    render();
  };

  // Re-render the open panel in place, e.g. after ranks change elsewhere.
  const refreshDetailIfOpen = () => {
    if (!overlay.classList.contains('hidden') && stack.length > 0) render();
  };

  return { initDetailPanel, openDetail, refreshDetailIfOpen };
})();
