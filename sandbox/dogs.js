// Sandbox das cachorrinhas. Parâmetros de URL:
//   dog=both|radhija|rhaenyra   view=34|side|front|back|top|face|game|hero
//   action=none|dash|push|strain|tug|celebrate|sit|sniff   speed=<m/s>   turn=<rad/s>
//   move=1 (anda de verdade, câmera segue)   sim=<s> (simula s segundos com dt fixo e congela)
//   orbit=1   carry=1|carrot|ball|slipper   bark=<s> (late no instante s)   look=1 (olha para a câmera)   yaw=<graus>
//   wet=<0..1>   action=shake|startled|turn (novas)   then=<ação depois de 'at' s>  at=<s>
import * as THREE from 'three';
import { createDog, createPlushCarrot } from '../src/dogs/dog.js';

// itens de teste (o jogo usa os do cenário): bolinha de tênis r≈0,065 e pantufa felpuda ≈0,24 m
function testBall(r = 0.065) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d7e83a'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#f6f6ee'; g.lineWidth = 7; g.beginPath();
  for (let x = 0; x <= 256; x += 2) { const y = 64 + Math.sin((x / 256) * Math.PI * 4) * 30; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  m.name = 'ball'; m.castShadow = true;
  return m;
}
function testSlipper(len = 0.24) {
  const g = new THREE.Group(); g.name = 'slipper';
  const felt = new THREE.MeshStandardMaterial({ color: '#e58fb0', roughness: 1 });
  const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, len - 0.09, 6, 14).rotateX(Math.PI / 2), felt);
  sole.scale.set(1, 0.45, 1);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), felt);
  top.scale.set(1, 0.75, 1.4); top.position.set(0, 0.02, len * 0.22);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff4f8', roughness: 1 }));
  pom.position.set(0, 0.05, len * 0.3);
  g.add(sole, top, pom);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
import { SUN, CAMERA } from '../src/levels/fase1/layout.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const which = q.get('dog') || 'both';
const view = q.get('view') || '34';
const action = q.get('action') || 'none';
const speed = num('speed', 0);
const turn = num('turn', 0);
const move = q.get('move') === '1';
const sim = q.has('sim') ? num('sim', 0) : null;
const orbit = q.get('orbit') === '1';
const carryKind = q.get('carry') || '';
const carry = !!carryKind && carryKind !== '0';
const wet = num('wet', 0);
const thenAction = q.get('then');
const thenAt = num('at', 0);
const barkAt = q.has('bark') ? num('bark', 0) : null;
const look = q.get('look') === '1';
const yawDeg = num('yaw', 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9c7a0');
scene.fog = new THREE.Fog('#e9c7a0', 8, 30);
const camera = new THREE.PerspectiveCamera(view === 'game' ? CAMERA.fov : 30, innerWidth / innerHeight, 0.02, 100);

scene.add(new THREE.HemisphereLight('#bcd3f0', '#7a6a40', 1.05));
const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
sun.position.set(...SUN.direction).multiplyScalar(10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -2.5;
sun.shadow.camera.right = sun.shadow.camera.top = 2.5;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#9fc0ff', 0.35);
fill.position.set(3, 4, 5);
scene.add(fill);

// grama simples procedural
function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#6f8a3c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const l = 30 + Math.random() * 28, h = 70 + Math.random() * 30;
    g.strokeStyle = `hsl(${h}, ${35 + Math.random() * 25}%, ${l}%)`;
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
  t.anisotropy = 8;
  return t;
}
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
);
ground.receiveShadow = true;
scene.add(ground);

