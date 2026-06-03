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
