import { CONFIG } from '../config.js';

export class Animation {

  constructor() {
    this.pathEdges  = [];    // Edge[] — urutan edge jalur terpendek
    this.pathNodes  = [];    // Node[] — urutan node jalur terpendek

    this.isRunning   = false;
    this.isDone      = false;
    this.isPaused    = false;
    this.edgeIndex   = 0;    // sedang di edge ke-berapa
    this.t           = 0;    // posisi di kurva bezier saat ini (0..1)

    this.x     = 0;
    this.y     = 0;
    this.angle = 0;    // sudut hadap (radian)

    // Array posisi sebelumnya untuk digambar sebagai garis tipis
    this.trail = [];
    this.maxTrail = 20;  // kurangi trail untuk terlihat lebih rapi

    this.onComplete = null;

    this.wheelPhase = 0;
    this.prevX = 0;
    this.prevY = 0;
  }

  /**
   * Menyiapkan animasi mobil dari path hasil Dijkstra.
   * @param {{ nodes: Node[], edges: Edge[] }} path - Hasil rekonstruksiPath
   * @param {Function} [onComplete] - Callback saat animasi selesai
   */
  mulai(path, onComplete = null) {
    if (!path.found || path.edges.length === 0) return;

    this.pathEdges   = path.edges;
    this.pathNodes   = path.nodes;
    this.edgeIndex   = 0;
    this.t           = 0;
    this.isRunning   = true;
    this.isDone      = false;
    this.isPaused    = false;
    this.trail       = [];
    this.onComplete  = onComplete;

    // Mobil selalu mulai dari node pertama pada path.
    const startNode  = path.nodes[0];
    this.x           = startNode.x;
    this.y           = startNode.y;
    this.prevX       = this.x;
    this.prevY       = this.y;
    this.angle       = path.edges[0].getPointAtT(0.02, startNode).angle;
  }

  /**
   * Menghentikan animasi dan mengosongkan data path/trail.
   */
  reset() {
    this.isRunning  = false;
    this.isDone     = false;
    this.isPaused   = false;
    this.edgeIndex  = 0;
    this.t          = 0;
    this.trail      = [];
    this.pathEdges  = [];
    this.pathNodes  = [];
  }

  /**
   * Memindahkan mobil satu frame. Kecepatan px/frame dikonversi
   * menjadi delta-t agar gerakan stabil pada edge pendek maupun panjang.
   */
  update() {
    if (!this.isRunning || this.isDone || this.isPaused) return;
    if (this.edgeIndex >= this.pathEdges.length) {
      this._selesai();
      return;
    }

    const edge      = this.pathEdges[this.edgeIndex];
    const fromNode  = this.pathNodes[this.edgeIndex];  // node asal di edge ini
    const edgeLen   = edge.getLength();                // panjang aproksimasi bezier
    const lookAhead = CONFIG.animation.turnLookAhead ?? 0.045;
    const turnSlowdown = CONFIG.animation.turnSlowdown ?? 0.25;

    const nowPt = edge.getPointAtT(this.t, fromNode);
    const futurePt = edge.getPointAtT(Math.min(this.t + lookAhead * 2, 1), fromNode);
    const curveDelta = Math.abs(this._angleDelta(nowPt.angle, futurePt.angle));
    const turnFactor = 1 - Math.min(curveDelta / (Math.PI / 2), 1) * turnSlowdown;
    const dt = (CONFIG.animation.speed * turnFactor) / Math.max(edgeLen, 1);

    this.t          = Math.min(this.t + dt, 1);

    const pt        = edge.getPointAtT(this.t, fromNode);
    const lookPt    = edge.getPointAtT(Math.min(this.t + lookAhead, 1), fromNode);
    const lookDx = lookPt.x - pt.x;
    const lookDy = lookPt.y - pt.y;
    const targetAngle = Math.sqrt(lookDx * lookDx + lookDy * lookDy) > 0.001
      ? Math.atan2(lookDy, lookDx)
      : pt.angle;
    const moveDist  = Math.sqrt((pt.x - this.x) ** 2 + (pt.y - this.y) ** 2);
    this.prevX      = this.x;
    this.prevY      = this.y;
    this.x          = pt.x;
    this.y          = pt.y;
    this.angle      = this._lerpAngle(
      this.angle,
      Number.isFinite(targetAngle) ? targetAngle : pt.angle,
      CONFIG.animation.turnSmoothness ?? 0.2
    );

    const wheelRadius = Math.max((CONFIG.animation.vehicleWheelRadius ?? 4), 1);
    this.wheelPhase = (this.wheelPhase + moveDist / wheelRadius) % (Math.PI * 2);

    // Trail tidak direkam setiap frame supaya jejak tidak terlalu padat.
    if (Math.random() > 0.3) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();
    }

