// Sandbox da Dona Gansa (luz noturna da fase 3: luar azulado + lanternas quentes). Parâmetros:
//   action=idle|walk|alert|honk|charge|curious|flap   speed=<m/s>  turn=<rad/s>  move=1 (anda de verdade)
//   sim=<s> (simula com dt fixo e congela)   view=34|side|front|back|top|face|hero   yaw=<graus>
//   lineup=1 (uma gansa por ação, lado a lado)   honk=<s> (grasna no instante s)   look=1 (olha a câmera)
//   day=1 (luz de dia)   dogs=1 (Rhaenyra ao lado para comparar escala)
import * as THREE from 'three';
import { createGoose } from '../src/characters/goose.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const view = q.get('view') || '34';
const action = q.get('action') || 'idle';
const speed = num('speed', 0);
const turn = num('turn', 0);
const move = q.get('move') === '1';
const sim = q.has('sim') ? num('sim', 0) : null;
const lineup = q.get('lineup') === '1';
const honkAt = q.has('honk') ? num('honk', 0) : null;
const look = q.get('look') === '1';
const day = q.get('day') === '1';
const yawDeg = num('yaw', 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = day ? 1.0 : 1.15;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const bg = day ? '#e9c7a0' : '#141c33';
scene.background = new THREE.Color(bg);
scene.fog = new THREE.Fog(bg, 6, 22);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.02, 100);

const moonDir = new THREE.Vector3(-0.5, 0.75, 0.45).normalize();
scene.add(new THREE.HemisphereLight(day ? '#bcd3f0' : '#5d6f9e', day ? '#7a6a40' : '#1d2230', day ? 1.05 : 0.7));
const moon = new THREE.DirectionalLight(day ? '#fff1d8' : '#a9bcff', day ? 2.6 : 1.25);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 1, far: 30 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.02;
scene.add(moon, moon.target);
if (!day) {
  for (const [x, z] of [[1.6, 1.2], [-1.8, -0.9]]) {
    const l = new THREE.PointLight('#ffb067', 1.8, 5, 1.6);
    l.position.set(x, 0.75, z);
    scene.add(l);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd29a' }));
    bulb.position.copy(l.position);
    scene.add(bulb);
  }
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#56702f';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.strokeStyle = `hsl(${75 + Math.random() * 30}, ${30 + Math.random() * 25}%, ${24 + Math.random() * 26}%)`;
    g.lineWidth = 1 + Math.random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 6);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);

const ACTIONS = ['idle', 'walk', 'alert', 'honk', 'charge', 'curious', 'flap'];
const list = lineup ? ACTIONS : [action];
const t0 = performance.now();
const geese = list.map((a, i) => {
  const g = createGoose();
  g.action = a;
  g.object.position.x = lineup ? (i - (list.length - 1) / 2) * 0.62 : 0;
  g.object.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  scene.add(g.object);
  return g;
});
const genMs = performance.now() - t0;
if (q.get('dogs') === '1') {
  const { createDog } = await import('../src/dogs/dog.js');
  const d = createDog('rhaenyra');
  d.object.position.set(0.55, 0, 0.1);
  scene.add(d.object);
  geese.dog = d;
}

const target = new THREE.Vector3();
function placeCamera() {
  const k = lineup ? 3.1 : 1;
  const c = new THREE.Vector3();
  geese.forEach((g) => c.add(g.object.position));
  c.divideScalar(geese.length);
  let pos, lk;
  switch (view) {
    case 'side': pos = [1.6 * k, 0.4, 0.0]; lk = [0, 0.3, 0]; break;
    case 'front': pos = [0, 0.42, 1.7 * k]; lk = [0, 0.3, 0]; break;
    case 'back': pos = [0.5, 0.7, -1.6 * k]; lk = [0, 0.3, 0]; break;
    case 'top': pos = [0, 2.4 * k, 0.01]; lk = [0, 0, 0]; break;
    case 'face': pos = [0.28, 0.56, 0.62]; lk = [0, 0.48, 0.17]; break;
    case 'hero': pos = [0.6 * k, 0.32, 1.35 * k]; lk = [0, 0.32, 0]; break;
    default: pos = [1.05 * k, 0.62, 1.2 * k]; lk = [0, 0.3, 0];
  }
  if (lineup && view !== 'side') { pos[0] *= 0.25; }
  camera.position.copy(c).add(new THREE.Vector3(...pos));
  target.copy(c).add(new THREE.Vector3(...lk));
  camera.lookAt(target);
  moon.target.position.copy(c);
  moon.position.copy(c).addScaledVector(moonDir, 10);
}

let elapsed = 0;
let honked = false;
function step(dt) {
  elapsed += dt;
  for (const g of geese) {
    const a = g.action;
    const sp = a === 'walk' ? Math.max(speed, 0.35) : a === 'charge' ? Math.max(speed, 1.6) : speed;
    if (move && sp > 0) {
      g.object.position.x += Math.sin(g.object.rotation.y) * sp * dt;
      g.object.position.z += Math.cos(g.object.rotation.y) * sp * dt;
      if (turn) g.object.rotation.y += turn * dt;
    }
    if (honkAt !== null && !honked && elapsed >= honkAt) g.triggerHonk();
    g.update(dt, { speed: sp, turn, action: a, lookAt: look ? camera.position : null });
  }
  if (honkAt !== null && elapsed >= honkAt) honked = true;
  geese.dog?.update(dt, { speed: 0, action: 'none' });
}

document.getElementById('info').textContent = `gansa: ${geese[0].stats.ms.toFixed(0)}ms (1ª) · ${geese[0].stats.tris} tris · total ${genMs.toFixed(0)}ms`;
window.__geese = { geese, genMs, renderer, scene, camera };
if (sim !== null) {
  placeCamera();
  for (let i = 0, n = Math.round(sim * 60); i < n; i++) step(1 / 60);
  placeCamera();
  renderer.render(scene, camera);
  window.__ready = true;
} else {
  const clock = new THREE.Clock();
  const loop = () => {
    step(Math.min(clock.getDelta(), 1 / 20));
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  placeCamera();
  loop();
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
