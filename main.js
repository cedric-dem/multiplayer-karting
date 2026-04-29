import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);

const topCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
topCamera.position.set(0, 12, 14);
topCamera.lookAt(0, 0, 0);

const followCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const followOffset = new THREE.Vector3(0, 3, 6);
const followLookOffset = new THREE.Vector3(0, 1.5, 0);

const cameras = {
    top: topCamera,
    follow: followCamera,
};
let activeCameraKey = 'top';

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
const kartRoot = new THREE.Group();
kartRoot.position.set(0, 8, 0);
scene.add(kartRoot);

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

const gravity = 9.81;
let verticalVelocity = 0;
const kartRadiusXZ = 0.45;
const clock = new THREE.Clock();

const getSupportHeight = (position) => {
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

const animate = () => {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    updateGravity(dt);
    updateFollowCamera();
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
    if (event.key.toLowerCase() === 'c') {
        activeCameraKey = activeCameraKey === 'top' ? 'follow' : 'top';
    }
});
