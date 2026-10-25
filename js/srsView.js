// "SRS Review": works through today's due (kanji, track) cards on the shared
// flashcard. This is the only place that grades an SRS track. A wrong answer
// resets the track and puts the card back at the end of the queue, so it comes
// round again this session.
// Plain script (no ES modules), exposed as window.SrsView — see state.js for why.

window.SrsView = (() => {
  const { isExcludedFromTests, getDueCards, getStudyingChars, getSrs, gradeTrack } = window.State;
  const { icons, srsTracksHtml } = window.Ui;
  const { today, daysBetween } = window.Srs;
  const { render: renderFlashcard, dedupeAdjacent, shuffle, setBottomTabsHidden } = window.Flashcard;

  const container = document.getElementById('srs-view');
  let dataset = null;
  let onShowKanjiTab = () => {};

  // A card is { char, track }; the queue head is the card on screen.
  let queue = [];
  let total = 0;
  let reviewedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let revealed = false;
  let finished = false;

  const sameChar = (card) => card.char;

  // Shuffled, with the same char's two tracks kept apart where possible.
  const buildQueue = (cards) => dedupeAdjacent(shuffle(cards), null, sameChar);

  // A failed card goes to the back, again keeping a char's tracks apart where
  // possible (a lone remaining card can't avoid repeating itself).
  const requeue = (rest, card) => dedupeAdjacent([...rest, card], null, sameChar);

  // Whole days until the earliest upcoming review among studying kanji, or
  // null when nothing is scheduled.
  const daysUntilNextDue = () => {
    const dues = getStudyingChars()
      .filter((char) => dataset.isTestEligible(char) && !isExcludedFromTests(char))
      .map(getSrs)
      .filter(Boolean)
      .flatMap((srs) => [srs.meaning.nextSrsReviewDate, srs.writing.nextSrsReviewDate]);
    if (dues.length === 0) return null;
    return daysBetween(today(), dues.reduce((min, due) => (due < min ? due : min)));
  };

  const nextDueText = (days) => (days === null ? '' : `Next review in ${days <= 1 ? '1 day' : `${days} days`}.`);

  const startSession = () => {
    queue = buildQueue(getDueCards());
    total = queue.length;
    reviewedCount = 0;
    correctCount = 0;
    incorrectCount = 0;
    revealed = false;
    finished = false;
    render();
  };

  const answer = (isCorrect) => {
    const [card, ...rest] = queue;
    gradeTrack(card.char, card.track, isCorrect);
    reviewedCount += 1;
    if (isCorrect) {
      correctCount += 1;
      queue = rest;
    } else {
      incorrectCount += 1;
      queue = requeue(rest, card);
    }
    revealed = false;
    finished = queue.length === 0;
    render();
  };

  const finishSession = () => {
    finished = true;
    render();
  };

  const renderEmptyState = () => {
    setBottomTabsHidden(container, false);
    const next = nextDueText(daysUntilNextDue());
    container.innerHTML = `
      <div class="session-empty">
        <h2>No reviews due</h2>
        ${next ? `<p class="stat-line">${next}</p>` : '<p class="stat-line">Choose some kanji to start learning.</p>'}
        <button type="button" class="primary-btn" id="srs-browse-btn">Browse kanji</button>
      </div>
    `;
    container.querySelector('#srs-browse-btn').addEventListener('click', onShowKanjiTab);
  };

  const renderReport = () => {
    setBottomTabsHidden(container, false);
    container.innerHTML = `
      <div class="session-report">
        <h2>Done for today</h2>
        <p class="stat-line">Reviewed: ${reviewedCount}</p>
        <p class="stat-line">Correct: ${correctCount}</p>
        <p class="stat-line">Incorrect: ${incorrectCount}</p>
        <button id="srs-back-btn" class="primary-btn">Back to Kanji</button>
      </div>
    `;
    container.querySelector('#srs-back-btn').addEventListener('click', onShowKanjiTab);
  };

  const renderCard = () => {
    setBottomTabsHidden(container, true);
    const { char, track } = queue[0];
    const progressPct = total === 0 ? 0 : Math.round((reviewedCount / total) * 100);

    container.innerHTML = `
      <div class="session-topbar">
        <button id="srs-finish-btn" class="icon-btn ghost-icon-btn" title="Finish review" aria-label="Finish review">
          ${icons.close}
        </button>
        <span class="stat-line">${queue.length} left</span>
      </div>
      <div class="session-progress"><div class="session-progress-fill" style="width:${progressPct}%"></div></div>

      <div class="session-body">
        ${srsTracksHtml(getSrs(char), today(), track)}
        <div id="srs-card-mount"></div>
      </div>
    `;

    renderFlashcard(container.querySelector('#srs-card-mount'), {
      char,
      direction: track,
      revealed,
      dataset,
      onReveal: () => {
        revealed = true;
        render();
      },
      onAnswer: answer,
    });

    container.querySelector('#srs-finish-btn').addEventListener('click', finishSession);
  };

  const render = () => {
    if (finished) return renderReport();
    if (queue.length === 0) return renderEmptyState();
    renderCard();
  };

  // `showKanjiTab` is where "Back to Kanji" goes (owned by app.js).
  const renderSrsView = (loadedDataset, showKanjiTab) => {
    dataset = loadedDataset;
    onShowKanjiTab = showKanjiTab;
    startSession();
  };

  // Prune excluded cards even from a session already underway. Empty sessions
  // pick up newly enabled or re-included due cards.
  const refreshSrsIfEmpty = () => {
    const remaining = queue.filter((card) => !isExcludedFromTests(card.char));
    if (remaining.length !== queue.length) {
      total -= queue.length - remaining.length;
      queue = remaining;
      revealed = false;
      render();
    }
    if (queue.length === 0 && !finished) startSession();
  };

  // Called whenever SRS Review becomes the visible view (the ☰ menu item).
  // Anything but a session actually underway (cards graded, not yet finished)
  // is rebuilt from what is due now, so cards that became due since the queue
  // was last built show up; a session underway is re-rendered untouched, which
  // also re-applies the bottom-tab hiding for this view.
  const showSrsView = () => {
    if (finished || reviewedCount === 0) startSession();
    else render();
  };

  return { renderSrsView, refreshSrsIfEmpty, showSrsView, buildQueue, requeue };
})();
