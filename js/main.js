import { CONFIG, THEMES, THEME_ORDER } from './config.js';
import { Graph }        from './graph/Graph.js';
import { MapGenerator } from './map/MapGenerator.js';
import { Randomizer }   from './map/Randomizer.js';
import { Dijkstra }     from './algorithm/Dijkstra.js';
import { Renderer }     from './visualization/Renderer.js';
import { Animation }    from './visualization/Animation.js';
import { UI }           from './visualization/UI.js';

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r = 0) {
    const radius = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.arcTo(x + w, y, x + w, y + radius, radius);
    this.lineTo(x + w, y + h - radius);
    this.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    this.lineTo(x + radius, y + h);
    this.arcTo(x, y + h, x, y + h - radius, radius);
    this.lineTo(x, y + radius);
    this.arcTo(x, y, x + radius, y, radius);
    this.closePath();
    return this;
  };
}

// State global aplikasi: graf, rute aktif, mode animasi, dan opsi render.
const state = {
  graph:       new Graph(),
  decorations: { buildings: [], trees: [], plants: [], animals: [], riceFields: [], ponds: [], trafficLights: [] },
  oval:        { cx: 0, cy: 0, rx: 0, ry: 0 },
  theme:       null,
  startNode:   null,
  endNode:     null,
  themeIndex:  -1,
  generated:   false,
  running:     false,
  done:        false,
  dijkstraGen:      null,
  dijkstraInterval: null,
  lastPath: null,
  animatingRoute: false,
  returningZoom: false,
  revealingPath: false,
  pathReveal: { active: false, progress: 0, segments: [] },
  visitedCount: 0,
  showWeights:  true,
  showLabels:   true,
};

// Modul utama dibuat sekali lalu dipakai bersama oleh handler UI.
const mapGen     = new MapGenerator();
const randomizer = new Randomizer();
const dijkstra   = new Dijkstra();
const renderer   = new Renderer();
const animation  = new Animation();

const ui = new UI(document.getElementById('app'), {
  onGenerate:    handleGenerate,
  onAcakPosisi:  handleAcakPosisi,
  onMulai:       handleMulai,
  onReset:       handleReset,
  onPauseAnim:   handlePauseAnim,
  onStopAnim:    handleStopAnim,
  onUlangiAnim:  handleUlangiAnim,
  onKembaliAnim: handleKembaliAnim,
  onCanvasClick: handleCanvasClick,
});

const canvas = ui.els.canvas;
canvas.style.display = 'block';
renderer.canvas = canvas;
renderer.ctx    = canvas.getContext('2d');

