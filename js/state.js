// In-memory rank store, backed by localStorage, with change notifications so
// views can re-render. File sync (fileSync.js) hooks into onChange to write through.
//
// Plain script (no ES modules): module scripts are blocked by CORS on file://,
// which is how this app is meant to be opened. Exposed as window.State.

window.State = (() => {
  const STORAGE_KEY = 'kanji-radicals:progress';

  const readLocalStorage = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  let ranks = readLocalStorage();
  const listeners = new Set();

  const persistLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(ranks));

  const getRank = (char) => ranks[char] || 0;

  const setRank = (char, rank) => {
    ranks = { ...ranks, [char]: rank };
    persistLocal();
    for (const listener of listeners) listener(ranks);
  };

  const getAllRanks = () => ranks;

  // Replaces the whole rank map (used when loading/importing progress from a file).
  const replaceAllRanks = (newRanks) => {
    ranks = { ...newRanks };
    persistLocal();
    for (const listener of listeners) listener(ranks);
  };

  const onChange = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { getRank, setRank, getAllRanks, replaceAllRanks, onChange };
})();
