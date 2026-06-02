export class PriorityQueue {
    constructor() {
        this.heap = [];
    }

        // Tambah node baru (priority/jarak) ke heap.
    insertHeap(node, priority) {
        this.heap.push({ node, priority });
        this._heapifyUp(this.heap.length - 1);
    }

        // EXTRACT MIN: Mengambil & menghapus node dengan priority terkecil, Kompleksitas: O(log n)
    extractMin() {
        if (this.isEmpty()) return null;

        const minNode = this.heap[0].node; 
        const last    = this.heap.pop();   

        if (this.heap.length > 0) {
        this.heap[0] = last;             
        this._heapifyDown(0);            
        }

        return minNode;
    }

        // DECREASE KEY: Update priority node yang ada di heap, dipakai saat Dijkstra temukan jalur lebih pendek, Kompleksitas: O(n) pencarian + O(log n) heapify
    decreaseKey(nodeId, newPriority) {
        const idx = this.heap.findIndex(item => item.node.id === nodeId);
        if (idx === -1) return; // node tidak ada di heap
        if (newPriority < this.heap[idx].priority) {
        this.heap[idx].priority = newPriority;
        this._heapifyUp(idx);
        }
    }

        // HEAPIFY UP: Geser elemen ke atas untuk pulihkan min-heap, dipanggil setelah insertHeap, Kompleksitas: O(log n)
    _heapifyUp(index) {
        while (index > 0) {
        const parentIdx = Math.floor((index - 1) / 2);

        if (this.heap[parentIdx].priority <= this.heap[index].priority) break; // Properti heap sudah terpenuhi → berhenti
        this._swap(parentIdx, index);
        index = parentIdx; // naik ke posisi parent
        }
    }

        // HEAPIFY DOWN: Geser elemen ke bawah untuk pulihkan min-heap, dipanggil setelah extractMin, Kompleksitas: O(log n)
    _heapifyDown(index) {
        const n = this.heap.length;

        while (true) {
        let smallest = index;
        const left   = 2 * index + 1; 
        const right  = 2 * index + 2; 

        if (left < n && this.heap[left].priority < this.heap[smallest].priority)
            smallest = left;

        if (right < n && this.heap[right].priority < this.heap[smallest].priority)
            smallest = right;

        if (smallest === index) break; // Properti heap sudah terpenuhi → berhenti

        this._swap(smallest, index);
        index = smallest; // turun ke posisi anak
        }
    }
} 