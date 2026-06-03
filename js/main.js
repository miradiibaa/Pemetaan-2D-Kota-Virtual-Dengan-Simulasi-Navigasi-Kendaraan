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
