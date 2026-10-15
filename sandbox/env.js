// Sandbox do Cenário: câmera e estado dos props controlados por URL.
//   ?cam=x,y,z&look=x,y,z     posição/alvo da câmera (padrão: plano geral)
//   ?follow=x,z               câmera de jogo (offset do layout) seguindo o ponto (x,z)
//   ?gate=0..1 &tug=0..1 &cartx=4.4..5.9 &hl=1 (cenoura) &door=1 &collect=0,1 &carrotAt=x,y,z
//   ?t=segundos (tempo fixo)  ?dogs=1 (carrega as dogs do Agente Cachorrinhas, se existirem)  ?nopost
import * as THREE from 'three';
import { createEngine } from '../src/core/engine.js';
import { buildEnvironment } from '../src/world/environment.js';
import { createProps } from '../src/world/props.js';
import LAYOUT from '../src/level/layout.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? Number(params.get(k)) : d);
const vec = (k, d) => (params.has(k) ? params.get(k).split(',').map(Number) : d);

const t0 = performance.now();
const engine = createEngine(document.getElementById('app'), { params });
const env = buildEnvironment(engine, LAYOUT);
const props = createProps(engine, LAYOUT);
const buildMs = performance.now() - t0;

const cam = engine.camera;
if (params.has('follow')) {
  const [fx, fz] = vec('follow');
  const o = LAYOUT.CAMERA.offset;
  cam.position.set(fx + o[0], o[1], fz + o[2]);
  cam.lookAt(fx, LAYOUT.CAMERA.lookHeight, fz);
} else {
  cam.position.set(...vec('cam', [0.6, 9.5, 11.5]));
  cam.lookAt(...vec('look', [0.4, 0, -0.6]));
}

props.gate.setOpen(num('gate', 0));
props.rope.setTug(num('tug', 0));
props.cart.setX(num('cartx', LAYOUT.CART.start.x));
if (params.get('hl') === '1') props.carrot.setHighlight(true);
if (params.get('door') === '1') props.door.setHighlight(true);
if (params.has('collect')) for (const i of params.get('collect').split(',')) props.collectibles[Number(i)]?.collect();
if (params.has('carrotAt')) props.carrot.object.position.set(...vec('carrotAt'));

let dogs = null;
if (params.get('dogs') === '1') {
  import('../src/dogs/dog.js').then(({ createDog }) => {
    dogs = { radhija: createDog('radhija'), rhaenyra: createDog('rhaenyra') };
    for (const [k, d] of Object.entries(dogs)) {
      const s = LAYOUT.DOGS[k].start;
      d.object.position.set(s.x, 0, s.z);
      d.object.rotation.y = s.yaw;
      engine.scene.add(d.object);
    }
    if (params.has('dogAt')) {
      const [x, z, yaw] = vec('dogAt');
      dogs.radhija.object.position.set(x, 0, z);
      dogs.radhija.object.rotation.y = yaw || 0;
    }
  }).catch((e) => console.warn('dogs indisponíveis', e));
}

const fixedT = params.has('t') ? num('t', 0) : null;
const clock = new THREE.Clock();
let elapsed = 0;
let frames = 0, acc = 0;
const info = document.getElementById('info');
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  const t = fixedT ?? elapsed;
  env.update(dt, t);
  props.update(dt, t);
  if (dogs) for (const d of Object.values(dogs)) d.update(dt, { speed: 0, turn: 0, action: 'none', lookAt: null, carrying: false });
  engine.render(dt, t);
  frames++; acc += dt;
  if (acc > 0.5) {
    const ri = engine.renderer.info.render;
    info.textContent = `${(frames / acc).toFixed(0)} fps · ${ri.calls} draws · ${(ri.triangles / 1000).toFixed(0)}k tris · build ${buildMs.toFixed(0)} ms`;
    frames = 0; acc = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__env = { engine, env, props, THREE, LAYOUT };
