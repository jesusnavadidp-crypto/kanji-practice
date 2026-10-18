// In-memory progress store (studying flags, SRS tracks, descriptions, settings),
// backed by localStorage, with change notifications so views can re-render.
// File sync (fileSync.js) hooks into onChange to write through. State only —
// the shared markup that renders it lives in ui.js, the scheduling math in srs.js.
//
// Plain script (no ES modules): module scripts are blocked by CORS on file://,
// which is how this app is meant to be opened. Exposed as window.State.

window.State = (() => {
  const { today, newTrack, grade, isDue, bandForLevel, isValidSteps, DEFAULT_STEPS } = window.Srs;

  const STORAGE_KEY = 'kanji-radicals:progress';
  const LEGACY_BACKUP_KEY = 'kanji-radicals:progress-v1-backup';
  const VERSION = 2;
  const TRACKS = ['meaning', 'writing'];
  const DESCRIPTION_MAX_WORDS = 30;
  const KEYWORD_MAX_LENGTH = 40;
  const RTK_MIN = 1;
  const RTK_MAX = 9999;

  // Legacy conversion needs to know which characters are kanji (only kanji get
  // SRS tracks). data/kanji.js is loaded before this script, so reading
  // window.KANJI_DATA here is simpler than threading a predicate through an
  // init call from app.js.
  const kanjiChars = new Set((window.KANJI_DATA || []).map((k) => k.char));

  // Legacy rank (1/2/3) -> SRS level the migrated tracks start at, and the
  // legacy test weight key -> its band name.
  const LEGACY_LEVELS = { 1: 0, 2: 2, 3: 4 };
  const LEGACY_WEIGHT_KEYS = { 1: 'new', 2: 'mid', 3: 'mature' };

  const defaultPracticeSettings = () => ({ weights: { new: 50, mid: 30, mature: 20 } });

  const emptyBundle = () => ({
    version: VERSION,
    chars: {},
    practiceSettings: defaultPracticeSettings(),
    srsSettings: { steps: [...DEFAULT_STEPS] },
  });

  const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

  // One line, trimmed, capped at the word limit — whatever was stored.
  const cleanDescription = (value) => {
    if (typeof value !== 'string') return '';
    return value.split(/\s+/).filter(Boolean).slice(0, DESCRIPTION_MAX_WORDS).join(' ');
  };

  const isDateString = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

  const cleanTrack = (track, todayStr) => {
    if (!isPlainObject(track)) return newTrack(todayStr);
    return {
      level: Number.isInteger(track.level) && track.level >= 0 ? track.level : 0,
      lastReviewed: isDateString(track.lastReviewed) ? track.lastReviewed : null,
      due: isDateString(track.due) ? track.due : todayStr,
    };
  };

  const cleanSrs = (srs, todayStr) =>
    isPlainObject(srs)
      ? { meaning: cleanTrack(srs.meaning, todayStr), writing: cleanTrack(srs.writing, todayStr) }
      : null;

  const cleanWeights = (weights) => {
    const defaults = defaultPracticeSettings().weights;
    const cleaned = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = weights?.[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) cleaned[key] = value;
    }
    return cleaned;
  };

  // Same rules as the editor (Srs.isValidSteps); anything else falls back to the default ladder.
  const cleanSteps = (steps) => (isValidSteps(steps) ? [...steps] : [...DEFAULT_STEPS]);

  // One line, trimmed, capped at the length limit.
  const cleanKeyword = (value) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, KEYWORD_MAX_LENGTH).trim() : '';

  const isValidRtk = (value) => Number.isInteger(value) && value >= RTK_MIN && value <= RTK_MAX;

  const cleanRtk = (value) => (isValidRtk(value) ? value : null);

  const cleanV2 = (parsed) => {
    const todayStr = today();
    const chars = {};
    for (const [char, record] of Object.entries(isPlainObject(parsed.chars) ? parsed.chars : {})) {
      if (!isPlainObject(record)) continue;
      chars[char] = {
        studying: record.studying === true,
        activatedOn: isDateString(record.activatedOn) ? record.activatedOn : null,
        srs: cleanSrs(record.srs, todayStr),
        description: cleanDescription(record.description),
        keyword: cleanKeyword(record.keyword),
        rtk: cleanRtk(record.rtk),
      };
    }
    return {
      version: VERSION,
      chars,
      practiceSettings: { weights: cleanWeights(parsed.practiceSettings?.weights) },
      srsSettings: { steps: cleanSteps(parsed.srsSettings?.steps) },
    };
  };

  const isV2 = (parsed) => isPlainObject(parsed) && parsed.version === VERSION;

  // Old shapes: a flat char->rank map, or `{ ranks, testSettings }`. Rank 0 is
  // dropped; 1/2/3 become studying with both tracks at level 0/2/4, due today
  // (kanji only). Anything unparseable converts to an empty bundle.
  const convertLegacyBundle = (parsed) => {
    if (isV2(parsed)) return { bundle: cleanV2(parsed), legacy: false, summary: { kanji: 0, radicals: 0 } };

    const bundle = emptyBundle();
    const summary = { kanji: 0, radicals: 0 };
    if (!isPlainObject(parsed)) return { bundle, legacy: true, summary };

    const todayStr = today();
    const ranks = isPlainObject(parsed.ranks) ? parsed.ranks : parsed;
    for (const [char, rank] of Object.entries(ranks)) {
      if (!Object.hasOwn(LEGACY_LEVELS, rank)) continue;
      const isKanji = kanjiChars.has(char);
      const level = LEGACY_LEVELS[rank];
      bundle.chars[char] = {
        studying: true,
        activatedOn: null,
        srs: isKanji ? { meaning: newTrack(todayStr, level), writing: newTrack(todayStr, level) } : null,
        description: '',
        keyword: '',
        rtk: null,
      };
      if (isKanji) summary.kanji += 1;
      else summary.radicals += 1;
    }

    const legacyWeights = parsed.testSettings?.weights;
    const weights = {};
    for (const [rank, key] of Object.entries(LEGACY_WEIGHT_KEYS)) weights[key] = legacyWeights?.[rank];
    bundle.practiceSettings = { weights: cleanWeights(weights) };

    return { bundle, legacy: true, summary };
  };

  // Normalizes anything (current, legacy, garbage) into a v2 bundle; never throws.
  const normalizeStoredData = (parsed) => convertLegacyBundle(parsed).bundle;

  // Reads localStorage once at startup. A legacy blob is backed up (once) under
  // its own key before the converted bundle overwrites it.
  const readLocalStorage = () => {
    let raw = null;
    let parsed = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      return { bundle: emptyBundle(), migrated: false };
    }
    const migrated = isPlainObject(parsed) && !isV2(parsed) && Object.keys(parsed).length > 0;
    if (migrated) {
      try {
        if (localStorage.getItem(LEGACY_BACKUP_KEY) === null) localStorage.setItem(LEGACY_BACKUP_KEY, raw);
      } catch {
        // Backup is best effort; conversion still proceeds.
      }
    }
    return { bundle: normalizeStoredData(parsed), migrated };
  };

  const initial = readLocalStorage();
  let { chars, practiceSettings, srsSettings } = initial.bundle;
  const listeners = new Set();

  const persistLocal = () =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getProgressBundle()));

  const notify = () => {
    for (const listener of listeners) listener(chars);
  };

  // Writes one char's record (merged over any existing one) and publishes.
  const updateChar = (char, changes) => {
    const existing = chars[char] || {
      studying: false,
      activatedOn: null,
      srs: null,
      description: '',
      keyword: '',
      rtk: null,
    };
    chars = { ...chars, [char]: { ...existing, ...changes } };
    persistLocal();
    notify();
  };

  const isStudying = (char) => chars[char]?.studying === true;

  // Turning on stamps today's date (feeds the "activated today" counter) and,
  // for a kanji that has none yet, creates both SRS tracks. Turning off keeps
  // the SRS data and description so re-enabling resumes where it left off.
  const setStudying = (char, on, { isKanji = false } = {}) => {
    if (!on) return updateChar(char, { studying: false });
    const todayStr = today();
    const srs = chars[char]?.srs || (isKanji ? { meaning: newTrack(todayStr), writing: newTrack(todayStr) } : null);
    updateChar(char, { studying: true, activatedOn: todayStr, srs });
  };

  const getStudyingChars = () => Object.keys(chars).filter(isStudying);

  const getSrs = (char) => chars[char]?.srs || null;

  const getSrsSteps = () => [...srsSettings.steps];

  // Validates again here — never trust the caller. Invalid input is rejected
  // (returns false), not thrown. Stored `due` dates are untouched: the new
  // ladder only applies from the next grading.
  const setSrsSteps = (steps) => {
    if (!isValidSteps(steps)) return false;
    srsSettings = { steps: [...steps] };
    persistLocal();
    notify();
    return true;
  };

  const gradeTrack = (char, trackName, correct) => {
    const srs = getSrs(char);
    if (!srs || !srs[trackName]) return;
    const graded = grade(srs[trackName], correct, srsSettings.steps, today());
    updateChar(char, { srs: { ...srs, [trackName]: graded } });
  };

  const getDescription = (char) => chars[char]?.description || '';

  const setDescription = (char, text) => updateChar(char, { description: cleanDescription(text) });

  const getKeyword = (char) => chars[char]?.keyword || '';

  const setKeyword = (char, text) => updateChar(char, { keyword: cleanKeyword(text) });

  // The user's RTK number for this char, or null to use the KANJIDIC2 default.
  const getRtkOverride = (char) => chars[char]?.rtk ?? null;

  // Anything that isn't an integer in 1..9999 clears the override.
  const setRtkOverride = (char, number) => updateChar(char, { rtk: cleanRtk(number) });

  const getActivatedTodayCount = () => {
    const todayStr = today();
    return Object.values(chars).filter((c) => c.studying && c.activatedOn === todayStr).length;
  };

  // Every (char, track name) of a studying kanji whose track is due today.
  const getDueCards = () => {
    const todayStr = today();
    const cards = [];
    for (const char of getStudyingChars()) {
      // Ignore component-only characters, even if imported progress has SRS tracks.
      if (!kanjiChars.has(char) || char === '丨' || char === '｜') continue;
      const srs = chars[char].srs;
      if (!srs) continue;
      for (const track of TRACKS) {
        if (isDue(srs[track], todayStr)) cards.push({ char, track });
      }
    }
    return cards;
  };

  // 0 = not studying, else 1..3. A kanji shows the lower of its two track
  // levels; a studying char with no SRS (a plain radical) is always the top band.
  const getChipBand = (char) => {
    if (!isStudying(char)) return 0;
    const srs = chars[char].srs;
    return srs
      ? bandForLevel(Math.min(srs.meaning.level, srs.writing.level), srsSettings.steps.length)
      : 3;
  };

  const getPracticeWeights = () => ({ ...practiceSettings.weights });

  const setPracticeWeight = (band, value) => {
    practiceSettings = { weights: { ...practiceSettings.weights, [band]: value } };
    persistLocal();
    notify();
  };

  // The full persisted shape, for file export/sync — see fileSync.js.
  const getProgressBundle = () => ({ version: VERSION, chars, practiceSettings, srsSettings });

  // Replaces everything from a loaded/imported file; a legacy file is converted
  // on the way in by the normalizer.
  const replaceProgressBundle = (parsed) => {
    ({ chars, practiceSettings, srsSettings } = normalizeStoredData(parsed));
    persistLocal();
    notify();
  };

  const onChange = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  if (initial.migrated) persistLocal();

  return {
    DESCRIPTION_MAX_WORDS,
    countWords,
    isStudying,
    setStudying,
    getStudyingChars,
    getSrs,
    getSrsSteps,
    setSrsSteps,
    gradeTrack,
    getDescription,
    setDescription,
    KEYWORD_MAX_LENGTH,
    isValidRtk,
    getKeyword,
    setKeyword,
    getRtkOverride,
    setRtkOverride,
    getActivatedTodayCount,
    getDueCards,
    getChipBand,
    getPracticeWeights,
    setPracticeWeight,
    getProgressBundle,
    replaceProgressBundle,
    convertLegacyBundle,
    onChange,
  };
})();
