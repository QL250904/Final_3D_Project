// Quản lý trạng thái game
export const state = {
    scene: null,
    camera: null,
    renderer: null,
    player: null,
    enemies: [],
    foods: [],
    score: 0,
    gameStatus: 'MENU',
    isBoosting: false,
    isActuallyBoosting: false,
    cameraMode: 'TPP', // TPP or FPP
    envObjects: { particles: null, pillars: [] }
};

export function updateScore(val) {
    state.score = val;
    const el = document.getElementById('score-val');
    if(el) el.innerText = Math.floor(state.score);
}