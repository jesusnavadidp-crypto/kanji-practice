// "Test" tab: flashcard-style drill over kanji you've already ranked
// Learning+ (rank >= 1) — ranking a kanji Unknown means there's nothing to
// test yet, so it's excluded from the draw pool. A kanji can also be
// individually excluded (e.g. known by heart) via State.setExcludedFromTest,
// toggled from here or from the detail sheet.
// Plain script (no ES modules), exposed as window.TestView — see state.js for why.

window.TestView = (() => {
  const { getRank, setRank, isExcludedFromTest, setExcludedFromTest, getTestWeights } = window.State;
  const { icons, rankRowHtml, bindRankRow } = window.Ui;

  const container = document.getElementById('test-view');
  let dataset = null;

  let currentChar = null;
  let flipped = false;
  let correctCount = 0;
  let incorrectCount = 0;
  let finished = false;

  // Practice should skew toward what's least solid: a Learning kanji should
  // come up much more often than a Known one. Draws are dealt from a small
  // shuffled "bag" built to this ratio (configurable — see Configurations in
  // the ☰ menu), rather than plain weighted random, so the ratio holds even
  // within a short session instead of only converging to it over a long one.
  const BAG_SIZE = 10;

  let bag = [];
  let bagIndex = 0;
  let lastDealt = null;

  // Excludes kanji marked "don't test me" (State.setExcludedFromTest), e.g.
  // ones already known by heart — set from here or from the detail sheet.
  const poolByRank = () => {
    const buckets = { 1: [], 2: [], 3: [] };
    for (const k of dataset.kanji) {
      if (isExcludedFromTest(k.char)) continue;
      const bucket = buckets[getRank(k.char)];
      if (bucket) bucket.push(k.char);
    }
    return buckets;
  };

  const shuffle = (list) => {
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Best-effort: swaps a card that landed next to an identical one with a
  // different card elsewhere. Prefers a later slot (a swap made there is
  // re-checked by this same forward pass); falls back to an earlier one when
  // the duplicate landed at the very end of the bag, with nothing after it
  // to swap with. Can't always fully resolve (e.g. a bag that's
  // overwhelmingly one character), but handles the typical case.
  // `previous` is the card dealt just before this bag, so the seam between two
  // consecutive bags gets the same treatment as any other adjacent pair.
  const dedupeAdjacent = (list, previous) => {
    const deduped = [...list];
    for (let i = 0; i < deduped.length; i++) {
      const before = i === 0 ? previous : deduped[i - 1];
      if (deduped[i] !== before) continue;
      let swapIdx = deduped.findIndex((c, idx) => idx > i && c !== deduped[i]);
      if (swapIdx === -1) swapIdx = deduped.findIndex((c, idx) => idx < i - 1 && c !== deduped[i]);
      if (swapIdx !== -1) [deduped[i], deduped[swapIdx]] = [deduped[swapIdx], deduped[i]];
    }
    return deduped;
  };

  // Builds a BAG_SIZE-slot deck matching the configured rank weights (relative,
  // needn't sum to 100 — normalized below), dropping any rank with no
  // candidates and renormalizing the rest so their weight isn't wasted.
  const buildBag = () => {
    const buckets = poolByRank();
    const weights = getTestWeights();
    const ranks = Object.keys(weights)
      .map(Number)
      .filter((rank) => buckets[rank].length > 0 && weights[rank] > 0);
    if (ranks.length === 0) return [];

    const totalWeight = ranks.reduce((sum, rank) => sum + weights[rank], 0);
    const newBag = [];
    let assigned = 0;
    ranks.forEach((rank, i) => {
      const isLast = i === ranks.length - 1;
      const slots = isLast ? BAG_SIZE - assigned : Math.round((BAG_SIZE * weights[rank]) / totalWeight);
      assigned += slots;
      const candidates = buckets[rank];
      for (let n = 0; n < slots; n++) {
        newBag.push(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    });

    return dedupeAdjacent(shuffle(newBag), lastDealt);
  };

  const dealNext = () => {
    if (bagIndex >= bag.length) {
      bag = buildBag();
      bagIndex = 0;
    }
    if (bag.length === 0) return null;
    lastDealt = bag[bagIndex++];
    return lastDealt;
  };

  const startSession = () => {
    correctCount = 0;
    incorrectCount = 0;
    finished = false;
    flipped = false;
    currentChar = dealNext();
    render();
  };

  const answer = (isCorrect) => {
    if (isCorrect) correctCount += 1;
    else incorrectCount += 1;
    flipped = false;
    currentChar = dealNext();
    render();
  };

  const finishSession = () => {
    finished = true;
    render();
  };

  const cardBackHtml = (char) => {
    const readings = dataset.getReadings(char);
    return `
      <div class="test-back">
        <button type="button" id="test-flip-back-btn" class="flip-back-btn">
          ${icons.undo}
          <span>Show character</span>
        </button>
        ${
          readings
            ? `${readings.on.length ? `<p class="stat-line">On: ${readings.on.join('、 ')}</p>` : ''}
               ${readings.kun.length ? `<p class="stat-line">Kun: ${readings.kun.join('、 ')}</p>` : ''}
               ${readings.meanings.length ? `<p class="stat-line">${readings.meanings.join(', ')}</p>` : ''}`
            : '<p class="stat-line">No readings/meaning available.</p>'
        }
        <div id="test-stroke-order-container"></div>
      </div>
    `;
  };

  // The bottom tab bar (Radicals/Kanji) is hidden only while an actual card
  // is up AND Test is the view actually on screen — that's the one moment
  // its own fixed answer buttons need the room. It's shown again on the
  // empty state and the report, so finishing (or never starting) a session
  // never leaves you without a way back. The "is Test on screen" guard
  // matters because render() runs even while Test is in the background —
  // at startup (renderTestView), and whenever a rank change elsewhere makes
  // the pool non-empty (refreshTestIfEmpty) — and none of that should be
  // able to hide the bar while you're actually looking at Radicals/Kanji.
  const setBottomTabsHidden = (hidden) => {
    if (hidden && container.classList.contains('hidden')) return;
    document.getElementById('bottom-tabs').classList.toggle('hidden', hidden);
  };

  const renderEmptyState = () => {
    setBottomTabsHidden(false);
    container.innerHTML = `
      <div class="test-empty">
        <p class="stat-line">Rank some kanji as Learning or higher to start testing yourself.</p>
      </div>
    `;
  };

  const renderReport = () => {
    setBottomTabsHidden(false);
    const total = correctCount + incorrectCount;
    container.innerHTML = `
      <div class="test-report">
        <h2>Test Report</h2>
        <p class="stat-line">Total tested: ${total}</p>
        <p class="stat-line">Correct: ${correctCount}</p>
        <p class="stat-line">Incorrect: ${incorrectCount}</p>
        <button id="test-restart-btn" class="primary-btn">Start New Test</button>
      </div>
    `;
    container.querySelector('#test-restart-btn').addEventListener('click', startSession);
  };

  const renderCard = () => {
    setBottomTabsHidden(true);
    const total = correctCount + incorrectCount;
    const accuracyPct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    const excluded = isExcludedFromTest(currentChar);

    container.innerHTML = `
      <div class="test-topbar">
        <button id="test-finish-btn" class="icon-btn ghost-icon-btn" title="Finish test" aria-label="Finish test">
          ${icons.close}
        </button>
        <span class="stat-line">${correctCount} correct &middot; ${incorrectCount} incorrect</span>
      </div>
      <div class="test-progress"><div class="test-progress-fill" style="width:${accuracyPct}%"></div></div>

      <div class="test-session-body">
        ${rankRowHtml(getRank(currentChar), excluded)}

        <div class="test-card">
          ${
            flipped
              ? cardBackHtml(currentChar)
              : `<button type="button" id="test-flip-btn" class="test-char" aria-label="Reveal answer">
                  <span class="test-char-glyph">${currentChar}</span>
                  <span class="test-char-hint">Tap to reveal</span>
                </button>`
          }
        </div>
      </div>
      <div class="test-answer-buttons">
        <button id="test-incorrect-btn" class="answer-icon-btn incorrect" title="Incorrect" aria-label="Incorrect">${icons.crossBold}</button>
        <button id="test-correct-btn" class="answer-icon-btn correct" title="Correct" aria-label="Correct">${icons.checkBold}</button>
      </div>
    `;

    if (flipped) {
      window.StrokeOrder.renderInto(container.querySelector('#test-stroke-order-container'), currentChar);
      container.querySelector('#test-flip-back-btn').addEventListener('click', () => {
        flipped = false;
        render();
      });
    } else {
      container.querySelector('#test-flip-btn').addEventListener('click', () => {
        flipped = true;
        render();
      });
    }

    bindRankRow(container, {
      onSelectRank: (newRank) => {
        setRank(currentChar, newRank);
        render();
      },
      onToggleExclude: () => {
        // Just flips the toggle in place — same card stays up, same as in
        // the detail sheet. It'll simply stop being drawn once the next
        // bag is built (see poolByRank).
        setExcludedFromTest(currentChar, !isExcludedFromTest(currentChar));
        render();
      },
    });

    container.querySelector('#test-correct-btn').addEventListener('click', () => answer(true));
    container.querySelector('#test-incorrect-btn').addEventListener('click', () => answer(false));
    container.querySelector('#test-finish-btn').addEventListener('click', finishSession);
  };

  const render = () => {
    if (finished) return renderReport();
    if (!currentChar) return renderEmptyState();
    renderCard();
  };

  const renderTestView = (loadedDataset) => {
    dataset = loadedDataset;
    startSession();
  };

  // Called on every rank change; only acts while stuck on the empty state
  // (no active session to disturb), so a pool that just became non-empty
  // elsewhere (e.g. ranking a kanji from another tab) is picked up here.
  const refreshTestIfEmpty = () => {
    if (!finished && !currentChar) startSession();
  };

  // Called whenever Test becomes the visible view (the ☰ menu item). Starts a
  // session if there isn't one, otherwise re-renders the current one untouched
  // — the re-render is what re-applies setBottomTabsHidden() for Test, which
  // would otherwise keep whatever state the *previous* view left it in.
  const showTestView = () => {
    if (!currentChar && !finished) startSession();
    else render();
  };

  return { renderTestView, refreshTestIfEmpty, showTestView };
})();
