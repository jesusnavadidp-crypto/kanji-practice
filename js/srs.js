// Pure spaced-repetition logic: calendar-day math, the step ladder and the
// grade transition. No DOM, no storage — state.js owns persistence, so this
// stays trivially testable. Dates are local 'YYYY-MM-DD' strings throughout.
// Plain script (no ES modules), exposed as window.Srs — see state.js for why.

window.Srs = (() => {
  // Days until the next review after reaching level 1..N. A track at the top
  // level stays there, re-scheduled at the last step's interval. The ladder is
  // user-configurable (see State.setSrsSteps); this is the starting point.
  const DEFAULT_STEPS = [1, 3, 7, 14, 30, 60];
  const MIN_STEPS = 1;
  const MAX_STEPS = 12;
  const MIN_STEP_DAYS = 1;
  const MAX_STEP_DAYS = 365;

  // The one definition of a valid ladder, shared by the editor, State's setter
  // and the storage normalizer: 1-12 integers in 1-365, strictly increasing.
  const isValidSteps = (steps) =>
    Array.isArray(steps) &&
    steps.length >= MIN_STEPS &&
    steps.length <= MAX_STEPS &&
    steps.every(
      (s, i) => Number.isInteger(s) && s >= MIN_STEP_DAYS && s <= MAX_STEP_DAYS && (i === 0 || s > steps[i - 1])
    );

  // A stored level can exceed a ladder that was shrunk afterwards; it then
  // counts as the top step.
  const clampLevel = (level, stepsLength) => Math.min(level, stepsLength);

  const pad = (n) => String(n).padStart(2, '0');

  const format = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  // Parsed as a local date on purpose: new Date('YYYY-MM-DD') is UTC midnight
  // and would land on the previous day west of Greenwich.
  const parse = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const today = () => format(new Date());

  // Date(y, m, d + n) lets the calendar roll over month/year boundaries.
  const addDays = (dateStr, n) => {
    const date = parse(dateStr);
    return format(new Date(date.getFullYear(), date.getMonth(), date.getDate() + n));
  };

  // Whole days from `fromStr` to `toStr` (negative when `toStr` is earlier).
  const daysBetween = (fromStr, toStr) => Math.round((parse(toStr) - parse(fromStr)) / 86400000);

  // ISO date strings sort lexicographically, so plain comparison works.
  const isDue = (track, todayStr) => track.nextSrsReviewDate <= todayStr;

  const newTrack = (todayStr, level = 0) => ({ level, nextSrsReviewDate: todayStr });

  // Returns a new track; never mutates the one passed in.
  const grade = (track, correct, steps, todayStr) => {
    if (!correct) return { level: 0, nextSrsReviewDate: todayStr };
    const level = Math.min(clampLevel(track.level, steps.length) + 1, steps.length);
    return { level, nextSrsReviewDate: addDays(todayStr, steps[level - 1]) };
  };

  // Color / practice-weight band, relative to the ladder length so the colors
  // keep their meaning with any ladder: ratio = min(level, len) / len,
  // < 1/3 -> 1 (new), < 2/3 -> 2 (mid), else 3 (mature). For the 6-step default
  // this is today's mapping: levels 0-1 -> 1, 2-3 -> 2, 4-6 -> 3. Compared with
  // integer math (level * 3 vs len) because 2/6 === 1/3 is a float coin flip.
  const bandForLevel = (level, stepsLength) => {
    const scaled = clampLevel(level, stepsLength) * 3;
    return scaled < stepsLength ? 1 : scaled < stepsLength * 2 ? 2 : 3;
  };

  return {
    DEFAULT_STEPS,
    MIN_STEPS,
    MAX_STEPS,
    MIN_STEP_DAYS,
    MAX_STEP_DAYS,
    isValidSteps,
    clampLevel,
    today,
    addDays,
    daysBetween,
    isDue,
    grade,
    bandForLevel,
    newTrack,
  };
})();
