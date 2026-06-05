
export class Renderer {

  constructor(canvas = null) {
    this.canvas = canvas;
    this.ctx    = canvas ? canvas.getContext('2d') : null;

    this.zoom    = 1.0;
    this.panX    = 0;
    this.panY    = 0;
    this._minZoom = 0.4;
    this._maxZoom = 3.5;

    // drag support
    this._dragging = false;
    this._dragStart = { x: 0, y: 0 };
    this._panStart  = { x: 0, y: 0 };
  }

  // Pasang event zoom/pan ke canvas
  attachZoomPan(canvas, onCanvasClick) {
    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect   = canvas.getBoundingClientRect();
      const mx     = (e.clientX - rect.left) * (canvas.width  / rect.width);
      const my     = (e.clientY - rect.top)  * (canvas.height / rect.height);
      this._zoomAt(mx, my, factor);
    }, { passive: false });

    // Pan via drag
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this._dragging  = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._panStart  = { x: this.panX, y: this.panY };
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      this.panX = this._panStart.x + dx;
      this.panY = this._panStart.y + dy;
    });
    const stopDrag = (e) => {
      if (this._dragging) {
        this._dragging = false;
        canvas.style.cursor = '';
        // jika tidak banyak gerak, anggap klik
        const dx = e.clientX - this._dragStart.x;
        const dy = e.clientY - this._dragStart.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && typeof onCanvasClick === 'function') {
          onCanvasClick(e);
        }
      }
    };
    canvas.addEventListener('mouseup', stopDrag);
    canvas.addEventListener('mouseleave', () => { this._dragging = false; canvas.style.cursor = ''; });

    // Touch pinch zoom
    let lastTouchDist = null;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx*dx + dy*dy);
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (lastTouchDist) {
          const factor = dist / lastTouchDist;
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const rect = canvas.getBoundingClientRect();
          this._zoomAt(
            (cx - rect.left) * (canvas.width  / rect.width),
            (cy - rect.top)  * (canvas.height / rect.height),
            factor
          );
        }
        lastTouchDist = dist;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { lastTouchDist = null; });
  }

  _zoomAt(mx, my, factor) {
    const newZoom = Math.min(this._maxZoom, Math.max(this._minZoom, this.zoom * factor));
    const scale   = newZoom / this.zoom;
    this.panX = mx - scale * (mx - this.panX);
    this.panY = my - scale * (my - this.panY);
    this.zoom = newZoom;
  }

  resetZoom() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  focusWorldPoint(x, y, targetZoom = this.zoom, smoothness = 1) {
    if (!this.canvas) return;

    const nextZoom = this._lerp(
      this.zoom,
      Math.min(this._maxZoom, Math.max(this._minZoom, targetZoom)),
      smoothness
    );
    const targetPanX = this.canvas.width / 2 - x * nextZoom;
    const targetPanY = this.canvas.height / 2 - y * nextZoom;

    this.zoom = nextZoom;
    this.panX = this._lerp(this.panX, targetPanX, smoothness);
    this.panY = this._lerp(this.panY, targetPanY, smoothness);
  }

  // Konversi koordinat canvas → world (untuk click detection)
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }
}
  // RENDER UTAMA
  render(state) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!state.graph || state.graph.nodes.length === 0) {
      this._drawEmpty(state.theme);
      return;
    }

    // Terapkan zoom/pan
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    this._drawOuterBackground(state);
    this._clipToOval(state, () => {
      this._drawInnerBackground(state);
      this._drawPonds(state);
      this._drawEdges(state);
      this._drawPlants(state);
      this._drawTrees(state);
      this._drawBuildings(state);
      this._drawAnimals(state);
      this._drawTrafficLights(state);
      this._drawNodes(state);
      if (state.showWeights) this._drawEdgeWeights(state);
      if (state.showLabels)  this._drawNodeLabels(state);
    });
    this._drawOvalBorder(state);

    ctx.restore();

    // HUD zoom (di atas zoom transform, UI space)
    this._drawZoomHUD();
  }

  _drawZoomHUD() {
    const { ctx } = this;
    const pct = Math.round(this.zoom * 100);
    ctx.save();
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, this.canvas.height - 30, 62, 22);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🔍 ${pct}%`, 39, this.canvas.height - 19);
    ctx.restore();
  }

  _lerp(from, to, amount) {
    const t = Math.min(1, Math.max(0, amount));
    return from + (to - from) * t;
  }

  // BACKGROUND & OVAL
  _drawEmpty(theme) {
    const { ctx, canvas } = this;
    ctx.fillStyle = theme ? theme.bgOuter : '#1A3A6A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tekan "Acak Map" untuk menampilkan peta', canvas.width/2, canvas.height/2);
  }
  
  _drawTrafficLights({ decorations }) {
    if (!decorations.trafficLights) return;
    const { ctx } = this;

    for (const light of decorations.trafficLights) {
      ctx.save();
      ctx.translate(light.x, light.y);
      ctx.rotate(light.angle);

      // Base kecil di trotoar, lalu lengan lampu mengarah ke persimpangan.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(-3, 3, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#202020';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(-3, -7);
      ctx.lineTo(5, -7);
      ctx.stroke();

      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.roundRect(-6, 2, 6, 3, 1.2);
      ctx.fill();

      ctx.fillStyle = '#1b1b1b';
      ctx.strokeStyle = '#050505';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(4, -15, 7, 17, 2);
      ctx.fill();
      ctx.stroke();

      const colors = ['#e23b3b', '#f0ca38', '#42d46b'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === light.active ? colors[i] : '#353535';
        ctx.shadowColor = i === light.active ? colors[i] : 'transparent';
        ctx.shadowBlur = i === light.active ? 4 : 0;
        ctx.beginPath();
        ctx.arc(7.5, -12 + i * 5.2, 1.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }
    // Jalan digambar berlapis: border, trotoar, aspal, marka, lalu highlight path.
    _drawEdges({ graph, theme, pathReveal = null }) {
        const { ctx } = this;
        const capR = theme.roadWidth / 2 + theme.sidewalkW + 1;

        // Border jalan digambar lebih besar agar aspal punya outline.
        for (const edge of graph.edges) {
            const cp = edge.getCurveControlPoint();
            ctx.beginPath();
            ctx.moveTo(edge.nodeA.x, edge.nodeA.y);
            ctx.quadraticCurveTo(cp.x, cp.y, edge.nodeB.x, edge.nodeB.y);
            ctx.strokeStyle = theme.roadBorder;
            ctx.lineWidth   = theme.roadWidth + theme.sidewalkW * 2 + 2;
            ctx.lineCap     = 'round';
            ctx.stroke();
        }

        // Lingkaran di node menutup sambungan antar-ruas agar tidak terlihat putus.
        for (const node of graph.nodes) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, capR, 0, Math.PI * 2);
            ctx.fillStyle = theme.roadBorder;
            ctx.fill();
        }

        // Trotoar berada di bawah aspal dan di atas border.
        if (theme.sidewalkColor) {
            for (const edge of graph.edges) {
                const cp = edge.getCurveControlPoint();
                ctx.beginPath();
                ctx.moveTo(edge.nodeA.x, edge.nodeA.y);
                ctx.quadraticCurveTo(cp.x, cp.y, edge.nodeB.x, edge.nodeB.y);
                ctx.strokeStyle = theme.sidewalkColor;
                ctx.lineWidth   = theme.roadWidth + theme.sidewalkW * 2;
                ctx.stroke();
            }
        }

        // Sambungan trotoar juga ditutup di node.
        for (const node of graph.nodes) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, capR - 1, 0, Math.PI * 2);
            ctx.fillStyle = theme.sidewalkColor || theme.roadBorder;
            ctx.fill();
        }

        // Aspal memakai warna state Dijkstra jika edge sedang diproses.
        for (const edge of graph.edges) {
            const cp = edge.getCurveControlPoint();
            ctx.beginPath();
            ctx.moveTo(edge.nodeA.x, edge.nodeA.y);
            ctx.quadraticCurveTo(cp.x, cp.y, edge.nodeB.x, edge.nodeB.y);

            if (edge.state === 'considering') {
                ctx.strokeStyle = theme.edgeColors.considering;
            } else if (edge.state === 'path') {
                ctx.strokeStyle = theme.edgeColors.path;
            } else {
                ctx.strokeStyle = theme.roadColor;
            }
            ctx.lineWidth = theme.roadWidth;
            ctx.stroke();
        }

        // Sambungan aspal dibuat bulat di setiap persimpangan.
        for (const node of graph.nodes) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, theme.roadWidth / 2, 0, Math.PI * 2);
            ctx.fillStyle = theme.roadColor;
            ctx.fill();
        }

        // Marka tengah membuat jalan lebih terbaca seperti jalan kota sungguhan.
        for (const edge of graph.edges) {
            if (edge.state === 'path') continue;
            const cp = edge.getCurveControlPoint();
            ctx.beginPath();
            ctx.moveTo(edge.nodeA.x, edge.nodeA.y);
            ctx.quadraticCurveTo(cp.x, cp.y, edge.nodeB.x, edge.nodeB.y);
            ctx.strokeStyle = edge.roadKind === 'parkLoop'
                ? 'rgba(255,245,180,0.44)'
                : 'rgba(255,255,255,0.30)';
            ctx.lineWidth   = edge.roadKind === 'uTurnBulb' ? 1.2 : 1.6;
            ctx.setLineDash(edge.roadKind === 'uTurnBulb' ? [5, 8] : [10, 12]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Path final digambar di atas aspal.
        for (const edge of graph.edges) {
            if (edge.state !== 'path') continue;
            const cp = edge.getCurveControlPoint();
            ctx.beginPath();
            ctx.moveTo(edge.nodeA.x, edge.nodeA.y);
            ctx.quadraticCurveTo(cp.x, cp.y, edge.nodeB.x, edge.nodeB.y);
            ctx.strokeStyle = 'rgba(255,240,80,0.50)';
            ctx.lineWidth   = theme.roadWidth * 0.7;
            ctx.setLineDash([10, 8]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (pathReveal?.active) {
            this._drawPathReveal(pathReveal, theme);
        }
    }

    _drawPathReveal(pathReveal, theme) {
        const { ctx } = this;
        const segments = pathReveal.segments ?? [];
        if (segments.length === 0) return;

        const totalProgress = Math.max(0, Math.min(1, pathReveal.progress ?? 0)) * segments.length;

        for (let i = 0; i < segments.length; i++) {
            const localProgress = Math.max(0, Math.min(1, totalProgress - i));
            if (localProgress <= 0) continue;

            const { edge, fromNode } = segments[i];
            const points = [];
            const steps = Math.max(3, Math.ceil(16 * localProgress));
            for (let s = 0; s <= steps; s++) {
                const t = (s / steps) * localProgress;
                points.push(edge.getPointAtT(t, fromNode));
            }

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let p = 1; p < points.length; p++) ctx.lineTo(points[p].x, points[p].y);
            ctx.strokeStyle = theme.edgeColors.path;
            ctx.lineWidth = theme.roadWidth * 0.74;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let p = 1; p < points.length; p++) ctx.lineTo(points[p].x, points[p].y);
            ctx.strokeStyle = 'rgba(255,240,80,0.72)';
            ctx.lineWidth = theme.roadWidth * 0.42;
            ctx.setLineDash([10, 8]);
            ctx.lineDashOffset = -pathReveal.progress * 80;
            ctx.stroke();

            const head = points[points.length - 1];
            ctx.fillStyle = 'rgba(255,245,120,0.95)';
            ctx.shadowColor = 'rgba(255,245,120,0.75)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(head.x, head.y, Math.max(3, theme.roadWidth * 0.25), 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
