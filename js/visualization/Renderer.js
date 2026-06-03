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
}
