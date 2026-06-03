import { Edge }   from '../graph/Edge.js';
import { CONFIG } from '../config.js';

export class Randomizer {

  // Memilih start/end acak yang masih bisa saling dijangkau.

  randomStart(graph) {
    const idx = Math.floor(Math.random() * graph.nodes.length);
    return graph.nodes[idx];
  }

  randomEnd(graph, startNode) {
    let endNode;
    do {
      const idx = Math.floor(Math.random() * graph.nodes.length);
      endNode   = graph.nodes[idx];
    } while (endNode.id === startNode.id);
    return endNode;
  }

  randomStartEnd(graph) {
    if (graph.nodes.length < 2) {
      return { start: graph.nodes[0], end: graph.nodes[0] };
    }

    const start = this.randomStart(graph);
    let   end   = this.randomEnd(graph, start);
    let   coba  = 0;

    while (!this.validasiKoneksi(graph, start, end) && coba < 10) {
      end  = this.randomEnd(graph, start);
      coba++;
    }

    return { start, end };
  }

  /**
   * Membuat ulang posisi node dan edge dengan pola blok kota.
   * Fungsi ini dipakai ketika layout jalan perlu diacak ulang.
   */
  acakLayout(graph, ovalCX, ovalCY, ovalRX, ovalRY) {
    const { curveIntensity, curveRandomness } = CONFIG.map;

    let rows = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      rows = this._placeNodesAsUrbanGrid(graph, ovalCX, ovalCY, ovalRX, ovalRY);
      if (this._minNodeDistance(graph.nodes) >= CONFIG.map.minConnectDist * 0.9) break;
    }

    this._rebuildRoadGrid(graph, rows);

    this._fixConnectivity(graph);

    for (const edge of graph.edges) {
      edge.weight = edge._hitungBobot();

      const sisi      = Math.random() < 0.5 ? 1 : -1;
      const intensity = curveIntensity + (Math.random() - 0.5) * curveRandomness * 2;

      const mx  = (edge.nodeA.x + edge.nodeB.x) / 2;
      const my  = (edge.nodeA.y + edge.nodeB.y) / 2;
      const dx  = edge.nodeB.x - edge.nodeA.x;
      const dy  = edge.nodeB.y - edge.nodeA.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      edge.controlPoint = {
        x: mx + (-dy / len) * len * intensity * sisi,
        y: my + ( dx / len) * len * intensity * sisi,
      };
    }
  }


_rebuildRoadGrid(graph, rows) {
    graph.edges = [];
    graph._adjacency = new Map();
    for (const node of graph.nodes) graph._adjacency.set(node.id, []);

    const edgeSudahAda = new Set();
    let edgeId = 0;

    const tambah = (a, b) => {
      const key = [a.id, b.id].sort((x, y) => x - y).join('-');
      if (edgeSudahAda.has(key)) return false;
      if (this._edgeCrossesExisting(a, b, graph)) return false;

      edgeSudahAda.add(key);
      graph.tambahEdge(new Edge(edgeId++, a, b));
      return true;
    };

    const sortedRows = rows
      .map(row => row.slice().sort((a, b) => a.x - b.x))
      .filter(row => row.length > 0);

    for (const row of sortedRows) {
      for (let i = 0; i < row.length - 1; i++) {
        tambah(row[i], row[i + 1]);
      }
    }

    for (let r = 0; r < sortedRows.length - 1; r++) {
      const atas = sortedRows[r];
      const bawah = sortedRows[r + 1];
      let bridgeCount = 0;
      for (let i = 0; i < atas.length; i++) {
        const baseTargetIndex = atas.length === 1
          ? Math.round((bawah.length - 1) / 2)
          : Math.round((i / (atas.length - 1)) * (bawah.length - 1));
        const offset = Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        const targetIndex = this._clamp(baseTargetIndex + offset, 0, bawah.length - 1);
        if (tambah(atas[i], bawah[targetIndex])) bridgeCount++;
      }

      if (bridgeCount === 0) {
        const a = atas[Math.floor(atas.length / 2)];
        const b = bawah[Math.floor(bawah.length / 2)];
        tambah(a, b);
      }

      const extraConnectors = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < extraConnectors; k++) {
        const a = atas[Math.floor(Math.random() * atas.length)];
        const nearest = bawah
          .map(b => ({ node: b, d: a.distanceTo(b) }))
          .sort((x, y) => x.d - y.d)
          .slice(0, 3);
        const pick = nearest[Math.floor(Math.random() * nearest.length)];
        if (pick) tambah(a, pick.node);
      }
    }
  }
}