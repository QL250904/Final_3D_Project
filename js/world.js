import * as THREE from 'three';
import { CONFIG } from './config.js';
import { state } from './state.js';

export function setupEnvironment() {
    // 1. Load Background
    const loader = new THREE.TextureLoader();
    const bgTexture = loader.load('https://i.imgur.com/854ginr.png'); 
    bgTexture.wrapS = THREE.RepeatWrapping;
    bgTexture.wrapT = THREE.RepeatWrapping;
    bgTexture.repeat.set(CONFIG.ARENA_SIZE / 50, CONFIG.ARENA_SIZE / 50); 
    state.scene.background = bgTexture;

    // 2. Setup Fog
    const fogColor = new THREE.Color(0x111111); 
    state.scene.fog = new THREE.FogExp2(fogColor, CONFIG.FOG_DENSITY);

    // 3. Setup Lights
    state.scene.add(new THREE.AmbientLight(0x222222)); 
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    state.scene.add(dirLight);

    // 4. Floor Plane (Invisible) for Raycasting
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshBasicMaterial({visible:false}));
    plane.rotation.x = -Math.PI/2;
    state.scene.add(plane);

    // 5. Particles
    const pc = 4000;
    const pos = new Float32Array(pc*3);
    for(let i=0; i<pc*3; i++) pos[i] = (Math.random()-0.5)*CONFIG.ARENA_SIZE*2.5;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ size: 2, color: 0x00ffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
    state.envObjects.particles = new THREE.Points(pGeo, pMat);
    state.scene.add(state.envObjects.particles);

    // 6. Pillars
    const pillarGeo = new THREE.BoxGeometry(10, 200, 10);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x00aaaa, emissive: 0x00ffff, emissiveIntensity: 1.5 });
    const pPos = CONFIG.ARENA_SIZE/2;
    [[pPos,pPos], [-pPos,pPos], [pPos,-pPos], [-pPos,-pPos]].forEach(c => {
        const m = new THREE.Mesh(pillarGeo, pillarMat);
        m.position.set(c[0], 100, c[1]);
        state.scene.add(m);
        state.envObjects.pillars.push(m);
    });

    return plane; // Return plane for raycaster use
}