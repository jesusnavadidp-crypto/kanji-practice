// "Test" tab: flashcard-style drill over kanji you've already ranked
// Learning+ (rank >= 1) — ranking a kanji Unknown means there's nothing to
// test yet, so it's excluded from the draw pool.
// Plain script (no ES modules), exposed as window.TestView — see state.js for why.

window.TestView = (() => {
  const { RANK_LABELS, getRank, setRank } = window.State;

  const container = document.getElementById('test-view');
  let dataset = null;

  let currentChar = null;
  let flipped = false;
  let correctCount = 0;
  let incorrectCount = 0;
  let finished = false;

  // Practice should skew toward what's least solid: a Learning kanji should
  // come up much more often than a Known one. Draws are dealt from a small
  // shuffled "bag" built to this exact ratio, rather than plain weighted
  // random, so the ratio holds even within a short session instead of only
  // converging to it over a long one.
  const RANK_WEIGHTS = { 1: 0.5, 2: 0.3, 3: 0.2 }; // Learning, Familiar, Known
  const BAG_SIZE = 10; // 5/3/2 slots — exact, no rounding needed.

  let bag = [];
  let bagIndex = 0;
  let lastDealt = null;

  const poolByRank = () => {
    const buckets = { 1: [], 2: [], 3: [] };
    for (const k of dataset.kanji) {
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
  const dedupeAdjacent = (list) => {
    const deduped = [...list];
    for (let i = 1; i < deduped.length; i++) {
      if (deduped[i] !== deduped[i - 1]) continue;
      let swapIdx = deduped.findIndex((c, idx) => idx > i && c !== deduped[i]);
      if (swapIdx === -1) swapIdx = deduped.findIndex((c, idx) => idx < i - 1 && c !== deduped[i]);
      if (swapIdx !== -1) [deduped[i], deduped[swapIdx]] = [deduped[swapIdx], deduped[i]];
    }
    return deduped;
  };

  // Builds a BAG_SIZE-slot deck matching RANK_WEIGHTS, dropping any rank with
  // no candidates and renormalizing the rest so their weight isn't wasted.
  const buildBag = () => {
    const buckets = poolByRank();
    const ranks = Object.keys(RANK_WEIGHTS)
      .map(Number)
      .filter((rank) => buckets[rank].length > 0);
    if (ranks.length === 0) return [];

    const totalWeight = ranks.reduce((sum, rank) => sum + RANK_WEIGHTS[rank], 0);
    const newBag = [];
    let assigned = 0;
    ranks.forEach((rank, i) => {
      const isLast = i === ranks.length - 1;
      const slots = isLast ? BAG_SIZE - assigned : Math.round((BAG_SIZE * RANK_WEIGHTS[rank]) / totalWeight);
      assigned += slots;
      const candidates = buckets[rank];
      for (let n = 0; n < slots; n++) {
        newBag.push(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    });

    return dedupeAdjacent(shuffle(newBag));
  };

  const dealNext = () => {
    if (bagIndex >= bag.length) {
      bag = buildBag();
      bagIndex = 0;
      // Avoid the new bag starting with the same char that just finished the old one.
      if (bag.length > 1 && bag[0] === lastDealt) {
        const swapIdx = bag.findIndex((c, idx) => idx > 0 && c !== lastDealt);
        if (swapIdx !== -1) [bag[0], bag[swapIdx]] = [bag[swapIdx], bag[0]];
      }
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

  const rankSelectHtml = (char) => `
    <select id="test-rank-select" class="rank-select" aria-label="Learn status">
      ${RANK_LABELS.map((label, i) => `<option value="${i}"${i === getRank(char) ? ' selected' : ''}>${label}</option>`).join('')}
    </select>
  `;

  // Plain check/cross glyphs, styled like the rest of the app's inline icons —
  // icon-only so the two buttons can sit further apart without feeling wide,
  // which is what keeps a mis-tap from landing on the wrong one.
  const checkIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 12.5l5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const crossIconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>`;

  const cardBackHtml = (char) => {
    const readings = dataset.getReadings(char);
    return `
      <div class="test-back">
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

  const renderEmptyState = () => {
    container.innerHTML = `
      <div class="test-empty">
        <p class="stat-line">Rank some kanji as Learning or higher to start testing yourself.</p>
      </div>
    `;
  };

  const renderReport = () => {
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
    container.innerHTML = `
      <div class="test-topbar">
        <span class="stat-line">${correctCount + incorrectCount} tested &middot; ${correctCount} correct &middot; ${incorrectCount} incorrect</span>
        <button id="test-finish-btn" class="icon-btn" title="Finish test" aria-label="Finish test">&times;</button>
      </div>
      <div class="test-card">
        ${rankSelectHtml(currentChar)}
        ${flipped ? cardBackHtml(currentChar) : `<div class="test-char">${currentChar}</div>`}
        ${flipped ? '' : `<button id="test-flip-btn" class="primary-btn">Flip</button>`}
        <div class="test-answer-buttons">
          <button id="test-correct-btn" class="answer-icon-btn correct" title="Correct" aria-label="Correct">${checkIconSvg}</button>
          <button id="test-incorrect-btn" class="answer-icon-btn incorrect" title="Incorrect" aria-label="Incorrect">${crossIconSvg}</button>
        </div>
      </div>
    `;

    if (flipped) {
      window.StrokeOrder.renderInto(container.querySelector('#test-stroke-order-container'), currentChar);
    } else {
      container.querySelector('#test-flip-btn').addEventListener('click', () => {
        flipped = true;
        render();
      });
    }

    container.querySelector('#test-correct-btn').addEventListener('click', () => answer(true));
    container.querySelector('#test-incorrect-btn').addEventListener('click', () => answer(false));

    container.querySelector('#test-rank-select').addEventListener('change', (e) => {
      setRank(currentChar, Number(e.target.value));
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

  // Called on every rank change; only acts while stuck on the empty state
  // (no active session to disturb), so a pool that just became non-empty
  // elsewhere (e.g. ranking a kanji from another tab) is picked up here.
  const refreshTestIfEmpty = () => {
    if (!finished && !currentChar) startSession();
  };

  return { renderTestView, refreshTestIfEmpty };
})();
