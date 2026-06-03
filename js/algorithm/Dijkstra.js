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
}