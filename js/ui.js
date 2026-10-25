// Shared view-layer building blocks: the inline icon set, the band-colored
// chip, the studying switch, the SRS track lines and horizontal-swipe wiring.
// Everything here is markup/DOM only — it reads State for a character's band
// but owns no state of its own, which is what keeps state.js a plain store.
// Plain script (no ES modules), exposed as window.Ui — see state.js for why.

window.Ui = (() => {
  const { getChipBand, getSrsSteps, isExcludedFromTests } = window.State;
  const { bandForLevel, clampLevel, daysBetween } = window.Srs;

  // Everything rendered via innerHTML that came from the user (descriptions)
  // must go through here first.
  const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Every inline icon in the app shares one wrapper; only the path body and
  // the stroke weight differ. Heavier strokes (2.4) are for the oversized
  // answer buttons, where the default weight reads too thin at 28px.
  const svgIcon = (body, strokeWidth = 1.8) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${body}</svg>`;

  // One definition per glyph, so the same icon is literally the same markup
  // everywhere it appears (e.g. `close` as both the search-field clear button
  // and the test view's finish button).
  const icons = {
    close: svgIcon('<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/>'),
    checkBold: svgIcon('<path d="M4 12.5l5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/>', 2.4),
    crossBold: svgIcon('<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/>', 2.4),
    undo: svgIcon(
      '<path d="M9 14 4 9l5-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a5 5 0 0 1 0 10h-1" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    // The "studying" glyph on the switch thumb (the off glyph is `stop`).
    pencil: svgIcon('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 3 21l.5-4.5L17 3Z" stroke-linecap="round" stroke-linejoin="round"/>'),
    // "Not studying": a circle struck through by a diagonal slash.
    stop: svgIcon('<circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6" stroke-linecap="round"/>'),
    // Two circular arrows: the SRS Review menu item.
    repeat: svgIcon(
      '<path d="M17 2l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 11V9a4 4 0 0 1 4-4h12" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 22l-3-3 3-3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 13v2a4 4 0 0 1-4 4H4" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
  };

  // The character tile used by every grid in the app (radicals, kanji,
  // sub-components) — always colored by its current band (0 = not studying).
  const chipHtml = (char, { title = '' } = {}) =>
    `<button class="chip band-${getChipBand(char)}${isExcludedFromTests(char) ? ' excluded' : ''}" aria-label="${escapeHtml(char)}${isExcludedFromTests(char) ? ' — excluded from tests' : ''}" data-char="${char}"${title ? ` title="${title}"` : ''}>${char}</button>`;

  const bindChips = (root, onSelect) => {
    root.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => onSelect(chip.dataset.char));
    });
  };

  // Repaints just the band colors of already-rendered chips, e.g. after a
  // studying/SRS change, without rebuilding the DOM.
  const refreshChipBands = (root) => {
    root.querySelectorAll('.chip').forEach((chip) => {
      chip.className = `chip band-${getChipBand(chip.dataset.char)}${isExcludedFromTests(chip.dataset.char) ? ' excluded' : ''}`;
      chip.setAttribute('aria-label', `${chip.dataset.char}${isExcludedFromTests(chip.dataset.char) ? ' — excluded from tests' : ''}`);
    });
  };

  // The "Studying" switch. The thumb carries the state glyph: stop when off,
  // pencil when on. `compact` drops the visible label (the detail sheet's top
  // bar shows the bare switch), so it keeps its name via aria-label + title.
  const studyToggleHtml = (on, { compact = false } = {}) =>
    `<button type="button" class="study-switch${on ? ' on' : ''}${compact ? ' compact' : ''}" role="switch" aria-checked="${on}"${
      compact ? ` aria-label="Studying" title="${on ? 'Studying — tap to stop' : 'Not studying — tap to start'}"` : ''
    }>
      ${compact ? '' : '<span class="study-switch-label">Studying</span>'}
      <span class="study-switch-track">
        <span class="study-switch-thumb">${on ? icons.pencil : icons.stop}</span>
      </span>
    </button>`;

  // Calls `onToggle(newValue)` when the switch rendered by studyToggleHtml()
  // inside `root` is clicked.
  const bindStudyToggle = (root, onToggle) => {
    const toggle = root.querySelector('.study-switch');
    toggle.addEventListener('click', () => onToggle(toggle.getAttribute('aria-checked') !== 'true'));
  };

  const excludeToggleHtml = (char) =>
    `<label class="exclude-toggle"><span>Exclude from tests</span><input type="checkbox" class="exclude-tests" role="switch" ${isExcludedFromTests(char) ? 'checked' : ''} /></label>`;

  const bindExcludeToggle = (root, char) => {
    root.querySelector('.exclude-tests').addEventListener('change', (event) => {
      window.State.setExcludedFromTests(char, event.target.checked);
    });
  };

  const TRACK_LABELS = [
    ['meaning', '意', 'Meaning'],
    ['writing', '書', 'Writing'],
  ];

  const dueText = (track, todayStr) => {
    const days = daysBetween(todayStr, track.nextSrsReviewDate);
    return days <= 0 ? 'today' : `in ${days}d`;
  };

  // One compact line per track: label, a bar with one segment per step of the
  // current ladder whose first `level` segments are filled in the track's band
  // color (read by length, not counted), and when it is next due. A stored
  // level above a since-shrunk ladder shows as full. `only` limits it to one track name
  // (SRS Review shows just the track being graded).
  const srsTracksHtml = (srs, todayStr, only = null) => {
    const stepCount = getSrsSteps().length;
    return `<div class="srs-tracks">
      ${TRACK_LABELS.filter(([name]) => !only || name === only).map(([name, label, word]) => {
        const track = srs[name];
        const level = clampLevel(track.level, stepCount);
        const segments = Array.from(
          { length: stepCount },
          (_, i) => `<span class="srs-seg${i < level ? ' filled' : ''}"></span>`
        ).join('');
        return `<div class="srs-track">
          <span class="srs-track-label" title="${word}" aria-label="${word}">${label}</span>
          <span class="srs-bar band-${bandForLevel(level, stepCount)}" role="img" aria-label="${word} level ${level} of ${stepCount}">${segments}</span>
          <span class="srs-due">${dueText(track, todayStr)}</span>
        </div>`;
      }).join('')}
    </div>`;
  };

  // Calls `onSwipe(+1)` for a leftward swipe over `el` and `onSwipe(-1)` for a
  // rightward one. Ignores gestures that are mostly vertical, so it doesn't
  // fight scrolling.
  const onHorizontalSwipe = (el, thresholdPx, onSwipe) => {
    let startX = 0;
    let startY = 0;

    el.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });

    el.addEventListener('touchend', (e) => {
      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = e.changedTouches[0].clientY - startY;
      if (Math.abs(deltaX) < thresholdPx || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
      onSwipe(deltaX < 0 ? 1 : -1);
    });
  };

  return {
    icons,
    escapeHtml,
    chipHtml,
    bindChips,
    refreshChipBands,
    studyToggleHtml,
    excludeToggleHtml,
    bindExcludeToggle,
    bindStudyToggle,
    srsTracksHtml,
    onHorizontalSwipe,
  };
})();
