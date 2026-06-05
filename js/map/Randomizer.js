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


 _hapusEdgeSilang(graph) {
    const edgesToKeep = [];

    for (const edge of graph.edges) {
      let problematic = false;

      for (const other of graph.edges) {
        if (other === edge) continue;
        // Edge yang bertemu di persimpangan memang boleh bersentuhan.
        if (other.nodeA.id === edge.nodeA.id ||
            other.nodeB.id === edge.nodeA.id ||
            other.nodeA.id === edge.nodeB.id ||
            other.nodeB.id === edge.nodeB.id) continue;

        if (this._segmentsIntersectStrict(
          edge.nodeA.x, edge.nodeA.y, edge.nodeB.x, edge.nodeB.y,
          other.nodeA.x, other.nodeA.y, other.nodeB.x, other.nodeB.y
        )) {
          problematic = true;
          break;
        }
      }

      if (!problematic) edgesToKeep.push(edge);
    }

    graph.edges = edgesToKeep;

    // Setelah edges diganti, adjacency list harus dibangun ulang.
    graph._adjacency = new Map();
    for (const node of graph.nodes) {
      graph._adjacency.set(node.id, []);
    }
    for (const edge of graph.edges) {
      graph._adjacency.get(edge.nodeA.id).push(edge);
      graph._adjacency.get(edge.nodeB.id).push(edge);
    }
  }

  _segmentsIntersectStrict(ax, ay, bx, by, cx, cy, dx, dy) {
    const eps = 0.30;

    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx - cx, d2y = dy - cy;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false;

    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;

    return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
  }

  /**
   * Menambah edge ke tetangga terdekat tanpa membuat jalan bersilangan.
   * Dipakai setelah edge lama dihapus atau layout node berubah.
   */
  _tambahEdgeBersih(graph, maxConnectDist, maxNeighbors) {
    const { minNeighbors } = CONFIG.map;
    const nodes = graph.nodes;
    let edgeId  = graph.edges.length > 0
      ? Math.max(...graph.edges.map(e => e.id)) + 1
      : 0;

    const edgeSudahAda = new Set(
      graph.edges.map(e => [e.nodeA.id, e.nodeB.id].sort((a,b)=>a-b).join('-'))
    );

    // Isi koneksi sampai mendekati maxNeighbors.
    for (const node of nodes) {
      let jumlah = graph.getNeighbors(node.id).length;
      if (jumlah >= maxNeighbors) continue;

      const kandidat = nodes
        .filter(n => n.id !== node.id)
        .map(n => ({ node: n, jarak: node.distanceTo(n) }))
        .filter(c => c.jarak <= maxConnectDist)
        .sort((a, b) => a.jarak - b.jarak);

      for (const { node: tetangga } of kandidat) {
        if (jumlah >= maxNeighbors) break;

        const key = [node.id, tetangga.id].sort((a,b)=>a-b).join('-');
        if (edgeSudahAda.has(key)) continue;

        if (this._edgeCrossesExisting(node, tetangga, graph)) continue;

        edgeSudahAda.add(key);
        const edge = new Edge(edgeId++, node, tetangga);
        graph.tambahEdge(edge);
        jumlah++;
      }
    }

    // Pastikan node tidak kekurangan koneksi minimum.
    const nodeDegree = () => {
      const deg = new Map();
      for (const n of nodes) deg.set(n.id, 0);
      for (const e of graph.edges) {
        deg.set(e.nodeA.id, deg.get(e.nodeA.id) + 1);
        deg.set(e.nodeB.id, deg.get(e.nodeB.id) + 1);
      }
      return deg;
    };

    let deg = nodeDegree();
    const targetMin = minNeighbors || 2;
    const needMore = nodes.filter(n => deg.get(n.id) < targetMin);

    for (const node of needMore) {
      const kandidat = nodes
        .filter(n => n.id !== node.id)
        .map(n => ({ node: n, d: node.distanceTo(n) }))
        .sort((a, b) => a.d - b.d);

      for (const { node: tetangga } of kandidat) {
        const key = [node.id, tetangga.id].sort((a,b)=>a-b).join('-');
        if (edgeSudahAda.has(key)) continue;
        if (this._edgeCrossesExisting(node, tetangga, graph)) continue;

        edgeSudahAda.add(key);
        const edge = new Edge(edgeId++, node, tetangga);
        graph.tambahEdge(edge);
        break;
      }
    }
  }


 _fixConnectivity(graph) {
    const { minNeighbors } = CONFIG.map;
    const nodes = graph.nodes;
    let edgeId  = graph.edges.length > 0
      ? Math.max(...graph.edges.map(e => e.id)) + 1
      : 0;

    const edgeSudahAda = new Set(
      graph.edges.map(e => [e.nodeA.id, e.nodeB.id].sort((a,b)=>a-b).join('-'))
    );

    let iterasi = 0;
    while (!graph.isConnected() && iterasi < 30) {
      iterasi++;
      const terisolasi = graph.findDisconnectedNodes();

      const komponen = new Set();
      const antrian  = [nodes[0]];
      komponen.add(nodes[0].id);
      while (antrian.length > 0) {
        const cur = antrian.shift();
        for (const { node } of graph.getNeighborNodes(cur)) {
          if (!komponen.has(node.id)) {
            komponen.add(node.id);
            antrian.push(node);
          }
        }
      }

      for (const iso of terisolasi) {
        let terdekat = null, minD = Infinity;
        for (const n of nodes) {
          if (!komponen.has(n.id)) continue;
          const d = iso.distanceTo(n);
          if (d < minD) { minD = d; terdekat = n; }
        }
        if (!terdekat) continue;

        const key = [iso.id, terdekat.id].sort((a,b)=>a-b).join('-');
        if (edgeSudahAda.has(key)) continue;

        if (this._edgeCrossesExisting(iso, terdekat, graph)) continue;

        edgeSudahAda.add(key);
        const edge = new Edge(edgeId++, iso, terdekat);
        graph.tambahEdge(edge);
        komponen.add(iso.id);
      }
    }

    // Tambah koneksi untuk node yang masih berada di bawah degree minimum.
    const nodeDegree = () => {
      const deg = new Map();
      for (const n of nodes) deg.set(n.id, 0);
      for (const e of graph.edges) {
        deg.set(e.nodeA.id, deg.get(e.nodeA.id) + 1);
        deg.set(e.nodeB.id, deg.get(e.nodeB.id) + 1);
      }
      return deg;
    };

    let deg = nodeDegree();
    const targetMin = minNeighbors || 2;
    let lowDegree = nodes.filter(n => deg.get(n.id) < targetMin);

    for (const node of lowDegree) {
      const kandidat = nodes
        .filter(n => n.id !== node.id)
        .map(n => ({ node: n, d: node.distanceTo(n) }))
        .sort((a, b) => a.d - b.d);

      for (const { node: tetangga } of kandidat) {
        const key = [node.id, tetangga.id].sort((a,b)=>a-b).join('-');
        if (edgeSudahAda.has(key)) continue;
        if (this._edgeCrossesExisting(node, tetangga, graph)) continue;

        edgeSudahAda.add(key);
        const edge = new Edge(edgeId++, node, tetangga);
        graph.tambahEdge(edge);
        break;
      }
    }
  }

  // Validasi koneksi start/end memakai BFS.

  validasiKoneksi(graph, startNode, endNode) {
    if (startNode.id === endNode.id) return true;

    const visited = new Set();
    const antrian = [startNode];
    visited.add(startNode.id);

    while (antrian.length > 0) {
      const current = antrian.shift();
      if (current.id === endNode.id) return true;

      for (const { node } of graph.getNeighborNodes(current)) {
        if (!visited.has(node.id)) {
          visited.add(node.id);
          antrian.push(node);
        }
      }
    }

    return false;
  }
}