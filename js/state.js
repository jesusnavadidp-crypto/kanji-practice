// In-memory rank + test-settings store, backed by localStorage, with change
// notifications so views can re-render. File sync (fileSync.js) hooks into
// onChange to write through. State only — the shared markup that renders a
// rank lives in ui.js.
//
// Plain script (no ES modules): module scripts are blocked by CORS on file://,
// which is how this app is meant to be opened. Exposed as window.State.

window.State = (() => {
  const STORAGE_KEY = 'kanji-radicals:progress';

  // Single source of truth for the rank scale, shared by every view that lets
  // the user set or display a rank (detail panel, test view).
  const RANK_LABELS = ['Unknown', 'Learning', 'Familiar', 'Known'];

  // Default draw-weight mix for the Test view's bag (relative weights, not
  // required to sum to 100 — see TestView's buildBag, which normalizes
  // whatever's here). Keyed by rank, same 3 ranks the test draws from.
  const defaultTestSettings = () => ({ weights: { 1: 50, 2: 30, 3: 20 }, excluded: [] });

  // The stored blob is `{ ranks, testSettings }`. Older progress files (and
  // anything already in localStorage from before testSettings existed) are
  // just the flat char→rank map — detected by the absence of a `ranks` key —
  // and get wrapped with defaults rather than treated as corrupt. Anything
  // else (missing, empty, unparseable) falls through to plain defaults.
  const normalizeStoredData = (parsed) => {
    const isBundle = parsed && typeof parsed === 'object' && 'ranks' in parsed;
    const { ranks, testSettings } = isBundle ? parsed : { ranks: parsed };
    const defaults = defaultTestSettings();
    return {
      ranks: ranks || {},
      testSettings: {
        weights: { ...defaults.weights, ...testSettings?.weights },
        excluded: testSettings?.excluded || defaults.excluded,
      },
    };
  };

  const readLocalStorage = () => {
    try {
      return normalizeStoredData(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return normalizeStoredData(null);
    }
  };

  let { ranks, testSettings } = readLocalStorage();
  const listeners = new Set();

  const persistLocal = () =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ranks, testSettings }));

  const notify = () => {
    for (const listener of listeners) listener(ranks);
  };

  const getRank = (char) => ranks[char] || 0;

  const setRank = (char, rank) => {
    ranks = { ...ranks, [char]: rank };
    persistLocal();
    notify();
  };

  const getAllRanks = () => ranks;

  const getTestWeights = () => ({ ...testSettings.weights });

  const setTestWeight = (rank, weight) => {
    testSettings = { ...testSettings, weights: { ...testSettings.weights, [rank]: weight } };
    persistLocal();
    notify();
  };

  const isExcludedFromTest = (char) => testSettings.excluded.includes(char);

  const getExcludedFromTest = () => [...testSettings.excluded];

  const setExcludedFromTest = (char, excluded) => {
    const withoutChar = testSettings.excluded.filter((c) => c !== char);
    testSettings = { ...testSettings, excluded: excluded ? [...withoutChar, char] : withoutChar };
    persistLocal();
    notify();
  };

  // The full persisted shape, for file export/sync — see fileSync.js.
  const getProgressBundle = () => ({ ranks: getAllRanks(), testSettings: { ...testSettings } });

  // Replaces both ranks and testSettings from a loaded/imported file, in
  // either the current nested shape or an older flat ranks-only one.
  const replaceProgressBundle = (parsed) => {
    const normalized = normalizeStoredData(parsed);
    ranks = { ...normalized.ranks };
    testSettings = normalized.testSettings;
    persistLocal();
    notify();
  };

  const onChange = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    RANK_LABELS,
    getRank,
    setRank,
    getAllRanks,
    getTestWeights,
    setTestWeight,
    isExcludedFromTest,
    getExcludedFromTest,
    setExcludedFromTest,
    getProgressBundle,
    replaceProgressBundle,
    onChange,
  };
})();