    if (this.t >= 1) {
      this.edgeIndex++;
      this.t = 0;

      if (this.edgeIndex >= this.pathEdges.length) {
        this._selesai();
      }
    }
  }

  _selesai() {
    this.isRunning = false;
    this.isDone    = true;
    this.isPaused  = false;
    if (typeof this.onComplete === 'function') {
      this.onComplete();
    }
  }

  _angleDelta(from, to) {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  _lerpAngle(from, to, amount) {
    return from + this._angleDelta(from, to) * Math.min(1, Math.max(0, amount));
  }

  pause() {
    if (!this.isRunning || this.isDone) return;
    this.isPaused = true;
  }

  resume() {
    if (!this.isRunning || this.isDone) return;
    this.isPaused = false;
  }

  stop() {
    this.isRunning = false;
    this.isDone = false;
    this.isPaused = false;
    this.trail = [];
  }

  /**
   * draw — Menggambar kendaraan dan trailnya di canvas.
   * Kendaraan ditampilkan sebagai mobil tampak atas yang mengikuti arah jalan.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} theme - Tema aktif
   */
  draw(ctx, theme, zoom = 1, panX = 0, panY = 0) {
    if (!this.isRunning && !this.isDone) return;
    if (this.pathEdges.length === 0) return;

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);
    this._drawTrail(ctx, theme);
    this._drawVehicle(ctx, theme);
    ctx.restore();
  }

  _drawTrail(ctx, theme) {
    if (this.trail.length < 2) return;

    const vehicleScale = CONFIG.animation.vehicleScale ?? 1;
    for (let i = 1; i < this.trail.length; i++) {
      const alpha = (i / this.trail.length) * 0.45; // makin transparan di belakang
      const width = (i / this.trail.length) * (theme.vehicleSize * vehicleScale * 0.6);

      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.strokeStyle = `rgba(255,200,50,${alpha})`;
      ctx.lineWidth   = width;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
  }

  /**
   * Menggambar mobil tampak atas. Seluruh bodi diputar mengikuti tangent jalan
   * agar arah kendaraan selalu sinkron dengan arah perjalanan.
   */
  _drawVehicle(ctx, theme) {
    const s = theme.vehicleSize * (CONFIG.animation.vehicleScale ?? 1);
    const c = theme.vehicleColor;
    const bodyL = s * 2.35;
    const bodyW = s * 1.18;
    const cabinL = s * 0.86;
    const cabinW = s * 0.76;
    const wheelL = s * 0.46;
    const wheelW = s * 0.18;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Bayangan membantu mobil terbaca di atas jalan.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, bodyW * 0.20, bodyL * 0.48, bodyW * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bodi tampak atas, hidung mobil mengarah ke sumbu X positif.
    ctx.fillStyle = c;
    ctx.strokeStyle = this._darkenColor(c, 38);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(-bodyL / 2, -bodyW / 2, bodyL, bodyW, s * 0.22);
    ctx.fill();
    ctx.stroke();

    // Kap depan supaya arah kendaraan terbaca.
    ctx.fillStyle = this._lightenColor(c, 16);
    ctx.beginPath();
    ctx.roundRect(bodyL * 0.12, -bodyW * 0.38, bodyL * 0.28, bodyW * 0.76, s * 0.12);
    ctx.fill();

    // Kabin tampak atas.
    ctx.fillStyle = 'rgba(175,225,255,0.90)';
    ctx.strokeStyle = this._darkenColor(c, 35);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(-cabinL * 0.45, -cabinW / 2, cabinL, cabinW, s * 0.10);
    ctx.fill();
    ctx.stroke();

    // Garis tengah kaca dan detail bodi.
    ctx.strokeStyle = 'rgba(0,0,0,0.24)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-cabinL * 0.05, -cabinW / 2);
    ctx.lineTo(-cabinL * 0.05, cabinW / 2);
    ctx.moveTo(-bodyL * 0.28, -bodyW * 0.44);
    ctx.lineTo(-bodyL * 0.28, bodyW * 0.44);
    ctx.stroke();

    // Lampu depan dan belakang.
    ctx.fillStyle = '#fff4a8';
    ctx.beginPath();
    ctx.roundRect(bodyL * 0.42, -bodyW * 0.30, s * 0.12, s * 0.22, s * 0.04);
    ctx.roundRect(bodyL * 0.42, bodyW * 0.08, s * 0.12, s * 0.22, s * 0.04);
    ctx.fill();

    ctx.fillStyle = '#d93434';
    ctx.beginPath();
    ctx.roundRect(-bodyL * 0.52, -bodyW * 0.30, s * 0.10, s * 0.22, s * 0.04);
    ctx.roundRect(-bodyL * 0.52, bodyW * 0.08, s * 0.10, s * 0.22, s * 0.04);
    ctx.fill();

    // Empat roda dari tampak atas.
    ctx.fillStyle = '#121212';
    for (const wx of [-bodyL * 0.30, bodyL * 0.30]) {
      for (const wy of [-bodyW * 0.56, bodyW * 0.56]) {
        ctx.beginPath();
        ctx.roundRect(wx - wheelL / 2, wy - wheelW / 2, wheelL, wheelW, wheelW * 0.5);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawWheel(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.wheelPhase);

    ctx.fillStyle = '#121212';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, 0);
    ctx.lineTo(r * 0.55, 0);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(0, r * 0.55);
    ctx.stroke();

    ctx.fillStyle = '#707070';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _darkenColor(hex, amount = 30) {
    try {
      const num = parseInt(hex.replace('#',''), 16);
      const r   = Math.max(0, (num >> 16) - amount);
      const g   = Math.max(0, ((num >> 8) & 0xFF) - amount);
      const b   = Math.max(0, (num & 0xFF) - amount);
      return `rgb(${r},${g},${b})`;
    } catch { return '#333'; }
  }

  _lightenColor(hex, amount = 20) {
    try {
      const num = parseInt(hex.replace('#',''), 16);
      const r   = Math.min(255, (num >> 16) + amount);
      const g   = Math.min(255, ((num >> 8) & 0xFF) + amount);
      const b   = Math.min(255, (num & 0xFF) + amount);
      return `rgb(${r},${g},${b})`;
    } catch { return '#ddd'; }
  }
}
