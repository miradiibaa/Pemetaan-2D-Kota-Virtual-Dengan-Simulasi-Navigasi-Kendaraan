
export class UI {

  /**
   * @param {HTMLElement} container  - Elemen wrapper utama aplikasi
   * @param {object}      callbacks  - Fungsi-fungsi dari main.js
   * @param {Function}    callbacks.onGenerate    - Klik tombol Acak Map
   * @param {Function}    callbacks.onAcakPosisi  - Klik tombol Acak Posisi
   * @param {Function}    callbacks.onMulai       - Klik tombol Mulai
   * @param {Function}    callbacks.onReset       - Klik tombol Reset
   * @param {Function}    callbacks.onPauseAnim   - Klik tombol Pause/Resume animasi
   * @param {Function}    callbacks.onStopAnim    - Klik tombol Stop animasi
   * @param {Function}    callbacks.onUlangiAnim  - Klik tombol Ulangi animasi
   * @param {Function}    callbacks.onKembaliAnim - Klik tombol kembali dari kontrol animasi
   * @param {Function}    callbacks.onCanvasClick - Klik di canvas
   */
  constructor(container, callbacks) {
    this.container = container;
    this.cb        = callbacks;

    // Referensi elemen DOM (diisi saat _buildUI)
    this.els = {};

    this._buildUI();
    this.setButtonStates({ generated: false, running: false, done: false });
  }

  // Membuat struktur DOM utama: toolbar, canvas, panel info, dan log.

