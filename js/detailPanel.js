// The "chunk container" detail panel, shared by radicals and kanji: shows
// sub-components (drill-down), a link to Jisho for stroke order, the studying
// switch (top-left of the top bar, no label), and (for actual kanji only — see dataset.isKanjiChar) the SRS track
// lines and a one-line description note. Both entry types render through the
// same render() function.
// Plain script (no ES modules), exposed as window.DetailPanel — see state.js for why.

window.DetailPanel = (() => {
  const {
    isStudying,
    setStudying,
    getSrs,
    getDescription,
    setDescription,
    getKeyword,
    setKeyword,
    getRtkOverride,
    setRtkOverride,
    isValidRtk,
    countWords,
    DESCRIPTION_MAX_WORDS,
    KEYWORD_MAX_LENGTH,
  } = window.State;
  const { today } = window.Srs;
  const { escapeHtml, chipHtml, bindChips, studyToggleHtml, bindStudyToggle, srsTracksHtml, onHorizontalSwipe } =
    window.Ui;

  const SWIPE_THRESHOLD_PX = 40;

  let dataset = null;
  let stack = [];
  // Ordered list of chars the panel was opened from (e.g. the current Kanji
  // tab listing), letting Prev/Next and swipe move through it without closing
  // the panel. Empty when opened from a context with no such ordering (e.g.
  // Radicals), or once the user has drilled into a sub-component.
  let navList = [];

  // Set while the description / keyword / RTK fields commit, so the state change
  // they cause doesn't re-render the panel out from under the user (see
  // refreshDetailIfOpen).
  let committingField = false;

  const overlay = document.getElementById('detail-overlay');
  const content = document.getElementById('detail-content');
  const studySlot = document.getElementById('detail-study');
  const backBtn = document.getElementById('detail-back');
  const closeBtn = document.getElementById('detail-close');
  const prevBtn = document.getElementById('detail-prev');
  const nextBtn = document.getElementById('detail-next');
  const positionEl = document.getElementById('detail-position');
  const panel = document.querySelector('.detail-panel');

  // The "#kanji" filter routes to Jisho's kanji-detail page (stroke order, readings,
  // meanings) instead of the general dictionary search results.
  const jishoUrl = (char) => `https://jisho.org/search/${encodeURIComponent(`${char} #kanji`)}`;

  // Counts words live while typing, but only commits (Enter / blur) when the
  // text actually changed and is within the limit — never on each keystroke.
  const bindDescriptionField = (char) => {
    const field = content.querySelector('.description-field');
    const input = field.querySelector('input');
    const counter = field.querySelector('.description-counter');

    input.addEventListener('input', () => {
      const words = countWords(input.value);
      counter.textContent = `${words}/${DESCRIPTION_MAX_WORDS} words`;
      field.classList.toggle('invalid', words > DESCRIPTION_MAX_WORDS);
    });

    const commit = () => {
      const text = input.value.replace(/\s+/g, ' ').trim();
      if (countWords(text) > DESCRIPTION_MAX_WORDS || text === getDescription(char)) return;
      committingField = true;
      setDescription(char, text);
      committingField = false;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
    });
    input.addEventListener('blur', commit);
  };

  // Same commit pattern as the description (Enter / blur, only when changed,
  // never re-rendering mid-typing). An empty number clears the override; a
  // non-integer or out-of-range one is flagged invalid and not saved.
  const bindRtkFields = (char) => {
    const keywordInput = content.querySelector('#keyword-input');
    const rtkInput = content.querySelector('#rtk-input');

    const commitKeyword = () => {
      const text = keywordInput.value.replace(/\s+/g, ' ').trim();
      if (text === getKeyword(char)) return;
      committingField = true;
      setKeyword(char, text);
      committingField = false;
    };

    const rtkValue = () => (rtkInput.value.trim() === '' ? null : Number(rtkInput.value));

    rtkInput.addEventListener('input', () => {
      const value = rtkValue();
      rtkInput.classList.toggle('invalid', value !== null && !isValidRtk(value));
    });

    const commitRtk = () => {
      const value = rtkValue();
      if (value !== null && !isValidRtk(value)) return;
      if (value === getRtkOverride(char)) return;
      committingField = true;
      setRtkOverride(char, value);
      committingField = false;
      content.querySelector('.detail-subtitle').textContent = subtitleFor(char);
    };

    for (const [input, commit] of [
      [keywordInput, commitKeyword],
      [rtkInput, commitRtk],
    ]) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      input.addEventListener('blur', commit);
    }
  };

  const subtitleFor = (char) => {
    const entry = dataset.getEntry(char);
    const jlptLevel = dataset.getJlptLevel(char);
    const rtkNumber = dataset.getRtkNumber(char);
    return [
      entry.isRadical ? `Radical · ${entry.strokeCount} strokes` : 'Kanji',
      jlptLevel ? `JLPT N${jlptLevel}` : null,
      rtkNumber ? `RTK #${rtkNumber}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const render = () => {
    const char = stack[stack.length - 1];
    const entry = dataset.getEntry(char);
    if (!entry) return;

    const readings = dataset.getReadings(char);

    const rtk = dataset.getRtk(char);
    const readingRows = [
      rtk ? [`RTK 6th · #${rtk.number}`, escapeHtml(rtk.keyword)] : null,
      readings?.meanings.length ? ['Concept', readings.meanings.join(', ')] : null,
      readings?.kun.length ? ["Kun'yomi", readings.kun.join('、 ')] : null,
      readings?.on.length ? ["On'yomi", readings.on.join('、 ')] : null,
    ].filter(Boolean);

    const isKanji = dataset.isKanjiChar(char);
    const srs = getSrs(char);
    const description = getDescription(char);
    const rtkOverride = getRtkOverride(char);
    const rtkDefault = dataset.getDefaultRtkNumber(char);

    // The switch is per character, so it is re-rendered with the char into the
    // top bar's slot rather than living in the scrolling body.
    studySlot.innerHTML = studyToggleHtml(isStudying(char), { compact: true });

    content.innerHTML = `
      <div class="detail-char">${char}</div>
      <p class="detail-subtitle">${subtitleFor(char)}</p>

      ${srs && isStudying(char) ? srsTracksHtml(srs, today()) : ''}
      ${
        isKanji
          ? `<div class="detail-section description-field${countWords(description) > DESCRIPTION_MAX_WORDS ? ' invalid' : ''}">
              <input type="text" id="description-input" value="${escapeHtml(description)}" placeholder="Your note on this kanji…" aria-label="Description" />
              <div class="description-counter" id="description-counter">${countWords(description)}/${DESCRIPTION_MAX_WORDS} words</div>
            </div>
            <div class="detail-section rtk-row">
              <input type="text" id="keyword-input" class="rtk-keyword" value="${escapeHtml(getKeyword(char))}" maxlength="${KEYWORD_MAX_LENGTH}" placeholder="${escapeHtml(dataset.getRtk(char)?.keyword || 'RTK keyword')}" aria-label="RTK keyword" />
              <input type="number" id="rtk-input" class="rtk-number" min="1" max="9999" step="1" value="${rtkOverride ?? ''}" placeholder="${rtkDefault ?? '#'}" aria-label="RTK number (empty uses the default${rtkDefault ? ` #${rtkDefault}` : ''})" />
            </div>`
          : ''
      }

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

    bindStudyToggle(studySlot, (on) => setStudying(char, on, { isKanji }));

    if (isKanji) {
      bindDescriptionField(char);
      bindRtkFields(char);
    }

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

    // Left/Right move through navList (ignored while typing in a field).
    document.addEventListener('keydown', (e) => {
      if (overlay.classList.contains('hidden') || e.target.matches('input, textarea')) return;
      if (e.key === 'ArrowLeft') goToOffset(-1);
      if (e.key === 'ArrowRight') goToOffset(1);
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

  // Re-render the open panel in place, e.g. after progress changes elsewhere.
  const refreshDetailIfOpen = () => {
    if (committingField) return;
    if (!overlay.classList.contains('hidden') && stack.length > 0) render();
  };

  return { initDetailPanel, openDetail, refreshDetailIfOpen };
})();
