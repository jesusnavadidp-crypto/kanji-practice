// Practice Test drills studying kanji in uniform shuffled cycles.
// Practice never grades an SRS track.
// Plain script (no ES modules), exposed as window.TestView — see state.js for why.

window.TestView = (() => {
  const { isExcludedFromTests, isStudying } = window.State;
  const { icons } = window.Ui;
  const { render: renderFlashcard, dedupeAdjacent, shuffle, setBottomTabsHidden } = window.Flashcard;

  const container = document.getElementById('test-view');
  let dataset = null;
  let onShowKanjiTab = () => {};

  let currentChar = null;
  let flipped = false;
  let correctCount = 0;
  let incorrectCount = 0;
  let finished = false;

  // Uniform coverage: each eligible character appears once per shuffled cycle.
  // Practice reads eligibility only and never grades or reads SRS maturity.
  let bag = [];
  let bagIndex = 0;
  let lastDealt = null;
  const eligibleChars = () => dataset.kanji
    .filter((k) => dataset.isTestEligible(k.char) && isStudying(k.char) && !isExcludedFromTests(k.char))
    .map((k) => k.char);
  let poolSignature = '';
  const buildBag = () => dedupeAdjacent(shuffle(eligibleChars()), lastDealt);

  const dealNext = () => {
    if (bagIndex >= bag.length) {
      bag = buildBag();
      bagIndex = 0;
    }
    if (bag.length === 0) return null;
    if (isExcludedFromTests(bag[bagIndex]) || !isStudying(bag[bagIndex])) {
      bag.splice(bagIndex, 1);
      return dealNext();
    }
    lastDealt = bag[bagIndex++];
    return lastDealt;
  };

  const startSession = () => {
    bag = [];
    bagIndex = 0;
    poolSignature = eligibleChars().join('');
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
        <h2>No kanji to practice yet</h2>
        <p class="stat-line">Choose some kanji and turn on Studying to begin.</p>
        <button type="button" class="primary-btn" id="test-browse-btn">Browse kanji</button>
      </div>
    `;
    container.querySelector('#test-browse-btn').addEventListener('click', onShowKanjiTab);
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

  const renderTestView = (loadedDataset, showKanjiTab) => {
    onShowKanjiTab = showKanjiTab;
    dataset = loadedDataset;
    startSession();
  };

  // Drop excluded cards from the retained bag and current card. An empty
  // session picks up kanji that have just been included or enabled elsewhere.
  const refreshTestIfEmpty = () => {
    const signature = eligibleChars().join('');
    if (signature !== poolSignature) {
      poolSignature = signature;
      bag = shuffle(eligibleChars().filter((char) => char !== currentChar));
      bagIndex = 0;
    }
    if (!finished && currentChar && (isExcludedFromTests(currentChar) || !isStudying(currentChar))) {
      currentChar = dealNext();
      flipped = false;
      render();
    }
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
