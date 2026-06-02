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

    // Hitung titik kontrol Bezier: midpoint digeser tegak lurus (atau pakai controlPoint). O(1).
    getCurveControlPoint(intensity = 0.18) {
        if (this.controlPoint) return this.controlPoint;
    
        // Titik tengah A-B
        const mx = (this.nodeA.x + this.nodeB.x) / 2;
        const my = (this.nodeA.y + this.nodeB.y) / 2;
    
        // Arah dari A ke B
        const dx  = this.nodeB.x - this.nodeA.x;
        const dy  = this.nodeB.y - this.nodeA.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
    
        // Arah tegak lurus: putar vektor (dx,dy) sebesar 90°
        const perpX = -dy / len;
        const perpY =  dx / len;
    
        // Geser midpoint ke arah tegak lurus
        const offset = len * intensity;
        return { x: mx + perpX * offset, y: my + perpY * offset };
    }
    
    // Titik tengah Bezier (t=0.5) untuk label bobot. O(1).
    getMidPoint() {
        return this.getPointAtT(0.5);
    }
    
    // Posisi & sudut kendaraan di kurva Bezier (t). O(1).
    getPointAtT(t, fromNode = null) {
        const cp = this.getCurveControlPoint();
    
        // Tentukan arah gerak (dari A ke B, atau terbalik)
        let ax, ay, bx, by;
        if (fromNode && fromNode.id === this.nodeB.id) {
        // Bergerak dari B ke A
        ax = this.nodeB.x; ay = this.nodeB.y;
        bx = this.nodeA.x; by = this.nodeA.y;
        } else {
        // Bergerak dari A ke B (default)
        ax = this.nodeA.x; ay = this.nodeA.y;
        bx = this.nodeB.x; by = this.nodeB.y;
        }
    
        const mt = 1 - t;
    
        // Hitung posisi di kurva bezier
        const x = mt * mt * ax + 2 * mt * t * cp.x + t * t * bx;
        const y = mt * mt * ay + 2 * mt * t * cp.y + t * t * by;
    
        // Hitung tangent (arah gerak) untuk sudut kendaraan
        const tx = 2 * mt * (cp.x - ax) + 2 * t * (bx - cp.x);
        const ty = 2 * mt * (cp.y - ay) + 2 * t * (by - cp.y);
        const angle = Math.atan2(ty, tx);
    
        return { x, y, angle };
    }
    
    // Panjang kurva Bezier ≈ 20 segmen, untuk kecepatan konsisten. O(1).
    getLength() {
        const steps = 20;
        let len = 0;
        let prev = this.getPointAtT(0);
        for (let i = 1; i <= steps; i++) {
        const curr = this.getPointAtT(i / steps);
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        len += Math.sqrt(dx * dx + dy * dy);
        prev = curr;
        }
        return len;
    }
    
    // Reset state: kembalikan warna jalan ke normal. O(1).
    reset() {
        this.state = 'normal';
    }
}
