import * as THREE from 'three';
import { CONFIG } from './config.js';
import { state, updateScore } from './state.js';
import { spawnFood, spawnEnemyAI } from './logic.js'; // Sẽ tạo file này sau

export class Snake {
    constructor(colorHSL, skinType = 'smooth', isAI = false) {
        this.isAI = isAI;
        this.skinType = skinType;
        this.baseHSL = colorHSL || { h: 0.5, s: 1, l: 0.5 };
        this.alive = true;
        this.speed = CONFIG.SPEED_NORMAL;
        this.dir = new THREE.Vector3(1, 0, 0);
        this.targetDir = new THREE.Vector3(1, 0, 0);

        this.snakeScale = 1.0;
        this.targetScale = 1.0;
        
        // --- AI LOGIC ---
        if (isAI) {
            this.isSmart = Math.random() > 0.7; 
            if (this.isSmart) {
                this.turnSpeed = 0.12; 
                this.avoidDistMult = 1.0; 
            } else {
                this.turnSpeed = 0.06; 
                this.avoidDistMult = 0.4; 
            }
        } else {
            this.turnSpeed = 0.18; 
        }
        this.aiTimer = 0; 

        // --- MATERIAL ---
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(this.baseHSL.h, this.baseHSL.s, this.baseHSL.l),
            emissive: new THREE.Color().setHSL(this.baseHSL.h, this.baseHSL.s, this.baseHSL.l),
            emissiveIntensity: 0.8, roughness: 0.2
        });

        // --- GEOMETRY ---
        let geo;
        if (skinType === 'block') geo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
        else if (skinType === 'spiky') geo = new THREE.OctahedronGeometry(2.5, 0);
        else if (skinType === 'mecha') geo = new THREE.TorusGeometry(1.5, 1, 16, 20);
        else geo = new THREE.IcosahedronGeometry(2.2, 2);

        this.head = new THREE.Mesh(geo, mat);
        if (skinType === 'mecha') this.head.rotation.x = Math.PI/2;
        
        // --- POSITION ---
        const spawnX = (Math.random() - 0.5) * (CONFIG.ARENA_SIZE * 0.8);
        const spawnZ = (Math.random() - 0.5) * (CONFIG.ARENA_SIZE * 0.8);
        this.head.position.set(isAI ? spawnX : 0, 2, isAI ? spawnZ : 0);
        
        if(isAI) {
            const angle = Math.random() * Math.PI * 2;
            this.targetDir.set(Math.cos(angle), 0, Math.sin(angle));
            this.dir.copy(this.targetDir);
        }

        this.addEyes();
        state.scene.add(this.head);

        this.segments = [this.head];
        this.pathHistory = [this.head.position.clone()];
        this.lastRecPos = this.head.position.clone();
        
        const startLen = isAI ? (this.isSmart ? 12 : 5) : 10;
        for(let i=0; i<startLen; i++) this.grow(false);
    }

    addEyes() {
        const eyeGroup = new THREE.Group();
        const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        const createEyeball = () => {
            const g = new THREE.Group();
            const white = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12).scale(1, 0.85, 0.7), whiteMat);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8).scale(1, 0.85, 0.7), blackMat);
            pupil.position.z = 0.4;
            g.add(white, pupil);
            return g;
        }
        
        const leftEye = createEyeball();
        const rightEye = createEyeball();
        leftEye.position.set(1.3, 0.8, 1.0); rightEye.position.set(-1.3, 0.8, 1.0);
        leftEye.rotation.y = 0.45; rightEye.rotation.y = -0.45;
        eyeGroup.add(leftEye, rightEye);

        if (this.skinType === 'mecha') {
            eyeGroup.position.set(0, 0, 0); eyeGroup.rotation.x = -Math.PI / 2;
            leftEye.position.set(1.2, 1.5, 0); leftEye.rotation.set(0, 0, 0);
            rightEye.position.set(-1.2, 1.5, 0); rightEye.rotation.set(0, 0, 0);
        }
        this.head.add(eyeGroup);
    }

    grow(increaseSize = true) {
        const idx = this.segments.length;
        const hue = (this.baseHSL.h + idx * 0.02) % 1;
        const col = new THREE.Color().setHSL(hue, this.baseHSL.s, this.baseHSL.l * 0.9);
        const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 });

        let geo;
        if (this.skinType === 'block') geo = new THREE.BoxGeometry(2.8,2.8,2.8);
        else if (this.skinType === 'spiky') geo = new THREE.OctahedronGeometry(2,0);
        else if (this.skinType === 'mecha') geo = new THREE.TorusGeometry(1.2, 0.6, 8, 16);
        else geo = new THREE.IcosahedronGeometry(1.8, 1);

        const seg = new THREE.Mesh(geo, mat);
        if (this.skinType === 'mecha') seg.rotation.x = Math.PI/2;
        
        const tail = this.segments[this.segments.length-1];
        seg.position.copy(tail.position);
        state.scene.add(seg);
        this.segments.push(seg);

        if (increaseSize && this.targetScale < 6.0) {
            const growthFactor = 0.015 / (this.targetScale * 1.5);
            this.targetScale += growthFactor; 
        }
    }

    updateAI() {
        let steer = this.dir.clone();

        if (this.isSmart) {
            let target = null;
            let minDist = 500; 
            for (let f of state.foods) {
                const d = this.head.position.distanceTo(f.position);
                if (d < minDist) { minDist = d; target = f.position; }
            }
            const potentialPrey = [state.player, ...state.enemies].filter(e => e && e !== this && e.alive && e.snakeScale < this.snakeScale * 0.95);
            for (let prey of potentialPrey) {
                const d = this.head.position.distanceTo(prey.head.position);
                if (d < minDist * 1.5) { minDist = d; target = prey.head.position; }
            }
            if (target) {
                const toTarget = new THREE.Vector3().subVectors(target, this.head.position).normalize();
                steer.add(toTarget.multiplyScalar(2.5)); 
            }
        } else {
            this.aiTimer -= 0.1;
            if (this.aiTimer <= 0) {
                const angle = (Math.random() - 0.5) * 3; 
                const currentAngle = Math.atan2(this.dir.z, this.dir.x);
                const newAngle = currentAngle + angle;
                const randomDir = new THREE.Vector3(Math.cos(newAngle), 0, Math.sin(newAngle));
                steer.add(randomDir);
                this.aiTimer = Math.random() * 30 + 10;
            }
            if (this.head.position.length() > CONFIG.ARENA_SIZE/2 - 30) {
                const toCenter = this.head.position.clone().negate().normalize();
                steer.add(toCenter.multiplyScalar(1.5));
            }
        }

        // Avoidance
        const avoidVector = new THREE.Vector3();
        const lookAheadDist = 35 * this.snakeScale * this.avoidDistMult; 
        const obstacles = [state.player, ...state.enemies].filter(e => e && e !== this && e.alive);
        
        for (let obs of obstacles) {
            for (let seg of obs.segments) {
                const d = this.head.position.distanceTo(seg.position);
                if (d < lookAheadDist) {
                    const push = new THREE.Vector3().subVectors(this.head.position, seg.position).normalize();
                    const force = (lookAheadDist - d) / lookAheadDist; 
                    avoidVector.add(push.multiplyScalar(force * (this.isSmart ? 8.0 : 1.5)));
                }
            }
        }
        steer.add(avoidVector);

        steer.y = 0; steer.normalize();
        this.targetDir.copy(steer);
    }

    update() {
        if (!this.alive) return;

        // Scale Logic
        if (Math.abs(this.snakeScale - this.targetScale) > 0.001) {
            this.snakeScale += (this.targetScale - this.snakeScale) * 0.1; 
        }

        this.head.scale.setScalar(this.snakeScale);
        this.head.userData.radius = 2.2 * this.snakeScale;

        for(let i=1; i<this.segments.length; i++) {
            const seg = this.segments[i];
            let taper = 1.0; 
            const tailPercentage = i / this.segments.length;
            if (tailPercentage > 0.8) taper = 1.0 - ((tailPercentage - 0.8) * 5 * 0.6); 
            if (taper < 0.4) taper = 0.4;
            const segScale = this.snakeScale * taper;
            seg.scale.setScalar(segScale);
            seg.userData.radius = 2.0 * segScale;
        }

        // Move & Boost Logic
        let targetSpd = CONFIG.SPEED_NORMAL;
        let canBoost = false;

        if (this.isAI) {
            this.updateAI();
        } else {
            if (state.isBoosting && state.score > 0) {
                canBoost = true;
                targetSpd = CONFIG.SPEED_BOOST;
                updateScore(Math.max(0, state.score - 0.3));
                
                if (this.targetScale > 1.0) {
                    this.targetScale -= 0.003; 
                    if (state.score <= 0.5) this.targetScale = 1.0; 
                    if (this.targetScale < 1.0) this.targetScale = 1.0;
                }
            }
            state.isActuallyBoosting = canBoost;
        }
        
        this.speed += (targetSpd - this.speed) * 0.1;

        const tSpeed = this.isAI ? this.turnSpeed : (canBoost ? 0.1 : 0.18); 
        this.dir.lerp(this.targetDir, tSpeed).normalize();
        
        this.head.position.addScaledVector(this.dir, this.speed);
        this.head.lookAt(this.head.position.clone().add(this.dir));
        this.head.position.y = 2 * this.snakeScale; 

        // History Path
        let dist = this.head.position.distanceTo(this.lastRecPos);
        while (dist >= CONFIG.HISTORY_STEP) {
            const dir = new THREE.Vector3().subVectors(this.head.position, this.lastRecPos).normalize();
            const pt = this.lastRecPos.clone().addScaledVector(dir, CONFIG.HISTORY_STEP);
            this.pathHistory.unshift(pt);
            this.lastRecPos.copy(pt);
            dist -= CONFIG.HISTORY_STEP;
        }
        
        const neededHist = this.segments.length * Math.ceil(CONFIG.SEGMENT_INDEX_GAP * this.snakeScale) + 50;
        if (this.pathHistory.length > neededHist) this.pathHistory.length = neededHist;

        const dynamicGap = Math.ceil(CONFIG.SEGMENT_INDEX_GAP * this.snakeScale * 0.7); 
        for (let i=1; i<this.segments.length; i++) {
            const idx = i * dynamicGap;
            if (this.pathHistory[idx]) {
                this.segments[i].position.copy(this.pathHistory[idx]);
                this.segments[i].position.y = 2 * this.segments[i].scale.y; 
                if (this.skinType !== 'smooth') {
                    const look = (i===1) ? this.head.position : this.segments[i-1].position;
                    this.segments[i].lookAt(look);
                    if (this.skinType === 'mecha') this.segments[i].rotation.x += Math.PI/2;
                }
            }
        }

        // Arena Limit
        const lim = CONFIG.ARENA_SIZE/2;
        if (Math.abs(this.head.position.x) > lim || Math.abs(this.head.position.z) > lim) {
             this.targetDir.copy(this.head.position).negate().normalize();
             this.dir.lerp(this.targetDir, 0.5);
             this.head.position.clampScalar(-lim, lim);
        }

        // Emissive Effect
        const targetIntensity = (canBoost && !this.isAI) ? 2.5 : 0.6; 
        this.segments.forEach(mesh => {
            if (mesh.material) {
                mesh.material.emissive.copy(mesh.material.color);
                const currentIntensity = mesh.material.emissiveIntensity || 0.6;
                mesh.material.emissiveIntensity = THREE.MathUtils.lerp(currentIntensity, targetIntensity, 0.1);
            }
        });
    }

    die() {
        this.alive = false;
        const deadColor = this.head.material.color.clone(); 
        for (let i=0; i<this.segments.length; i++) {
            spawnFood(this.segments[i].position, 3, deadColor);
        }
        this.segments.forEach(s => state.scene.remove(s));
        
        if (!this.isAI) {
            state.gameStatus = 'GAMEOVER';
            document.getElementById('gameover').style.display = 'flex';
            document.getElementById('game-ui').style.display = 'none';
            document.getElementById('finalScore').innerText = "Energy Collected: " + Math.floor(state.score);
        } else {
            const idx = state.enemies.indexOf(this);
            if (idx > -1) state.enemies.splice(idx, 1);
            if(state.gameStatus ==='PLAYING') setTimeout(() => spawnEnemyAI(), 1500);
        }
    }
}