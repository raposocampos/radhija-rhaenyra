// Sandbox das cachorrinhas. Parâmetros de URL:
//   dog=both|radhija|rhaenyra   view=34|side|front|back|top|face|ear|game|hero
//   model=v1|v2|both (both: o atual e o novo lado a lado, cada um no seu quadro)
//   action=none|dash|push|strain|tug|celebrate|sit|sniff|shake|startled|turn|bafoAim|bafo|proud|yuck|lick|licked|slide
//   speed=<m/s>   turn=<rad/s>   move=1 (anda de verdade, câmera segue)   sim=<s> (simula s segundos e congela)
//   stop=<s> (para de andar no instante s: as patas assentam)
//   orbit=1   carry=1|carrot|ball|slipper   bark=<s> (late no instante s)   look=1 (olha para a câmera)   yaw=<graus>
//   wet=<0..1>   then=<ação depois de 'at' s>  at=<s>
//   extra=drink|eat|dig|sneeze|nudge|roll  xk=<0..1> (progresso fixo; sem ele, repete a cada xdur s)
//   idle=scratch|lie|pee (parada por muito tempo, game/idle.js)  ik=<0..1> (progresso fixo)  it=<s> (tempo somado:
//   deitada há mais de 9 s, a cabeça descansa)  iside=1|-1 (a pata que coça)
//   lick=1 (fase da lambida em ciclo)   airk=<0..1> + jumph=<m> (no ar)   slope=<rad>   poop=<0..1>
//   wallk=<0..1> (impulso na parede, com a parede a 0,45 m à frente)   hop=1 (pula a cada 1 s: física das orelhas)
//   wall=<m> (parede a m metros à frente: anda com o controle e a colisão do jogo, e a cabeça do modelo novo desvia)
//   crate=<altura m> (empurrando ou fazendo força num caixote dessa altura, encostado no peito: de pé, patas nele)
// window.__pose({ ...mesmos campos }) refaz a pose sem remontar as dogs (capturas em série, tools/scripts).
import * as THREE from 'three';
import { createDog, createPlushCarrot } from '../src/dogs/dog.js';
import { createDogV2 } from '../src/dogs/v2/dog.js';
import { DOG_CONFIG, withStart } from '../src/dogs/config.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createController, placeController, steer, integrate } from '../src/game/dogController.js';
import { SUN, CAMERA } from '../src/levels/fase1/layout.js';

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

const q = new URLSearchParams(location.search);
/** Configuração da pose (URL no começo; window.__pose troca). */
const cfg = {};
function readConfig(src) {
  const get = (k, d) => (src[k] !== undefined && src[k] !== null && src[k] !== '' ? src[k] : d);
  const num = (k, d) => Number(get(k, d));
  Object.assign(cfg, {
    view: get('view', '34'),
    action: get('action', 'none'),
    speed: num('speed', 0),
    turn: num('turn', 0),
    move: String(get('move', '')) === '1',
    sim: src.sim !== undefined && src.sim !== null && src.sim !== '' ? Number(src.sim) : null,
    orbit: String(get('orbit', '')) === '1',
    carryKind: String(get('carry', '')),
    wet: num('wet', 0),
    thenAction: get('then', null),
    thenAt: num('at', 0),
    barkAt: src.bark !== undefined && src.bark !== null && src.bark !== '' ? Number(src.bark) : null,
    look: String(get('look', '')) === '1',
    yawDeg: num('yaw', 0),
    extra: get('extra', ''),
    xk: src.xk !== undefined && src.xk !== null && src.xk !== '' ? Number(src.xk) : null,
    xdur: num('xdur', 3),
    lick: String(get('lick', '')) === '1',
    airk: src.airk !== undefined && src.airk !== null && src.airk !== '' ? Number(src.airk) : null,
    jumph: num('jumph', 0.3),
    slope: num('slope', 0),
    poop: src.poop !== undefined && src.poop !== null && src.poop !== '' ? Number(src.poop) : null,
    idle: get('idle', ''),
    ik: src.ik !== undefined && src.ik !== null && src.ik !== '' ? Number(src.ik) : null,
    it: num('it', 0),
    iside: num('iside', 1) < 0 ? -1 : 1,
    wallk: src.wallk !== undefined && src.wallk !== null && src.wallk !== '' ? Number(src.wallk) : null,
    hop: String(get('hop', '')) === '1',
    stopAt: src.stop !== undefined && src.stop !== null && src.stop !== '' ? Number(src.stop) : null,
    wall: src.wall !== undefined && src.wall !== null && src.wall !== '' ? Number(src.wall) : null,
    crate: src.crate !== undefined && src.crate !== null && src.crate !== '' ? Number(src.crate) : null,
  });
  cfg.carry = !!cfg.carryKind && cfg.carryKind !== '0';
}
readConfig(Object.fromEntries(q));
const which = q.get('dog') || 'both';
const modelParam = q.get('model') || 'v1';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
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
const camera = new THREE.PerspectiveCamera(cfg.view === 'game' ? CAMERA.fov : 30, innerWidth / innerHeight, 0.02, 100);

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
  new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
);
ground.receiveShadow = true;
scene.add(ground);

