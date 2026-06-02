// Edge = jalan penghubung dua persimpangan.

export class Edge {

  // Konstruktor: dipanggil MapGenerator saat hubungkan dua node.
    constructor(id, nodeA, nodeB, weight = null) {
        this.id    = id;      // ID unik edge (angka)
        this.nodeA = nodeA;   // Persimpangan ujung pertama
        this.nodeB = nodeB;   // Persimpangan ujung kedua

        // Bobot = panjang jalan (px), default dihitung otomatis dari jarak Euclidean
        this.weight = weight !== null ? weight : this._hitungBobot();

        // Titik kontrol Bezier: acak dari MapGenerator, dipakai Renderer buat jalan melengkung.
        this.controlPoint = null;

        // State Dijkstra: warna jalan → normal, considering, path
        this.state = 'normal';
    }

    // Bobot edge = jarak Euclidean nodeA–nodeB (dibulatkan). O(1).
    _hitungBobot() {
        const dx = this.nodeB.x - this.nodeA.x;
        const dy = this.nodeB.y - this.nodeA.y;
        return Math.round(Math.sqrt(dx * dx + dy * dy));
    }

    // Return ujung lain dari edge (O(1)).
    getOtherNode(node) {
        return node.id === this.nodeA.id ? this.nodeB : this.nodeA;
    }
}
