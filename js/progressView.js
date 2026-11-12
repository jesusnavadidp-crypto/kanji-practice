// Derived statistics only: catalog membership is independent of personal RTK numbering.
window.ProgressView = (() => {
  const { isStudying, getSrs, getSrsSteps, getDailyCount, getDailyGoal, onChange } = window.State;
  const { bandForLevel } = window.Srs;
  const root = document.getElementById('progress-view');
  let dataset;
  const row = (label, chars) => {
    const studying = chars.filter(isStudying);
    const levels = getSrsSteps().length;
    const mature = (char, track) => {
      const srs = getSrs(char);
      return srs && bandForLevel(srs[track].level, levels) === 3;
    };
    const meaning = studying.filter((char) => mature(char, 'meaning')).length;
    const writing = studying.filter((char) => mature(char, 'writing')).length;
    const both = studying.filter((char) => mature(char, 'meaning') && mature(char, 'writing')).length;
    return `<article class="progress-summary"><h3>${label}</h3>
      <p>${studying.length} / ${chars.length} studying · ${chars.length ? Math.round(studying.length / chars.length * 100) : 0}%</p>
      <progress value="${studying.length}" max="${chars.length || 1}" aria-label="${label} studying coverage"></progress>
      <p class="stat-line">Mature: ${both} both tracks · ${meaning} meaning · ${writing} writing</p></article>`;
  };
  const refresh = () => {
    if (!dataset) return;
    const chars = dataset.kanji.map((k) => k.char).filter(dataset.isTestEligible);
    const goal = getDailyGoal();
    root.innerHTML = `<div class="progress-page"><h2>Progress</h2>
      <article class="progress-summary"><h3>Today's goal</h3><p>${getDailyCount()}${goal ? ` / ${goal}` : ''} new kanji studied${goal ? '' : ' · goal off'}</p>
      ${goal ? `<progress value="${Math.min(getDailyCount(), goal)}" max="${goal}" aria-label="Daily goal"></progress>` : ''}
      <p class="stat-line">Only first-time studying activations count. Existing progress starts with no daily history.</p></article>
      ${row('RTK · Volume 1, sixth edition', chars.filter((char) => dataset.getRtk(char)))}
      <h2>JLPT</h2>${[5, 4, 3, 2, 1].map((level) => row(`JLPT N${level}`, chars.filter((char) => dataset.getJlptLevel(char) === level))).join('')}
      <p class="stat-line">Each JLPT row uses its own bundled list. Mature means the final SRS band; both tracks must reach it for the combined count. Excluded kanji retain their study progress.</p>
      </div>`;
  };
  onChange(refresh);
  return { init: (loadedDataset) => { dataset = loadedDataset; refresh(); }, refresh };
})();
