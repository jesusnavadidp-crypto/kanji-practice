// Renders animated stroke-order diagrams from the bundled KanjiVG data
// (data/strokes.js) — no network involved, so this works fully offline from
// the start. Plain script, exposed as window.StrokeOrder.

window.StrokeOrder = (() => {
  const STROKE_MS = 900;
  const VIEW_SIZE = 109; // KanjiVG's fixed canvas size

  const animate = (svg) => {
    const paths = [...svg.querySelectorAll('path')];
    paths.forEach((path, i) => {
      const length = path.getTotalLength();
      path.style.transition = 'none';
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      // Force the initial (undrawn) state to paint before enabling the transition.
      path.getBoundingClientRect();
      path.style.transition = `stroke-dashoffset ${STROKE_MS}ms ease-in-out`;
      path.style.transitionDelay = `${i * STROKE_MS}ms`;
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

    // The diagram itself is the replay control; the click must not reach a
    // parent handler (e.g. the flashcard).
    container.innerHTML = `
      <button type="button" class="stroke-order-replay" aria-label="Replay stroke order" title="Tap to replay">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}">${pathTags}</svg>
      </button>
    `;
    const svg = container.querySelector('svg');
    animate(svg);

    container.querySelector('.stroke-order-replay').addEventListener('click', (e) => {
      e.stopPropagation();
      animate(svg);
    });
  };

  return { renderInto };
})();
