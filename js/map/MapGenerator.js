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

    // Menjamin graf connected dan setiap node punya minimal dua koneksi.
    _fixConnectivity() {
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

        _generateControlPoints() {
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