// cachorrinhas: no modo de comparação (model=both) cada uma fica longe das outras e ganha o próprio quadro
const t0 = performance.now();
const kinds = which === 'both' ? ['radhija', 'rhaenyra'] : [which];
const models = modelParam === 'both' ? ['v1', 'v2'] : [modelParam === 'v2' ? 'v2' : 'v1'];
const compare = models.length > 1;
const dogs = [];
for (const k of kinds) for (const m of models) {
  const d = m === 'v2' ? createDogV2(k) : createDog(k);
  d.modelLabel = m === 'v2' ? 'nova' : 'atual';
  dogs.push(d);
}
const genMs = performance.now() - t0;
const spread = !compare && dogs.length > 1 ? 0.36 : 0;
dogs.forEach((d, i) => {
  d.home = new THREE.Vector3(compare ? i * 8 : dogs.length > 1 ? (i === 0 ? -spread : spread) : 0, 0, 0);
  d.object.position.copy(d.home);
  d.object.rotation.y = THREE.MathUtils.degToRad(cfg.yawDeg);
  scene.add(d.object);
  d.steps = 0;
  d.onFootstep = () => d.steps++;
  d.object.updateMatrixWorld(true);
  d.bodyRestY = d.bones.find((b) => b.name === 'body').getWorldPosition(new THREE.Vector3()).y;
});
// parede (wall=) e caixote (crate=): um por dog, no rumo de onde ela começa
const propMat = new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.9 });
const crateMat = new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.85 });
let world = null;
const fwd = () => {
  const y = THREE.MathUtils.degToRad(cfg.yawDeg);
  return { x: Math.sin(y), z: Math.cos(y), yaw: y };
};
function applyProps() {
  for (const d of dogs) {
    for (const k of ['wallMesh', 'crateMesh']) if (d[k]) { scene.remove(d[k]); d[k].geometry.dispose(); d[k] = null; }
  }
  const f = fwd();
  const walls = [];
  for (const d of dogs) {
    if (cfg.wall !== null) {
      // parede de 1 m de largura e 20 cm de espessura, a face a `wall` m do centro (de lado, vê-se a face de quina)
      const cx = d.home.x + f.x * (cfg.wall + 0.1), cz = d.home.z + f.z * (cfg.wall + 0.1);
      const along = Math.abs(f.z) > Math.abs(f.x);
      const hx = along ? 0.5 : 0.1, hz = along ? 0.1 : 0.5;
      walls.push({ id: `parede-${walls.length}`, shape: 'box', x: cx, z: cz, hx, hz });
      d.wallMesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 0.9, hz * 2), propMat);
      d.wallMesh.position.set(cx, 0.45, cz);
      d.wallMesh.castShadow = d.wallMesh.receiveShadow = true;
      scene.add(d.wallMesh);
    }
    if (cfg.crate !== null) {
      d.crateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, cfg.crate, 0.5), crateMat);
      d.crateMesh.castShadow = d.crateMesh.receiveShadow = true;
      scene.add(d.crateMesh);
    }
    d.ctrl = cfg.wall !== null ? createController(d.kind, withStart(d.kind, { x: d.home.x, z: d.home.z, yaw: f.yaw })) : null;
  }
  world = cfg.wall !== null ? createCollisionWorld({ STATIC_COLLIDERS: walls, WORLD: { bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 } } }) : null;
  for (const d of dogs) d.setWorld?.(world);
}
/** O caixote encostado no peito (empurrando, ele anda junto com ela). */
function placeCrate(d) {
  if (!d.crateMesh) return;
  const gap = DOG_CONFIG[d.kind].body.front;
  const y = d.object.rotation.y;
  d.crateMesh.position.set(d.object.position.x + Math.sin(y) * (gap + 0.25), cfg.crate / 2, d.object.position.z + Math.cos(y) * (gap + 0.25));
  d.crateMesh.rotation.y = y;
}

function applyItems() {
  for (const d of dogs) {
    d.mouthSocket.clear();
    if (cfg.carry) d.mouthSocket.add(cfg.carryKind === 'ball' ? testBall() : cfg.carryKind === 'slipper' ? testSlipper() : createPlushCarrot(0.28));
    d.setWet(cfg.wet);
  }
}
applyItems();
applyProps();

// legendas dos quadros
const labels = dogs.map((d) => {
  const el = document.createElement('div');
  el.className = 'cell-label';
  el.textContent = `${d.kind === 'radhija' ? 'Radhija' : 'Rhaenyra'} · ${d.modelLabel}`;
  el.style.display = compare ? 'block' : 'none';
  document.body.appendChild(el);
  return el;
});

