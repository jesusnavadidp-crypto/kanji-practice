// "Configurations" (☰ menu): lets you tune the Practice Test draw mix and
// review/undo which kanji you've excluded from it. Both are persisted
// alongside ranks — see State.getTestWeights/setTestWeight and
// State.getExcludedFromTest/setExcludedFromTest.
// Plain script (no ES modules), exposed as window.ConfigView — see state.js for why.

window.ConfigView = (() => {
  const { RANK_LABELS, getTestWeights, setTestWeight, getExcludedFromTest, setExcludedFromTest } = window.State;
  const { chipHtml, bindChips } = window.Ui;

  const container = document.getElementById('config-view');
  // The 3 ranks the Test view actually draws from — Unknown has nothing to test yet.
  const WEIGHTED_RANKS = [1, 2, 3];

  const renderExcludedList = () => {
    const grid = container.querySelector('#excluded-chip-grid');
    const emptyMsg = container.querySelector('#excluded-empty');
    const excluded = getExcludedFromTest();

    emptyMsg.classList.toggle('hidden', excluded.length > 0);
    grid.innerHTML = excluded
      .map((char) => chipHtml(char, { title: 'Tap to include in Practice Test again' }))
      .join('');

    bindChips(grid, (char) => {
      setExcludedFromTest(char, false);
      renderExcludedList();
    });
  };

  const renderConfigView = () => {
    const weights = getTestWeights();

    container.innerHTML = `
      <div class="config-form">
        <h3>Practice Test draw mix</h3>
        <p class="stat-line">
          Relative weights for how often each rank comes up — they don't need to add up to 100.
        </p>
        ${WEIGHTED_RANKS.map(
          (rank) => `
            <label class="form-field">
              <span>${RANK_LABELS[rank]}</span>
              <div class="input-with-suffix">
                <span class="rank-swatch" data-rank="${rank}" aria-hidden="true"></span>
                <input type="number" class="weight-input" data-rank="${rank}" min="0" step="1" value="${weights[rank] ?? 0}" />
                <span class="input-suffix">%</span>
              </div>
            </label>
          `
        ).join('')}

        <h3>Excluded from Practice Test</h3>
        <p class="stat-line" id="excluded-empty">
          Nothing excluded yet — toggle "Exclude from Practice Test" from a kanji's detail sheet, or from the test card itself, for ones you already know by heart.
        </p>
        <div class="chip-grid" id="excluded-chip-grid"></div>
      </div>
    `;

    container.querySelectorAll('.weight-input').forEach((input) => {
      input.addEventListener('input', () => {
        const value = Number(input.value);
        setTestWeight(Number(input.dataset.rank), Number.isFinite(value) ? value : 0);
      });
    });

    renderExcludedList();
  };

  // Called on every rank change while this view is open, e.g. a chip un-excluded
  // elsewhere while Configurations happens to be the visible view.
  const refreshExcludedIfOpen = () => {
    if (!container.classList.contains('hidden')) renderExcludedList();
  };

  return { renderConfigView, refreshExcludedIfOpen };
})();
