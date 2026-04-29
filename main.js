import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.4, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(2, 4, 5);
scene.add(keyLight);

const sphereGeometry = new THREE.SphereGeometry(1, 48, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x3ea6ff, metalness: 0.2, roughness: 0.35 });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(0, 1.2, 0);
scene.add(sphere);

const cubeGeometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xffa24d, metalness: 0.1, roughness: 0.55 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(0, -1.2, 0);
scene.add(cube);

const animate = () => {
    requestAnimationFrame(animate);
    sphere.rotation.y += 0.006;
    cube.rotation.x += 0.004;
    cube.rotation.y += 0.005;
    renderer.render(scene, camera);
};

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});