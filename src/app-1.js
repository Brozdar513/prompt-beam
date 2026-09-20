const DB_NAME = 'promptBeamDB';
const DB_VERSION = 2;
const APP_VERSION = '0.4';
const SCRIPT_SCHEMA_VERSION = 1;
const EMERGENCY_DRAFT_KEY = 'promptBeamEmergencyDraft';
const defaultSettings = {
  fontSize: 64,
  speed: 42,
  lineHeight: 1.35,
  marginX: 10,
  mirror: 'none',
  loop: false,
  countdown: 3,
  guide: true,
  orientationLock: false,
  keymap: {
    Space: 'toggle',
    MediaPlayPause: 'toggle',
    ArrowUp: 'faster',
    ArrowDown: 'slower',
    ArrowRight: 'forward',
    ArrowLeft: 'back',
    KeyM: 'mirror'
  }
};

let state = {
  view: 'scripts',
  scripts: [],
  currentId: null,
  settings: { ...defaultSettings, keymap: { ...defaultSettings.keymap } },
  search: '',
  remoteEvents: [],
  pendingMap: null,
  deferredPrompt: null,
  storageMode: 'indexeddb',
  runtime: { lastError: null }
};

let scroll = { running: false, y: 0, last: 0, raf: 0, wake: null, countdown: false, countdownToken: 0, maxY: 0, lastPersistAt: 0 };

const icons = {
  scripts: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.6.7 1 .9.34.17.72.25 1.1.25H21v4h-.09c-.58 0-1.12.22-1.51.85z"/>',
  remote: '<path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><circle cx="12" cy="8" r="1"/><path d="M9 13h6M9 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  play: '<path d="m9 7 9 5-9 5z"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>',
  file: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  words: '<path d="M4 6h16M4 12h12M4 18h9"/>',
  full: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  mirror: '<path d="M12 3v18M5 7l4 5-4 5M19 7l-4 5 4 5"/>',
  rewind: '<path d="M8 8H4v-4"/><path d="M4 8a8 8 0 1 1 2 8"/>',
  forward: '<path d="M16 8h4v-4"/><path d="M20 8a8 8 0 1 0-2 8"/>'
};

function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
}

function normalizeScript(s = {}) {
  const now = Date.now();
  return {
    id: s.id || uid(),
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    title: typeof s.title === 'string' ? s.title : 'Ohne Titel',
    content: typeof s.content === 'string' ? s.content : '',
    createdAt: Number(s.createdAt) || now,
    updatedAt: Number(s.updatedAt) || now
  };
}

