import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);

const topCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
topCamera.position.set(0, 12, 14);
topCamera.lookAt(0, 0, 0);

const followCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const followOffset = new THREE.Vector3(0, 3, -6);
const followLookOffset = new THREE.Vector3(0, 1.5, 0);

const cameras = {
    top: topCamera,
    follow: followCamera,
};
let activeCameraKey = 'follow';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(8, 12, 6);
scene.add(keyLight);

const loader = new GLTFLoader();
const use_file_race_track = true;
const trackCollisionMeshes = [];
const downRay = new THREE.Raycaster();
const moveRay = new THREE.Raycaster();
const probeStart = new THREE.Vector3();
const probeDirection = new THREE.Vector3();
const kartRoot = new THREE.Group();
kartRoot.position.set(102, 25, 113);
// x=102.49, y=17.88, z=113.71
scene.add(kartRoot);

const log_pos = false
var positionLogAccumulator = 0

loader.load('models/go_kart.glb', (gltf) => {
    const kart = gltf.scene;
    kart.scale.setScalar(0.01);
    kartRoot.add(kart);
});

const gridSize = 19;
const cube_size = 0.5;
const offset = ((gridSize - 1) * cube_size) / 2;
const cubeGeometry = new THREE.BoxGeometry(cube_size, cube_size, cube_size);
const obstacles = [];

if (use_file_race_track) {
    loader.load('models/free_1992_spa_francorchamps.glb', (gltf) => {
        const raceTrack = gltf.scene;
        raceTrack.position.set(0, 0, 0);
        raceTrack.scale.setScalar(0.1);
        scene.add(raceTrack);

        raceTrack.updateMatrixWorld(true);
        raceTrack.traverse((child) => {
            if (!child.isMesh) {
                return;
            }

            const worldGeometry = child.geometry.clone();
            worldGeometry.applyMatrix4(child.matrixWorld);
            const worldMesh = new THREE.Mesh(worldGeometry);
            worldMesh.geometry.computeBoundingBox();

            trackCollisionMeshes.push(worldMesh);
        });
    });
} else {
    for (let z = 0; z < gridSize; z += 1) {
        for (let x = 0; x < gridSize; x += 1) {
            const hue = ((z * gridSize) + x) / (gridSize * gridSize);
            const color = new THREE.Color().setHSL(hue, 0.85, 0.55);
            const cubeMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.7 });
            const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
            cube.position.set((x * cube_size) - offset, -0.5, (z * cube_size) - offset);
            scene.add(cube);
            obstacles.push(cube);
        }
    }
}

const gravity = 9.81;
let verticalVelocity = 0;
const kartRadiusXZ = 0.45;
const clock = new THREE.Clock();

const controls = {
    up: false,
    down: false,
    left: false,
    right: false,
};

let godModeEnabled = false;
const godModeSpeed = 8;

let forwardSpeed = 0;
const maxForwardSpeed = 8;
const acceleration = 10;
const braking = 14;
const rollingDeceleration = 3;
const turnSpeed = Math.PI * 1.4;

const getSupportHeight = (position) => {
    if (trackCollisionMeshes.length > 0) {
        probeStart.set(position.x, position.y + 20, position.z);
        downRay.set(probeStart, new THREE.Vector3(0, -1, 0));
        const hits = downRay.intersectObjects(trackCollisionMeshes, false);
        if (hits.length > 0) {
            return hits[0].point.y;
        }
    }

    let supportHeight = -Infinity;

    obstacles.forEach((obstacle) => {
        const halfWidth = obstacle.scale.x * 0.5;
        const halfDepth = obstacle.scale.z * 0.5;

        const isWithinX = Math.abs(position.x - obstacle.position.x) <= (halfWidth + kartRadiusXZ);
        const isWithinZ = Math.abs(position.z - obstacle.position.z) <= (halfDepth + kartRadiusXZ);

        if (isWithinX && isWithinZ) {
            const obstacleTop = obstacle.position.y + (obstacle.scale.y * 0.5);
            supportHeight = Math.max(supportHeight, obstacleTop);
        }
    });

    return supportHeight;
};

