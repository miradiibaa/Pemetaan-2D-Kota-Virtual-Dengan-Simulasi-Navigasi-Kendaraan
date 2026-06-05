// js/config.js
// Konstanta global, pengaturan kanvas, dan definisi tema visual

const PANEL_TOP   = 68;
const PANEL_RIGHT = 270;

export const CONFIG = {

    canvas: {
        width:  Math.max(700, window.innerWidth  - PANEL_RIGHT),
        height: Math.max(460, window.innerHeight - PANEL_TOP),
    },

    viewport: {
        mapScale: 1.85,
        minMapWidth:  1400,
        minMapHeight: 1050,
    },

    // Oval membatasi area kota di dalam canvas.
    oval: {
        radiusX: 0.41,
        radiusY: 0.40,
    },

    // Parameter pembentukan node, edge, dan dekorasi peta.
    map: {
        nodeCount:        16,
        maxConnectDist:  170,
        minConnectDist:   78,
        maxNeighbors:      4,
        minNeighbors:      2,
        curveIntensity:  0.0,   // jalan dibuat lurus agar tidak saling menimpa
        curveRandomness: 0.0,
        buildingsPerRoad:  4,
    },

    // Delay antar langkah Dijkstra saat divisualisasikan.
    dijkstra: {
        stepDelay:     300,
        fastStepDelay:  50,
    },

    // Pengaturan animasi mobil.
    animation: {
        speed:      1.72,
        fps:         60,
        stopRadius:   8,
        easeType: 'easeInOutQuad',
        vehicleWheelRadius: 3,
        vehicleScale: 1.42,
        turnLookAhead: 0.055,
        turnSmoothness: 0.20,
        turnSlowdown: 0.52,
        followZoom: 2.15,
        followSmoothness: 0.09,
        returnZoomSmoothness: 0.035,
    },

    // Ukuran panel UI yang dipakai untuk menghitung canvas.
    ui: {
        topPanelH:   68,
        rightPanelW: 270,
        padding:      14,
    },
    };

    // Tema visual kota modern.
    export const THEMES = {

    urban: {
        id: 'urban', name: 'Perkotaan', icon: '🏙️',
        bgOuter:     '#40535f',
        bgInner:     '#6d8f62',
        ovalBorder:  '#b7d7a8',
        roadColor:   '#4e5357',
        roadBorder:  '#25282b',
        roadWidth:    17,
        sidewalkColor:'#c4c1b8',
        sidewalkW:     4,
        nodeRadius:    9,
        nodeStroke:   '#2c2f32',
        nodeStrokeW:   2,
        buildings: [
        { fill:'#7c8492', stroke:'#4b5563', minH:44, maxH:74, minW:24, maxW:42, type:'office' },
        { fill:'#b99b76', stroke:'#7f6548', minH:22, maxH:34, minW:26, maxW:44, type:'shop'   },
        { fill:'#d0b26d', stroke:'#8a6d2e', minH:24, maxH:36, minW:34, maxW:54, type:'supermarket' },
        { fill:'#cbb36a', stroke:'#806c32', minH:34, maxH:48, minW:54, maxW:76, type:'mall' },
        { fill:'#c17855', stroke:'#7c4433', minH:24, maxH:36, minW:42, maxW:62, type:'market' },
        { fill:'#8fa6b2', stroke:'#58717f', minH:46, maxH:78, minW:20, maxW:36, type:'tower'  },
        { fill:'#c4a889', stroke:'#7f6552', minH:22, maxH:36, minW:24, maxW:38, type:'residential' },
        { fill:'#a98f9b', stroke:'#765b68', minH:34, maxH:56, minW:22, maxW:38, type:'apt'    },
        ],
        buildingDensity: 0.94,
        pond: {
        enabled: true,
        fill:    '#4d8ca8',
        stroke:  '#2f657b',
        shimmer: 'rgba(190,235,255,0.32)',
        },
        treeColors:  ['#265f3a','#347447','#446f35','#5c7a3c'],
        plantColors: ['#6aa84f','#8fbf61','#d4c96a','#d98b51','#c96678'],
        animalColors:['#f2d19b','#d7d7d7','#8f6b4a','#ffffff'],
        treeDensity:  0.34,
        treeRadius:  { min:7, max:11 },
        vehicleColor:'#FF69B4',
        vehicleSize:  8,
        stateColors: {
        unvisited:'#FFDD00', inQueue:'#FF8800', visited:'#4499FF',
        path:'#FF3333', start:'#00DD44', end:'#FF0055',
        },
        edgeColors: { normal:null, considering:'#FFAA00', path:'#FF3333' },
    },
};

export const THEME_ORDER = ['urban'];