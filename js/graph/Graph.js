export class Graph {

  // ── KONSTRUKTOR ────────────────────────────────────────────────────
  constructor() {
    this.nodes      = [];         // Array<Node> — semua persimpangan
    this.edges      = [];         // Array<Edge> — semua jalan
    this._adjacency = new Map();  // Map<nodeId, Edge[]> — daftar ketetanggaan
    //
    // Contoh isi _adjacency setelah beberapa tambahNode/tambahEdge:
    //   0 → [Edge(0-1), Edge(0-3)]
    //   1 → [Edge(0-1), Edge(1-2)]
    //   2 → [Edge(1-2)]
    //   3 → [Edge(0-3)]
  }

  // ─────────────────────────────────────────────────────────────────
  // PENAMBAHAN DATA
  // ─────────────────────────────────────────────────────────────────

  tambahNode(node) {
    this.nodes.push(node);
    this._adjacency.set(node.id, []); // slot kosong, belum ada tetangga
  }

  // ── TAMBAH EDGE ────────────────────────────────────────────────────

  tambahEdge(edge) {
    this.edges.push(edge);
    this._adjacency.get(edge.nodeA.id).push(edge); // daftar ke nodeA
    this._adjacency.get(edge.nodeB.id).push(edge); // daftar ke nodeB juga
  }

  getNeighbors(nodeId) {
    return this._adjacency.get(nodeId) ?? [];
  }

  // ── DAPATKAN PASANGAN {NODE, EDGE} TETANGGA ────────────────────────
 
  getNeighborNodes(node) {
    return this.getNeighbors(node.id).map(edge => ({
      node: edge.getOtherNode(node),
      edge,
    }));
  }

  // ── CARI NODE BERDASARKAN ID ────────────────────────────────────────
 
  getNodeById(id) {
    return this.nodes.find(n => n.id === id) ?? null;
  }

  // ── CARI EDGE ANTARA DUA NODE ───────────────────────────────────────
  
  getEdgeBetween(nodeA, nodeB) {
    return this.getNeighbors(nodeA.id)
      .find(e => e.getOtherNode(nodeA).id === nodeB.id) ?? null;
  }

  isConnected() {
    if (this.nodes.length === 0) return true;

    const visited = new Set();
    const queue   = [this.nodes[0]];
    visited.add(this.nodes[0].id);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const { node } of this.getNeighborNodes(current)) {
        if (!visited.has(node.id)) {
          visited.add(node.id);
          queue.push(node);
        }
      }
    }

    // Graf connected jika semua V node berhasil di-visit
    return visited.size === this.nodes.length;
  }

  // ── CARI NODE YANG TERISOLASI ───────────────────────────────────────

  findDisconnectedNodes() {
    if (this.nodes.length === 0) return [];

    const visited = new Set();
    const queue   = [this.nodes[0]];
    visited.add(this.nodes[0].id);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const { node } of this.getNeighborNodes(current)) {
        if (!visited.has(node.id)) {
          visited.add(node.id);
          queue.push(node);
        }
      }
    }

    // Node yang tidak ter-visit = terisolasi
    return this.nodes.filter(n => !visited.has(n.id));
  }

  reset() {
    this.nodes.forEach(n => n.reset()); // reset state & distance tiap node
    this.edges.forEach(e => e.reset()); // reset state tiap edge
  }

  // ── HAPUS SEMUA DATA ────────────────────────────────────────────────
  // Mengosongkan seluruh graf (dipanggil saat generate peta baru).
  clear() {
    this.nodes      = [];
    this.edges      = [];
    this._adjacency = new Map();
  }

  // ── INFO RINGKAS UNTUK PANEL UI ────────────────────────────────────
  
  getStats() {
    const avgDegree = this.nodes.length > 0
      ? (this.edges.length * 2 / this.nodes.length).toFixed(1)
      : 0;
    return {
      nodeCount: this.nodes.length,  // total persimpangan
      edgeCount: this.edges.length,  // total jalan
      avgDegree,                     // rata-rata tetangga per persimpangan
    };
  }
}