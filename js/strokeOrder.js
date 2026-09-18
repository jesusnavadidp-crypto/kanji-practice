// Renders animated stroke-order diagrams from the bundled KanjiVG data
// (data/strokes.js) — no network involved, so this works fully offline from
// the start. Plain script, exposed as window.StrokeOrder.

window.StrokeOrder = (() => {
  const SPEED_MS = { normal: 400, slow: 900 };
  const SPEED_KEY = 'kanji-radicals:strokeSpeed';
  const VIEW_SIZE = 109; // KanjiVG's fixed canvas size

  const getSpeed = () => (localStorage.getItem(SPEED_KEY) === 'slow' ? 'slow' : 'normal');
  const setSpeed = (speed) => localStorage.setItem(SPEED_KEY, speed);

  const animate = (svg) => {
    const durationMs = SPEED_MS[getSpeed()];
    const paths = [...svg.querySelectorAll('path')];
    paths.forEach((path, i) => {
      const length = path.getTotalLength();
      path.style.transition = 'none';
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      // Force the initial (undrawn) state to paint before enabling the transition.
      path.getBoundingClientRect();
      path.style.transition = `stroke-dashoffset ${durationMs}ms ease-in-out`;
      path.style.transitionDelay = `${i * durationMs}ms`;
      path.style.strokeDashoffset = '0';
    });
  };

  // Renders the stroke-order diagram for `char` into `container`, or leaves a
  // muted "not available" note if KanjiVG has no data for it.
  const renderInto = (container, char) => {
    const strokes = window.STROKES_DATA[char];

    if (!strokes) {
      container.innerHTML = '<p class="stat-line">No stroke order data available.</p>';
      return;
    }

    const pathTags = strokes
      .map((d) => `<path d="${d}" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');

    const speed = getSpeed();
    container.innerHTML = `
      <div class="stroke-order-svg">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}">${pathTags}</svg>
      </div>
      <div class="stroke-order-controls">
        <div class="speed-toggle">
          <button class="speed-btn${speed === 'slow' ? ' selected' : ''}" data-speed="slow">Slow</button>
          <button class="speed-btn${speed === 'normal' ? ' selected' : ''}" data-speed="normal">Normal</button>
        </div>
        <button class="ghost-btn stroke-replay-btn" title="Replay" aria-label="Replay">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M4 4v6h6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4.5 15a8 8 0 1 0 2-8.5L4 10" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;
    const svg = container.querySelector('svg');
    animate(svg);

    container.querySelector('.stroke-replay-btn').addEventListener('click', () => animate(svg));
    container.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setSpeed(btn.dataset.speed);
        container.querySelectorAll('.speed-btn').forEach((b) => b.classList.toggle('selected', b === btn));
        animate(svg);
      });
    });
  };

  return { renderInto };
})();