// cachorrinhas
const t0 = performance.now();
const list = which === 'both' ? ['radhija', 'rhaenyra'] : [which];
const dogs = list.map((k) => createDog(k));
const genMs = performance.now() - t0;
const spread = dogs.length > 1 ? 0.36 : 0;
dogs.forEach((d, i) => {
  d.object.position.x = dogs.length > 1 ? (i === 0 ? -spread : spread) : 0;
  d.object.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  scene.add(d.object);
  d.steps = 0;
  d.onFootstep = () => d.steps++;
  if (carry) d.mouthSocket.add(carryKind === 'ball' ? testBall() : carryKind === 'slipper' ? testSlipper() : createPlushCarrot(0.28));
  if (wet) d.setWet(wet);
});

const target = new THREE.Vector3();
function placeCamera(tm) {
  const c = new THREE.Vector3();
  dogs.forEach((d) => c.add(d.object.position));
  c.divideScalar(dogs.length);
  const k = dogs.length > 1 ? 1.55 : 1;
  const big = dogs.some((d) => d.kind === 'rhaenyra') ? 1.1 : 1;
  let pos, look;
  switch (view) {
    case 'side': pos = [1.35 * k * big, 0.32, 0.0]; look = [0, 0.25, 0]; break;
    case 'front': pos = [0, 0.38, 1.45 * k * big]; look = [0, 0.27, 0]; break;
    case 'back': pos = [0.5, 0.65, -1.3 * k]; look = [0, 0.25, 0]; break;
    case 'top': pos = [0, 2.2 * k, 0.01]; look = [0, 0, 0]; break;
    case 'face': pos = [0.18, 0.44 * big, 0.62 * big]; look = [0, 0.37 * big, 0.2 * big]; break;
    case 'hero': pos = [0.55 * k, 0.32, 1.25 * k]; look = [0, 0.3, 0]; break;
    case 'game': pos = CAMERA.offset.slice(); look = [0, CAMERA.lookHeight, 0]; break;
    default: pos = [0.95 * k * big, 0.58, 1.05 * k * big]; look = [0, 0.27, 0];
  }
  const p = new THREE.Vector3(...pos);
  if (orbit) p.applyAxisAngle(new THREE.Vector3(0, 1, 0), tm * 0.4);
  if (view === 'face' && dogs.length > 1) p.x += 0; // face foca a primeira
  const focus = view === 'face' ? dogs[0].object.position : c;
  camera.position.copy(focus).add(p);
  target.copy(focus).add(new THREE.Vector3(...look));
  camera.lookAt(target);
  sun.target.position.copy(focus);
  sun.position.copy(focus).add(new THREE.Vector3(...SUN.direction).multiplyScalar(10));
}

let elapsed = 0;
let barked = false;
function step(dt) {
  elapsed += dt;
  for (const d of dogs) {
    if (move && speed > 0) {
      const yaw = d.object.rotation.y;
      d.object.position.x += Math.sin(yaw) * speed * dt;
      d.object.position.z += Math.cos(yaw) * speed * dt;
      if (turn) d.object.rotation.y += turn * dt;
    }
    if (barkAt !== null && !barked && elapsed >= barkAt) d.triggerBark();
    d.update(dt, {
      speed,
      turn,
      action: thenAction && elapsed >= thenAt ? thenAction : action,
      carrying: carry,
      lookAt: look ? camera.position : null,
    });
  }
  if (barkAt !== null && elapsed >= barkAt) barked = true;
}

const info = document.getElementById('info');
const statTxt = dogs.map((d) => `${d.kind}: ${d.stats.ms.toFixed(0)}ms tris ${JSON.stringify(d.stats.tris)}`).join(' | ');
info.textContent = `${statTxt} | total ${genMs.toFixed(0)}ms`;
window.__dogs = { dogs, stats: dogs.map((d) => d.stats), genMs, renderer, scene, camera };

if (sim !== null) {
  const n = Math.round(sim * 60);
  placeCamera(0);
  for (let i = 0; i < n; i++) {
    step(1 / 60);
    placeCamera(elapsed);
  }
  renderer.render(scene, camera);
  window.__ready = true;
} else {
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    step(dt);
    placeCamera(elapsed);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
