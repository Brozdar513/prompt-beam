function bindCommon() {
  document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { state.view = b.dataset.nav; render(); });
  document.querySelector('#newBtn')?.addEventListener('click', newScript);
  document.querySelector('#emptyNew')?.addEventListener('click', newScript);
  document.querySelector('#fab')?.addEventListener('click', newScript);
  document.querySelector('#search')?.addEventListener('input', e => { state.search = e.target.value; render(); });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEditor(b.dataset.edit));
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => openPrompt(b.dataset.start));
  document.querySelectorAll('[data-dup]').forEach(b => b.onclick = () => duplicate(b.dataset.dup));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => remove(b.dataset.del));
  document.querySelector('#exportBtn')?.addEventListener('click', exportBackup);
  document.querySelector('#importBtn')?.addEventListener('click', () => document.querySelector('#fileInput')?.click());
  document.querySelector('#fileInput')?.addEventListener('change', importBackup);
}

function newScript() { state.currentId = null; state.view = 'editor'; render(); }
function openEditor(id) { state.currentId = id; state.view = 'editor'; render(); }
function openPrompt(id) { state.currentId = id; state.view = 'prompter'; scroll.y = 0; render(); }
async function duplicate(id) { const s = state.scripts.find(x => x.id === id); if (!s) return; const n = { ...s, id: uid(), title: `${s.title} – Kopie`, createdAt: Date.now(), updatedAt: Date.now() }; await putScript(n); state.scripts = await getAllScripts(); render(); }
async function remove(id) { if (!confirm('Skript wirklich löschen?')) return; await deleteScript(id); state.scripts = await getAllScripts(); render(); }

function bindEditor() {
  let saveTimer;
  const title = document.querySelector('#titleInput');
  const content = document.querySelector('#contentInput');
  async function persist() {
    let s = state.scripts.find(x => x.id === state.currentId);
    if (!s) { s = { id: uid(), createdAt: Date.now(), title: '', content: '' }; state.currentId = s.id; }
    s = { ...s, title: title.value.trim() || 'Ohne Titel', content: content.value, updatedAt: Date.now() };
    await putScript(s);
    try { localStorage.removeItem(EMERGENCY_DRAFT_KEY); } catch {}
    state.scripts = await getAllScripts();
    const a = document.querySelector('#autosave'); if (a) a.textContent = 'Gespeichert';
  }
  function changed() {
    try { localStorage.setItem(EMERGENCY_DRAFT_KEY, JSON.stringify({ id: state.currentId, title: title.value, content: content.value, updatedAt: Date.now() })); } catch {}
    const wc = document.querySelector('#wordCount'); if (wc) wc.innerHTML = `${icon('words','sm')}${words(content.value)} Wörter`;
    const dur = document.querySelector('#duration'); if (dur) dur.innerHTML = `${icon('clock','sm')}Geschätzte Sprechzeit: ${duration(content.value)}`;
    const a = document.querySelector('#autosave'); if (a) a.textContent = 'Speichert …';
    clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400);
  }
  title.oninput = changed; content.oninput = changed;
  document.querySelector('#backScripts').onclick = async () => { await persist(); state.view = 'scripts'; render(); };
  document.querySelector('#openPrompter').onclick = async () => { await persist(); openPrompt(state.currentId); };
}

function bindSettings() {
  ['fontSize','speed','lineHeight','marginX'].forEach(id => {
    const el = document.querySelector('#' + id);
    el.oninput = async () => {
      state.settings[id] = Number(el.value);
      document.querySelector('#' + id + 'Val').textContent = id === 'fontSize' ? el.value + 'px' : id === 'marginX' ? el.value + '%' : el.value;
      await saveSettings();
    };
  });
  ['mirror','countdown'].forEach(id => document.querySelector('#' + id).onchange = async e => { state.settings[id] = id === 'countdown' ? Number(e.target.value) : e.target.value; await saveSettings(); });
  ['guide','loop','orientationLock'].forEach(id => document.querySelector('#' + id).onchange = async e => { state.settings[id] = e.target.checked; await saveSettings(); });
  document.querySelectorAll('#resetSettings').forEach(btn => btn.onclick = async () => { state.settings = { ...defaultSettings, keymap: { ...defaultSettings.keymap } }; await saveSettings(); render(); });
  updateInstallUI();
  document.querySelector('#installApp')?.addEventListener('click', installPromptBeam);
  document.querySelector('#showInstallHelp')?.addEventListener('click', () => document.querySelector('#installHelp')?.classList.toggle('hidden'));
}

