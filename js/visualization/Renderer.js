
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