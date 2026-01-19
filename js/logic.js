import * as THREE from 'three';
import { CONFIG } from './config.js';
import { state, updateScore } from './state.js';
import { Snake } from './Snake.js';

export function spawnEnemyAI() {
    if (state.gameStatus !== 'PLAYING') return;
    if (state.enemies.length >= CONFIG.AI_COUNT) return;

    const skins = ['smooth', 'block', 'spiky', 'mecha'];
    const randSkin = skins[Math.floor(Math.random()*skins.length)];
    const randHsl = { h: Math.random(), s: 0.8, l: 0.5 };
    const enemy = new Snake(randHsl, randSkin, true);
    state.enemies.push(enemy);
}

export function spawnFood(pos, val=1, color=null) {
    let geo, mat;

    if (color) {
        geo = new THREE.SphereGeometry(val * 0.35, 8, 8); 
        mat = new THREE.MeshStandardMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            roughness: 0.0
        });
    } else {
        const size = (val===1) ? 1.2 : (val * 0.4);
        geo = new THREE.TetrahedronGeometry(size);
        mat = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
            emissiveIntensity: 0.7 
        });
        mat.emissive = mat.color;
    }

    const f = new THREE.Mesh(geo, mat);
    if (pos) {
        f.position.copy(pos); f.position.x += (Math.random()-0.5)*5; f.position.z += (Math.random()-0.5)*5;
    } else {
        f.position.set((Math.random()-0.5)*CONFIG.ARENA_SIZE, 2, (Math.random()-0.5)*CONFIG.ARENA_SIZE);
    }
    f.userData = { val: val };
    state.scene.add(f); 
    state.foods.push(f);
}

export function checkCol() {
    if(!state.player || !state.player.alive) return;
    const all = [state.player, ...state.enemies.filter(e=>e.alive)];

    // 1. Eat Food
    for(let i=state.foods.length-1; i>=0; i--) {
        const eatRange = 6 * state.player.snakeScale;
        
        const distP = state.player.head.position.distanceTo(state.foods[i].position);
        if (distP < eatRange) {
            state.player.grow(true);
            updateScore(state.score + 10 * state.foods[i].userData.val);
            state.scene.remove(state.foods[i]); 
            state.foods.splice(i,1); 
            spawnFood();
            continue;
        }

        for(let e of state.enemies) {
            if(!e.alive) continue;
            const distE = e.head.position.distanceTo(state.foods[i].position);
            if (distE < eatRange * e.snakeScale) {
                 e.grow(true);
                 state.scene.remove(state.foods[i]); 
                 state.foods.splice(i,1); 
                 spawnFood();
                 break; 
            }
        }
    }

    // 2. Collision
    for(let s1 of all) {
        if (!s1.alive) continue;
        for(let s2 of all) {
            if (s1 === s2 || !s2.alive) continue;
            
            const head1 = s1.head.position;
            const r1 = (s1.head.userData.radius || 2.2); 

            // A. Body Crash
            let crashed = false;
            for (let seg of s2.segments) {
                if (seg === s2.head) continue;
                const dist = head1.distanceTo(seg.position);
                const r2 = (seg.userData.radius || 2);
                if (dist < (r1 + r2) * 0.8) {
                    s1.die();
                    crashed = true;
                    break;
                }
            }
            if(crashed || !s1.alive) continue;

            // B. Head to Head
            const head2 = s2.head.position;
            if (head1.distanceTo(head2) < (r1 + (s2.head.userData.radius||2.2)) * 0.9) {
                if (s1 === state.player) {
                    if (s2.snakeScale > s1.snakeScale * 1.5) s1.die();
                    else s2.die(); 
                } 
                else if (s2 === state.player) {
                    if (s1.snakeScale > s2.snakeScale * 1.5) s2.die();
                    else s1.die();
                }
                else {
                    if (s1.snakeScale < s2.snakeScale * 0.95) s1.die();
                    else if (s2.snakeScale < s1.snakeScale * 0.95) s2.die();
                    else { s1.die(); s2.die(); }
                }
            }
        }
    }
}