function bindRemote() {
  document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { state.pendingMap = b.dataset.map; b.textContent = 'Taste drücken …'; });
  document.querySelector('#resetKeys').onclick = async () => { state.settings.keymap = { ...defaultSettings.keymap }; await saveSettings(); render(); };
}

async function acquireWake() { try { if ('wakeLock' in navigator) scroll.wake = await navigator.wakeLock.request('screen'); } catch {} }
async function releaseWake() { try { await scroll.wake?.release(); } catch {} scroll.wake = null; }
async function startWithCountdown() {
  if (scroll.running || scroll.countdown) return;
  const n = state.settings.countdown;
  if (n > 0) {
    scroll.countdown = true;
    const layer = document.querySelector('#countdownLayer');
    layer.classList.remove('hidden');
    const token = ++scroll.countdownToken;
    for (let i = n; i > 0; i--) {
      if (token !== scroll.countdownToken || state.view !== 'prompter') { layer.classList.add('hidden'); scroll.countdown = false; return; }
      layer.textContent = i; await new Promise(r => setTimeout(r, 1000));
    }
    layer.classList.add('hidden');
    scroll.countdown = false;
  }
  if (state.view === 'prompter') startScroll();
}
function startScroll() { scroll.running = true; scroll.last = performance.now(); const b = document.querySelector('#toggleRun'); if (b) b.innerHTML = '❚❚ Pause'; acquireWake(); tick(scroll.last); }
function stopScroll() { scroll.running = false; scroll.countdownToken++; cancelAnimationFrame(scroll.raf); const b = document.querySelector('#toggleRun'); if (b) b.innerHTML = `${icon('play','sm')} Start`; releaseWake(); }
function tick(t) {
  if (!scroll.running) return;
  const dt = (t - scroll.last) / 1000; scroll.last = t; scroll.y += state.settings.speed * dt; applyScroll();
  const max = measureMaxScroll();
  if (scroll.y >= max) { if (state.settings.loop && max > 0) scroll.y = 0; else { scroll.y = max; stopScroll(); } }
  scroll.raf = requestAnimationFrame(tick);
}
function measureMaxScroll() {
  const stage = document.querySelector('#stage'), txt = document.querySelector('#promptText');
  if (!stage || !txt) return 0;
  scroll.maxY = Math.max(0, txt.scrollHeight - stage.clientHeight * .55);
  return scroll.maxY;
}
function applyScroll() {
  const txt = document.querySelector('#promptText'); if (!txt) return;
  const max = scroll.maxY || measureMaxScroll();
  scroll.y = Math.max(0, Math.min(scroll.y, max));
  txt.style.translate = `0 ${-scroll.y}px`;
  const p = document.querySelector('#progressBar'); if (p) p.style.width = `${max ? Math.min(100, scroll.y / max * 100) : 0}%`;
}
function jump(sec) { const max = measureMaxScroll(); scroll.y = Math.max(0, Math.min(max, scroll.y + state.settings.speed * sec)); applyScroll(); }
function cycleMirror() { state.settings.mirror = state.settings.mirror === 'none' ? 'x' : state.settings.mirror === 'x' ? 'y' : state.settings.mirror === 'y' ? 'xy' : 'none'; saveSettings(); render(); }
function bindPrompter() {
  applyScroll();
  document.querySelector('#exitPrompter').onclick = () => { stopScroll(); PlatformAdapter.unlockOrientation(); state.view = 'scripts'; render(); };
  document.querySelector('#toggleRun').onclick = () => scroll.running ? stopScroll() : startWithCountdown();
  document.querySelector('#faster').onclick = () => { state.settings.speed = Math.min(160, state.settings.speed + 5); saveSettings(); };
  document.querySelector('#slower').onclick = () => { state.settings.speed = Math.max(5, state.settings.speed - 5); saveSettings(); };
  document.querySelector('#forward10').onclick = () => jump(10);
  document.querySelector('#back10').onclick = () => jump(-10);
  document.querySelector('#mirrorBtn').onclick = cycleMirror;
  document.querySelector('#fullBtn').onclick = async () => { const ok = await PlatformAdapter.toggleFullscreen(); if (!ok) alert('Vollbild wird von diesem Browser/Gerät nicht unterstützt.'); };
  if (state.settings.orientationLock) PlatformAdapter.lockLandscape();
  requestAnimationFrame(() => { measureMaxScroll(); applyScroll(); });
}