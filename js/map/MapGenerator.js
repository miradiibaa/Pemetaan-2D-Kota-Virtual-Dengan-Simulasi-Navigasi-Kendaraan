    import { Node }   from '../graph/Node.js';
    import { Edge }   from '../graph/Edge.js';
    import { Graph }  from '../graph/Graph.js';
    import { CONFIG } from '../config.js';

    export class MapGenerator {

    constructor() {
        this.graph = new Graph();
        this.theme = null;

        this.decorations = {
        buildings:  [],
        trees:      [],
        plants:     [],
        animals:    [],
        riceFields: [],
        ponds:      [],
        trafficLights: [],
        };

        this.ovalCX = 0;
        this.ovalCY = 0;
        this.ovalRX = 0;
        this.ovalRY = 0;
        this.nodeRows = [];
        this.gridAngle = 0;
        this.layoutVariant = 0;
        this._lastLayoutVariant = -1;
        this.centerKind = 'loop';
        this.centerLoop = null;
        this.roadProfile = null;
        this._lastRoadProfileId = '';
        this._lastCenterKind = '';
        this._lastLayoutSignature = '';
    }

    generatePeta(theme, canvasW, canvasH) {
        const W = canvasW || CONFIG.canvas.width;
        const H = canvasH || CONFIG.canvas.height;
        const mapRadius = Math.min(
        W * CONFIG.oval.radiusX,
        (H - CONFIG.ui.topPanelH) * CONFIG.oval.radiusY
        );
        this.ovalCX = W / 2;
        this.ovalCY = H / 2 + CONFIG.ui.topPanelH / 4;
        this.ovalRX = mapRadius;
        this.ovalRY = mapRadius;
        this.theme = theme;

        let cleanMap = false;
        for (let attempt = 0; attempt < 40; attempt++) {
        this.graph.clear();
        this.decorations = { buildings: [], trees: [], plants: [], animals: [], riceFields: [], ponds: [], trafficLights: [] };
        this.nodeRows = [];
        this.gridAngle = 0;
        this.centerLoop = null;

        this._generateNodes();
        this._connectNodes();
        this._fixConnectivity();
        this._generateControlPoints();

        const signature = this._layoutSignature();
        if (this._isRoadNetworkClean() && signature !== this._lastLayoutSignature) {
            this._lastLayoutSignature = signature;
            this._lastRoadProfileId = this.roadProfile?.id ?? '';
            this._lastCenterKind = this.centerKind;
            cleanMap = true;
            break;
        }
        }

        if (!cleanMap) {
        this._straightenProblemRoads();
        }

        this._generateDecorations();

        return {
        graph:       this.graph,
        decorations: this.decorations,
        theme:       this.theme,
        oval: {
            cx: this.ovalCX,
            cy: this.ovalCY,
            rx: this.ovalRX,
            ry: this.ovalRY,
        },
        };
    }

    // Membuat node dalam pola kota dengan variasi pusat: loop, perempatan, atau median/u-turn.
    _generateNodes() {
        const profile = this._chooseRoadProfile();
        this.roadProfile = profile;
        this.layoutVariant = profile.index;
        this.centerKind = profile.centerKind;

        this.gridAngle = (Math.random() - 0.5) * Math.PI * 0.10;
        this.layoutMirror = Math.random() < 0.5 ? -1 : 1;
        this.uTurnSide = profile.uTurnSide;

        const loopCx = (Math.random() - 0.5) * 0.045;
        const loopCy = (Math.random() - 0.5) * 0.035;
        const outerScaleX = 0.985 + Math.random() * 0.030;
        const outerScaleY = 0.980 + Math.random() * 0.035;

        const addNode = (nx, ny, role = 'street') => {
        const jitter = role === 'outer' ? 0.012 : 0.010;
        const px = this.layoutMirror * nx * outerScaleX + (Math.random() - 0.5) * jitter;
        const py = ny * outerScaleY + (Math.random() - 0.5) * jitter;
        const { x, y } = this._toOvalPoint(px, py);
        const node = new Node(this.graph.nodes.length, x, y);
        node.mapRole = role;
        this.graph.tambahNode(node);
        return node;
        };

        const addWorldNode = (x, y, role = 'street') => {
        const node = new Node(this.graph.nodes.length, x, y);
        node.mapRole = role;
        this.graph.tambahNode(node);
        return node;
        };

        const outer = [
        [-0.63, -0.48], [ 0.00, -0.66], [ 0.63, -0.48], [ 0.79, -0.02],
        [ 0.63,  0.48], [ 0.00,  0.66], [-0.63,  0.48], [-0.79,  0.02],
        ].map(([nx, ny]) => addNode(nx, ny, 'outer'));

        let centerNodes;
        if (this.centerKind === 'intersection') {
        const slipCoords = {
            se: [0.20, 0.16],
            sw: [-0.20, 0.16],
            nw: [-0.20, -0.16],
            ne: [0.20, -0.16],
        }[profile.slipCorner] ?? [0.20, 0.16];
        centerNodes = [
            [0, -0.28], [0.28, 0], [0, 0.28], [-0.28, 0], [0, 0], slipCoords,
        ].map(([nx, ny]) => addNode(loopCx + nx, loopCy + ny, 'center'));
        } else if (this.centerKind === 'median') {
        const medianY = 0.095 + Math.random() * 0.012;
        const medianX = medianY;
        const coords = profile.medianOrientation === 'vertical'
            ? [
                [-medianX, -0.30], [-medianX, 0.00], [-medianX, 0.30],
                [ medianX,  0.30], [ medianX, 0.00], [ medianX, -0.30],
            ]
            : [
                [-0.30, -medianY], [0.00, -medianY], [0.30, -medianY],
                [0.30,  medianY], [0.00,  medianY], [-0.30,  medianY],
            ];
        centerNodes = coords.map(([nx, ny]) => addNode(loopCx + nx, loopCy + ny, 'median'));
        } else {
        const loopRotation = profile.loopRotation + (Math.random() - 0.5) * 0.08;
        const loopCenter = this._toOvalPoint(this.layoutMirror * loopCx * outerScaleX, loopCy * outerScaleY);
        const loopRadius = Math.min(this.ovalRX, this.ovalRY) * 0.235;
        this.centerLoop = { x: loopCenter.x, y: loopCenter.y, r: loopRadius };
        centerNodes = Array.from({ length: 6 }, (_, i) => {
            const a = loopRotation - Math.PI / 2 + i * Math.PI * 2 / 6;
            return addWorldNode(
            loopCenter.x + Math.cos(a) * loopRadius,
            loopCenter.y + Math.sin(a) * loopRadius,
            'park'
            );
        });
        }

        const sideCoords = {
        right:  [[0.88, -0.26], [0.88, 0.26]],
        left:   [[-0.88, -0.26], [-0.88, 0.26]],
        top:    [[-0.26, -0.78], [0.26, -0.78]],
        bottom: [[-0.26, 0.78], [0.26, 0.78]],
        }[this.uTurnSide];
        const uTurn = sideCoords.map(([nx, ny]) => addNode(nx, ny, 'uturn'));

        this.nodeRows = [outer, centerNodes, uTurn];
    }

    _chooseRoadProfile() {
        const profiles = this._roadProfiles();
        const candidates = profiles.filter(profile =>
        profile.id !== this._lastRoadProfileId &&
        profile.centerKind !== this._lastCenterKind
        );
        const pool = candidates.length > 0
        ? candidates
        : profiles.filter(profile => profile.id !== this._lastRoadProfileId);
        return pool[Math.floor(Math.random() * pool.length)] ?? profiles[0];
    }

    _roadProfiles() {
        return [
        {
            id: 'roundabout-cardinal',
            index: 0,
            centerKind: 'loop',
            loopRotation: -Math.PI / 2,
            connectorAnchors: [1, 3, 5, 7],
            uTurnSide: 'right',
        },
        {
            id: 'roundabout-diagonal',
            index: 1,
            centerKind: 'loop',
            loopRotation: -Math.PI / 3,
            connectorAnchors: [0, 2, 4, 6],
            uTurnSide: 'bottom',
        },
        {
            id: 'intersection-slip-se',
            index: 2,
            centerKind: 'intersection',
            slipCorner: 'se',
            connectors: [[1, 8], [3, 9], [5, 10], [7, 11]],
            uTurnSide: 'top',
        },
        {
            id: 'intersection-slip-nw',
            index: 3,
            centerKind: 'intersection',
            slipCorner: 'nw',
            connectors: [[0, 11], [2, 8], [3, 9], [4, 10]],
            uTurnSide: 'left',
        },
        {
            id: 'intersection-slip-ne',
            index: 4,
            centerKind: 'intersection',
            slipCorner: 'ne',
            connectors: [[1, 8], [2, 9], [5, 10], [7, 11]],
            uTurnSide: 'right',
        },
        {
            id: 'median-horizontal',
            index: 5,
            centerKind: 'median',
            medianOrientation: 'horizontal',
            connectors: [[7, 8], [3, 10], [7, 13], [3, 11]],
            uTurnSide: 'top',
        },
        {
            id: 'median-horizontal-access',
            index: 6,
            centerKind: 'median',
            medianOrientation: 'horizontal',
            connectors: [[1, 9], [5, 12], [7, 8], [3, 11]],
            uTurnSide: 'bottom',
        },
        {
            id: 'median-vertical',
            index: 7,
            centerKind: 'median',
            medianOrientation: 'vertical',
            connectors: [[1, 8], [2, 13], [5, 10], [4, 11]],
            uTurnSide: 'right',
        },
        {
            id: 'median-vertical-access',
            index: 8,
            centerKind: 'median',
            medianOrientation: 'vertical',
            connectors: [[7, 9], [3, 12], [1, 13], [5, 10]],
            uTurnSide: 'left',
        },
        ];
    }

    _randomRowCount(nodeCount) {
        if (nodeCount <= 24) return 4;
        return Math.max(4, Math.round(Math.sqrt(nodeCount * 0.8)));
    }

    _distributeNodes(nodeCount, rows) {
        const counts = Array.from({ length: rows }, () => 3);
        let remaining = nodeCount - rows * 3;
        let row = Math.floor(Math.random() * rows);

        while (remaining > 0) {
        const maxForRow = row === 0 || row === rows - 1
            ? Math.ceil(nodeCount / rows) + 1
            : Math.ceil(nodeCount / rows) + 2;
        if (counts[row] < maxForRow) {
            counts[row]++;
            remaining--;
        }
        row = (row + 1 + Math.floor(Math.random() * Math.max(1, rows - 1))) % rows;
        }

        return counts;
    }

    _toOvalPoint(nx, ny) {
        const cos = Math.cos(this.gridAngle);
        const sin = Math.sin(this.gridAngle);
        const rx = nx * cos - ny * sin;
        const ry = nx * sin + ny * cos;
        return {
        x: this.ovalCX + rx * this.ovalRX,
        y: this.ovalCY + ry * this.ovalRY,
        };
    }

    _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    _fillMissingNodes(nextId, targetCount) {
        const { minConnectDist } = CONFIG.map;
        const margin = minConnectDist * 0.7;
        const rx = this.ovalRX - margin;
        const ry = this.ovalRY - margin;
        let id = nextId;
        let attempts = 0;

        while (this.graph.nodes.length < targetCount && attempts < targetCount * 120) {
        attempts++;
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.sqrt(Math.random()) * 0.86;
        const x = this.ovalCX + r * rx * Math.cos(angle);
        const y = this.ovalCY + r * ry * Math.sin(angle);
        const minGap = attempts < targetCount * 80 ? minConnectDist * 0.9 : minConnectDist * 0.78;

        if (!this._isPointFarEnough(x, y, minGap)) continue;

        const node = new Node(id++, x, y);
        this.graph.tambahNode(node);

        const targetRow = this.nodeRows.reduce((best, row, idx) => {
            if (row.length === 0) return best;
            const avgY = row.reduce((sum, n) => sum + n.y, 0) / row.length;
            const d = Math.abs(avgY - y);
            return d < best.d ? { idx, d } : best;
        }, { idx: 0, d: Infinity }).idx;
        this.nodeRows[targetRow]?.push(node);
        }
    }

    _isPointFarEnough(x, y, minGap) {
        return !this.graph.nodes.some(n => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx * dx + dy * dy) < minGap;
        });
    }

    // Menyambungkan node sebagai jaringan jalan kota yang rapi dan mudah dibaca.
    _connectNodes() {
        let edgeId = 0;
        const tambah = (aId, bId, roadKind = 'street', curveSide = 0) => {
        const nodeA = this.graph.nodes[aId];
        const nodeB = this.graph.nodes[bId];
        if (this._edgeCrossesExisting(nodeA, nodeB)) return false;

        const edge = new Edge(edgeId++, nodeA, nodeB);
        edge.roadKind = roadKind;
        edge.curveSide = curveSide || (Math.random() < 0.5 ? -1 : 1);
        this.graph.tambahEdge(edge);
        return true;
        };

        // Ring arteri luar: selalu connected dan tidak punya ruas terisolasi.
        [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [4, 5], [5, 6], [6, 7], [7, 0],
        ].forEach(([a, b]) => tambah(a, b, 'outerLoop'));

        if (this.centerKind === 'intersection') {
        const slipEdges = {
            se: [[9, 13], [10, 13]],
            sw: [[10, 13], [11, 13]],
            nw: [[11, 13], [8, 13]],
            ne: [[8, 13], [9, 13]],
        }[this.roadProfile?.slipCorner] ?? [[9, 13], [10, 13]];
        [
            [8, 12], [9, 12], [10, 12], [11, 12],
            ...slipEdges,
        ].forEach(([a, b]) => tambah(a, b, 'centerIntersection'));
        } else if (this.centerKind === 'median') {
        [
            [8, 9], [9, 10], [13, 12], [12, 11],
            [8, 13], [10, 11],
        ].forEach(([a, b]) => tambah(a, b, 'medianRoad'));
        } else {
        [
            [8, 9], [9, 10], [10, 11],
            [11, 12], [12, 13], [13, 8],
        ].forEach(([a, b]) => tambah(a, b, 'parkLoop'));
        }

        this._connectorPlanForCenter().forEach(([a, b]) => tambah(a, b, 'connector'));

        const uTurnAnchors = {
        right:  [3, 4],
        left:   [7, 6],
        top:    [1, 2],
        bottom: [5, 4],
        }[this.uTurnSide];
        tambah(uTurnAnchors[0], 14, 'uTurnStem');
        tambah(14, 15, 'uTurnBulb');
        tambah(15, uTurnAnchors[1], 'uTurnStem');
    }

    _connectorPlanForCenter() {
        if (this.roadProfile?.connectors) {
        return this.roadProfile.connectors;
        }

        if (this.centerKind === 'intersection') {
        return this._connectorPlanFromCenters([8, 9, 10, 11], [1, 3, 5, 7, 0, 2, 4, 6]);
        }

        const anchors = this.roadProfile?.connectorAnchors ?? [1, 3, 5, 7];
        const candidates = this.centerKind === 'intersection'
        ? [8, 9, 10, 11]
        : [8, 9, 10, 11, 12, 13];
        const planned = [];
        const usedCenters = new Set();

        for (const anchorId of anchors) {
        const sorted = candidates
            .filter(centerId => !usedCenters.has(centerId))
            .map(centerId => ({
            centerId,
            distance: this.graph.nodes[anchorId].distanceTo(this.graph.nodes[centerId]),
            }))
            .sort((a, b) => a.distance - b.distance);

        let chosen = null;
        for (const { centerId } of sorted) {
            if (!this._connectorCrossesPlanned(anchorId, centerId, planned)) {
            chosen = centerId;
            break;
            }
        }

        if (chosen === null) {
            const fallback = candidates
            .map(centerId => ({
                centerId,
                distance: this.graph.nodes[anchorId].distanceTo(this.graph.nodes[centerId]),
            }))
            .sort((a, b) => a.distance - b.distance)
            .find(({ centerId }) => !this._connectorCrossesPlanned(anchorId, centerId, planned));
            chosen = fallback?.centerId ?? null;
        }

        if (chosen !== null) {
            planned.push([anchorId, chosen]);
            usedCenters.add(chosen);
        }
        }

        return planned;
    }

    _connectorPlanFromCenters(centerIds, anchorCandidates) {
        const planned = [];
        const usedAnchors = new Set();

        for (const centerId of centerIds) {
        const sorted = anchorCandidates
            .filter(anchorId => !usedAnchors.has(anchorId))
            .map(anchorId => ({
            anchorId,
            distance: this.graph.nodes[anchorId].distanceTo(this.graph.nodes[centerId]),
            }))
            .sort((a, b) => a.distance - b.distance);

        let chosen = null;
        for (const { anchorId } of sorted) {
            if (!this._connectorCrossesPlanned(anchorId, centerId, planned)) {
            chosen = anchorId;
            break;
            }
        }

        if (chosen === null) {
            const fallback = anchorCandidates
            .map(anchorId => ({
                anchorId,
                distance: this.graph.nodes[anchorId].distanceTo(this.graph.nodes[centerId]),
            }))
            .sort((a, b) => a.distance - b.distance)
            .find(({ anchorId }) => !this._connectorCrossesPlanned(anchorId, centerId, planned));
            chosen = fallback?.anchorId ?? null;
        }

        if (chosen !== null) {
            planned.push([chosen, centerId]);
            usedAnchors.add(chosen);
        }
        }

        return planned;
    }

    _connectorCrossesPlanned(aId, bId, planned) {
        const a = this.graph.nodes[aId];
        const b = this.graph.nodes[bId];
        const crossesEdge = (edgeA, edgeB) => {
        if (edgeA.id === a.id || edgeB.id === a.id) return false;
        if (edgeA.id === b.id || edgeB.id === b.id) return false;
        return this._segmentsIntersect(a.x, a.y, b.x, b.y, edgeA.x, edgeA.y, edgeB.x, edgeB.y);
        };

        for (const edge of this.graph.edges) {
        if (crossesEdge(edge.nodeA, edge.nodeB)) return true;
        }

        for (const [paId, pbId] of planned) {
        if (crossesEdge(this.graph.nodes[paId], this.graph.nodes[pbId])) return true;
        }

        return false;
    }
}

    _buildMST(nodes, edgeSudahAda, startEdgeId); {
        const allEdges = [];
        for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const d = nodes[i].distanceTo(nodes[j]);
            if (d <= CONFIG.map.maxConnectDist * 1.2) {
            allEdges.push({
                a: nodes[i], b: nodes[j], d, id: `${i}-${j}`
            });
            }
        }
        }

        allEdges.sort((x, y) => x.d - y.d);

        const parent = new Map();
        const rank = new Map();
        for (const n of nodes) {
        parent.set(n.id, n.id);
        rank.set(n.id, 0);
        }

        const find = (x) => {
        if (parent.get(x) !== x) {
            parent.set(x, find(parent.get(x)));
        }
        return parent.get(x);
        };

        const union = (x, y) => {
        const px = find(x), py = find(y);
        if (px === py) return false;
        if (rank.get(px) < rank.get(py)) {
            parent.set(px, py);
        } else if (rank.get(px) > rank.get(py)) {
            parent.set(py, px);
        } else {
            parent.set(py, px);
            rank.set(px, rank.get(px) + 1);
        }
        return true;
        };

        let edgeId = startEdgeId;
        for (const edge of allEdges) {
        if (!union(edge.a.id, edge.b.id)) continue;
        if (this._edgeCrossesExisting(edge.a, edge.b)) continue;

        const key = [edge.a.id, edge.b.id].sort((a,b)=>a-b).join('-');
        if (edgeSudahAda.has(key)) continue;

        edgeSudahAda.add(key);
        const cleanEdge = new Edge(edgeId++, edge.a, edge.b);
        cleanEdge.roadKind = 'connector';
        this.graph.tambahEdge(cleanEdge);
        }
    }

    // Menjamin graf connected dan setiap node punya minimal dua koneksi.
    _fixConnectivity(); {
        const nodes  = this.graph.nodes;
        let edgeId   = this.graph.edges.length;
        const edgeSudahAda = new Set(
        this.graph.edges.map(e => [e.nodeA.id, e.nodeB.id].sort((a,b)=>a-b).join('-'))
        );

        const getKomponen = () => {
        const komp = new Map();
        let kompId = 0;
        for (const node of nodes) {
            if (komp.has(node.id)) continue;
            const antrian = [node];
            komp.set(node.id, kompId);
            while (antrian.length > 0) {
            const cur = antrian.shift();
            for (const { node: nb } of this.graph.getNeighborNodes(cur)) {
                if (!komp.has(nb.id)) { komp.set(nb.id, kompId); antrian.push(nb); }
            }
            }
            kompId++;
        }
        return komp;
        };

        for (let iterasi = 0; iterasi < nodes.length; iterasi++) {
        const komp = getKomponen();
        if (new Set(komp.values()).size === 1) break;

        let bestA = null, bestB = null, bestD = Infinity;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            if (komp.get(a.id) === komp.get(b.id)) continue;
            const key = [a.id, b.id].sort((x,y)=>x-y).join('-');
            if (edgeSudahAda.has(key)) continue;
            if (this._edgeCrossesExisting(a, b)) continue;
            const d = a.distanceTo(b);
            if (d < bestD) { bestD = d; bestA = a; bestB = b; }
            }
        }
        if (!bestA) break;
        const key = [bestA.id, bestB.id].sort((a,b)=>a-b).join('-');
        if (!edgeSudahAda.has(key)) {
            edgeSudahAda.add(key);
            const edge = new Edge(edgeId++, bestA, bestB);
            edge.roadKind = 'connector';
            this.graph.tambahEdge(edge);
        }
        }

        // Node degree rendah diberi koneksi tambahan tanpa membuat jalan silang.
        const minDegree = 2;
        const maxAttempts = nodes.length * 10;
        let attempts = 0;
        const nodeDegree = () => {
        const deg = new Map();
        for (const n of nodes) deg.set(n.id, 0);
        for (const e of this.graph.edges) {
            deg.set(e.nodeA.id, deg.get(e.nodeA.id) + 1);
            deg.set(e.nodeB.id, deg.get(e.nodeB.id) + 1);
        }
        return deg;
        };

        let degMap = nodeDegree();
        let nodesWithDeg1 = nodes.filter(n => degMap.get(n.id) < minDegree);
        while (nodesWithDeg1.length > 0 && attempts < maxAttempts) {
        attempts++;
        const a = nodesWithDeg1.shift();
        let kandidat = nodes
            .filter(n => n.id !== a.id)
            .map(n => ({ node: n, d: a.distanceTo(n) }))
            .sort((x,y)=>x.d-y.d);

        let connected = false;
        for (const { node: b } of kandidat) {
            const key = [a.id, b.id].sort((x,y)=>x-y).join('-');
            if (edgeSudahAda.has(key)) continue;
            if (this._edgeCrossesExisting(a, b)) continue;
            edgeSudahAda.add(key);
            const edge = new Edge(edgeId++, a, b);
            edge.roadKind = 'connector';
            this.graph.tambahEdge(edge);
            connected = true;
            break;
        }

        if (!connected) {
            nodesWithDeg1.push(a);
        }

        degMap = nodeDegree();
        nodesWithDeg1 = nodes.filter(n => degMap.get(n.id) < minDegree);
        }

        // Final pass tetap menolak koneksi yang membuat jalan saling menimpa.
        degMap = nodeDegree();
        nodesWithDeg1 = nodes.filter(n => degMap.get(n.id) < minDegree);
        for (const a of nodesWithDeg1) {
        const kandidat = nodes
            .filter(n => n.id !== a.id)
            .map(n => ({ node: n, d: a.distanceTo(n) }))
            .sort((x,y)=>x.d-y.d);
        for (const { node: b } of kandidat) {
            const key = [a.id, b.id].sort((x,y)=>x-y).join('-');
            if (edgeSudahAda.has(key)) continue;
            if (this._edgeCrossesExisting(a, b)) continue;
            edgeSudahAda.add(key);
            const edge = new Edge(edgeId++, a, b);
            edge.roadKind = 'connector';
            this.graph.tambahEdge(edge);
            break;
        }
        }

        const finalDeg = nodeDegree();
        const stillLow = nodes.filter(n => finalDeg.get(n.id) < minDegree);
        if (stillLow.length > 0) {
        console.warn('[MapGenerator] nodes with degree <', minDegree, ':', stillLow.map(n=>n.id));
        console.warn('[MapGenerator] graph stats after fix:', this.graph.getStats());
        }
    }

        _generateControlPoints(); {
        for (const edge of this.graph.edges) {
        const mx = (edge.nodeA.x + edge.nodeB.x) / 2;
        const my = (edge.nodeA.y + edge.nodeB.y) / 2;

        const dx  = edge.nodeB.x - edge.nodeA.x;
        const dy  = edge.nodeB.y - edge.nodeA.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;

        if (edge.roadKind === 'parkLoop') {
            const loop = this.centerLoop ?? { x: this.ovalCX, y: this.ovalCY, r: len };
            const outX = mx - loop.x;
            const outY = my - loop.y;
            const outLen = Math.sqrt(outX * outX + outY * outY) || 1;
            const radius = loop.r || len;
            edge.controlPoint = {
            x: loop.x + (outX / outLen) * radius * 1.155,
            y: loop.y + (outY / outLen) * radius * 1.155,
            };
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        if (edge.roadKind === 'medianRoad') {
            edge.controlPoint = this._midPointControl(edge);
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        if (edge.roadKind === 'centerIntersection') {
            edge.controlPoint = this._midPointControl(edge);
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        if (edge.roadKind === 'outerLoop') {
            const outX = mx - this.ovalCX;
            const outY = my - this.ovalCY;
            const outLen = Math.sqrt(outX * outX + outY * outY) || 1;
            edge.controlPoint = {
            x: mx + (outX / outLen) * len * (0.18 + Math.random() * 0.07),
            y: my + (outY / outLen) * len * (0.18 + Math.random() * 0.07),
            };
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        if (edge.roadKind === 'uTurnBulb') {
            const side = this.uTurnSide === 'left' || this.uTurnSide === 'top' ? -1 : 1;
            const vertical = this.uTurnSide === 'left' || this.uTurnSide === 'right';
            edge.controlPoint = {
            x: vertical ? mx + side * this.ovalRX * 0.13 : mx,
            y: vertical ? my : my + side * this.ovalRY * 0.13,
            };
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        if (edge.roadKind === 'uTurnStem' || edge.roadKind === 'connector') {
            edge.controlPoint = this._midPointControl(edge);
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        if (edge.roadKind === 'diagonal') {
            const perpX = -dy / len;
            const perpY =  dx / len;
            const side = edge.curveSide || (Math.random() < 0.5 ? -1 : 1);
            edge.controlPoint = {
            x: mx + perpX * len * (0.16 + Math.random() * 0.10) * side,
            y: my + perpY * len * (0.16 + Math.random() * 0.10) * side,
            };
            edge.weight = Math.round(edge.getLength());
            continue;
        }

        edge.controlPoint = this._midPointControl(edge);
        edge.weight = Math.round(edge.getLength());
        }
    }

    // Dekorasi ditempatkan memakai collision check agar tidak menimpa jalan/aset.
    _generateDecorations(); {
        this._occupiedAssets = [];
        this._generatePonds();
        this._generateTrafficLights();
        this._generateCommercialBlocks();
        this._generateBuildings();
        this._generateTrees();
        this._generatePlants();
        this._generateAnimals();
        this._occupiedAssets = [];
    }

    _generateBuildings(); {
        const theme   = this.theme;
        const density = theme.buildingDensity;
        const roadW   = theme.roadWidth;
        const perSisi = CONFIG.map.buildingsPerRoad;
        const byType = (type) => theme.buildings.filter(b => b.type === type);
        const pickStyle = (types, fallback = theme.buildings) => {
        const pool = types.flatMap(type => byType(type));
        return (pool.length > 0 ? pool : fallback)[Math.floor(Math.random() * (pool.length || fallback.length))];
        };

        for (const edge of this.graph.edges) {
        if (edge.roadKind === 'parkLoop' || edge.roadKind === 'medianRoad' ||
            edge.roadKind === 'centerIntersection' || edge.roadKind === 'uTurnBulb') continue;

        for (const sisi of [-1, 1]) {
            for (let s = 0; s < perSisi; s++) {
            if (Math.random() > density) continue;
            const t  = 0.14 + ((s + 0.5) / perSisi) * 0.72;
            const pt = edge.getPointAtT(t);

            const perpX = Math.cos(pt.angle + Math.PI / 2) * sisi;
            const perpY = Math.sin(pt.angle + Math.PI / 2) * sisi;
            const outward = ((pt.x - this.ovalCX) * perpX + (pt.y - this.ovalCY) * perpY) > 0;

            let style;
            if (edge.roadKind === 'outerLoop' && outward) {
                style = pickStyle(['office', 'tower', 'apt']);
            } else if (edge.roadKind === 'outerLoop') {
                style = pickStyle(['residential', 'shop']);
            } else {
                style = pickStyle(['shop', 'residential', 'office']);
            }
            const w      = style.minW + Math.random() * (style.maxW - style.minW);
            let h        = style.minH + Math.random() * (style.maxH - style.minH);
            if (edge.roadKind === 'outerLoop' && outward && (style.type === 'office' || style.type === 'tower' || style.type === 'apt')) {
                h *= 1.18;
            }
            if (style.type === 'residential') h *= 1.08;
            const radius = Math.sqrt(w * w + h * h) / 2;
            const frontSetback = roadW / 2 + theme.sidewalkW + 13;
            const offset = frontSetback + h / 2;

            const bx = pt.x + perpX * offset;
            const by = pt.y + perpY * offset;

            if (!this._canPlaceAsset(bx, by, radius * 0.60, 7, 9)) continue;

            this.decorations.buildings.push({
                x: bx, y: by, w, h, radius, style,
                angle: 0,
                type: style.type,
                rowIndex: s,
                rowCount: perSisi,
                frontSide: 1,
                roadAligned: true,
            });
            this._reserveAsset(bx, by, radius * 0.58);
            }
        }
        }
    }

    _generateCommercialBlocks(); {
        const mallStyles = this.theme.buildings.filter(b => b.type === 'mall' || b.type === 'market' || b.type === 'supermarket');
        if (mallStyles.length === 0) return;

        const candidates = this.graph.edges.filter(edge => edge.roadKind === 'outerLoop');
        const picked = candidates.slice().sort(() => Math.random() - 0.5);
        let placed = 0;

        for (const edge of picked) {
        if (placed >= 3) break;
        const style = mallStyles[placed % mallStyles.length];
        let didPlace = false;

        for (const t of [0.30, 0.50, 0.70]) {
            if (didPlace) break;
            const pt = edge.getPointAtT(t);
            const sideA = Math.cos(pt.angle + Math.PI / 2);
            const sideB = Math.sin(pt.angle + Math.PI / 2);
            const outward = ((pt.x - this.ovalCX) * sideA + (pt.y - this.ovalCY) * sideB) > 0 ? 1 : -1;

            for (const side of [-outward, outward]) {
            const w = style.minW + Math.random() * (style.maxW - style.minW);
            let h = style.minH + Math.random() * (style.maxH - style.minH);
            h *= style.type === 'mall' ? 1.35 : 1.20;
            const radius = Math.sqrt(w * w + h * h) / 2;
            const frontSetback = this.theme.roadWidth / 2 + this.theme.sidewalkW + 18;
            const offset = frontSetback + h / 2;
            const x = pt.x + sideA * side * offset;
            const y = pt.y + sideB * side * offset;

            if (!this._canPlaceAsset(x, y, radius * 0.56, 8, 10)) continue;

            this.decorations.buildings.push({
                x, y, w, h, radius, style,
                angle: 0,
                type: style.type,
                commercialBlock: true,
                frontSide: 1,
                roadAligned: true,
            });
            this._reserveAsset(x, y, radius * 0.56);
            placed++;
            didPlace = true;
            break;
            }
        }
        }
    }

    _generateTrees(); {
        const theme  = this.theme;
        const jumlah = Math.floor(this.graph.nodes.length * theme.treeDensity * 5);
        let placed = 0;

        for (const edge of this.graph.edges) {
            if (edge.roadKind !== 'parkLoop' && edge.roadKind !== 'medianRoad') continue;
            for (const t of [0.18, 0.38, 0.62, 0.82]) {
                const pt = edge.getPointAtT(t);
                const side = t < 0.5 ? -1 : 1;
                const radius = theme.treeRadius.min + Math.random() * (theme.treeRadius.max - theme.treeRadius.min);
                const offset = this.theme.roadWidth / 2 + 18 + radius;
                const x = pt.x + Math.cos(pt.angle + Math.PI / 2) * side * offset;
                const y = pt.y + Math.sin(pt.angle + Math.PI / 2) * side * offset;
                if (!this._canPlaceAsset(x, y, radius, 6)) continue;
                const colorIdx = Math.floor(Math.random() * theme.treeColors.length);
                this.decorations.trees.push({ x, y, radius, colorIdx, aligned: true });
                this._reserveAsset(x, y, radius);
                placed++;
            }
        }

        for (let i = 0; i < jumlah * 4 && placed < jumlah; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r     = Math.sqrt(Math.random()) * 0.88;
            const x     = this.ovalCX + r * this.ovalRX * Math.cos(angle);
            const y     = this.ovalCY + r * this.ovalRY * Math.sin(angle);

            const radius   = theme.treeRadius.min + Math.random() * (theme.treeRadius.max - theme.treeRadius.min);
                if (!this._canPlaceAsset(x, y, radius, 10)) continue;

            const colorIdx = Math.floor(Math.random() * theme.treeColors.length);
            this.decorations.trees.push({ x, y, radius, colorIdx });
            this._reserveAsset(x, y, radius);
            placed++;
        }
    }

    _generateTrafficLights(); {
        const busyNodes = this.graph.nodes
        .filter(node => this.graph.getNeighbors(node.id).length >= 3)
        .slice(0, 10);

        for (const node of busyNodes) {
            const vx = node.x - this.ovalCX;
            const vy = node.y - this.ovalCY;
            const len = Math.sqrt(vx * vx + vy * vy) || 1;
            const offset = this.theme.roadWidth / 2 + this.theme.nodeRadius + 8;
            const x = node.x + (vx / len) * offset;
            const y = node.y + (vy / len) * offset;
            this.decorations.trafficLights.push({
                x, y, angle: 0,
                active: node.id % 3,
            });
        }
    } 

    _generatePlants(); {
        const theme = this.theme;
        const jumlah = this.graph.nodes.length * 2;
        let placed = 0;

        for (let i = 0; i < jumlah * 5 && placed < jumlah; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.sqrt(Math.random()) * 0.90;
            const x = this.ovalCX + r * this.ovalRX * Math.cos(angle);
            const y = this.ovalCY + r * this.ovalRY * Math.sin(angle);
            const radius = 6 + Math.random() * 4;

            if (!this._canPlaceAsset(x, y, radius, 7)) continue;

            this.decorations.plants.push({
                x, y, radius,
                colorIdx: Math.floor(Math.random() * theme.plantColors.length),
                petals: 3 + Math.floor(Math.random() * 4),
            });
            this._reserveAsset(x, y, radius + 2);
            placed++;
        }
    }

    _generateAnimals(); {
        const theme = this.theme;
        const jumlah = 5 + Math.floor(Math.random() * 4);
        let placed = 0;

        for (let i = 0; i < jumlah * 10 && placed < jumlah; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.sqrt(Math.random()) * 0.82;
            const x = this.ovalCX + r * this.ovalRX * Math.cos(angle);
            const y = this.ovalCY + r * this.ovalRY * Math.sin(angle);
            const radius = 9 + Math.random() * 4;

            if (!this._canPlaceAsset(x, y, radius, 12)) continue;

            this.decorations.animals.push({
                x, y, radius,
                angle: Math.random() * Math.PI * 2,
                type: Math.random() < 0.5 ? 'cat' : 'dog',
                colorIdx: Math.floor(Math.random() * theme.animalColors.length),
            });
            this._reserveAsset(x, y, radius + 3);
            placed++;
        }
    }

    _generatePonds(); {
        if (!this.theme.pond?.enabled) return;
        const candidates = this._pondCandidates();
        const targetCount = this.centerKind === 'loop' ? 2 : 1;

        for (const candidate of candidates) {
        if (this.decorations.ponds.length >= targetCount) break;

        const pond = this._createPond(candidate);
        const pondRadius = Math.max(pond.rx, pond.ry) + 8;
        const clearance = Math.max(pond.rx, pond.ry) + 28;
        if (!this._canPlaceAsset(pond.x, pond.y, pondRadius, 4, 10)) continue;

        this.decorations.ponds.push(pond);
        this._reserveAsset(pond.x, pond.y, clearance);
        }
    }

    _pondCandidates(); {
        const centerNodes = this.nodeRows[1] ?? [];
        const center = centerNodes.length > 0
        ? {
            x: centerNodes.reduce((sum, node) => sum + node.x, 0) / centerNodes.length,
            y: centerNodes.reduce((sum, node) => sum + node.y, 0) / centerNodes.length,
            }
        : { x: this.ovalCX, y: this.ovalCY };

        const toWorld = (nx, ny) => this._toOvalPoint(nx, ny);
        const openPockets = [
        [-0.48, -0.26], [-0.36, -0.40], [0.00, -0.44], [0.36, -0.40], [0.48, -0.26],
        [-0.50,  0.24], [-0.34,  0.42], [0.00,  0.44], [0.34,  0.42], [0.50,  0.24],
        [-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18],
        ]
        .map(([nx, ny]) => {
            const point = toWorld(nx * this.layoutMirror, ny);
            const roadClearance = this._distanceToNearestRoad(point.x, point.y) - this.theme.roadWidth / 2 - 8;
            const nodeClearance = this._distanceToNearestNode(point.x, point.y) - this.theme.nodeRadius - 8;
            const score = Math.min(roadClearance, nodeClearance);
            const rx = this._clamp(score - 16, 19, 30);
            return {
            ...point,
            rx,
            ry: this._clamp(rx * 0.68, 16, 22),
            rot: 0,
            scale: this._clamp(rx / 31, 0.72, 0.94),
            score,
            };
        })
        .filter(candidate => candidate.score > 34)
        .sort((a, b) => b.score - a.score);

        if (this.centerKind === 'loop') {
        return [
            { x: center.x, y: center.y, rx: 34, ry: 23, rot: 0, scale: 1 },
            { ...toWorld(0.36 * this.layoutMirror, -0.34), rx: 28, ry: 20, rot: 0, scale: 0.82 },
            { ...toWorld(-0.36 * this.layoutMirror, 0.34), rx: 28, ry: 20, rot: 0, scale: 0.82 },
            ...openPockets,
        ];
        }

        if (this.centerKind === 'median') {
            return [
                { ...toWorld(-0.34 * this.layoutMirror, -0.32), rx: 30, ry: 21, rot: 0, scale: 0.88 },
                { ...toWorld(0.34 * this.layoutMirror, 0.32), rx: 30, ry: 21, rot: 0, scale: 0.88 },
                { x: center.x, y: center.y - this.ovalRY * 0.28, rx: 26, ry: 19, rot: 0, scale: 0.78 },
                ...openPockets,
            ];
        }

        return [
            { ...toWorld(-0.34 * this.layoutMirror, -0.30), rx: 29, ry: 21, rot: 0, scale: 0.84 },
            { ...toWorld(0.34 * this.layoutMirror, 0.30), rx: 29, ry: 21, rot: 0, scale: 0.84 },
            { ...toWorld(-0.36 * this.layoutMirror, 0.28), rx: 27, ry: 19, rot: 0, scale: 0.78 },
            ...openPockets,
        ];
    }    

    _createPond(candidate); {
        const rx = candidate.rx + Math.random() * 4;
        const ry = candidate.ry + Math.random() * 3;
        return {
        x: candidate.x,
        y: candidate.y,
        rx,
        ry,
        rot: candidate.rot ?? 0,
        accessories: this._pondAccessories(rx, ry, candidate.scale ?? 1),
        };
    }

    _pondAccessories(rx, ry, scale = 1); {
            const bushes = [-150, -108, -54, 44, 96, 148].map((deg, index) => ({
            type: 'bush',
            angle: deg * Math.PI / 180,
            distance: 1.00 + (index % 2) * 0.08,
            size: (6.2 + (index % 3) * 1.2) * scale,
        }));

        const benches = [-25, 205].map((deg) => ({
            type: 'bench',
            angle: deg * Math.PI / 180,
            distance: 1.16,
            w: 18 * scale,
            h: 7 * scale,
        }));

        return [...bushes, ...benches].map(item => ({
            ...item,
            x: Math.cos(item.angle) * rx * item.distance,
            y: Math.sin(item.angle) * ry * item.distance,
        }));
    }

      // Utilitas geometri dan collision detection.
    _edgeCrossesExisting(a, b); {
        for (const edge of this.graph.edges) {
        if (edge.nodeA.id === a.id || edge.nodeB.id === a.id) continue;
        if (edge.nodeA.id === b.id || edge.nodeB.id === b.id) continue;
        if (this._segmentsIntersect(
            a.x, a.y, b.x, b.y,
            edge.nodeA.x, edge.nodeA.y, edge.nodeB.x, edge.nodeB.y
        )) return true;
        }
        return false;
    }

    _segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy); {
        const eps  = 0.01;
        const d1x  = bx-ax, d1y = by-ay;
        const d2x  = dx-cx, d2y = dy-cy;
        const cross = d1x*d2y - d1y*d2x;
        if (Math.abs(cross) < 1e-10) return false;
        const t = ((cx-ax)*d2y - (cy-ay)*d2x) / cross;
        const u = ((cx-ax)*d1y - (cy-ay)*d1x) / cross;
        return t > eps && t < 1-eps && u > eps && u < 1-eps;
    }

    _hasRoadCollision(); {
        return this._getRoadCollisionPairs().length > 0;
    }

    _isRoadNetworkClean(); {
        return this.graph.isConnected() &&
        !this._hasDanglingRoads() &&
        this._connectorAccessCount() >= 3 &&
        !this._hasRoadCollision() &&
        !this._hasRoadOverlap();
    }

    _hasDanglingRoads(); {
        return this.graph.nodes.some(node => this.graph.getNeighbors(node.id).length < 2);
    }

    _connectorAccessCount(); {
        return this.graph.edges.filter(edge => edge.roadKind === 'connector').length;
    }

    _hasRoadOverlap(); {
        const samples = new Map(this.graph.edges.map(edge => [edge.id, this._sampleEdge(edge)]));
        const minClearance = this.theme.roadWidth * 0.86;

        for (let i = 0; i < this.graph.edges.length; i++) {
            for (let j = i + 1; j < this.graph.edges.length; j++) {
                const a = this.graph.edges[i];
                const b = this.graph.edges[j];
                if (this._edgesShareNode(a, b)) continue;

                const distance = this._polylineDistance(samples.get(a.id), samples.get(b.id));
                if (distance < minClearance) return true;
            }
        }
        return false;
    }

    _layoutSignature(); {
        const edgeSig = this.graph.edges
        .map(edge => `${edge.roadKind}:${Math.min(edge.nodeA.id, edge.nodeB.id)}-${Math.max(edge.nodeA.id, edge.nodeB.id)}`)
        .sort()
        .join('|');
        return `${this.roadProfile?.id ?? this.centerKind}:${this.uTurnSide}:${edgeSig}`;
    }

    _getRoadCollisionPairs(); {
        const pairs = [];
        const samples = new Map(this.graph.edges.map(edge => [edge.id, this._sampleEdge(edge)]));

        for (let i = 0; i < this.graph.edges.length; i++) {
            for (let j = i + 1; j < this.graph.edges.length; j++) {
                const a = this.graph.edges[i];
                const b = this.graph.edges[j];
                if (this._edgesShareNode(a, b)) continue;

                if (this._polylinesIntersect(samples.get(a.id), samples.get(b.id))) {
                pairs.push([a, b]);
                }
            }
        }
        return pairs;
    }

    _sampleEdge(edge, steps = 18); {
        const points = [];
        for (let i = 0; i <= steps; i++) {
            points.push(edge.getPointAtT(i / steps));
        }
        return points;
    }

    _polylinesIntersect(aPoints, bPoints); {
        for (let i = 0; i < aPoints.length - 1; i++) {
            const a1 = aPoints[i], a2 = aPoints[i + 1];
            for (let j = 0; j < bPoints.length - 1; j++) {
                const b1 = bPoints[j], b2 = bPoints[j + 1];
                if (this._segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) {
                    return true;
                }
            }
        }
        return false;
    }

    _polylineDistance(aPoints, bPoints); {
        let min = Infinity;
        for (let i = 0; i < aPoints.length - 1; i++) {
            const a1 = aPoints[i], a2 = aPoints[i + 1];
            for (let j = 0; j < bPoints.length - 1; j++) {
                const b1 = bPoints[j], b2 = bPoints[j + 1];
                min = Math.min(min, this._segmentDistance(a1, a2, b1, b2));
                if (min <= 0) return 0;
            }
        }
        return min;
    }

    _segmentDistance(a1, a2, b1, b2); {
        if (this._segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) return 0;
        return Math.min(
            this._pointSegmentDistance(a1, b1, b2),
            this._pointSegmentDistance(a2, b1, b2),
            this._pointSegmentDistance(b1, a1, a2),
            this._pointSegmentDistance(b2, a1, a2)
        );
    }

    _pointSegmentDistance(point, a, b); {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((point.x - a.x) ** 2 + (point.y - a.y) ** 2);

        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        return Math.sqrt((point.x - px) ** 2 + (point.y - py) ** 2);
    }

    _edgesShareNode(a, b); {
        return a.nodeA.id === b.nodeA.id ||
        a.nodeA.id === b.nodeB.id ||
        a.nodeB.id === b.nodeA.id ||
        a.nodeB.id === b.nodeB.id;
    }

    _straightenProblemRoads(); {
        const priority = {
            diagonal: 5,
            connector: 4,
            uTurnStem: 3,
            uTurnBulb: 2,
            centerIntersection: 2,
            medianRoad: 2,
            parkLoop: 1,
            outerLoop: 0,
        };

        for (let guard = 0; guard < 20; guard++) {
            const pairs = this._getRoadCollisionPairs();
            if (pairs.length === 0) return;

            let removed = false;
            for (const pair of pairs) {
                const candidates = pair
                .slice()
                .sort((a, b) => (priority[b.roadKind] ?? 1) - (priority[a.roadKind] ?? 1));

                for (const edge of candidates) {
                if ((priority[edge.roadKind] ?? 0) <= 1) continue;
                if (this._removeEdgeIfSafe(edge)) {
                    removed = true;
                    break;
                }
                }
                if (removed) break;
            }

            if (!removed) {
                for (const [a, b] of pairs) {
                    a.controlPoint = this._midPointControl(a);
                    b.controlPoint = this._midPointControl(b);
                    a.weight = Math.round(a.getLength());
                    b.weight = Math.round(b.getLength());
                }
                return;
            }
        }
    }

    _removeEdgeIfSafe(edgeToRemove); {
        const nextEdges = this.graph.edges.filter(edge => edge.id !== edgeToRemove.id);
        if (nextEdges.length < this.graph.nodes.length) return false;

        const oldEdges = this.graph.edges;
        const oldAdj = this.graph._adjacency;
        this.graph.edges = nextEdges;
        this.graph._adjacency = new Map(this.graph.nodes.map(node => [node.id, []]));
        for (const edge of nextEdges) {
            this.graph._adjacency.get(edge.nodeA.id).push(edge);
            this.graph._adjacency.get(edge.nodeB.id).push(edge);
        }

        const connected = this.graph.isConnected();
        const minDegreeOk = this.graph.nodes.every(node => this.graph.getNeighbors(node.id).length >= 2);
        if (connected && minDegreeOk) return true;

        this.graph.edges = oldEdges;
        this.graph._adjacency = oldAdj;
        return false;
    }

    _midPointControl(edge); {
        return {
        x: (edge.nodeA.x + edge.nodeB.x) / 2,
        y: (edge.nodeA.y + edge.nodeB.y) / 2,
        };
    }

    _isNearRoad(x, y, minDist); {
        for (const edge of this.graph.edges) {
            for (let t = 0; t <= 1; t += 0.05) {
                const pt = edge.getPointAtT(t);
                const dx = pt.x - x, dy = pt.y - y;
                if (Math.sqrt(dx*dx + dy*dy) < minDist) return true;
            }
        }
        return false;
    }

    _distanceToNearestRoad(x, y); {
        let nearest = Infinity;
        for (const edge of this.graph.edges) {
            for (let t = 0; t <= 1; t += 0.04) {
                const pt = edge.getPointAtT(t);
                const dx = pt.x - x, dy = pt.y - y;
                nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
            }
        }
        return nearest;
    }

    _isNearBuilding(x, y, minDist); {
        for (const b of this.decorations.buildings) {
            const dx = b.x - x, dy = b.y - y;
            if (Math.sqrt(dx*dx + dy*dy) < minDist + (b.radius ?? b.w/2)) return true;
        }
        return false;
    }

    _canPlaceAsset(x, y, radius, roadGap = 8, assetGap = 5); {
        const nx = (x - this.ovalCX) / this.ovalRX;
        const ny = (y - this.ovalCY) / this.ovalRY;
        if (nx * nx + ny * ny > 0.88) return false;

        if (this._isNearRoad(x, y, radius + this.theme.roadWidth / 2 + roadGap)) return false;
        if (this._isNearNode(x, y, radius + this.theme.nodeRadius + 8)) return false;

        for (const asset of this._occupiedAssets ?? []) {
            const dx = asset.x - x;
            const dy = asset.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < asset.r + radius + assetGap) return false;
        }
        return true;
    }

    _reserveAsset(x, y, radius); {
        this._occupiedAssets.push({ x, y, r: radius });
    }

    _isNearNode(x, y, minDist); {
        return this.graph.nodes.some(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) < minDist;
        });
    }

    _distanceToNearestNode(x, y); {
        return this.graph.nodes.reduce((nearest, node) => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
        }, Infinity);
    }
