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
  const { renderTestView, refreshTestIfEmpty, showTestView } = window.TestView;
  const { renderAiTextView, refreshKnownCount } = window.AiText;
  const { renderConfigView, refreshExcludedIfOpen } = window.ConfigView;
  const { onHorizontalSwipe } = window.Ui;

  const views = {
    radicals: document.getElementById('radicals-view'),
    kanji: document.getElementById('kanji-view'),
    test: document.getElementById('test-view'),
    aiText: document.getElementById('ai-text-view'),
    config: document.getElementById('config-view'),
  };

  // The two primary tabs, in swipe order — Test and AI Text are menu-triggered
  // destinations, not part of this cycle.
  const PRIMARY_TABS = ['radicals', 'kanji'];

  // Shared by the tab bar and the "AI Text"/"Practice Test" menu items — no
  // tab pill is active while viewing either, since neither is one of the tabs.
  const showView = (name) => {
    for (const [viewName, el] of Object.entries(views)) {
      el.classList.toggle('hidden', viewName !== name);
    }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    // Always reveal it on navigation — Test's own render (see testView.js)
    // re-hides it only for as long as an actual card is up.
    document.getElementById('bottom-tabs').classList.remove('hidden');
    updateScrollTopVisibility();
  };

  // Floating "scroll to top" button — only where a view can actually get long
  // enough to need it (the two primary tabs' chip grids), and only once
  // there's somewhere to scroll back up from.
  const SCROLL_TOP_THRESHOLD_PX = 300;

  const updateScrollTopVisibility = () => {
    const onPrimaryTab = PRIMARY_TABS.includes(document.querySelector('.tab.active')?.dataset.tab);
    document.getElementById('scroll-top-btn').classList.toggle('hidden', !onPrimaryTab || window.scrollY < SCROLL_TOP_THRESHOLD_PX);
  };

  const initScrollToTop = () => {
    window.addEventListener('scroll', updateScrollTopVisibility);
    document.getElementById('scroll-top-btn').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  // The top tab row (desktop) and the bottom tab bar (mobile) both use
  // `.tab` buttons and stay in sync via showView()'s shared active-state toggle.
  const initTabs = () => {
    ['tabs', 'bottom-tabs'].forEach((id) => {
      document.getElementById(id).addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (btn) showView(btn.dataset.tab);
      });
    });
  };

  // Swipe left/right over the main content area moves between the two
  // primary tabs.
  const SWIPE_THRESHOLD_PX = 50;

  const initSwipeNavigation = () => {
    onHorizontalSwipe(document.getElementById('app'), SWIPE_THRESHOLD_PX, (direction) => {
      const currentIndex = PRIMARY_TABS.indexOf(document.querySelector('.tab.active')?.dataset.tab);
      if (currentIndex === -1) return;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= PRIMARY_TABS.length) return;
      showView(PRIMARY_TABS[nextIndex]);
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

    document.getElementById('test-menu-btn').addEventListener('click', () => {
      menu.classList.add('hidden');
      showView('test');
      showTestView();
    });

    document.getElementById('config-menu-btn').addEventListener('click', () => {
      menu.classList.add('hidden');
      showView('config');
      refreshExcludedIfOpen();
    });
  };

  const main = () => {
    const dataset = loadDataset();

    initTabs();
    initSwipeNavigation();
    initSettingsMenu();
    initScrollToTop();
    initFileSync();
    initDetailPanel(dataset);
    renderRadicalsView(dataset);
    renderKanjiView(dataset);
    renderTestView(dataset);
    renderAiTextView(dataset);
    renderConfigView();

    onChange(() => {
      refreshRadicalRanks();
      refreshKanjiRanks();
      refreshDetailIfOpen();
      refreshTestIfEmpty();
      refreshKnownCount();
      refreshExcludedIfOpen();
    });
  };

  main();
})();
