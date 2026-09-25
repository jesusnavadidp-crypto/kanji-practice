// The "chunk container" detail panel, shared by radicals and kanji: shows
// sub-components (drill-down), a link to Jisho for stroke order, and the rank
// selector. Both entry types render through the same renderDetail() function.
// Plain script (no ES modules), exposed as window.DetailPanel — see state.js for why.

window.DetailPanel = (() => {
  const { RANK_LABELS, getRank, setRank } = window.State;

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
  const panel = document.querySelector('.detail-panel');

  // The "#kanji" filter routes to Jisho's kanji-detail page (stroke order, readings,
  // meanings) instead of the general dictionary search results.
  const jishoUrl = (char) => `https://jisho.org/search/${encodeURIComponent(`${char} #kanji`)}`;

  const render = () => {
    const char = stack[stack.length - 1];
    const entry = dataset.getEntry(char);
    if (!entry) return;

    const rank = getRank(char);
    const jlptLevel = dataset.getJlptLevel(char);
    const readings = dataset.getReadings(char);
    const subtitle = [
      entry.isRadical ? `Radical · ${entry.strokeCount} strokes` : 'Kanji',
      jlptLevel ? `JLPT N${jlptLevel}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    content.innerHTML = `
      <div class="rank-selector">
        ${RANK_LABELS.map(
          (label, i) => `<button class="rank-btn${i === rank ? ' selected' : ''}" data-rank="${i}">${label}</button>`
        ).join('')}
      </div>

      <div class="detail-char">${char}</div>

      ${
        readings && readings.meanings.length
          ? `<div class="detail-section">
              <h3>Concept</h3>
              <p class="stat-line">${readings.meanings.join(', ')}</p>
            </div>`
          : ''
      }

      ${
        readings && readings.kun.length
          ? `<div class="detail-section">
              <h3>Kun'yomi</h3>
              <p class="stat-line">${readings.kun.join('、 ')}</p>
            </div>`
          : ''
      }

      ${
        readings && readings.on.length
          ? `<div class="detail-section">
              <h3>On'yomi</h3>
              <p class="stat-line">${readings.on.join('、 ')}</p>
            </div>`
          : ''
      }

      <div class="detail-section">
        <div id="stroke-order-container"></div>
      </div>

      <div class="detail-section">
        <p class="detail-subtitle">${subtitle}</p>
        <a class="primary-btn" href="${jishoUrl(char)}" target="_blank" rel="noopener">Open on Jisho ↗</a>
        <h3>Sub-components</h3>
        ${
          entry.components.length > 0
            ? `<div class="chip-grid">${entry.components
                .map((c) => `<button class="chip rank-${getRank(c)}" data-char="${c}">${c}</button>`)
                .join('')}</div>`
            : '<p class="stat-line">No further decomposition in this dataset.</p>'
        }
        ${
          entry.isRadical
            ? `<p class="stat-line">Used in ${entry.kanjiUsing.length} kanji.</p>`
            : ''
        }
      </div>
    `;

    window.StrokeOrder.renderInto(content.querySelector('#stroke-order-container'), char);

    content.querySelectorAll('.rank-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setRank(char, Number(btn.dataset.rank));
        render();
      });
    });

    content.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        stack.push(chip.dataset.char);
        render();
        backBtn.classList.remove('hidden');
      });
    });

    backBtn.classList.toggle('hidden', stack.length <= 1);

    // Prev/Next only make sense at the root of the stack (not while drilled
    // into a sub-component) and when opened with an ordered list to move through.
    const navIndex = stack.length === 1 ? navList.indexOf(char) : -1;
    prevBtn.classList.toggle('hidden', navIndex <= 0);
    nextBtn.classList.toggle('hidden', navIndex === -1 || navIndex >= navList.length - 1);
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

  const initSwipeNavigation = () => {
    let startX = 0;
    let startY = 0;

    panel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });

    panel.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
      goToOffset(deltaX < 0 ? 1 : -1);
    });
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
    initSwipeNavigation();

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
