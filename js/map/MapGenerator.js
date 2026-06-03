_buildMST(nodes, edgeSudahAda, startEdgeId) {
    const allEdges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].distanceTo(nodes[j]);
        if (d <= CONFIG.map.maxConnectDist * 1.2) {
          allEdges.push({
            a: nodes[i], b: nodes[j], d, id: `${i}-${j}`
          });
        }
      }
    }

    allEdges.sort((x, y) => x.d - y.d);

    const parent = new Map();
    const rank = new Map();
    for (const n of nodes) {
      parent.set(n.id, n.id);
      rank.set(n.id, 0);
    }

    const find = (x) => {
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)));
      }
      return parent.get(x);
    };

    const union = (x, y) => {
      const px = find(x), py = find(y);
      if (px === py) return false;
      if (rank.get(px) < rank.get(py)) {
        parent.set(px, py);
      } else if (rank.get(px) > rank.get(py)) {
        parent.set(py, px);
      } else {
        parent.set(py, px);
        rank.set(px, rank.get(px) + 1);
      }
      return true;
    };

    let edgeId = startEdgeId;
    for (const edge of allEdges) {
      if (!union(edge.a.id, edge.b.id)) continue;
      if (this._edgeCrossesExisting(edge.a, edge.b)) continue;

      const key = [edge.a.id, edge.b.id].sort((a,b)=>a-b).join('-');
      if (edgeSudahAda.has(key)) continue;

      edgeSudahAda.add(key);
      const cleanEdge = new Edge(edgeId++, edge.a, edge.b);
      cleanEdge.roadKind = 'connector';
      this.graph.tambahEdge(cleanEdge);
    }
}