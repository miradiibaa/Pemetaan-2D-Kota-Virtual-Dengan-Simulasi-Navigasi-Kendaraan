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
  // Versi lebih lengkap dari getNeighbors — mengembalikan node tetangga
  // sekaligus edge yang menghubungkannya.
  //
  // Contoh hasil untuk node A yang terhubung ke B dan C:
  //   [ { node: B, edge: Edge(A-B) }, { node: C, edge: Edge(A-C) } ]
  //
  // Dipakai langsung oleh dijkstraGenerator() untuk menelusuri tetangga.
  // Kompleksitas: O(degree(node)) — degree = jumlah tetangga node
  getNeighborNodes(node) {
    return this.getNeighbors(node.id).map(edge => ({
      node: edge.getOtherNode(node),
      edge,
    }));
  }

  // ── CARI NODE BERDASARKAN ID ────────────────────────────────────────
  // Dipakai UI saat user mengklik persimpangan di canvas.
  // Kompleksitas: O(V)
  getNodeById(id) {
    return this.nodes.find(n => n.id === id) ?? null;
  }

  // ── CARI EDGE ANTARA DUA NODE ───────────────────────────────────────
  // Mengembalikan edge yang langsung menghubungkan nodeA ke nodeB.
  // Dipakai untuk keperluan debug atau validasi.
  // Kompleksitas: O(degree(nodeA))
  getEdgeBetween(nodeA, nodeB) {
    return this.getNeighbors(nodeA.id)
      .find(e => e.getOtherNode(nodeA).id === nodeB.id) ?? null;
  }
}