const canMoveTo = (nextPosition) => {
    if (trackCollisionMeshes.length === 0) {
        return true;
    }

    probeDirection.subVectors(nextPosition, kartRoot.position);
    const distance = probeDirection.length();
    if (distance <= 0.0001) {
        return true;
    }

    probeDirection.normalize();
    probeStart.copy(kartRoot.position);
    probeStart.y += 0.45;

    moveRay.set(probeStart, probeDirection);
    moveRay.far = distance + kartRadiusXZ;

    const hits = moveRay.intersectObjects(trackCollisionMeshes, false);
    if (hits.length === 0) {
        return true;
    }

    for (const hit of hits) {
        if (Math.abs(hit.face.normal.y) < 0.4) {
            return false;
        }
    }

    return true;
};

const updateGravity = (dt) => {
    verticalVelocity -= gravity * dt;
    kartRoot.position.y += verticalVelocity * dt;

    const supportHeight = getSupportHeight(kartRoot.position);
    if (supportHeight !== -Infinity && kartRoot.position.y <= supportHeight) {
        kartRoot.position.y = supportHeight;
        verticalVelocity = 0;
    }
};

const updateFollowCamera = () => {
    const worldOffset = followOffset.clone().applyQuaternion(kartRoot.quaternion);
    followCamera.position.copy(kartRoot.position).add(worldOffset);

    const lookTarget = kartRoot.position.clone().add(followLookOffset);
    followCamera.lookAt(lookTarget);
};

const updateControls = (dt) => {
    if (godModeEnabled) {
        const forwardInput = (controls.up ? 1 : 0) - (controls.down ? 1 : 0);
        const strafeInput = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);

        if (forwardInput !== 0) {
            kartRoot.translateZ(forwardInput * godModeSpeed * dt);
        }
        if (strafeInput !== 0) {
            kartRoot.translateX(strafeInput * godModeSpeed * dt);
        }

        // Keep movement locked to horizontal plane while in god mode.
        kartRoot.position.y = Math.max(kartRoot.position.y, getSupportHeight(kartRoot.position));
        return;
    }

    if (controls.up) {
        forwardSpeed = Math.min(maxForwardSpeed, forwardSpeed + (acceleration * dt));
    } else if (controls.down) {
        forwardSpeed = Math.max(0, forwardSpeed - (braking * dt));
    } else {
        forwardSpeed = Math.max(0, forwardSpeed - (rollingDeceleration * dt));
    }

    const turnInput = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);
    if (turnInput !== 0 && forwardSpeed > 0) {
        const speedRatio = forwardSpeed / maxForwardSpeed;
        kartRoot.rotation.y += turnInput * turnSpeed * dt * speedRatio;
    }

    const attemptedMove = new THREE.Vector3(0, 0, forwardSpeed * dt).applyQuaternion(kartRoot.quaternion);
    const nextPosition = kartRoot.position.clone().add(attemptedMove);
    if (canMoveTo(nextPosition)) {
        kartRoot.position.copy(nextPosition);
    } else {
        forwardSpeed = 0;
    }
};

const animate = () => {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    positionLogAccumulator += dt;
    updateControls(dt);
    if (!godModeEnabled) {
        updateGravity(dt);
    }
    updateFollowCamera();
    if (log_pos && positionLogAccumulator >= 1) {
        const { x, y, z } = kartRoot.position;
        console.log(`Kart position: x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}`);
        positionLogAccumulator = 0;
    }
    renderer.render(scene, cameras[activeCameraKey]);
};


animate();

window.addEventListener('resize', () => {
    Object.values(cameras).forEach((camera) => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    if (key === 'c') {
        activeCameraKey = activeCameraKey === 'top' ? 'follow' : 'top';
        return;
    }
    if (key === 'v') {
        godModeEnabled = !godModeEnabled;
        forwardSpeed = 0;
        verticalVelocity = 0;
        return;
    }

    if (key === 'arrowup') {
        controls.up = true;
    } else if (key === 'arrowdown') {
        controls.down = true;
    } else if (key === 'arrowleft') {
        controls.left = true;
    } else if (key === 'arrowright') {
        controls.right = true;
    }
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();

    if (key === 'arrowup') {
        controls.up = false;
    } else if (key === 'arrowdown') {
        controls.down = false;
    } else if (key === 'arrowleft') {
        controls.left = false;
    } else if (key === 'arrowright') {
        controls.right = false;
    }
});