const StorageAdapter = {
  async openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB nicht verfügbar'));
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('scripts')) db.createObjectStore('scripts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('runtime')) db.createObjectStore('runtime', { keyPath: 'key' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('IndexedDB konnte nicht geöffnet werden'));
    });
  },
  async idbRequest(store, mode, fn) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tr = db.transaction(store, mode);
      const os = tr.objectStore(store);
      let req;
      try { req = fn(os); } catch (err) { db.close(); reject(err); return; }
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tr.oncomplete = () => db.close();
      tr.onabort = () => { db.close(); reject(tr.error || new Error('Speichervorgang abgebrochen')); };
    });
  },
  fallbackRead(key, fallback) {
    try { const raw = localStorage.getItem('pb:' + key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  },
  fallbackWrite(key, value) {
    try { localStorage.setItem('pb:' + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  async getAllScripts() {
    try {
      state.storageMode = 'indexeddb';
      const rows = await this.idbRequest('scripts', 'readonly', os => os.getAll());
      return (rows || []).map(normalizeScript);
    } catch (err) {
      state.storageMode = 'localstorage'; state.runtime.lastError = String(err?.message || err);
      return this.fallbackRead('scripts', []).map(normalizeScript);
    }
  },
  async putScript(script) {
    const s = normalizeScript(script);
    try { await this.idbRequest('scripts', 'readwrite', os => os.put(s)); }
    catch {
      state.storageMode = 'localstorage';
      const rows = this.fallbackRead('scripts', []).filter(x => x.id !== s.id); rows.push(s); this.fallbackWrite('scripts', rows);
    }
  },
  async deleteScript(id) {
    try { await this.idbRequest('scripts', 'readwrite', os => os.delete(id)); }
    catch {
      state.storageMode = 'localstorage';
      this.fallbackWrite('scripts', this.fallbackRead('scripts', []).filter(x => x.id !== id));
    }
  },
  async loadSettings() {
    try { const row = await this.idbRequest('settings', 'readonly', os => os.get('app')); return row?.value || null; }
    catch { state.storageMode = 'localstorage'; return this.fallbackRead('settings', null); }
  },
  async saveSettings(value) {
    try { await this.idbRequest('settings', 'readwrite', os => os.put({ key: 'app', value })); }
    catch { state.storageMode = 'localstorage'; this.fallbackWrite('settings', value); }
  }
};

async function getAllScripts() { return StorageAdapter.getAllScripts(); }
async function putScript(s) { return StorageAdapter.putScript(s); }
async function deleteScript(id) { return StorageAdapter.deleteScript(id); }
async function loadSettings() { return StorageAdapter.loadSettings(); }
async function saveSettings() { return StorageAdapter.saveSettings(state.settings); }

const PlatformAdapter = {
  async acquireWake() {
    try { if ('wakeLock' in navigator) { scroll.wake = await navigator.wakeLock.request('screen'); return true; } } catch {}
    return false;
  },
  async releaseWake() { try { await scroll.wake?.release(); } catch {} scroll.wake = null; },
  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) { if (!document.documentElement.requestFullscreen) return false; await document.documentElement.requestFullscreen(); }
      else if (document.exitFullscreen) await document.exitFullscreen();
      return true;
    } catch { return false; }
  },
  async lockLandscape() { try { if (screen.orientation?.lock) { await screen.orientation.lock('landscape'); return true; } } catch {} return false; },
  unlockOrientation() { try { screen.orientation?.unlock?.(); } catch {} }
};

const InputAdapter = {
  codeFromEvent(e) { return e.code || e.key || ''; },
  actionFromEvent(e) { const code = this.codeFromEvent(e); return state.settings.keymap[code] || state.settings.keymap[e.key] || null; }
};

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const fmt = d => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
const words = t => (t.trim().match(/\S+/g) || []).length;
const duration = t => { const s = Math.max(1, Math.round(words(t) / 145 * 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`; };
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

function navButton(view, label, iconName, mobile = false) {
  return `<button data-nav="${view}" class="${state.view === view ? 'active' : ''}" aria-label="${label}">${icon(iconName)}<span>${label}</span></button>`;
}

function shell(content) {
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">PB</div><div class="brand-wordmark">Prompt <span>Beam</span></div></div>
      <nav class="nav" aria-label="Hauptnavigation">
        ${navButton('scripts', 'Skripte', 'scripts')}
        ${navButton('settings', 'Einstellungen', 'settings')}
        ${navButton('remote', 'Fernbedienung', 'remote')}
      </nav>
      <div class="sidebar-foot"><strong>Prompt Beam · Privat</strong>Offline-Teleprompter<br>V0.4 · lokal auf deinem Gerät</div>
    </aside>
    <main class="main">
      <div class="mobile-head"><div class="brand"><div class="brand-mark">PB</div><div class="brand-wordmark">Prompt <span>Beam</span></div></div></div>
      ${content}
    </main>
    <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
      ${navButton('scripts', 'Skripte', 'scripts', true)}
      ${navButton('settings', 'Setup', 'settings', true)}
      ${navButton('remote', 'Remote', 'remote', true)}
    </nav>
  </div>`;
}

function render() {
  if (state.view === 'prompter') {
    document.querySelector('#app').innerHTML = prompterView();
    bindPrompter();
    return;
  }
  const content = state.view === 'scripts' ? scriptsView() : state.view === 'editor' ? editorView() : state.view === 'settings' ? settingsView() : remoteView();
  document.querySelector('#app').innerHTML = shell(content);
  bindCommon();
  if (state.view === 'editor') bindEditor();
  if (state.view === 'settings') bindSettings();
  if (state.view === 'remote') bindRemote();
}