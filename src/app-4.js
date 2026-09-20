async function exportBackup() {
  const payload = { app: 'Prompt Beam', version: 3, exportedAt: new Date().toISOString(), scripts: state.scripts, settings: state.settings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `prompt-beam-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}
async function importBackup(e) {
  const f = e.target.files?.[0]; if (!f) return; const text = await f.text();
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !Array.isArray(data.scripts)) throw new Error('INVALID_BACKUP');
    if (Array.isArray(data.scripts)) {
      for (const s of data.scripts) await putScript({ ...s, id: s.id || uid(), updatedAt: s.updatedAt || Date.now() });
      if (data.settings) state.settings = { ...defaultSettings, ...data.settings, keymap: { ...defaultSettings.keymap, ...(data.settings.keymap || {}) } };
      await saveSettings();
    } else await putScript({ id: uid(), title: f.name.replace(/\.[^.]+$/, ''), content: text, createdAt: Date.now(), updatedAt: Date.now() });
  } catch (err) {
    const isText = f.type.startsWith('text/') || /\.(txt|md)$/i.test(f.name);
    if (!isText) { alert('Die Datei ist kein gültiges Prompt-Beam-Backup.'); e.target.value = ''; return; }
    await putScript({ id: uid(), schemaVersion: SCRIPT_SCHEMA_VERSION, title: f.name.replace(/\.[^.]+$/, ''), content: text, createdAt: Date.now(), updatedAt: Date.now() });
  }
  e.target.value = ''; state.scripts = await getAllScripts(); render();
}

function handleKey(e) {
  const code = InputAdapter.codeFromEvent(e);
  const shown = `${code}${e.key && e.key !== code ? ` · key=${e.key}` : ''}`;
  if (state.view === 'remote') {
    state.remoteEvents = [shown, ...state.remoteEvents].slice(0, 20);
    if (state.pendingMap) {
      Object.keys(state.settings.keymap).forEach(k => { if (state.settings.keymap[k] === state.pendingMap) delete state.settings.keymap[k]; });
      state.settings.keymap[code] = state.pendingMap; state.pendingMap = null; saveSettings();
    }
    render(); e.preventDefault(); return;
  }
  if (state.view !== 'prompter') return;
  const action = InputAdapter.actionFromEvent(e); if (!action) return; e.preventDefault();
  if (action === 'toggle') scroll.running ? stopScroll() : startWithCountdown();
  if (action === 'faster') { state.settings.speed = Math.min(160, state.settings.speed + 5); saveSettings(); }
  if (action === 'slower') { state.settings.speed = Math.max(5, state.settings.speed - 5); saveSettings(); }
  if (action === 'forward') jump(10);
  if (action === 'back') jump(-10);
  if (action === 'mirror') cycleMirror();
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function updateInstallUI() {
  const stateEl = document.querySelector('#installState');
  const hintEl = document.querySelector('#installHint');
  const btn = document.querySelector('#installApp');
  if (!stateEl || !hintEl || !btn) return;
  if (isStandalone()) {
    stateEl.textContent = 'Prompt Beam ist installiert';
    hintEl.textContent = 'Die App läuft im Standalone-Modus und ist offline nutzbar.';
    btn.disabled = true; btn.textContent = 'Installiert'; return;
  }
  if (state.deferredPrompt) {
    stateEl.textContent = 'Bereit zur Installation';
    hintEl.textContent = 'Tippe auf „Prompt Beam installieren“.';
    btn.disabled = false; return;
  }
  stateEl.textContent = 'Installation über Browser-Menü';
  hintEl.textContent = location.protocol === 'https:' || location.hostname === 'localhost' ? 'Chrome kann die Installation über das Browser-Menü anbieten.' : 'Für die Installation als PWA bitte eine HTTPS-Adresse verwenden.';
  btn.disabled = true;
}
async function installPromptBeam() {
  if (!state.deferredPrompt) { updateInstallUI(); return; }
  const p = state.deferredPrompt; state.deferredPrompt = null;
  try { await p.prompt(); await p.userChoice; } catch {}
  updateInstallUI();
}

window.addEventListener('keydown', handleKey, { capture: true });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredPrompt = e; updateInstallUI(); });
window.addEventListener('appinstalled', () => { state.deferredPrompt = null; updateInstallUI(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { releaseWake(); return; }
  if (scroll.running) { scroll.last = performance.now(); acquireWake(); }
});
window.addEventListener('resize', () => { if (state.view === 'prompter') { measureMaxScroll(); applyScroll(); } });
window.addEventListener('pagehide', () => { stopScroll(); PlatformAdapter.unlockOrientation(); });

async function recoverEmergencyDraft() {
  try {
    const raw = localStorage.getItem(EMERGENCY_DRAFT_KEY); if (!raw) return;
    const d = JSON.parse(raw);
    const existing = d.id ? state.scripts.find(s => s.id === d.id) : null;
    if (!d.content && !d.title) { localStorage.removeItem(EMERGENCY_DRAFT_KEY); return; }
    if (!existing || Number(d.updatedAt) > Number(existing.updatedAt || 0)) {
      if (confirm('Prompt Beam hat ungespeicherte Editor-Änderungen gefunden. Wiederherstellen?')) {
        const restored = normalizeScript({ ...existing, ...d, id: d.id || uid(), updatedAt: Date.now() });
        await putScript(restored); state.scripts = await getAllScripts();
      }
    }
    localStorage.removeItem(EMERGENCY_DRAFT_KEY);
  } catch { localStorage.removeItem(EMERGENCY_DRAFT_KEY); }
}

async function init() {
  state.scripts = await getAllScripts();
  await recoverEmergencyDraft();
  const saved = await loadSettings();
  if (saved) state.settings = { ...defaultSettings, ...saved, keymap: { ...defaultSettings.keymap, ...(saved.keymap || {}) } };
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();