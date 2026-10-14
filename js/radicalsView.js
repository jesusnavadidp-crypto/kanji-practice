// Plain script (no ES modules), exposed as window.RadicalsView — see state.js for why.

window.RadicalsView = (() => {
  const { chipHtml, bindChips, refreshChipBands } = window.Ui;
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

  // Within a group, radicals that are also RTK kanji come first by number
  // ascending; the rest follow in their dataset order (the sort is stable).
  const sortedByRtk = (dataset, radicals) => {
    const weight = (r) => dataset.getRtkNumber(r.char) ?? Infinity;
    return [...radicals].sort((a, b) => weight(a) - weight(b));
  };

  let currentDataset = null;
  let orderSignature = '';

  const orderedGroups = (dataset) =>
    groupByStrokeCount(dataset.radicals).map(([strokeCount, radicals]) => [
      strokeCount,
      sortedByRtk(dataset, radicals),
    ]);

  const signatureOf = (groups) => groups.map(([, radicals]) => radicals.map((r) => r.char).join('')).join('|');

  const renderRadicalsView = (dataset) => {
    currentDataset = dataset;
    const groups = orderedGroups(dataset);
    orderSignature = signatureOf(groups);
    container.innerHTML = groups
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

  // After a progress change: rebuilds only when an RTK number override moved a
  // radical within its group, otherwise just repaints the band colors.
  const refreshRadicals = () => {
    if (!currentDataset) return;
    if (signatureOf(orderedGroups(currentDataset)) !== orderSignature) renderRadicalsView(currentDataset);
    else refreshChipBands(container);
  };

  return { renderRadicalsView, refreshRadicals };
})();
