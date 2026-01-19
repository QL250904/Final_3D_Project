import * as THREE from 'three';

export const CONFIG = {
    ARENA_SIZE: 600,
    HISTORY_STEP: 0.5,
    SEGMENT_INDEX_GAP: 5,
    SPEED_NORMAL: 0.55,
    SPEED_BOOST: 1.3,
    FOG_DENSITY: 0.0008,
    AI_COUNT: 15
};

export const SETTINGS = {
    color: new THREE.Color(0x00ffff),
    hsl: { h: 0.5, s: 1, l: 0.5 },
    skin: 'smooth'
};