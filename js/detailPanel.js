// The "chunk container" detail panel, shared by radicals and kanji: shows
// sub-components (drill-down), a link to Jisho for stroke order, and the rank
// selector. Both entry types render through the same renderDetail() function.
// Plain script (no ES modules), exposed as window.DetailPanel — see state.js for why.

window.DetailPanel = (() => {
  const { getRank, setRank } = window.State;

  const RANK_LABELS = ['Unknown', 'Learning', 'Familiar', 'Known'];

  let dataset = null;
  let stack = [];

  const overlay = document.getElementById('detail-overlay');
  const content = document.getElementById('detail-content');
  const backBtn = document.getElementById('detail-back');
  const closeBtn = document.getElementById('detail-close');

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
      <div class="detail-char">${char}</div>
      <div class="detail-subtitle">${subtitle}</div>

      <div class="rank-selector">
        ${RANK_LABELS.map(
          (label, i) => `<button class="rank-btn${i === rank ? ' selected' : ''}" data-rank="${i}">${label}</button>`
        ).join('')}
      </div>

      ${
        readings
          ? `<div class="detail-section">
              <h3>Readings &amp; Meaning</h3>
              ${readings.on.length ? `<p class="stat-line">On: ${readings.on.join('、 ')}</p>` : ''}
              ${readings.kun.length ? `<p class="stat-line">Kun: ${readings.kun.join('、 ')}</p>` : ''}
              ${readings.meanings.length ? `<p class="stat-line">${readings.meanings.join(', ')}</p>` : ''}
            </div>`
          : ''
      }

      <div class="detail-section">
        <h3>Stroke Order</h3>
        <div id="stroke-order-container"></div>
      </div>

      <a class="primary-btn" href="${jishoUrl(char)}" target="_blank" rel="noopener">Open on Jisho ↗</a>

      <div class="detail-section">
        <h3>Sub-components</h3>
        ${
          entry.components.length > 0
            ? `<div class="chip-grid">${entry.components
                .map((c) => `<button class="chip rank-${getRank(c)}" data-char="${c}">${c}</button>`)
                .join('')}</div>`
            : '<p class="stat-line">No further decomposition in this dataset.</p>'
        }
      </div>

      ${
        entry.isRadical
          ? `<p class="stat-line">Used in ${entry.kanjiUsing.length} kanji.</p>`
          : ''
      }
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
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeBtn.click();
    });

    // Keyboard shortcuts for ranking the character currently open: 1 Unknown,
    // 2 Learning, 3 Familiar, 4 Known.
    document.addEventListener('keydown', (e) => {
      if (overlay.classList.contains('hidden')) return;
      const rank = { '1': 0, '2': 1, '3': 2, '4': 3 }[e.key];
      if (rank === undefined) return;
      setRank(stack[stack.length - 1], rank);
      render();
    });
  };

  const openDetail = (char) => {
    stack = [char];
    overlay.classList.remove('hidden');
    render();
  };

  // Re-render the open panel in place, e.g. after ranks change elsewhere.
  const refreshDetailIfOpen = () => {
    if (!overlay.classList.contains('hidden') && stack.length > 0) render();
  };

  return { initDetailPanel, openDetail, refreshDetailIfOpen };
})();
