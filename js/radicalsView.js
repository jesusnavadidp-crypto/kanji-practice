// Plain script (no ES modules), exposed as window.RadicalsView — see state.js for why.

window.RadicalsView = (() => {
  const { getRank } = window.State;
  const { openDetail } = window.DetailPanel;

  const container = document.getElementById('radicals-view');

  const groupByStrokeCount = (radicals) => {
    const groups = new Map();
    for (const r of radicals) {
      if (!groups.has(r.strokeCount)) groups.set(r.strokeCount, []);
      groups.get(r.strokeCount).push(r);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  };

  const renderRadicalsView = (dataset) => {
    const groups = groupByStrokeCount(dataset.radicals);

    container.innerHTML = groups
      .map(
        ([strokeCount, radicals]) => `
          <div class="stroke-group" data-stroke-count="${strokeCount}">
            <h2>${strokeCount} stroke${strokeCount === 1 ? '' : 's'}</h2>
            <div class="chip-grid">
              ${radicals
                .map((r) => `<button class="chip rank-${getRank(r.char)}" data-char="${r.char}">${r.char}</button>`)
                .join('')}
            </div>
          </div>
        `
      )
      .join('');

    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => openDetail(chip.dataset.char));
    });
  };

  // Repaints just the rank colors, e.g. after a rank change, without rebuilding the DOM.
  const refreshRadicalRanks = () => {
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.className = `chip rank-${getRank(chip.dataset.char)}`;
    });
  };

  return { renderRadicalsView, refreshRadicalRanks };
})();
