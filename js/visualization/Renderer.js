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
    _drawOuterBackground({ theme, oval }) {
    const { ctx, canvas } = this;
    const grad = ctx.createRadialGradient(oval.cx, oval.cy, oval.rx*0.9, oval.cx, oval.cy, Math.max(canvas.width, canvas.height));
    grad.addColorStop(0,   theme.bgOuter);
    grad.addColorStop(0.4, this._darken(theme.bgOuter, 20));
    grad.addColorStop(1,   this._darken(theme.bgOuter, 40));
    ctx.fillStyle = grad;
    ctx.fillRect(-this.panX/this.zoom, -this.panY/this.zoom, canvas.width/this.zoom, canvas.height/this.zoom);

    // riak air
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.ellipse(oval.cx, oval.cy, oval.rx + i*18, oval.ry + i*18, 0, 0, Math.PI*2);
        ctx.stroke();
    }
  }

  _clipToOval({ oval }, drawFn) {
        const { ctx } = this;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI*2);
        ctx.clip();
        drawFn();
        ctx.restore();
    }

    _drawInnerBackground({ theme, oval }) {
        const { ctx } = this;
        const grad = ctx.createRadialGradient(
        oval.cx - oval.rx*0.15, oval.cy - oval.ry*0.15, 0,
        oval.cx, oval.cy, Math.max(oval.rx, oval.ry)
        );
        grad.addColorStop(0,   this._lighten(theme.bgInner, 15));
        grad.addColorStop(0.6, theme.bgInner);
        grad.addColorStop(1,   this._darken(theme.bgInner, 15));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI*2);
        ctx.fill();
    }

    _drawOvalBorder({ theme, oval }) {
        const { ctx } = this;
        ctx.shadowBlur  = 18;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.strokeStyle = this._darken(theme.bgOuter, 10);
        ctx.lineWidth   = 8;
        ctx.beginPath();
        ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = theme.ovalBorder;
        ctx.lineWidth   = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(oval.cx, oval.cy, oval.rx-2, oval.ry-2, 0, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // KOLAM / DANAU KOTA
    _drawPonds({ theme, decorations }) {
        if (!theme.pond?.enabled || !decorations.ponds) return;
        const { ctx } = this;
        const pond = theme.pond;

        for (const p of decorations.ponds) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        ctx.fillStyle = 'rgba(218,206,176,0.70)';
        ctx.strokeStyle = 'rgba(130,120,92,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx + 11, p.ry + 9, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        // Bayangan memberi pemisah visual antara kolam dan tanah.
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(3, 3, p.rx, p.ry, 0, 0, Math.PI*2);
        ctx.fill();

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(p.rx, p.ry));
        grad.addColorStop(0,   this._lighten(pond.fill, 20));
        grad.addColorStop(0.6, pond.fill);
        grad.addColorStop(1,   this._darken(pond.fill, 15));
        ctx.fillStyle   = grad;
        ctx.strokeStyle = pond.stroke;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pond.shimmer;
        ctx.beginPath();
        ctx.ellipse(-p.rx*0.25, -p.ry*0.25, p.rx*0.35, p.ry*0.2, -0.5, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth   = 1;
        for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, p.rx * (0.5 + i*0.2), p.ry * (0.5 + i*0.2), 0, 0, Math.PI*2);
            ctx.stroke();
        }

        this._drawPondAccessories(p);
        ctx.restore();
        }
    }

    _drawPondAccessories(pond) {
        const { ctx } = this;
        for (const item of pond.accessories ?? []) {
        ctx.save();
        ctx.translate(item.x, item.y);

        if (item.type === 'bench') {
        ctx.rotate(item.angle + Math.PI / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(1.5, 3, item.w * 0.55, item.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8a5a36';
        ctx.strokeStyle = '#5f3d27';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-item.w / 2, -item.h / 2, item.w, item.h, 1.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#5f3d27';
        ctx.fillRect(-item.w * 0.42, -item.h * 0.75, item.w * 0.10, item.h * 0.55);
        ctx.fillRect(item.w * 0.32, -item.h * 0.75, item.w * 0.10, item.h * 0.55);
        } else {
        const s = item.size;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(1.5, 2, s * 0.80, s * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#315f35';
        ctx.strokeStyle = '#214525';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(-s * 0.25, 0, s * 0.48, s * 0.38, -0.2, 0, Math.PI * 2);
        ctx.ellipse(s * 0.25, 0, s * 0.50, s * 0.40, 0.25, 0, Math.PI * 2);
        ctx.ellipse(0, -s * 0.28, s * 0.42, s * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#5f8a48';
        ctx.beginPath();
        ctx.ellipse(-s * 0.10, -s * 0.20, s * 0.25, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        }

        ctx.restore();
        }
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
    // Label bobot edge
    _drawEdgeWeights({ graph, theme }) {
        const { ctx } = this;
        for (const edge of graph.edges) {
        const mid = edge.getMidPoint();
        const lbl = edge.weight.toString();
        const pad = 3;
        ctx.font = 'bold 11px sans-serif';
        const tw  = ctx.measureText(lbl).width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(mid.x - tw/2 - pad, mid.y - 9, tw + pad*2, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, mid.x, mid.y);
        }
        ctx.textBaseline = 'alphabetic';
    }

    // Node persimpangan
    _drawNodes({ graph, theme, startNode, endNode }) {
        const { ctx } = this;

        for (const node of graph.nodes) {
        const stateColor = theme.stateColors[node.state] ?? theme.stateColors.unvisited;
        const r          = theme.nodeRadius;

        if (node.state !== 'unvisited') {
            ctx.shadowBlur  = node.state === 'start' || node.state === 'end' ? 28 : 14;
            ctx.shadowColor = stateColor;
        }

        // Bayangan memisahkan node dari jalan.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(node.x+2, node.y+3, r, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + theme.nodeStrokeW + 1, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = theme.nodeStroke;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + theme.nodeStrokeW, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = stateColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.40)';
        ctx.beginPath();
        ctx.arc(node.x - r*0.3, node.y - r*0.3, r*0.42, 0, Math.PI*2);
        ctx.fill();

        ctx.shadowBlur = 0;

        if (startNode && node.id === startNode.id) {
            this._drawStartIcon(node.x, node.y, r);
        } else if (endNode && node.id === endNode.id) {
            this._drawEndIcon(node.x, node.y, r);
        }
        }
    }

    _drawStartIcon(x, y, r) {
        const { ctx } = this;
        const sz = r * 2.2;

        ctx.fillStyle   = 'rgba(0, 200, 60, 0.88)';
        ctx.strokeStyle = '#006020';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - 20, y - r - 26, 40, 20, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle    = '#FFFFFF';
        ctx.font         = `bold 10px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('START', x, y - r - 16);

        // Ikon start dibuat besar supaya titik awal cepat terlihat.
        ctx.font = `${sz}px sans-serif`;
        ctx.fillText('🚩', x, y - r - 26 - sz*0.5);
        ctx.textBaseline = 'alphabetic';
    }

    _drawEndIcon(x, y, r) {
        const { ctx } = this;
        const sz = r * 2.2;

        ctx.fillStyle   = 'rgba(220, 30, 80, 0.88)';
        ctx.strokeStyle = '#880030';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - 16, y - r - 26, 32, 20, 5);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle    = '#FFFFFF';
        ctx.font         = 'bold 10px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('END', x, y - r - 16);

        ctx.font = `${sz}px sans-serif`;
        ctx.fillText('🏁', x, y - r - 26 - sz*0.5);
        ctx.textBaseline = 'alphabetic';
    }

    
    // Label node
    _drawNodeLabels({ graph, theme }) {
        const { ctx } = this;
        const r = theme.nodeRadius;
        ctx.font         = `bold ${r + 2}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        for (const node of graph.nodes) {
        const lbl = node.label;
        const tw  = ctx.measureText(lbl).width;

        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath();
        ctx.roundRect(node.x - tw/2 - 3, node.y - r*0.6, tw + 6, r*1.2, 3);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(lbl, node.x, node.y);
        }
        ctx.textBaseline = 'alphabetic';
    }

    // WARNA UTILS
    _darken(hex, amount = 20) {
        try {
        const num = parseInt(hex.replace('#',''), 16);
        const r   = Math.max(0, (num >> 16) - amount);
        const g   = Math.max(0, ((num >> 8) & 0xFF) - amount);
        const b   = Math.max(0, (num & 0xFF) - amount);
        return `rgb(${r},${g},${b})`;
        } catch { return '#333'; }
    }
    _lighten(hex, amount = 20) {
        try {
        const num = parseInt(hex.replace('#',''), 16);
        const r   = Math.min(255, (num >> 16) + amount);
        const g   = Math.min(255, ((num >> 8) & 0xFF) + amount);
        const b   = Math.min(255, (num & 0xFF) + amount);
        return `rgb(${r},${g},${b})`;
        } catch { return '#ccc'; }
    }

    // Pohon taman kota, dibuat tidak berbentuk bulatan polos.
    _drawTrees({ decorations, theme }) {
        if (!decorations.trees) return;
        const { ctx } = this;
        for (const tree of decorations.trees) {
        const color = theme.treeColors[tree.colorIdx] ?? theme.treeColors[0];
        const r     = tree.radius;

        ctx.save();
        ctx.translate(tree.x, tree.y);

        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(r * 0.22, r * 0.78, r * 0.82, r * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#6c5136';
        ctx.fillRect(-r * 0.12, -r * 0.05, r * 0.24, r * 0.95);

        ctx.fillStyle = color;
        ctx.strokeStyle = this._darken(color, 22);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.22);
        ctx.lineTo(r * 0.64, -r * 0.58);
        ctx.lineTo(r * 0.48, -r * 0.12);
        ctx.lineTo(r * 0.82, r * 0.22);
        ctx.lineTo(r * 0.18, r * 0.36);
        ctx.lineTo(0, r * 0.82);
        ctx.lineTo(-r * 0.18, r * 0.36);
        ctx.lineTo(-r * 0.82, r * 0.22);
        ctx.lineTo(-r * 0.48, -r * 0.12);
        ctx.lineTo(-r * 0.64, -r * 0.58);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this._lighten(color, 18);
        ctx.beginPath();
        ctx.moveTo(-r * 0.30, -r * 0.78);
        ctx.lineTo(r * 0.08, -r * 1.02);
        ctx.lineTo(r * 0.35, -r * 0.58);
        ctx.lineTo(r * 0.10, -r * 0.36);
        ctx.lineTo(-r * 0.20, -r * 0.42);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        }
    }

    // Tanaman kecil
    _drawPlants({ decorations, theme }) {
        if (!decorations.plants) return;
        const { ctx } = this;

        for (const plant of decorations.plants) {
        const color = theme.plantColors?.[plant.colorIdx] ?? '#7fd25a';
        const r = plant.radius;

        ctx.save();
        ctx.translate(plant.x, plant.y);

        ctx.strokeStyle = this._darken(color, 25);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < plant.petals; i++) {
            const a = (i / plant.petals) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.stroke();
        }

        ctx.fillStyle = color;
        for (let i = 0; i < plant.petals; i++) {
            const a = (i / plant.petals) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.35, r * 0.18, a, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = this._lighten(color, 18);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        }
    }

    // Bangunan dengan variasi bentuk berdasarkan tipe.
    _drawBuildings({ decorations, theme }) {
        if (!decorations.buildings) return;
        const { ctx } = this;
        for (const b of decorations.buildings) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        const hw = b.w/2, hh = b.h/2;
        const type = b.type ?? b.style.type;
        const frontSide = b.frontSide ?? 1;
        const frontY = frontSide > 0 ? hh : -hh;
        const rearY = -frontY;
        const frontInset = (amount) => frontY - frontSide * amount;

        // Bayangan membuat bangunan terbaca di atas background kota.
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.roundRect(-hw+4, -hh+4, b.w, b.h, 2);
        ctx.fill();

        ctx.fillStyle   = b.style.fill;
        ctx.strokeStyle = b.style.stroke;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, b.w, b.h, 2);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = this._darken(b.style.fill, 20);
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, b.w, Math.min(5, b.h*0.25), 2);
        ctx.fill();

        if (type === 'residential' || type === 'house') {
            ctx.fillStyle = this._darken(b.style.stroke, 5);
            ctx.beginPath();
            ctx.moveTo(-hw - 2, rearY + frontSide * 2);
            ctx.lineTo(0, rearY + frontSide * Math.min(9, b.h * 0.38));
            ctx.lineTo(hw + 2, rearY + frontSide * 2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(220,190,150,0.55)';
            ctx.beginPath();
            ctx.roundRect(-hw + 3, Math.min(frontInset(b.h * 0.52), frontInset(b.h * 0.34)), b.w - 6, b.h * 0.18, 1);
            ctx.fill();
            ctx.fillStyle = 'rgba(80,55,40,0.35)';
            const units = 3;
            for (let i = 1; i < units; i++) {
            ctx.fillRect(-hw + (b.w / units) * i - 0.8, -hh + 5, 1.6, b.h - 8);
            }
            for (let i = 0; i < units; i++) {
            const ux = -hw + (b.w / units) * i;
            ctx.fillStyle = '#5c3d2e';
            ctx.beginPath();
            ctx.roundRect(ux + b.w / units * 0.38, frontInset(b.h * 0.24), b.w / units * 0.22, b.h * 0.24, 1);
            ctx.fill();
            ctx.fillStyle = 'rgba(170,215,235,0.82)';
            ctx.beginPath();
            ctx.roundRect(ux + b.w / units * 0.12, frontInset(b.h * 0.58), b.w / units * 0.18, b.h * 0.14, 1);
            ctx.fill();
            }
        } else if (type === 'shop') {
            ctx.fillStyle = '#d84f4f';
            ctx.beginPath();
            ctx.roundRect(-hw, frontInset(8), b.w, 4, 1);
            ctx.fill();
            ctx.fillStyle = '#f5d56a';
            for (let i = 0; i < 3; i++) {
            ctx.fillRect(-hw + i * b.w / 3, frontInset(8), b.w / 6, 4);
            }
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.roundRect(-hw + b.w * 0.10, frontInset(b.h * 0.24), b.w * 0.30, b.h * 0.24, 1);
            ctx.fill();
            ctx.fillStyle = 'rgba(245,245,220,0.92)';
            ctx.beginPath();
            ctx.roundRect(-hw + b.w * 0.48, frontInset(b.h * 0.18), b.w * 0.38, b.h * 0.18, 1);
            ctx.fill();
            ctx.strokeStyle = 'rgba(50,50,50,0.28)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-hw + b.w * 0.52, frontInset(b.h * 0.10));
            ctx.lineTo(hw - b.w * 0.12, frontInset(b.h * 0.10));
            ctx.stroke();
        } else if (type === 'supermarket' || type === 'mall' || type === 'market') {
            const label = type === 'mall' ? 'MALL' : (type === 'market' ? 'PASAR' : 'MART');
            ctx.fillStyle = '#2f4f6f';
            ctx.beginPath();
            ctx.roundRect(-hw + 3, -hh + 4, b.w - 6, b.h * 0.30, 2);
            ctx.fill();
            ctx.fillStyle = '#f8f1c0';
            ctx.font = `bold ${type === 'market' ? 7 : 8}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, -hh + b.h * 0.19);
            ctx.fillStyle = type === 'market' ? '#e65f45' : '#f0c75e';
            for (let i = 0; i < 5; i++) {
            ctx.fillRect(-hw + 4 + i * (b.w - 8) / 5, -hh + b.h * 0.30, (b.w - 8) / 10, 4);
            }
            ctx.fillStyle = 'rgba(70,110,130,0.85)';
            ctx.beginPath();
            ctx.roundRect(-hw + b.w * 0.12, hh - b.h * 0.34, b.w * 0.76, b.h * 0.22, 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 4; i++) {
            const x = -hw + b.w * (0.12 + i * 0.19);
            ctx.beginPath();
            ctx.moveTo(x, hh - b.h * 0.34);
            ctx.lineTo(x, hh - b.h * 0.12);
            ctx.stroke();
            }
            if (b.commercialBlock) {
            ctx.fillStyle = 'rgba(60,65,70,0.52)';
            ctx.beginPath();
            ctx.roundRect(-hw + b.w * 0.16, hh + 2, b.w * 0.68, 7, 1.5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 0.8;
            for (let i = 0; i < 4; i++) {
                const x = -hw + b.w * (0.22 + i * 0.14);
                ctx.beginPath();
                ctx.moveTo(x, hh + 3);
                ctx.lineTo(x + 5, hh + 8);
                ctx.stroke();
            }
            }
        } else if (type === 'office' || type === 'tower' || type === 'apt') {
            if (type === 'office') {
            ctx.fillStyle = 'rgba(35,55,75,0.55)';
            ctx.beginPath();
            ctx.roundRect(-hw + 3, -hh + 3, b.w - 6, b.h * 0.20, 2);
            ctx.fill();
            }
            if (type === 'apt') {
            ctx.fillStyle = '#57516b';
            ctx.beginPath();
            ctx.roundRect(-hw + b.w * 0.38, hh - b.h * 0.25, b.w * 0.24, b.h * 0.18, 1);
            ctx.fill();
            }
        }

        if (type === 'tower') {
            ctx.strokeStyle = this._lighten(b.style.fill, 35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.lineTo(0, -hh - 8);
            ctx.stroke();
        }

        if (b.w > 12 && b.h > 10) {
            ctx.fillStyle = type === 'tower'
            ? 'rgba(200,240,255,0.80)'
            : 'rgba(180,225,255,0.70)';
            const wSize = Math.min(4, b.w*0.22);
            const wGap  = b.w / 3;
            const rowGap = Math.max(7, b.h / 4);
            for (let wy = -hh + b.h * 0.34; wy < hh - wSize - 2; wy += rowGap) {
            for (let wx = -hw + wGap*0.5; wx < hw - wSize; wx += wGap) {
                if (type === 'supermarket' && wy > hh - b.h * 0.40) continue;
                if (type === 'residential' && wy > hh - b.h * 0.35) continue;
                ctx.beginPath();
                ctx.roundRect(wx, wy, wSize, wSize, 1);
                ctx.fill();
            }
            }
        }

        if (type === 'office') {
            ctx.fillStyle = 'rgba(240,250,255,0.72)';
            for (let wy = -hh + b.h * 0.30; wy < hh - 4; wy += 8) {
            for (let wx = -hw + 5; wx < hw - 4; wx += 8) {
                ctx.beginPath();
                ctx.roundRect(wx, wy, 3.2, 4.2, 1);
                ctx.fill();
            }
            }
        }

        if (type === 'tower') {
            ctx.fillStyle = 'rgba(235,250,255,0.62)';
            for (let wy = -hh + 7; wy < hh - 6; wy += 7) {
            ctx.fillRect(-hw + b.w * 0.22, wy, b.w * 0.18, 3);
            ctx.fillRect(hw - b.w * 0.40, wy, b.w * 0.18, 3);
            }
        }

        if (b.roadAligned) {
            const stripY = frontSide > 0 ? hh - 4 : -hh;

            ctx.fillStyle = 'rgba(235,226,205,0.62)';
            ctx.beginPath();
            ctx.roundRect(-hw + 3, stripY, b.w - 6, 4, 1);
            ctx.fill();

            ctx.fillStyle = 'rgba(45,50,55,0.62)';
            const doorW = Math.max(5, Math.min(10, b.w * 0.18));
            const doorH = Math.max(4, Math.min(9, b.h * 0.18));
            ctx.beginPath();
            ctx.roundRect(-doorW / 2, frontY - frontSide * doorH, doorW, doorH, 1);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.30)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-hw + 4, frontY - frontSide * 1.5);
            ctx.lineTo(hw - 4, frontY - frontSide * 1.5);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, b.w*0.45, b.h*0.35, 2);
        ctx.fill();

        ctx.restore();
        }
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

    // Hewan kecil sebagai dekorasi vektor.
    _drawAnimals({ decorations, theme }) {
        if (!decorations.animals) return;
        const { ctx } = this;

        for (const animal of decorations.animals) {
        const color = theme.animalColors?.[animal.colorIdx] ?? '#f2d19b';
        const r = animal.radius;

        ctx.save();
        ctx.translate(animal.x, animal.y);
        ctx.rotate(animal.angle);

        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(1, r * 0.45, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.strokeStyle = this._darken(color, 35);
        ctx.lineWidth = 1.1;

        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.85, r * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r * 0.68, -r * 0.10, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(r * 0.58, -r * 0.42);
        ctx.lineTo(r * 0.72, -r * 0.82);
        ctx.lineTo(r * 0.88, -r * 0.40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (animal.type === 'dog') {
            ctx.strokeStyle = this._darken(color, 30);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-r * 0.72, -r * 0.06);
            ctx.quadraticCurveTo(-r * 1.08, -r * 0.55, -r * 1.25, -r * 0.10);
            ctx.stroke();
        } else {
            ctx.strokeStyle = this._darken(color, 40);
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(-r * 0.72, 0);
            ctx.quadraticCurveTo(-r * 1.15, r * 0.28, -r * 1.25, -r * 0.24);
            ctx.stroke();
        }

        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(r * 0.82, -r * 0.18, r * 0.06, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        }
    }
  }