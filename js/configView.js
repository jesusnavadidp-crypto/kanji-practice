// "Configurations" (☰ menu): lets you edit the SRS step ladder, tune the
// Practice Test draw mix by SRS band and convert a progress file saved by the
// old rank-based version. Weights and steps are persisted alongside progress —
// see State.getPracticeWeights/setPracticeWeight and State.getSrsSteps/
// setSrsSteps. The ladder editor works on a local draft; nothing is persisted
// until Save.
// Plain script (no ES modules), exposed as window.ConfigView — see state.js for why.

window.ConfigView = (() => {
  const {
    DEFAULT_THEME_COLOR,
    getThemeColor,
    setThemeColor,
    isLeftHanded,
    setLeftHanded,
    getPracticeWeights,
    setPracticeWeight,
    getSrsSteps,
    setSrsSteps,
    convertLegacyBundle,
    replaceProgressBundle,
    onChange,
  } = window.State;
  const { DEFAULT_STEPS, MIN_STEPS, MAX_STEPS, MIN_STEP_DAYS, MAX_STEP_DAYS, isValidSteps } = window.Srs;
  const { icons } = window.Ui;

  const container = document.getElementById('config-view');
  const BANDS = [
    ['new', 'New'],
    ['mid', 'Mid'],
    ['mature', 'Mature'],
  ];

  // Local draft of the ladder: entries are numbers, or null for an empty /
  // non-numeric input. `savedSteps` is what was last persisted, to tell whether
  // the draft has unsaved edits.
  let draft = getSrsSteps();
  let savedSteps = getSrsSteps();

  const isDirty = () => draft.length !== savedSteps.length || draft.some((v, i) => v !== savedSteps[i]);

  // Inline reason the draft can't be saved, or '' when it can.
  const draftProblem = () => {
    if (draft.length < MIN_STEPS || draft.length > MAX_STEPS) return `Use ${MIN_STEPS}-${MAX_STEPS} steps.`;
    if (!draft.every((v) => Number.isInteger(v) && v >= MIN_STEP_DAYS && v <= MAX_STEP_DAYS)) {
      return `Each step must be a whole number of days, ${MIN_STEP_DAYS}-${MAX_STEP_DAYS}.`;
    }
    if (!isValidSteps(draft)) return 'Each step must be longer than the one before it.';
    return '';
  };

  const stepRowsHtml = () =>
    draft
      .map(
        (value, i) => `
          <div class="step-row">
            <span class="step-label">Step ${i + 1}</span>
            <div class="input-with-suffix">
              <input type="number" class="step-input" data-index="${i}" min="${MIN_STEP_DAYS}" max="${MAX_STEP_DAYS}" step="1" value="${value ?? ''}" aria-label="Step ${i + 1} in days" />
              <span class="input-suffix">days</span>
            </div>
            <button type="button" class="icon-btn ghost-icon-btn step-remove" data-index="${i}" title="Remove step ${i + 1}" aria-label="Remove step ${i + 1}"${draft.length <= MIN_STEPS ? ' disabled' : ''}>${icons.close}</button>
          </div>`
      )
      .join('');

  // Validation message + button states; cheap enough to run on every keystroke
  // without touching the inputs (so typing never loses focus).
  const refreshStepsStatus = () => {
    const problem = draftProblem();
    const message = container.querySelector('#steps-message');
    message.textContent = problem;
    message.classList.toggle('error', problem !== '');
    container.querySelectorAll('.step-input').forEach((input, i) => {
      const value = draft[i];
      const valid = Number.isInteger(value) && value >= MIN_STEP_DAYS && value <= MAX_STEP_DAYS;
      input.classList.toggle('invalid', !valid);
    });
    container.querySelector('#steps-save').disabled = problem !== '' || !isDirty();
    container.querySelector('#steps-add').disabled = draft.length >= MAX_STEPS;
    container.querySelector('#steps-reset').disabled =
      draft.length === DEFAULT_STEPS.length && draft.every((v, i) => v === DEFAULT_STEPS[i]);
  };

  // Rebuilds only the rows (add / remove / reset / external change).
  const renderStepRows = () => {
    container.querySelector('#steps-rows').innerHTML = stepRowsHtml();
    container.querySelectorAll('.step-input').forEach((input) => {
      input.addEventListener('input', () => {
        const value = input.value.trim() === '' ? null : Number(input.value);
        draft[Number(input.dataset.index)] = Number.isFinite(value) ? value : null;
        refreshStepsStatus();
      });
    });
    container.querySelectorAll('.step-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (draft.length <= MIN_STEPS) return;
        draft.splice(Number(btn.dataset.index), 1);
        renderStepRows();
      });
    });
    refreshStepsStatus();
  };

  const addStep = () => {
    if (draft.length >= MAX_STEPS) return;
    const last = draft[draft.length - 1];
    draft.push(Number.isInteger(last) ? Math.min(last * 2, MAX_STEP_DAYS) : MIN_STEP_DAYS);
    renderStepRows();
  };

  const saveSteps = () => {
    if (draftProblem() !== '' || !setSrsSteps(draft)) return;
    savedSteps = getSrsSteps();
    draft = [...savedSteps];
    renderStepRows();
  };

  const showConvertResult = (text, isError = false) => {
    const el = container.querySelector('#convert-result');
    el.textContent = text;
    el.classList.toggle('error', isError);
  };

  // Converts a legacy file in place and loads it; a file that is already in
  // the current format is loaded as-is.
  const convertFile = async (file) => {
    try {
      const { bundle, legacy, summary } = convertLegacyBundle(JSON.parse(await file.text()));
      replaceProgressBundle(bundle);
      showConvertResult(
        legacy
          ? `Converted ${summary.kanji} kanji and ${summary.radicals} radicals.`
          : 'Already in the current format — loaded as-is.'
      );
    } catch {
      showConvertResult("Couldn't read that file.", true);
    }
  };

  const renderConfigView = () => {
    const weights = getPracticeWeights();

    container.innerHTML = `
      <div class="config-form">
        <h3>Appearance</h3>
        <div class="theme-setting">
          <label for="theme-color">Theme color</label>
          <input type="color" id="theme-color" value="${getThemeColor()}" />
          <button type="button" class="theme-reset" id="theme-reset" ${getThemeColor() === DEFAULT_THEME_COLOR ? 'disabled' : ''}>Reset to blue</button>
        </div>
        <div class="theme-preview" aria-label="Theme preview: new, mid and mature">
          <span class="chip band-1" aria-hidden="true">一</span><span class="chip band-2" aria-hidden="true">二</span><span class="chip band-3" aria-hidden="true">三</span>
        </div>

        <h3>Controls</h3>
        <label class="preference-toggle"><span>Left-handed mode</span><input type="checkbox" id="left-handed-mode" role="switch" ${isLeftHanded() ? 'checked' : ''} /></label>
        <p class="stat-line">Places Correct on the left in Practice and SRS.</p>

        <h3>SRS steps</h3>
        <p class="stat-line">Days until the next review after each correct answer.</p>
        <div class="steps-editor" id="steps-rows"></div>
        <p class="stat-line">Changes apply from the next review; current schedules stay as they are.</p>
        <p class="steps-message" id="steps-message" role="status"></p>
        <div class="steps-actions">
          <button type="button" class="icon-btn" id="steps-add">Add step</button>
          <button type="button" class="icon-btn" id="steps-reset">Reset to default (${DEFAULT_STEPS.join('·')})</button>
          <button type="button" class="primary-btn" id="steps-save">Save</button>
        </div>

        <h3>Practice Test draw mix</h3>
        <p class="stat-line">
          Relative weights for how often each SRS band comes up — they don't need to add up to 100.
        </p>
        ${BANDS.map(
          ([band, label]) => `
            <label class="form-field">
              <span>${label}</span>
              <div class="input-with-suffix">
                <span class="band-swatch" data-band="${band}" aria-hidden="true"></span>
                <input type="number" class="weight-input" data-band="${band}" min="0" step="1" value="${weights[band] ?? 0}" />
                <span class="input-suffix">%</span>
              </div>
            </label>
          `
        ).join('')}

        <h3>Convert old progress file</h3>
        <p class="stat-line">Load a progress file from the rank-based version and convert it.</p>
        <label class="form-field">
          <input type="file" id="convert-input" accept="application/json" />
        </label>
        <p class="convert-result" id="convert-result" role="status"></p>
      </div>
    `;

    container.querySelector('#theme-color').addEventListener('input', (event) => setThemeColor(event.target.value));
    container.querySelector('#theme-reset').addEventListener('click', () => setThemeColor(DEFAULT_THEME_COLOR));
    container.querySelector('#left-handed-mode').addEventListener('change', (event) => {
      setLeftHanded(event.target.checked);
    });
    renderStepRows();
    container.querySelector('#steps-add').addEventListener('click', addStep);
    container.querySelector('#steps-reset').addEventListener('click', () => {
      draft = [...DEFAULT_STEPS];
      renderStepRows();
    });
    container.querySelector('#steps-save').addEventListener('click', saveSteps);

    container.querySelectorAll('.weight-input').forEach((input) => {
      input.addEventListener('input', () => {
        const value = Number(input.value);
        setPracticeWeight(input.dataset.band, Number.isFinite(value) ? value : 0);
      });
    });

    container.querySelector('#convert-input').addEventListener('change', (e) => {
      const [file] = e.target.files;
      if (file) convertFile(file);
      e.target.value = '';
    });
  };

  // An import / folder load can replace the ladder underneath the editor; follow
  // it unless there are unsaved edits (those win until saved or reset).
  onChange(() => {
    const picker = container.querySelector('#theme-color');
    if (picker && picker.value !== getThemeColor()) picker.value = getThemeColor();
    const reset = container.querySelector('#theme-reset');
    if (reset) reset.disabled = getThemeColor() === DEFAULT_THEME_COLOR;
    const handedness = container.querySelector('#left-handed-mode');
    if (handedness) handedness.checked = isLeftHanded();
    const current = getSrsSteps();
    if (current.length === savedSteps.length && current.every((v, i) => v === savedSteps[i])) return;
    const wasDirty = isDirty();
    savedSteps = current;
    if (!container.querySelector('#steps-rows')) return;
    if (!wasDirty) draft = [...savedSteps];
    renderStepRows();
  });

  return { renderConfigView };
})();
