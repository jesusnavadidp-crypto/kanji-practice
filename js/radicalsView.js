// Plain script (no ES modules), exposed as window.RadicalsView — see state.js for why.

window.RadicalsView = (() => {
  const { chipHtml, bindChips, refreshChipRanks } = window.Ui;
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
    container.innerHTML = groupByStrokeCount(dataset.radicals)
      .map(
        ([strokeCount, radicals]) => `
          <div class="stroke-group" data-stroke-count="${strokeCount}">
            <h2>${strokeCount} stroke${strokeCount === 1 ? '' : 's'}</h2>
            <div class="chip-grid">
              ${radicals.map((r) => chipHtml(r.char)).join('')}
            </div>
          </div>
        `
      )
      .join('');

    bindChips(container, (char) => openDetail(char));
  };

  // Repaints just the rank colors, e.g. after a rank change, without rebuilding the DOM.
  const refreshRadicalRanks = () => refreshChipRanks(container);

  return { renderRadicalsView, refreshRadicalRanks };
})();
