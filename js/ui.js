// Shared view-layer building blocks: the inline icon set, the rank chip, the
// rank row (rank selector + exclude toggle) and horizontal-swipe wiring.
// Everything here is markup/DOM only — it reads State for a character's rank
// but owns no state of its own, which is what keeps state.js a plain store.
// Plain script (no ES modules), exposed as window.Ui — see state.js for why.

window.Ui = (() => {
  const { RANK_LABELS, getRank } = window.State;

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
    // The exclude-from-test toggle. A single diagonal path, corner-to-corner
    // across the viewBox — unlike the common two-path "pencil + underline"
    // glyph, this one is symmetric around its own center, so it sits visually
    // centered in a circular button instead of reading bottom-right-heavy.
    pencil: svgIcon('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 3 21l.5-4.5L17 3Z" stroke-linecap="round" stroke-linejoin="round"/>'),
    replay: svgIcon(
      '<path d="M4 4v6h6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 15a8 8 0 1 0 2-8.5L4 10" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    fast: svgIcon(
      '<path d="M4 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
    slow: svgIcon('<path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>'),
  };

  // The character tile used by every grid in the app (radicals, kanji,
  // sub-components, the excluded list) — always colored by its current rank.
  const chipHtml = (char, { title = '' } = {}) =>
    `<button class="chip rank-${getRank(char)}" data-char="${char}"${title ? ` title="${title}"` : ''}>${char}</button>`;

  const bindChips = (root, onSelect) => {
    root.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => onSelect(chip.dataset.char));
    });
  };

  // Repaints just the rank colors of already-rendered chips, e.g. after a rank
  // change, without rebuilding the DOM.
  const refreshChipRanks = (root) => {
    root.querySelectorAll('.chip').forEach((chip) => {
      chip.className = `chip rank-${getRank(chip.dataset.char)}`;
    });
  };

  // The 4-pill rank row. Every rank stays colored by its own state;
  // `.selected` just adds emphasis to the current one. The label's first
  // letter doubles as a narrow-screen initial via CSS (see .rank-btn-label in
  // styles.css) while the full word stays in the DOM for screen readers.
  const rankSelectorHtml = (rank) =>
    `<div class="rank-selector">
      ${RANK_LABELS.map(
        (label, i) =>
          `<button class="rank-btn${i === rank ? ' selected' : ''}" data-rank="${i}">
            <span class="rank-btn-label" data-short="${label[0]}">${label}</span>
          </button>`
      ).join('')}
    </div>`;

  // The rank selector plus, for actual kanji, a compact exclude-from-test icon
  // beside it — one row, shared by the detail sheet and the test view so
  // "learning status" and "don't quiz me on this" always sit together.
  const rankRowHtml = (rank, excluded, showExcludeToggle = true) =>
    `<div class="rank-row">
      ${rankSelectorHtml(rank)}
      ${
        showExcludeToggle
          ? `<button class="icon-btn ghost-icon-btn exclude-toggle-icon${excluded ? ' selected' : ''}" aria-pressed="${excluded}" aria-label="${excluded ? 'Include in Practice Test again' : 'Exclude from Practice Test'}" title="${excluded ? 'Excluded from Practice Test' : 'Exclude from Practice Test'}">
              ${icons.pencil}
            </button>`
          : ''
      }
    </div>`;

  // Binds the rank selector and (when present) the exclude toggle rendered by
  // rankRowHtml() inside `root`.
  const bindRankRow = (root, { onSelectRank, onToggleExclude }) => {
    root.querySelectorAll('.rank-btn').forEach((btn) => {
      btn.addEventListener('click', () => onSelectRank(Number(btn.dataset.rank)));
    });
    const excludeBtn = root.querySelector('.exclude-toggle-icon');
    if (excludeBtn) excludeBtn.addEventListener('click', onToggleExclude);
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

  return { icons, chipHtml, bindChips, refreshChipRanks, rankRowHtml, bindRankRow, onHorizontalSwipe };
})();
