// Builds an AI writing-practice prompt from the kanji you've ranked Learning+
// (rank >= 1), so an LLM writes back using vocabulary you actually know.
// Plain script (no ES modules), exposed as window.AiText — see state.js for why.

window.AiText = (() => {
  const container = document.getElementById('ai-text-view');
  let dataset = null;

  const knownKanji = () => {
    const ranks = window.State.getAllRanks();
    return dataset.kanji.filter((k) => (ranks[k.char] || 0) >= 1).map((k) => k.char);
  };

  const buildPrompt = ({ topic, length, chapters }) => {
    const kanjiList = knownKanji().join('');
    return (
      `Generate an article about '${topic}', following this guidelines: ` +
      `1) Japanese language. ` +
      `2) Use kanji from this list ${kanjiList}. Anything else write in Furigana with a simple space between words. ` +
      `3) Article contains ${length} words divided in up to ${chapters}, use the minimum. ` +
      `4) Present your answers by the Model capacity, minimum of 1 CHAPTER at a time. ` +
      `5) Split CHAPTERS with double jump and surround with --- for clarity. ` +
      `6) Remove punctuation from abbreviations, exmple: Dr. becomes Dr and so on. ` +
      `7) Emphasised words with double quotes, never with asterisks. ` +
      `8) Dont add any extra sections to the article, no vocabulary, no references, no images`
    );
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Falls through to the execCommand fallback below.
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  let toastTimer = null;
  const showToast = (text) => {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1200);
  };

  const refreshKnownCount = () => {
    const el = container.querySelector('#ai-known-count');
    if (el) el.textContent = `Using ${knownKanji().length} kanji you've ranked Learning or higher.`;
  };

  const renderAiTextView = (loadedDataset) => {
    dataset = loadedDataset;

    container.innerHTML = `
      <div class="ai-text-form">
        <label class="form-field">
          <span>Topic</span>
          <textarea id="ai-topic" rows="3" placeholder="Describe the topic…"></textarea>
        </label>
        <label class="form-field">
          <span>Length of article</span>
          <div class="input-with-suffix">
            <input type="number" id="ai-length" step="500" min="0" max="10000" value="2500" />
            <span class="input-suffix">words</span>
          </div>
        </label>
        <label class="form-field">
          <span>Chapters</span>
          <input type="number" id="ai-chapters" min="1" max="10" value="4" />
        </label>
        <p class="stat-line" id="ai-known-count"></p>
        <button id="ai-copy-btn" class="primary-btn">Copy to Clipboard</button>
      </div>
    `;

    refreshKnownCount();

    container.querySelector('#ai-copy-btn').addEventListener('click', async () => {
      const topic = container.querySelector('#ai-topic').value.trim();
      const length = container.querySelector('#ai-length').value;
      const chapters = container.querySelector('#ai-chapters').value;
      await copyToClipboard(buildPrompt({ topic, length, chapters }));
      showToast('Copied!');
    });
  };

  return { renderAiTextView, refreshKnownCount };
})();
