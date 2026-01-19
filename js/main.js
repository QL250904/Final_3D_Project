import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { CONFIG, SETTINGS } from './config.js';
import { state, updateScore } from './state.js';
import { Snake } from './Snake.js';
import { setupEnvironment } from './world.js';
import { spawnFood, spawnEnemyAI, checkCol } from './logic.js';

let composer, raycaster, mouse, plane;
let bgMusic;

function init() {
    state.scene = new THREE.Scene();
    
    state.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    state.camera.position.set(0, 90, 80);

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.xr.enabled = true;
    document.body.appendChild(state.renderer.domElement);
    document.body.appendChild(VRButton.createButton(state.renderer));

    composer = new EffectComposer(state.renderer);
    composer.addPass(new RenderPass(state.scene, state.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.8, 0.5, 0.9);
    composer.addPass(bloom);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Setup World and get plane for interactions
    plane = setupEnvironment();

    // Events
    window.addEventListener('mousemove', e => {
        mouse.x = (e.clientX/window.innerWidth)*2-1;
        mouse.y = -(e.clientY/window.innerHeight)*2+1;
    });
    window.addEventListener('resize', () => {
        state.camera.aspect = window.innerWidth/window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    // Audio
    const listener = new THREE.AudioListener();
    state.camera.add(listener);
    bgMusic = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('assets/audio/music.mp3', function(buffer) {
        bgMusic.setBuffer(buffer);
        bgMusic.setLoop(true);
        bgMusic.setVolume(0.5);
    });

    state.renderer.setAnimationLoop(render);
}

function startGame() {
    if(!state.scene) return;
    if(state.player) { 
        state.scene.remove(state.player.head); 
        state.player.segments.forEach(s => state.scene.remove(s)); 
    }
    state.enemies.forEach(e => { 
        state.scene.remove(e.head); 
        e.segments.forEach(s => state.scene.remove(s)); 
    });
    
    // Clear Arrays
    state.enemies = []; 
    state.foods.forEach(f=>state.scene.remove(f)); 
    state.foods=[];

    updateScore(0);
    state.isActuallyBoosting = false;

    SETTINGS.color.getHSL(SETTINGS.hsl);
    state.player = new Snake(SETTINGS.hsl, SETTINGS.skin, false);

    state.gameStatus = 'PLAYING';
    for(let i=0; i<CONFIG.AI_COUNT; i++) spawnEnemyAI();
    for(let i=0; i<60; i++) spawnFood();
}

function render() {
    if (state.gameStatus === 'PLAYING' && state.player && state.player.alive) {
        raycaster.setFromCamera(mouse, state.camera);
        const hits = raycaster.intersectObject(plane);
        if (hits.length > 0) {
            const d = hits[0].point.sub(state.player.head.position);
            d.y = 0; d.normalize();
            state.player.targetDir.copy(d);
        }

        state.player.update();
        state.enemies.forEach(e => e.update());
        checkCol();

        if (state.player.alive) {
            const zoom = state.player.snakeScale; 
            
            // --- CAMERA LOGIC ---
            if (state.cameraMode === 'TPP') {
                const t = state.player.head.position.clone();
                t.y = 80 + (zoom * 20); 
                t.z += 60 + (zoom * 15);
                
                if (state.isActuallyBoosting) {
                    t.x += (Math.random() - 0.5) * 1.5;
                    t.z += (Math.random() - 0.5) * 1.5;
                }
                state.camera.position.lerp(t, 0.1);
                state.camera.lookAt(state.player.head.position);
            } 
            else if (state.cameraMode === 'FPP') {
                const headPos = state.player.head.position.clone();
                const forward = state.player.dir.clone().normalize();
                
                const camOffset = forward.multiplyScalar(2.0 * zoom);
                const upOffset = new THREE.Vector3(0, 1.5 * zoom, 0); 
                
                const camPos = headPos.add(camOffset).add(upOffset);
                const lookTarget = camPos.clone().add(state.player.dir.clone().multiplyScalar(50));

                if (state.isActuallyBoosting) {
                    camPos.x += (Math.random() - 0.5) * 0.5;
                    camPos.y += (Math.random() - 0.5) * 0.5;
                }
                state.camera.position.lerp(camPos, 0.2); 
                state.camera.lookAt(lookTarget);
            }
        }

        state.foods.forEach(f => { f.rotation.x+=0.02; f.rotation.y+=0.03; });
        if(state.envObjects.particles) state.envObjects.particles.rotation.y += 0.0005;
    }
    if (state.renderer.xr.isPresenting) state.renderer.render(state.scene, state.camera);
    else composer.render();
}

// --- UI EVENT LISTENERS ---
document.querySelectorAll('.opt-btn').forEach(b => {
    b.addEventListener('click', (e) => {
        const p = e.target.parentElement;
        p.querySelectorAll('.opt-btn').forEach(x => x.classList.remove('selected'));
        e.target.classList.add('selected');
        if (e.target.dataset.skin) SETTINGS.skin = e.target.dataset.skin;
        if (e.target.dataset.theme) {
            document.body.className = `theme-${e.target.dataset.theme}`;
        }
    })
});

document.querySelectorAll('.color-dot').forEach(d => {
    d.addEventListener('click', (e) => {
        document.querySelectorAll('.color-dot').forEach(x => x.classList.remove('selected'));
        e.target.classList.add('selected');
        SETTINGS.color.setHex(parseInt(e.target.dataset.color));
        SETTINGS.color.getHSL(SETTINGS.hsl);
    });
});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    if (bgMusic && !bgMusic.isPlaying && bgMusic.buffer) bgMusic.play();
    startGame();
});

document.getElementById('restart-btn').addEventListener('click', () => location.reload());

const boost = (on) => { state.isBoosting = on; document.getElementById('boost-btn').classList.toggle('active', on); }
const bBtn = document.getElementById('boost-btn');
bBtn.addEventListener('mousedown', ()=>boost(true));
bBtn.addEventListener('mouseup', ()=>boost(false));
bBtn.addEventListener('touchstart', (e)=>{e.preventDefault(); boost(true)});
bBtn.addEventListener('touchend', (e)=>{e.preventDefault(); boost(false)});
window.addEventListener('keydown', e=>{if(e.code==='Space') boost(true)});
window.addEventListener('keyup', e=>{if(e.code==='Space') boost(false)});

const setCameraMode = (mode) => {
    state.cameraMode = mode;
    document.getElementById('btn-tpp').classList.toggle('active', mode === 'TPP');
    document.getElementById('btn-fpp').classList.toggle('active', mode === 'FPP');
};

document.getElementById('btn-tpp').addEventListener('click', () => setCameraMode('TPP'));
document.getElementById('btn-fpp').addEventListener('click', () => setCameraMode('FPP'));

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyV') {
        setCameraMode(state.cameraMode === 'TPP' ? 'FPP' : 'TPP');
    }
});

// Start
init();