// "Test" tab: flashcard-style drill over the kanji you're studying, drawn by
// SRS band. Practice only reads progress — it never grades an SRS track.
// Plain script (no ES modules), exposed as window.TestView — see state.js for why.

window.TestView = (() => {
  const { isStudying, getChipBand, getPracticeWeights } = window.State;
  const { icons } = window.Ui;
  const { render: renderFlashcard, dedupeAdjacent, shuffle, setBottomTabsHidden } = window.Flashcard;

  // Chip band (1..3) -> the practice weight key that governs it.
  const BAND_KEYS = { 1: 'new', 2: 'mid', 3: 'mature' };

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

  // Studying kanji only, bucketed by band (new / mid / mature).
  const poolByBand = () => {
    const buckets = { new: [], mid: [], mature: [] };
    for (const k of dataset.kanji) {
      if (!isStudying(k.char)) continue;
      buckets[BAND_KEYS[getChipBand(k.char)]].push(k.char);
    }
    return buckets;
  };

  // Builds a BAG_SIZE-slot deck matching the configured band weights (relative,
  // needn't sum to 100 — normalized below), dropping any band with no
  // candidates and renormalizing the rest so their weight isn't wasted.
  const buildBag = () => {
    const buckets = poolByBand();
    const weights = getPracticeWeights();
    const bands = Object.keys(buckets).filter((band) => buckets[band].length > 0 && weights[band] > 0);
    if (bands.length === 0) return [];

    const totalWeight = bands.reduce((sum, band) => sum + weights[band], 0);
    const newBag = [];
    let assigned = 0;
    bands.forEach((band, i) => {
      const isLast = i === bands.length - 1;
      const slots = isLast ? BAG_SIZE - assigned : Math.round((BAG_SIZE * weights[band]) / totalWeight);
      assigned += slots;
      const candidates = buckets[band];
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

  const renderEmptyState = () => {
    setBottomTabsHidden(container, false);
    container.innerHTML = `
      <div class="session-empty">
        <p class="stat-line">Turn on Studying for some kanji to start practicing.</p>
      </div>
    `;
  };

  const renderReport = () => {
    setBottomTabsHidden(container, false);
    const total = correctCount + incorrectCount;
    container.innerHTML = `
      <div class="session-report">
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
    setBottomTabsHidden(container, true);
    const total = correctCount + incorrectCount;
    const accuracyPct = total === 0 ? 0 : Math.round((correctCount / total) * 100);

    container.innerHTML = `
      <div class="session-topbar">
        <button id="test-finish-btn" class="icon-btn ghost-icon-btn" title="Finish test" aria-label="Finish test">
          ${icons.close}
        </button>
        <span class="stat-line">${correctCount} correct &middot; ${incorrectCount} incorrect</span>
      </div>
      <div class="session-progress"><div class="session-progress-fill" style="width:${accuracyPct}%"></div></div>

      <div class="session-body">
        <div id="test-card-mount"></div>
      </div>
    `;

    // Practice always asks kanji -> meaning; the writing direction is SRS-only.
    renderFlashcard(container.querySelector('#test-card-mount'), {
      char: currentChar,
      direction: 'meaning',
      revealed: flipped,
      dataset,
      onReveal: () => {
        flipped = true;
        render();
      },
      onAnswer: answer,
    });

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

  // Called on every progress change; only acts while stuck on the empty state
  // (no active session to disturb), so a pool that just became non-empty
  // elsewhere (e.g. studying a kanji from another tab) is picked up here.
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