function resizeCanvas() {
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const viewportW = wrap.clientWidth  || 800;
  const viewportH = wrap.clientHeight || 600;
  const w = Math.max(CONFIG.viewport.minMapWidth, Math.round(viewportW * CONFIG.viewport.mapScale));
  const h = Math.max(CONFIG.viewport.minMapHeight, Math.round(viewportH * CONFIG.viewport.mapScale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    centerCanvasScroll();
  }
}

function centerCanvasScroll() {
  const wrap = canvas.parentElement;
  if (!wrap) return;
  wrap.scrollLeft = Math.max(0, (canvas.width - wrap.clientWidth) / 2);
  wrap.scrollTop = Math.max(0, (canvas.height - wrap.clientHeight) / 2);
}

// Resize pertama menunggu layout DOM selesai dihitung.
setTimeout(resizeCanvas, 0);
window.addEventListener('resize', resizeCanvas);
if (canvas.parentElement) {
  new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
}

canvas.removeEventListener('click', ui.cb?.onCanvasClick);
renderer.attachZoomPan(canvas, handleCanvasClick);

// Tombol zoom mengirim event agar Renderer tetap menjadi pemilik state zoom.
document.addEventListener('app:zoom', (e) => {
  state.returningZoom = false;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  if      (e.detail.action === 'in')    renderer._zoomAt(cx, cy, 1.25);
  else if (e.detail.action === 'out')   renderer._zoomAt(cx, cy, 0.8);
  else if (e.detail.action === 'reset') renderer.resetZoom();
});

// Oval default dipakai sebelum peta pertama digenerate.
function getDefaultOval() {
  const w = canvas.width  || 800;
  const h = canvas.height || 600;
  const radius = Math.min(w * CONFIG.oval.radiusX, h * CONFIG.oval.radiusY);
  return {
    cx: w / 2,
    cy: h / 2,
    rx: radius,
    ry: radius,
  };
}

// Game loop merender canvas setiap frame dan mengupdate animasi aktif.
function gameLoop() {
  if (animation.isRunning) animation.update();
  if (animation.isRunning) {
    renderer.focusWorldPoint(
      animation.x,
      animation.y,
      CONFIG.animation.followZoom,
      CONFIG.animation.followSmoothness
    );
  }
  _updatePathReveal();
  _updateReturnZoom();

  const oval = (state.oval.cx > 0) ? state.oval : getDefaultOval();

  renderer.render({
    graph:       state.graph,
    decorations: state.decorations,
    theme:       state.theme ?? THEMES[THEME_ORDER[0]],
    oval,
    startNode:   state.startNode,
    endNode:     state.endNode,
    showWeights: state.showWeights,
    showLabels:  state.showLabels,
    pathReveal:  state.pathReveal,
  });

  if (animation.isRunning || animation.isDone) {
    animation.draw(renderer.ctx, state.theme, renderer.zoom, renderer.panX, renderer.panY);
  }

  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

function handleGenerate() {
  _stopDijkstra();
  animation.reset();

  state.themeIndex = 0;
  state.theme      = THEMES[THEME_ORDER[0]];

  const result      = mapGen.generatePeta(state.theme, canvas.width, canvas.height);
  state.graph       = result.graph;
  state.decorations = result.decorations;
  state.oval        = result.oval;

  const { start, end } = randomizer.randomStartEnd(state.graph);
  state.startNode  = start;
  state.endNode    = end;

  state.generated  = true;
  state.running    = false;
  state.done       = false;
  state.lastPath   = null;
  state.animatingRoute = false;
  state.returningZoom = false;
  _resetPathReveal();
  state.visitedCount = 0;

  renderer.resetZoom();
  centerCanvasScroll();

  const stats = state.graph.getStats();
  ui.updateStats({ nodeCount: stats.nodeCount, edgeCount: stats.edgeCount });
  ui.updateThemeBadge(state.theme);
  ui.clearLog();
  ui.addStepLog(
    `Map "${state.theme.name}" diacak — ${stats.nodeCount} node, ${stats.edgeCount} edge`,
    'init'
  );
  ui.setButtonStates({ generated: true, running: false, done: false });
}

function handleReset() {
  _stopDijkstra();
  animation.reset();
  renderer.resetZoom();
  state.graph.reset();
  if (state.startNode) state.startNode.state = 'start';
  if (state.endNode)   state.endNode.state   = 'end';
  state.running      = false;
  state.done         = false;
  state.lastPath     = null;
  state.animatingRoute = false;
  state.returningZoom = false;
  _resetPathReveal();
  state.visitedCount = 0;
  ui.clearLog();
  ui.addStepLog('Rute di-reset. Peta tetap sama.', 'init');
  ui.setButtonStates({ generated: state.generated, running: false, done: false });
  ui.updateStats({
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    dist: '—', visited: '—',
  });
}

function handleCanvasClick(event) {
  if (!state.generated || state.running || state.animatingRoute || state.revealingPath) return;

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  const sx = (event.clientX - rect.left) * scaleX;
  const sy = (event.clientY - rect.top)  * scaleY;

  const { x: mx, y: my } = renderer.screenToWorld(sx, sy);

  let nearest = null, minDist = Infinity;
  const hitRadius = (state.theme?.nodeRadius ?? 10) * 3.0;

  for (const node of state.graph.nodes) {
    const dx = node.x - mx, dy = node.y - my;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d < minDist && d < hitRadius) { minDist = d; nearest = node; }
  }
  if (!nearest) return;

  if (event.shiftKey) {
    if (state.startNode && nearest.id === state.startNode.id) return;
    if (state.endNode) state.endNode.state = 'unvisited';
    state.endNode       = nearest;
    state.endNode.state = 'end';
    ui.addStepLog(`End → ${nearest.label}`, 'init');
  } else {
    if (state.endNode && nearest.id === state.endNode.id) return;
    if (state.startNode) state.startNode.state = 'unvisited';
    state.startNode       = nearest;
    state.startNode.state = 'start';
    ui.addStepLog(`Start → ${nearest.label}`, 'init');
  }

  state.graph.reset();
  if (state.startNode) state.startNode.state = 'start';
  if (state.endNode)   state.endNode.state   = 'end';
  animation.reset();
  state.done = false;
  state.lastPath = null;
  state.animatingRoute = false;
  ui.setButtonStates({ generated: true, running: false, done: false });
}

// Mengacak start/end tanpa mengubah bentuk peta.
function handleAcakPosisi() {
  if (!state.generated) return;
  _stopDijkstra();
  animation.reset();
  state.graph.reset();
  state.done    = false;
  state.running = false;
  state.animatingRoute = false;
  state.returningZoom = false;
  _resetPathReveal();

  const { start, end } = randomizer.randomStartEnd(state.graph);
  state.startNode = start;
  state.endNode   = end;

  ui.clearLog();
  ui.addStepLog(
    `Posisi mobil diacak → Start: ${state.startNode.label}, End: ${state.endNode.label}`,
    'init'
  );
  ui.setButtonStates({ generated: true, running: false, done: false });
  ui.updateStats({
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    dist: '—', visited: '—',
  });
}

function handlePauseAnim() {
  if (!state.animatingRoute) return;

  if (animation.isPaused) {
    animation.resume();
  } else {
    animation.pause();
  }

  ui.setButtonStates({
    generated: true,
    running: false,
    done: true,
    animating: true,
    paused: animation.isPaused,
  });
}

function handleStopAnim() {
  if (!state.animatingRoute && !animation.isRunning) return;

  animation.stop();
  renderer.resetZoom();
  state.graph.reset();
  if (state.startNode) state.startNode.state = 'start';
  if (state.endNode)   state.endNode.state   = 'end';
  state.animatingRoute = false;
  state.returningZoom = false;
  state.done = false;
  state.lastPath = null;
  _resetPathReveal();
  ui.addStepLog('Animasi mobil dihentikan.', 'done');
  ui.updateStats({
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    dist: '—',
    visited: '—',
  });
  ui.setButtonStates({ generated: true, running: false, done: false });
}

function handleUlangiAnim() {
  if (!state.lastPath?.found) return;

  _finishPathState(state.lastPath);
  _startRouteAnimation('Animasi mobil diulang dari awal.');
}

function handleKembaliAnim() {
  if (!state.animatingRoute || animation.isRunning) return;

  state.animatingRoute = false;
  state.returningZoom = false;
  renderer.resetZoom();
  ui.setButtonStates({ generated: true, running: false, done: true });
}

function _startRouteAnimation(logMessage = null) {
  if (!state.lastPath?.found) return;
  state.returningZoom = false;

  animation.mulai(state.lastPath, () => {
    ui.addStepLog('Mobil sampai di tujuan!', 'done');
    state.returningZoom = true;
    state.animatingRoute = true;
    ui.setButtonStates({
      generated: true,
      running: false,
      done: true,
      animating: true,
      animationDone: true,
    });
  });

  renderer.focusWorldPoint(animation.x, animation.y, CONFIG.animation.followZoom, 1);
  state.animatingRoute = true;
  if (logMessage) ui.addStepLog(logMessage, 'init');
  ui.setButtonStates({ generated: true, running: false, done: true, animating: true });
}

function _updateReturnZoom() {
  if (!state.returningZoom) return;

  const smoothness = CONFIG.animation.returnZoomSmoothness ?? 0.035;
  renderer.zoom += (1 - renderer.zoom) * smoothness;
  renderer.panX += (0 - renderer.panX) * smoothness;
  renderer.panY += (0 - renderer.panY) * smoothness;

  const zoomDone = Math.abs(renderer.zoom - 1) < 0.003;
  const panDone = Math.abs(renderer.panX) < 0.8 && Math.abs(renderer.panY) < 0.8;
  if (!zoomDone || !panDone) return;

  renderer.resetZoom();
  state.returningZoom = false;
}