const target = new THREE.Vector3();
function placeCamera(tm, focusDogs) {
  const c = new THREE.Vector3();
  focusDogs.forEach((d) => c.add(d.object.position));
  c.divideScalar(focusDogs.length);
  // no ar (pulo, impulso na parede) a câmera sobe junto com o meio do corpo (o osso 'body'; rolando, ele fica embaixo)
  const _b = new THREE.Vector3();
  const lift = focusDogs.reduce((m, d) => {
    const body = d.bones.find((b) => b.name === 'body');
    body.updateWorldMatrix(true, false);
    return Math.max(m, body.getWorldPosition(_b).y - d.object.position.y - (d.bodyRestY ?? 0));
  }, 0);
  c.y += lift * 0.85;
  const k = focusDogs.length > 1 ? 1.55 : 1;
  const big = focusDogs.some((d) => d.kind === 'rhaenyra') ? 1.1 : 1;
  let pos, look;
  switch (cfg.view) {
    case 'side': pos = [1.35 * k * big, 0.32, 0.0]; look = [0, 0.25, 0]; break;
    case 'front': pos = [0, 0.38, 1.45 * k * big]; look = [0, 0.27, 0]; break;
    case 'back': pos = [0.5, 0.65, -1.3 * k]; look = [0, 0.25, 0]; break;
    case 'top': pos = [0, 2.2 * k, 0.01]; look = [0, 0, 0]; break;
    case 'face': pos = [0.18, 0.44 * big, 0.62 * big]; look = [0, 0.37 * big, 0.2 * big]; break;
    case 'ear': pos = [0.55 * big, 0.42 * big, 0.12 * big]; look = [0, 0.33 * big, 0.2 * big]; break;
    case 'hero': pos = [0.55 * k, 0.32, 1.25 * k]; look = [0, 0.3, 0]; break;
    case 'game': pos = CAMERA.offset.slice(); look = [0, CAMERA.lookHeight, 0]; break;
    default: pos = [0.95 * k * big, 0.58, 1.05 * k * big]; look = [0, 0.27, 0];
  }
  const p = new THREE.Vector3(...pos);
  if (cfg.orbit) p.applyAxisAngle(new THREE.Vector3(0, 1, 0), tm * 0.4);
  const focus = cfg.view === 'face' || cfg.view === 'ear' ? focusDogs[0].object.position : c;
  if (cfg.wallk !== null || cfg.crate !== null) p.multiplyScalar(1.5); // de pé: a cabeça fica bem mais alta
  camera.position.copy(focus).add(p);
  target.copy(focus).add(new THREE.Vector3(...look));
  camera.lookAt(target);
  sun.target.position.copy(focus);
  sun.position.copy(focus).add(new THREE.Vector3(...SUN.direction).multiplyScalar(10));
}

/** Pose pedida no instante t (s). */
function animAt(t) {
  const act = cfg.thenAction && t >= cfg.thenAt ? cfg.thenAction : cfg.action;
  /** @type {any} */
  const stopped = cfg.stopAt !== null && t >= cfg.stopAt;
  const a = { speed: stopped ? 0 : cfg.speed, turn: stopped ? 0 : cfg.turn, action: act, carrying: cfg.carry, lookAt: cfg.look ? camera.position : null, slope: cfg.slope };
  if (cfg.extra) {
    const k = cfg.xk !== null ? cfg.xk : (t % cfg.xdur) / cfg.xdur;
    a.extra = { kind: cfg.extra, k, t: cfg.xk !== null ? t : t % cfg.xdur };
  }
  if (cfg.lick) {
    a.lickPhase = (t % 0.44) / 0.44;
    a.lickSide = Math.floor(t / 0.44) % 2 ? -1 : 1;
  }
  if (cfg.airk !== null) {
    a.airK = cfg.airk;
    a.jump = 4 * cfg.jumph * cfg.airk * (1 - cfg.airk);
  }
  if (cfg.poop !== null) a.poopK = cfg.poop;
  if (cfg.idle) {
    const dur = cfg.idle === 'pee' ? 3 : cfg.idle === 'scratch' ? 2.6 : 1.2;
    a.idle = { kind: cfg.idle, k: cfg.ik !== null ? cfg.ik : Math.min(1, t / dur), t: cfg.it + t, side: cfg.iside };
  }
  if (cfg.hop) {
    // pulo de verdade a cada 1 s (0,5 s no ar, 0,4 m): as orelhas reagem à física
    const u = t % 1;
    if (u < 0.5) {
      a.airK = u / 0.5;
      a.jump = 4 * 0.4 * a.airK * (1 - a.airK);
    }
  }
  if (cfg.wallk !== null) Object.assign(a, { action: 'wallJump', wallK: cfg.wallk, wallGap: 0.45, wallTop: 1.1, wallOut: 0.05, wallPaws: 1.03, wallSide: 0.165, wallLat: 0.14 });
  if (cfg.crate !== null) a.pushTop = cfg.crate;
  return a;
}

