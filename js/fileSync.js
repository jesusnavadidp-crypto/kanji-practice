// Optional sync of progress.json against a real folder (e.g. one living in
// iCloud Drive), using the File System Access API where it's available
// (Chrome/Edge on desktop). Falls back to manual export/import everywhere else
// (notably iOS/Safari, which has no such API).
// Plain script (no ES modules), exposed as window.FileSync — see state.js for why.

window.FileSync = (() => {
  const { getAllRanks, replaceAllRanks, onChange } = window.State;

  const PROGRESS_FILE_NAME = 'progress.json';
  const supportsFileSystemAccess = 'showDirectoryPicker' in window;

  let directoryHandle = null;
  let writeTimer = null;

  const setStatus = (text) => {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = text;
  };

  const writeProgressFile = async () => {
    if (!directoryHandle) return;
    const fileHandle = await directoryHandle.getFileHandle(PROGRESS_FILE_NAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(getAllRanks(), null, 2));
    await writable.close();
  };

  const scheduleWrite = () => {
    if (!directoryHandle) return;
    clearTimeout(writeTimer);
    setStatus('Saving…');
    writeTimer = setTimeout(async () => {
      try {
        await writeProgressFile();
        setStatus('Synced to folder');
      } catch (err) {
        setStatus('Save failed');
        console.error(err);
      }
    }, 400);
  };

  const linkFolder = async () => {
    if (!supportsFileSystemAccess) {
      setStatus('Not supported here');
      return;
    }
    try {
      directoryHandle = await window.showDirectoryPicker();
      const fileHandle = await directoryHandle.getFileHandle(PROGRESS_FILE_NAME, { create: true });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = text.trim() ? JSON.parse(text) : {};
      if (Object.keys(parsed).length > 0) {
        replaceAllRanks(parsed);
        setStatus('Loaded from folder');
      } else {
        await writeProgressFile();
        setStatus('Linked');
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  };

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(getAllRanks(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = PROGRESS_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = async (file) => {
    const text = await file.text();
    replaceAllRanks(JSON.parse(text));
    setStatus('Imported');
  };

  const initFileSync = () => {
    document.getElementById('link-folder-btn').addEventListener('click', linkFolder);
    document.getElementById('export-btn').addEventListener('click', exportProgress);
    document.getElementById('import-input').addEventListener('change', (e) => {
      const [file] = e.target.files;
      if (file) importProgress(file);
      e.target.value = '';
    });

    if (!supportsFileSystemAccess) {
      document.getElementById('link-folder-btn').title = 'Not supported in this browser — use Export/Import';
      document.getElementById('link-folder-btn').disabled = true;
    }

    onChange(scheduleWrite);
  };

  return { initFileSync };
})();
