function scriptsView() {
  const q = state.search.trim().toLowerCase();
  const list = state.scripts
    .filter(s => !q || s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return `<section class="page">
    <div class="topbar">
      <div class="title"><div class="eyebrow">Bibliothek</div><h1>Meine Skripte</h1><p>${state.scripts.length ? `${state.scripts.length} ${state.scripts.length === 1 ? 'Skript' : 'Skripte'} lokal gespeichert.` : 'Erstelle dein erstes Skript und starte direkt im Prompter.'}</p></div>
      <div class="actions">
        <details class="tool-menu desktop-secondary"><summary class="btn icon-only" aria-label="Weitere Aktionen">${icon('more')}</summary><div class="menu-pop"><button id="importBtn">${icon('upload','sm')} Importieren</button><button id="exportBtn">${icon('download','sm')} Backup exportieren</button></div></details>
        <button class="btn primary" id="newBtn">${icon('plus','sm')} Neues Skript</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-wrap">${icon('search')}<input class="search" id="search" placeholder="Skripte durchsuchen …" value="${esc(state.search)}" aria-label="Skripte durchsuchen"></div>
    </div>
    ${list.length ? `<div class="script-list">${list.map(s => `
      <article class="script-card">
        <div class="script-main">
          <div class="script-file-icon">${icon('file')}</div>
          <div class="script-copy"><div class="script-title">${esc(s.title || 'Ohne Titel')}</div><div class="meta"><span>${fmt(s.updatedAt)}</span><span class="meta-dot">•</span><span>${words(s.content)} Wörter</span><span class="meta-dot">•</span><span>ca. ${duration(s.content)}</span></div></div>
        </div>
        <div class="row-actions">
          <button class="btn primary start-btn" data-start="${s.id}" aria-label="${esc(s.title)} starten">${icon('play','sm')} <span class="label-sm">Starten</span></button>
          <details class="overflow"><summary class="btn icon-only" aria-label="Skriptaktionen">${icon('more')}</summary><div class="menu-pop"><button data-edit="${s.id}">${icon('edit','sm')} Bearbeiten</button><button data-dup="${s.id}">${icon('copy','sm')} Duplizieren</button><button class="danger" data-del="${s.id}">${icon('trash','sm')} Löschen</button></div></details>
        </div>
      </article>`).join('')}</div>` : `<div class="empty"><div class="empty-icon">${icon('scripts','lg')}</div><strong>Noch keine Skripte</strong><p>Erstelle ein Skript, füge deinen Text ein und öffne ihn direkt im Prompter.</p><button class="btn primary" id="emptyNew">${icon('plus','sm')} Neues Skript</button></div>`}
    <input type="file" id="fileInput" accept="application/json,text/plain" class="hidden">
    <button class="fab" id="fab" aria-label="Neues Skript">+</button>
  </section>`;
}

function editorView() {
  const s = state.scripts.find(x => x.id === state.currentId) || { title: '', content: '' };
  return `<section class="page narrow">
    <div class="topbar">
      <div class="title"><div class="eyebrow">Editor</div><h1>${s.id ? 'Skript bearbeiten' : 'Neues Skript'}</h1><p class="save-status" id="autosave">Lokale Speicherung · Autosave</p></div>
      <div class="actions"><button class="btn keep-mobile" id="backScripts">${icon('back','sm')} <span class="label-sm">Zurück</span></button><button class="btn primary" id="openPrompter">${icon('play','sm')} Im Prompter öffnen</button></div>
    </div>
    <div class="editor-shell">
      <div class="editor-card">
        <div class="field"><label for="titleInput">Titel</label><input id="titleInput" maxlength="100" placeholder="z. B. YouTube – Napoleon" value="${esc(s.title)}"></div>
        <div class="field"><label for="contentInput">Skript</label><textarea id="contentInput" placeholder="Schreibe oder füge hier dein Skript ein …">${esc(s.content)}</textarea></div>
      </div>
      <div class="editor-foot"><div class="editor-meta"><span class="meta-pill" id="wordCount">${icon('words','sm')}${words(s.content)} Wörter</span><span class="meta-pill" id="duration">${icon('clock','sm')}Geschätzte Sprechzeit: ${duration(s.content)}</span></div></div>
    </div>
  </section>`;
}

function settingsView() {
  const x = state.settings;
  return `<section class="page">
    <div class="topbar"><div class="title"><div class="eyebrow">Setup</div><h1>Prompter-Einstellungen</h1><p>Darstellung und Verhalten für deinen Auftritt. Alle Werte bleiben lokal gespeichert.</p></div><div class="actions"><button class="btn desktop-secondary" id="resetSettings">Standardwerte</button></div></div>
    <div class="settings-wrap">
      <div class="surface settings-section">
        <h2 class="section-title">Lesbarkeit & Tempo</h2><p class="section-sub">Passe den Text an Abstand, Blickwinkel und Sprechtempo an.</p>
        <div class="setting-list">
          <div class="setting-row"><div class="setting-head"><span>Schriftgröße</span><span class="setting-value" id="fontSizeVal">${x.fontSize}px</span></div><input id="fontSize" type="range" min="28" max="120" value="${x.fontSize}"></div>
          <div class="setting-row"><div class="setting-head"><span>Scroll-Geschwindigkeit</span><span class="setting-value" id="speedVal">${x.speed}</span></div><input id="speed" type="range" min="5" max="160" value="${x.speed}"></div>
          <div class="setting-row"><div class="setting-head"><span>Zeilenabstand</span><span class="setting-value" id="lineHeightVal">${x.lineHeight}</span></div><input id="lineHeight" type="range" min="1" max="2" step="0.05" value="${x.lineHeight}"></div>
          <div class="setting-row"><div class="setting-head"><span>Seitenränder</span><span class="setting-value" id="marginXVal">${x.marginX}%</span></div><input id="marginX" type="range" min="2" max="25" value="${x.marginX}"></div>
        </div>
      </div>
      <div class="surface settings-section">
        <h2 class="section-title">Prompter-Verhalten</h2><p class="section-sub">Spiegelung, Countdown und Fokusfunktionen.</p>
        <div class="setting-list">
          <div class="setting-row select-row"><label for="mirror">Spiegelmodus</label><select id="mirror"><option value="none" ${x.mirror === 'none' ? 'selected' : ''}>Normal</option><option value="x" ${x.mirror === 'x' ? 'selected' : ''}>Horizontal</option><option value="y" ${x.mirror === 'y' ? 'selected' : ''}>Vertikal</option><option value="xy" ${x.mirror === 'xy' ? 'selected' : ''}>Horizontal + vertikal</option></select></div>
          <div class="setting-row select-row"><label for="countdown">Countdown</label><select id="countdown"><option value="0" ${x.countdown === 0 ? 'selected' : ''}>Aus</option><option value="3" ${x.countdown === 3 ? 'selected' : ''}>3 Sekunden</option><option value="5" ${x.countdown === 5 ? 'selected' : ''}>5 Sekunden</option></select></div>
          <label class="toggle-row"><span class="toggle-copy"><strong>Leseführung</strong><small>Markerlinie als Orientierung im Text</small></span><input class="switch" id="guide" type="checkbox" ${x.guide ? 'checked' : ''}></label>
          <label class="toggle-row"><span class="toggle-copy"><strong>Endlosschleife</strong><small>Am Ende automatisch von vorne beginnen</small></span><input class="switch" id="loop" type="checkbox" ${x.loop ? 'checked' : ''}></label>
          <label class="toggle-row"><span class="toggle-copy"><strong>Orientierung sperren</strong><small>Querformat beim Prompter bevorzugen</small></span><input class="switch" id="orientationLock" type="checkbox" ${x.orientationLock ? 'checked' : ''}></label>
        </div>
        <div class="notice" style="margin-top:16px">Fullscreen und Orientierung hängen vom jeweiligen Browser und Betriebssystem ab. Prompt Beam nutzt die Funktionen nur, wenn dein Gerät sie unterstützt.</div>
        <button class="btn" id="resetSettings" style="margin-top:14px">Standardwerte wiederherstellen</button>
      </div>
      <div class="surface settings-section install-section">
        <h2 class="section-title">App auf diesem Gerät</h2><p class="section-sub">Prompt Beam kann auf unterstützten Android-Geräten wie eine App installiert werden.</p>
        <div class="install-status"><span class="dot"></span><div><strong id="installState">Installation prüfen …</strong><small id="installHint">Öffne Prompt Beam über eine sichere HTTPS-Adresse in Chrome.</small></div></div>
        <div class="install-actions"><button class="btn primary" id="installApp">Prompt Beam installieren</button><button class="btn" id="showInstallHelp">Installationshilfe</button></div>
        <div class="notice hidden" id="installHelp">Android/Chrome: Menü ⋮ → „App installieren“ oder „Zum Startbildschirm hinzufügen“. Für eine echte PWA-Installation muss Prompt Beam über HTTPS geöffnet werden. Nach der Installation läuft die Kern-App offline.</div>
      </div>
    </div>
  </section>`;
}

function remoteView() {
  const map = state.settings.keymap;
  const actions = [['toggle','Start / Pause'],['faster','Schneller'],['slower','Langsamer'],['forward','Vorwärts springen'],['back','Zurück springen'],['mirror','Spiegelmodus wechseln']];
  const keyFor = a => Object.entries(map).find(([, v]) => v === a)?.[0] || 'Nicht belegt';
  return `<section class="page">
    <div class="topbar"><div class="title"><div class="eyebrow">Controller</div><h1>Fernbedienung</h1><p>Teste Bluetooth-/Tastaturbefehle und ordne sie direkt den Prompter-Aktionen zu.</p></div><div class="status"><span class="dot"></span>Eingabe-Erkennung aktiv</div></div>
    <div class="remote-grid">
      <div class="surface remote-list">
        <div class="remote-banner"><span class="dot"></span><div><strong>Bluetooth HID / Tastatur bereit</strong><small>Wenn deine Leeventi-Fernbedienung Tastaturbefehle sendet, erkennt Prompt Beam sie hier.</small></div></div>
        ${actions.map(([a,l]) => `<div class="remote-row"><span class="remote-label">${l}</span><span class="keycap">${esc(keyFor(a))}</span><button class="btn" data-map="${a}">Neu belegen</button></div>`).join('')}
        <button class="btn" id="resetKeys" style="margin-top:16px">Standardbelegung</button>
      </div>
      <div class="surface event-log"><h2 class="section-title">Live-Tastenereignisse</h2><p class="section-sub">Die letzten erkannten Eingaben deines Geräts.</p><div id="events">${state.remoteEvents.length ? state.remoteEvents.slice(0,12).map(e => `<code>${esc(e)}</code>`).join('') : '<span class="meta">Drücke eine Taste auf der Fernbedienung …</span>'}</div></div>
    </div>
  </section>`;
}

function prompterView() {
  const s = state.scripts.find(x => x.id === state.currentId);
  if (!s) return `<div style="padding:30px">Kein Skript ausgewählt.</div>`;
  const x = state.settings;
  const cls = x.mirror === 'x' ? 'mirror-x' : x.mirror === 'y' ? 'mirror-y' : x.mirror === 'xy' ? 'mirror-xy' : '';
  return `<div class="prompter-wrap ${cls}" style="--fontSize:${x.fontSize}px;--lineHeight:${x.lineHeight};--marginX:${x.marginX}vw">
    <div class="progress"><div id="progressBar"></div></div>
    <div class="prompter-top"><button class="btn" id="exitPrompter">${icon('back','sm')} <span class="label-sm">${esc(s.title || 'Skript')}</span></button><div class="actions"><button class="btn icon-only" id="fullBtn" aria-label="Vollbild">${icon('full')}</button><button class="btn icon-only" id="mirrorBtn" aria-label="Spiegelmodus">${icon('mirror')}</button></div></div>
    <div class="prompter-stage" id="stage"><div class="prompter-text" id="promptText">${esc(s.content)}</div>${x.guide ? '<div class="guide"></div>' : ''}</div>
    <div class="prompter-bottom"><button class="btn" id="back10">${icon('rewind','sm')} 10s</button><button class="btn" id="slower">−</button><button class="btn primary" id="toggleRun">${icon('play','sm')} Start</button><button class="btn" id="faster">＋</button><button class="btn" id="forward10">10s ${icon('forward','sm')}</button></div>
    <div id="countdownLayer" class="countdown hidden"></div>
  </div>`;
}