import { PriorityQueue } from './PriorityQueue.js';

export class Dijkstra {
  constructor() {
    this.pq      = new PriorityQueue(); // min-heap
    this.dist    = new Map();  // nodeId → jarak
    this.prev    = new Map();  // nodeId → { node, edge }
    this.visited = new Set();  // nodeId yang sudah diproses
  }

  // Reset struktur data sebelum algoritma berjalan:
  inisialisasiJarak(graph, startNode) {
    this.pq.clear();
    this.dist.clear();
    this.prev.clear();
    this.visited.clear();

    // Set jarak awal & reset node
    graph.nodes.forEach(node => {
      this.dist.set(node.id, Infinity);
      this.prev.set(node.id, null);
      node.reset();
    });

    // Jarak startNode = 0
    this.dist.set(startNode.id, 0);
    startNode.distance = 0;
    startNode.state    = 'start';

    // Masukkan startNode ke heap
    this.pq.insertHeap(startNode, 0);
  }

    *dijkstraGenerator(graph, startNode, endNode) {

        // ── LANGKAH 0: Inisialisasi ──
        this.inisialisasiJarak(graph, startNode);

        yield {
        type: 'init',
        message: `Mulai dari ${startNode.label} → jarak = 0, lainnya = ∞`,
        currentNode: startNode,
        dist: new Map(this.dist),
        visitedCount: 0,
        queueSize: 1,
        };

        // ── LOOP UTAMA ──
        while (!this.pq.isEmpty()) {

        // Ambil node dengan jarak min (O(log V))
        const current = this.pq.extractMin();

        // Lewati duplikat (lazy insertion)
        if (this.visited.has(current.id)) continue;

        // Tandai sebagai visited
        this.visited.add(current.id);

        // Update state tampilan (kecuali start/end)
        if (current.id !== startNode.id && current.id !== endNode.id) {
            current.state = 'visited';
        }

        // YIELD: node yang diproses
        yield {
            type: 'visit',
            message: `▶ Proses ${current.label} (jarak = ${this.dist.get(current.id)})`,
            currentNode: current,
            dist: new Map(this.dist),
            visitedCount: this.visited.size,
            queueSize: this.pq.size(),
        };

        // Stop jika endNode sudah dicapai
        if (current.id === endNode.id) {
            if (endNode.id !== startNode.id) endNode.state = 'end';
            break;
        }

        // ── PERIKSA TETANGGA ──
        const neighbors = graph.getNeighborNodes(current);

        for (const { node: neighbor, edge } of neighbors) {

            if (this.visited.has(neighbor.id)) continue;

            // Tandai edge & neighbor
            edge.state = 'considering';
            if (neighbor.state === 'unvisited') neighbor.state = 'inQueue';

            // Hitung jarak baru
            const distBaru = this.dist.get(current.id) + edge.weight;
            const distLama = this.dist.get(neighbor.id);
            const lebihPendek = distBaru < distLama;

            // YIELD: pertimbangan edge
            yield {
            type: 'consider',
            message: `  Cek ${current.label}→${neighbor.label}: ` +
                    `${this.dist.get(current.id)} + ${edge.weight} = ${distBaru}` +
                    (lebihPendek ? ` ✓ lebih pendek!` : ` ✗ tidak lebih baik`),
            currentNode: current,
            neighbor,
            edge,
            distBaru,
            distLama,
            lebihPendek,
            queueSize: this.pq.size(),
            };

            if (lebihPendek) {
            // Update jarak & prev
            this.dist.set(neighbor.id, distBaru);
            this.prev.set(neighbor.id, { node: current, edge });
            neighbor.distance = distBaru;

            // Masukkan ulang ke heap (lazy insertion)
            this.pq.insertHeap(neighbor, distBaru);

            // YIELD: konfirmasi update
            yield {
                type: 'update',
                message: `  ✓ Update ${neighbor.label}: jarak baru = ${distBaru} (via ${current.label})`,
                neighbor,
                distBaru,
                via: current,
                queueSize: this.pq.size(),
            };
            }

            // Reset edge
            edge.state = 'normal';
        }
        }

        // ── REKONSTRUKSI PATH ──
        const result = this.rekonstruksiPath(startNode, endNode);

        // Tandai jalur terpendek
        result.edges.forEach(e => { e.state = 'path'; });
        result.nodes.forEach(n => {
        if (n.id !== startNode.id && n.id !== endNode.id) n.state = 'path';
        });

        // YIELD akhir
        yield {
        type: 'done',
        message: result.found
            ? `✅ Selesai! ${startNode.label} → ${endNode.label} = ${result.totalDistance} unit`
            : `❌ Tidak ada jalur dari ${startNode.label} ke ${endNode.label}`,
        path: result,
        };
    }
}