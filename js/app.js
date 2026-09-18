// Entry point. Plain script (no ES modules) — see state.js for why — so this
// must load last, after data/radicals.js, data/kanji.js, and every js/*.js
// namespace it depends on (see index.html for the load order).

(() => {
  const { loadDataset } = window.Data;
  const { onChange } = window.State;
  const { initFileSync } = window.FileSync;
  const { initDetailPanel, refreshDetailIfOpen } = window.DetailPanel;
  const { renderRadicalsView, refreshRadicalRanks } = window.RadicalsView;
  const { renderKanjiView, refreshKanjiRanks } = window.KanjiView;
  const { renderAiTextView, refreshKnownCount } = window.AiText;

  const views = {
    radicals: document.getElementById('radicals-view'),
    kanji: document.getElementById('kanji-view'),
    aiText: document.getElementById('ai-text-view'),
  };

  // Shared by the tab bar and the "AI Text" menu item — no tab pill is active
  // while viewing AI Text, since it isn't one of the tabs.
  const showView = (name) => {
    for (const [viewName, el] of Object.entries(views)) {
      el.classList.toggle('hidden', viewName !== name);
    }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  };

  const initTabs = () => {
    document.getElementById('tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (btn) showView(btn.dataset.tab);
    });
  };

  const initSettingsMenu = () => {
    const btn = document.getElementById('settings-menu-btn');
    const menu = document.getElementById('settings-menu');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn) {
        menu.classList.add('hidden');
      }
    });

    document.getElementById('ai-text-menu-btn').addEventListener('click', () => {
      menu.classList.add('hidden');
      showView('aiText');
      refreshKnownCount();
    });
  };

  const main = () => {
    const dataset = loadDataset();

    initTabs();
    initSettingsMenu();
    initFileSync();
    initDetailPanel(dataset);
    renderRadicalsView(dataset);
    renderKanjiView(dataset);
    renderAiTextView(dataset);

    onChange(() => {
      refreshRadicalRanks();
      refreshKanjiRanks();
      refreshDetailIfOpen();
      refreshKnownCount();
    });
  };

  main();
})();
