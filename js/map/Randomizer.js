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
}