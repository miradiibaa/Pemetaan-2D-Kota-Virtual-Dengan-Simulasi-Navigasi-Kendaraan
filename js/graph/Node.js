// Node.js — representasi titik/persimpangan jalan.
// Tiap persimpangan di peta = satu Node.

export class Node {

  // KONSTRUKTOR
  // Dipanggil saat MapGenerator membuat persimpangan baru di peta.
    constructor(id, x, y, label = null) {
        this.id    = id;          // ID unik node (angka)
        this.x     = x;          // Posisi horizontal di canvas (px)
        this.y     = y;          // Posisi vertikal di canvas (px)
        this.label = label ?? `N${id}`;  // Label tampilan, contoh: "N0", "N1"

        // STATE NODE DIJKSTRA (warna renderer)
        // 'unvisited' = belum dikunjungi (kuning)
        // 'inQueue'   = antrian, belum diproses (oranye)
        // 'visited'   = sudah diproses (biru)
        // 'path'      = jalur terpendek (merah)
        // 'start'     = titik awal (hijau)
        // 'end'       = tujuan (merah tua)
        this.state = 'unvisited';

        // Jarak terpendek yang sudah diketahui dari startNode ke node ini.
        // Awalnya Infinity karena belum ada jalur yang ditemukan.
        this.distance = Infinity;

        // Node sebelumnya di jalur terpendek (untuk rekonstruksi jalur).
        // Contoh: jika jalur = A→C→E, maka E.previous = C, C.previous = A
        this.previous = null;

        // Edge yang digunakan untuk tiba di node ini (disimpan untuk rekonstruksi).
        this.previousEdge = null;
    }

  // Mengembalikan semua data Dijkstra ke kondisi awal.
  // Dipanggil oleh Graph.reset() sebelum menjalankan algoritma baru.
  // Kompleksitas: O(1)
    reset() {
        this.state        = 'unvisited';
        this.distance     = Infinity;
        this.previous     = null;
        this.previousEdge = null;
    }

  // Hitung jarak Euclidean antar node: √((x₂-x₁)² + (y₂-y₁)²).
  // Dipakai MapGenerator cek kedekatan untuk hubungkan jalan. O(1).
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

  // Cek apakah node ada di dalam oval.
  // Rumus elips: (x-cx)²/rx² + (y-cy)²/ry² ≤ 1.
  // Dipakai MapGenerator pastikan node tetap di peta. O(1).
    isInOval(cx, cy, rx, ry) {
        const nx = (this.x - cx) / rx;
        const ny = (this.y - cy) / ry;
        return (nx * nx + ny * ny) <= 1;
    }
}