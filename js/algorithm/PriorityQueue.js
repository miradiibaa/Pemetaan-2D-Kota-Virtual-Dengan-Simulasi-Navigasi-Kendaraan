export class PriorityQueue {
    constructor() {
        this.heap = [];
    }

  // Tambah node baru (priority/jarak) ke heap.
    insertHeap(node, priority) {
        this.heap.push({ node, priority });
        this._heapifyUp(this.heap.length - 1);
    }
}