let elapsed = 0;
let barked = false;
function step(dt) {
  elapsed += dt;
  const a = animAt(elapsed);
  for (const d of dogs) {
    let ad = a;
    if (d.ctrl) {
      // contra a parede: o controle e a colisão do jogo (o peito encosta; a cabeça do modelo novo desvia)
      const f = fwd();
      steer(d.ctrl, dt, { dx: f.x, dz: f.z, speed: a.speed });
      integrate(d.ctrl, dt, world);
      d.object.position.set(d.ctrl.x, 0, d.ctrl.z);
      d.object.rotation.y = d.ctrl.yaw;
      ad = { ...a, speed: d.ctrl.animSpeed, turn: d.ctrl.yawRate };
    } else if (cfg.move && a.speed > 0) {
      const yaw = d.object.rotation.y;
      d.object.position.x += Math.sin(yaw) * a.speed * dt;
      d.object.position.z += Math.cos(yaw) * a.speed * dt;
      if (a.turn) d.object.rotation.y += a.turn * dt;
    }
    if (cfg.crate !== null) ad = { ...ad, pushGap: DOG_CONFIG[d.kind].body.front };
    if (cfg.barkAt !== null && !barked && elapsed >= cfg.barkAt) d.triggerBark();
    d.update(dt, ad);
    placeCrate(d);
  }
  if (cfg.barkAt !== null && elapsed >= cfg.barkAt) barked = true;
}

/** Desenha: um quadro só (normal) ou um por dog (comparação, colunas = modelos). */
function draw() {
  const W = innerWidth, H = innerHeight;
  if (!compare) {
    placeCamera(elapsed, dogs);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return;
  }
  const cols = models.length, rows = kinds.length;
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  renderer.setScissorTest(true);
  dogs.forEach((d, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cw, y = H - (row + 1) * ch;
    // só a dog do quadro (as outras ficariam no fundo, pequenininhas)
    for (const o of dogs) o.object.visible = o === d;
    placeCamera(elapsed, [d]);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setViewport(x, y, cw, ch);
    renderer.setScissor(x, y, cw, ch);
    renderer.render(scene, camera);
    Object.assign(labels[i].style, { left: `${x + 10}px`, top: `${row * ch + 8}px` });
  });
  for (const o of dogs) o.object.visible = true;
}

const info = document.getElementById('info');
const statTxt = dogs.map((d) => `${d.kind}/${d.modelLabel}: ${d.stats.ms.toFixed(0)}ms tris ${JSON.stringify(d.stats.tris)}`).join(' | ');
info.textContent = `${statTxt} | total ${genMs.toFixed(0)}ms`;

/** Refaz a pose sem remontar as dogs: volta ao lugar, simula `sim` s (padrão 2) e desenha. */
function pose(next = {}) {
  readConfig(next);
  // volta ao lugar e ao rumo do começo (uma pose andando em curva não deixa a próxima virada)
  for (const d of dogs) d.object.rotation.y = THREE.MathUtils.degToRad(cfg.yawDeg);
  applyItems();
  applyProps();
  elapsed = 0;
  barked = false;
  for (const d of dogs) {
    d.object.position.copy(d.home);
    if (d.ctrl) placeController(d.ctrl, d.home.x, d.home.z, fwd().yaw);
    d.locomotion?.reset(); // modelo novo: as patas voltam para debaixo do corpo (não "andou" até a casa)
    d.steps = 0;
    // um quadro farejando zera o tempo parado (senão, depois de 5 s, ela senta sozinha)
    d.update(1 / 60, { speed: 0, action: 'sniff' });
  }
  const n = Math.round((cfg.sim ?? 2) * 60);
  for (let i = 0; i < n; i++) step(1 / 60);
  draw();
  return dogs.map((d) => ({
    kind: d.kind, model: d.modelLabel, steps: d.steps, lowest: d.lowest ?? null, lift: d.lift ?? 0, tilt: d.tilt ?? 0, bone: d.lowestBone ?? '',
    back: d.head?.info.back ?? 0, headYaw: d.head?.info.yaw ?? 0,
  }));
}
window.__dogs = { dogs, stats: dogs.map((d) => d.stats), genMs, renderer, scene, camera };
window.__pose = pose;

if (cfg.sim !== null) {
  pose(Object.fromEntries(q));
  window.__ready = true;
} else {
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    step(dt);
    draw();
    requestAnimationFrame(loop);
  };
  loop();
  window.__ready = true;
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  draw();
});
