// Entry point. Plain script (no ES modules) — see state.js for why — so this
// must load last, after data/radicals.js, data/kanji.js, and every js/*.js
// namespace it depends on (see index.html for the load order).

(() => {
  const { loadDataset } = window.Data;
  const { onChange, getActivatedTodayCount, getDueCards } = window.State;
  const { initFileSync } = window.FileSync;
  const { initDetailPanel, refreshDetailIfOpen } = window.DetailPanel;
  const { renderRadicalsView, refreshRadicals } = window.RadicalsView;
  const { renderKanjiView, refreshKanjiList } = window.KanjiView;
  const { renderTestView, refreshTestIfEmpty, showTestView } = window.TestView;
  const { renderSrsView, refreshSrsIfEmpty, showSrsView } = window.SrsView;
  const { renderAiTextView, refreshKnownCount } = window.AiText;
  const { renderConfigView } = window.ConfigView;
  const { onHorizontalSwipe, icons } = window.Ui;

  const views = {
    radicals: document.getElementById('radicals-view'),
    kanji: document.getElementById('kanji-view'),
    srs: document.getElementById('srs-view'),
    test: document.getElementById('test-view'),
    aiText: document.getElementById('ai-text-view'),
    config: document.getElementById('config-view'),
  };

  // The two primary tabs, in swipe order — SRS Review, Test and AI Text are menu-triggered
  // destinations, not part of this cycle.
  const PRIMARY_TABS = ['radicals', 'kanji'];

  // Shared by the tab bar and the "AI Text"/"Practice Test" menu items — no
  // tab pill is active while viewing either, since neither is one of the tabs.
  const showView = (name) => {
    for (const [viewName, el] of Object.entries(views)) {
      el.classList.toggle('hidden', viewName !== name);
    }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    // Always reveal it on navigation — a session view's own render (see
    // flashcard.js) re-hides it only for as long as an actual card is up.
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

  // Shared by the ☰ menu's SRS Review item and the header due badge.
  const openSrsReview = () => {
    showView('srs');
    showSrsView();
  };

  // Header counters + the pending-reviews dot on ☰. Dates come from Srs.today(),
  // so re-reading State is enough after a day rollover.
  const refreshCounters = () => {
    const activated = getActivatedTodayCount();
    const due = getDueCards().length;
    const activatedBadge = document.getElementById('activated-badge');
    activatedBadge.innerHTML = `${icons.pencil}${activated}`;
    activatedBadge.classList.toggle('muted', activated === 0);
    activatedBadge.title = `${activated} kanji activated today`;
    activatedBadge.setAttribute('aria-label', `${activated} kanji activated today`);
    const dueBadge = document.getElementById('due-badge');
    dueBadge.innerHTML = `${icons.repeat}${due}`;
    dueBadge.classList.toggle('muted', due === 0);
    dueBadge.classList.toggle('due', due > 0);
    dueBadge.title = `${due} reviews due`;
    dueBadge.setAttribute('aria-label', `${due} reviews due`);
    document.getElementById('settings-menu-btn').classList.toggle('has-due', due > 0);
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

    document.getElementById('srs-menu-btn').addEventListener('click', () => {
      menu.classList.add('hidden');
      openSrsReview();
    });

    document.getElementById('due-badge').addEventListener('click', openSrsReview);

    document.getElementById('test-menu-btn').addEventListener('click', () => {
      menu.classList.add('hidden');
      showView('test');
      showTestView();
    });

    document.getElementById('config-menu-btn').addEventListener('click', () => {
      menu.classList.add('hidden');
      showView('config');
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
    renderTestView(dataset, () => showView('kanji'));
    renderSrsView(dataset, () => showView('kanji'));
    renderAiTextView(dataset);
    renderConfigView();

    refreshCounters();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshCounters();
    });

    onChange(() => {
      refreshCounters();
      refreshRadicals();
      refreshKanjiList();
      refreshDetailIfOpen();
      refreshTestIfEmpty();
      refreshSrsIfEmpty();
      refreshKnownCount();
    });
  };

  main();
})();
