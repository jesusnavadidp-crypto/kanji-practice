// The one review card, shared by Practice Test and SRS Review (so the two can't
// drift apart), plus the small session helpers both of those views need: the
// adjacent-duplicate shuffle fix and the bottom-tab hiding rule.
// The card never grades anything itself — it reports taps through callbacks
// and the owning view decides what a ✓/✗ means.
// Plain script (no ES modules), exposed as window.Flashcard — see state.js for why.

window.Flashcard = (() => {
  const { getDescription } = window.State;
  const { icons, escapeHtml } = window.Ui;

  const MAX_PROMPT_MEANINGS = 3;

  // Best-effort: swaps a card that landed next to an identical one with a
  // different card elsewhere. Prefers a later slot (a swap made there is
  // re-checked by this same forward pass); falls back to an earlier one when
  // the duplicate landed at the very end of the list, with nothing after it
  // to swap with. Can't always fully resolve (e.g. a list that's
  // overwhelmingly one character), but handles the typical case.
  // `previous` is the card dealt just before this list, so the seam between two
  // consecutive lists gets the same treatment as any other adjacent pair.
  // `keyOf` maps a card to what must not repeat back to back (default: itself).
  const dedupeAdjacent = (list, previous, keyOf = (card) => card) => {
    const deduped = [...list];
    const keyAt = (i) => keyOf(deduped[i]);
    for (let i = 0; i < deduped.length; i++) {
      const before = i === 0 ? (previous === undefined || previous === null ? null : keyOf(previous)) : keyAt(i - 1);
      if (before === null || keyAt(i) !== before) continue;
      let swapIdx = deduped.findIndex((c, idx) => idx > i && keyOf(c) !== keyAt(i));
      if (swapIdx === -1) swapIdx = deduped.findIndex((c, idx) => idx < i - 1 && keyOf(c) !== keyAt(i));
      if (swapIdx !== -1) [deduped[i], deduped[swapIdx]] = [deduped[swapIdx], deduped[i]];
    }
    return deduped;
  };

  const shuffle = (list) => {
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // The bottom tab bar (Radicals/Kanji) is hidden only while an actual card
  // is up AND the session view is the one actually on screen — that's the one
  // moment its own fixed answer buttons need the room. It's shown again on the
  // empty state and the report, so finishing (or never starting) a session
  // never leaves you without a way back. The "is it on screen" guard matters
  // because render() runs even while a session view is in the background — at
  // startup, and whenever a progress change elsewhere makes its pool
  // non-empty — and none of that should be able to hide the bar while you're
  // actually looking at Radicals/Kanji.
  const setBottomTabsHidden = (viewEl, hidden) => {
    if (hidden && viewEl.classList.contains('hidden')) return;
    document.getElementById('bottom-tabs').classList.toggle('hidden', hidden);
  };

  const readingLinesHtml = (readings) =>
    [
      readings.on.length ? `<p class="stat-line">On: ${readings.on.join('、 ')}</p>` : '',
      readings.kun.length ? `<p class="stat-line">Kun: ${readings.kun.join('、 ')}</p>` : '',
    ].join('');

  // Writing direction: the personal keyword, then bundled RTK keyword, leads;
  // otherwise meanings alone are ambiguous, so the readings go below them,
  // smaller. An optional hint (the user's note) opens in place either way.
  const writingPromptHtml = (readings, description, keyword) => {
    const meanings = readings ? readings.meanings.slice(0, MAX_PROMPT_MEANINGS).join(', ') : '';
    const promptHtml = keyword
      ? `<p class="fc-prompt-meaning fc-prompt-keyword">${escapeHtml(keyword)}</p>`
      : `<p class="fc-prompt-meaning">${escapeHtml(meanings || 'No meaning available')}</p>
         ${readings ? `<div class="fc-prompt-readings">${readingLinesHtml(readings)}</div>` : ''}`;
    return `
      ${promptHtml}
      ${
        description
          ? `<button type="button" class="fc-hint-btn">Hint</button>
             <p class="fc-hint hidden">${escapeHtml(description)}</p>`
          : ''
      }
    `;
  };

  const frontHtml = ({ char, direction, revealed }, readings, description, keyword) => {
    const hint = revealed ? '' : '<span class="fc-reveal-hint">Tap to reveal</span>';
    if (direction === 'meaning') {
      return revealed
        ? `<div class="fc-front"><span class="fc-glyph">${char}</span></div>`
        : `<button type="button" class="fc-front fc-reveal" aria-label="Reveal answer"><span class="fc-glyph">${char}</span>${hint}</button>`;
    }
    const prompt = writingPromptHtml(readings, description, keyword);
    return revealed
      ? `<div class="fc-front">${prompt}</div>`
      : `<div class="fc-front">${prompt}<button type="button" class="fc-reveal-btn">Tap to reveal</button></div>`;
  };

  // Both directions reveal the same complete answer. Only the hidden prompt differs.
  const backHtml = (char, readings, description, keyword) => {
    const descriptionHtml = description ? `<p class="fc-description">${escapeHtml(description)}</p>` : '';
    return `
      <div class="fc-back">
        <p class="fc-answer-meaning">${escapeHtml(keyword || readings?.meanings.join(', ') || 'No meaning available')}</p>
        ${keyword && readings?.meanings.length ? `<p class="stat-line">${escapeHtml(readings.meanings.join(', '))}</p>` : ''}
        ${readings ? readingLinesHtml(readings) : ''}
        <div class="fc-glyph-row">
          <div class="fc-stroke" id="fc-stroke-container"></div>
        </div>
        ${descriptionHtml}
      </div>
    `;
  };

  // Before the reveal only ✓ is offered; ✗ appears once the answer is shown.
  const answerBarHtml = (revealed) => `
    <div class="answer-bar">
      ${revealed ? `<button type="button" class="answer-icon-btn incorrect" data-answer="incorrect" title="Incorrect" aria-label="Incorrect">${icons.crossBold}</button>` : ''}
      <button type="button" class="answer-icon-btn correct" data-answer="correct" title="Correct" aria-label="Correct">${icons.checkBold}</button>
    </div>
  `;

  // Renders the card and its answer bar into `container`.
  // opts: { char, direction: 'meaning'|'writing', revealed, dataset,
  //         onReveal(), onAnswer(correct) }
  const render = (container, opts) => {
    const { char, revealed, dataset, onReveal, onAnswer } = opts;
    const readings = dataset.getReadings(char);
    const description = getDescription(char);
    const keyword = dataset.getKeyword(char);
    const rtkNumber = dataset.getRtkNumber(char);

    container.innerHTML = `
      <div class="fc-card">
        ${rtkNumber ? `<span class="fc-rtk" title="RTK 6th edition">#${rtkNumber}</span>` : ''}
        ${revealed
          ? `<div class="fc-front"><span class="fc-glyph">${char}</span></div>${backHtml(char, readings, description, keyword)}`
          : frontHtml(opts, readings, description, keyword)}
      </div>
      ${answerBarHtml(revealed)}
    `;

    if (revealed) window.StrokeOrder.renderInto(container.querySelector('#fc-stroke-container'), char);
    else container.querySelector('.fc-reveal, .fc-reveal-btn').addEventListener('click', onReveal);

    // The hint opens inline; it deliberately does not flip the card.
    const hintBtn = container.querySelector('.fc-hint-btn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => container.querySelector('.fc-hint').classList.toggle('hidden'));
    }

    container.querySelectorAll('[data-answer]').forEach((btn) => {
      btn.addEventListener('click', () => onAnswer(btn.dataset.answer === 'correct'));
    });
  };

  return { render, dedupeAdjacent, shuffle, setBottomTabsHidden };
})();
