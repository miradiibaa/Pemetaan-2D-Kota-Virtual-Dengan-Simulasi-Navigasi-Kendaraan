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