  _buildUI() {
    this.container.innerHTML = '';
    this.container.className = 'app-wrapper';

    const topPanel = document.createElement('div');
    topPanel.className = 'top-panel';
    topPanel.innerHTML = `
      <div class="app-title">
        <span class="title-icon">🗺️</span>
        <div>
          <div class="title-main">Road Pathfinding</div>
          <div class="title-sub">Dijkstra Algorithm Visualizer</div>
        </div>
      </div>

      <div class="btn-group" id="btnGroupPeta">
        <button class="btn btn-peta" id="btnGenerate" title="Acak map, jalan, dan lingkungan baru">
          <span>🔀</span> Acak Map
        </button>
      </div>

      <div class="btn-group" id="btnGroupTitik">
        <button class="btn btn-titik" id="btnAcakPosisi" title="Acak ulang titik start dan end tanpa mengubah peta" disabled>
          <span>📍</span> Acak Start/End
        </button>
      </div>

      <div class="divider-v"></div>

      <div class="btn-group" id="btnGroupAnim">
        <button class="btn btn-mulai" id="btnMulai" title="Mulai visualisasi Dijkstra dan animasi kendaraan" disabled>
          <span>▶</span> Mulai
        </button>
        <button class="btn btn-reset" id="btnReset" title="Reset rute tanpa generate ulang peta" disabled>
          <span>⟳</span> Reset
        </button>
        <button class="btn btn-pause" id="btnPauseAnim" title="Pause atau lanjutkan mobil" hidden>
          <span>⏸</span> Pause
        </button>
        <button class="btn btn-stop" id="btnStopAnim" title="Hentikan animasi mobil" hidden>
          <span>■</span> Stop
        </button>
        <button class="btn btn-ulangi" id="btnUlangiAnim" title="Ulangi animasi mobil dari awal" hidden>
          <span>↻</span> Ulangi
        </button>
        <button class="btn btn-kembali" id="btnKembaliAnim" title="Kembali ke tombol utama" hidden>
          <span>←</span> Kembali
        </button>
      </div>


      <div class="divider-v"></div>

      <div class="btn-group" id="btnGroupZoom">
        <button class="btn btn-zoom" id="btnZoomIn"  title="Zoom In (scroll mouse juga bisa)">🔍+</button>
        <button class="btn btn-zoom" id="btnZoomOut" title="Zoom Out">🔍−</button>
        <button class="btn btn-zoom" id="btnZoomReset" title="Posisi Tengah / Reset Zoom">⊙</button>
      </div>

      <div class="divider-v"></div>

      <div class="stat-group">
        <div class="stat-item">
          <div class="stat-val" id="statNodes">—</div>
          <div class="stat-lbl">NODES</div>
        </div>
        <div class="stat-item">
          <div class="stat-val" id="statEdges">—</div>
          <div class="stat-lbl">EDGES</div>
        </div>
        <div class="stat-item">
          <div class="stat-val" id="statDist">—</div>
          <div class="stat-lbl">JARAK RUTE</div>
        </div>
        <div class="stat-item">
          <div class="stat-val" id="statVisited">—</div>
          <div class="stat-lbl">DIKUNJUNGI</div>
        </div>
      </div>

      <div class="theme-badge" id="themeBadge">—</div>
    `;
    this.container.appendChild(topPanel);

    const mainArea = document.createElement('div');
    mainArea.className = 'main-area';

    // Canvas
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.id        = 'mapCanvas';
    canvas.className = 'map-canvas';
    if (typeof this.cb.onCanvasClick === 'function') {
      canvas.addEventListener('click', this.cb.onCanvasClick);
    }
    canvasWrap.appendChild(canvas);
    mainArea.appendChild(canvasWrap);

    // Panel kanan (info rute + log Dijkstra)
    const rightPanel = document.createElement('div');
    rightPanel.className = 'right-panel';
    rightPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-title">📊 Info Rute</div>
        <div id="routeInfo" class="route-info">
          <div class="info-placeholder">Tekan <b>Mulai</b> untuk melihat rute terpendek</div>
        </div>
      </div>

      <div class="panel-section flex-grow">
        <div class="panel-title">
          🔍 Log Dijkstra
          <button class="btn-clear-log" id="btnClearLog" title="Bersihkan log">✕</button>
        </div>
        <div id="dijkstraLog" class="dijkstra-log"></div>
      </div>
    `;
    mainArea.appendChild(rightPanel);

    this.container.appendChild(mainArea);

    this.els = {
      canvas,
      btnGenerate:   document.getElementById('btnGenerate'),
      btnAcakPosisi: document.getElementById('btnAcakPosisi'),
      btnMulai:      document.getElementById('btnMulai'),
      btnReset:      document.getElementById('btnReset'),
      btnPauseAnim:  document.getElementById('btnPauseAnim'),
      btnStopAnim:   document.getElementById('btnStopAnim'),
      btnUlangiAnim: document.getElementById('btnUlangiAnim'),
      btnKembaliAnim:document.getElementById('btnKembaliAnim'),
      btnZoomIn:     document.getElementById('btnZoomIn'),
      btnZoomOut:    document.getElementById('btnZoomOut'),
      btnZoomReset:  document.getElementById('btnZoomReset'),
      btnClearLog:   document.getElementById('btnClearLog'),
      statNodes:     document.getElementById('statNodes'),
      statEdges:     document.getElementById('statEdges'),
      statDist:      document.getElementById('statDist'),
      statVisited:   document.getElementById('statVisited'),
      themeBadge:    document.getElementById('themeBadge'),
      routeInfo:     document.getElementById('routeInfo'),
      dijkstraLog:   document.getElementById('dijkstraLog'),
    };

    this.els.btnGenerate.addEventListener('click',   this.cb.onGenerate);
    this.els.btnAcakPosisi.addEventListener('click', this.cb.onAcakPosisi);
    this.els.btnMulai.addEventListener('click',      this.cb.onMulai);
    this.els.btnReset.addEventListener('click',      this.cb.onReset);
    this.els.btnPauseAnim.addEventListener('click',  this.cb.onPauseAnim);
    this.els.btnStopAnim.addEventListener('click',   this.cb.onStopAnim);
    this.els.btnUlangiAnim.addEventListener('click', this.cb.onUlangiAnim);
    this.els.btnKembaliAnim.addEventListener('click',this.cb.onKembaliAnim);
    this.els.btnClearLog.addEventListener('click',   () => this.clearLog());

    // Zoom buttons — dispatch custom events, handled in main.js via renderer
    this.els.btnZoomIn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('app:zoom', { detail: { action: 'in' } }));
    });
    this.els.btnZoomOut.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('app:zoom', { detail: { action: 'out' } }));
    });
    this.els.btnZoomReset.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('app:zoom', { detail: { action: 'reset' } }));
    });
  }

  // UPDATE TAMPILAN

  /** Update statistik di panel atas */
  updateStats({ nodeCount = '—', edgeCount = '—', dist = '—', visited = '—' }) {
    this.els.statNodes.textContent   = nodeCount;
    this.els.statEdges.textContent   = edgeCount;
    this.els.statDist.textContent    = dist === Infinity ? '∞' : dist;
    this.els.statVisited.textContent = visited;
  }

  /** Update badge nama tema di pojok kanan atas */
  updateThemeBadge(theme) {
    this.els.themeBadge.textContent = `${theme.icon} ${theme.name}`;
    this.els.themeBadge.style.setProperty('--badge-color', theme.stateColors.start);
  }

  /** Update panel info rute setelah Dijkstra selesai */
  updateRouteInfo(path) {
    const el = this.els.routeInfo;
    if (!path || !path.found) {
      el.innerHTML = `<div class="info-error">❌ Tidak ada jalur yang ditemukan!</div>`;
      return;
    }

    const nodeList = path.nodeLabels.join(' → ');
    const edgeWeights = path.edges.map(e => e.weight).join(', ');

    el.innerHTML = `
      <div class="route-row">
        <span class="route-icon">📏</span>
        <span class="route-key">Total Jarak</span>
        <span class="route-val highlight">${path.totalDistance} unit</span>
      </div>
      <div class="route-row">
        <span class="route-icon">🔢</span>
        <span class="route-key">Jumlah Node</span>
        <span class="route-val">${path.nodes.length} titik</span>
      </div>
      <div class="route-row">
        <span class="route-icon">🛣️</span>
        <span class="route-key">Jumlah Edge</span>
        <span class="route-val">${path.edges.length} jalan</span>
      </div>
      <div class="route-section-title">Urutan Node:</div>
      <div class="route-nodes">${nodeList}</div>
      <div class="route-section-title">Bobot Edge:</div>
      <div class="route-weights">${edgeWeights}</div>
    `;
  }

  /**
   * addStepLog — Menambahkan satu baris log langkah Dijkstra.
   * @param {string} message - Pesan langkah
   * @param {'init'|'visit'|'consider'|'update'|'skip'|'done'} type
   */
  addStepLog(message, type = 'visit') {
    const el   = this.els.dijkstraLog;
    const item = document.createElement('div');
    item.className = `log-item log-${type}`;

    const icon = {
      init:     '⚙️', visit:    '▶',
      consider: '🔍', update:   '✓',
      skip:     '✗',  done:     '✅',
    }[type] ?? '•';

    item.innerHTML = `<span class="log-icon">${icon}</span><span>${message}</span>`;
    el.appendChild(item);

    // Auto-scroll ke bawah
    el.scrollTop = el.scrollHeight;

    // Batasi jumlah log agar tidak terlalu panjang
    while (el.children.length > 200) {
      el.removeChild(el.firstChild);
    }
  }

  /** Hapus semua log Dijkstra */
  clearLog() {
    this.els.dijkstraLog.innerHTML = '';
    this.els.routeInfo.innerHTML = `
      <div class="info-placeholder">Tekan <b>Mulai</b> untuk melihat rute terpendek</div>
    `;
    this.updateStats({ dist: '—', visited: '—' });
  }

  // Mengatur tombol berdasarkan fase aplikasi: belum generate, scan, animasi, atau selesai.
  setButtonStates({
    generated = false,
    running = false,
    done = false,
    animating = false,
    paused = false,
    animationDone = false,
  }) {
    const {
      btnGenerate, btnAcakPosisi, btnMulai, btnReset,
      btnPauseAnim, btnStopAnim, btnUlangiAnim, btnKembaliAnim, btnZoomIn, btnZoomOut,
      btnZoomReset, btnClearLog,
    } = this.els;

    const locked = running || animating;
    btnGenerate.disabled   = locked;
    btnAcakPosisi.disabled = !generated || locked;
    btnMulai.disabled      = !generated || locked;
    btnReset.disabled      = locked || (!done && !running);
    btnZoomIn.disabled     = locked;
    btnZoomOut.disabled    = locked;
    btnZoomReset.disabled  = locked;
    btnClearLog.disabled   = !generated || locked;

    btnGenerate.hidden   = animating;
    btnAcakPosisi.hidden = animating;
    btnZoomIn.hidden     = animating;
    btnZoomOut.hidden    = animating;
    btnZoomReset.hidden  = animating;

    btnMulai.hidden      = animating;
    btnReset.hidden      = animating;
    btnPauseAnim.hidden  = !animating || animationDone;
    btnStopAnim.hidden   = !animating;
    btnUlangiAnim.hidden = !animating;
    btnKembaliAnim.hidden = !animating || !animationDone;

    btnPauseAnim.disabled  = !animating || animationDone;
    btnStopAnim.disabled   = !animating;
    btnUlangiAnim.disabled = !animating;
    btnKembaliAnim.disabled = !animating || !animationDone;

    btnMulai.innerHTML = running
      ? '<span>⏳</span> Scan...'
      : '<span>▶</span> Mulai';

    btnPauseAnim.innerHTML = paused
      ? '<span>▶</span> Lanjut'
      : '<span>⏸</span> Pause';
  }
}
