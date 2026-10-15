// Cenário completo: chão + grama + caminho, casa, cerca, jardim, fundo e pólen nos raios de sol.
// API: buildEnvironment(engine, layout) → { update(dt, t), occluders: Object3D[] }
import * as THREE from 'three';
import { buildGround } from './ground.js';
import { buildHouse } from './house.js';
import { buildFence } from './fence.js';
import { buildGarden } from './garden.js';
import { buildBackground } from './background.js';
import { radialTexture, rng, shared } from './util.js';

function buildPollen(scene, layout) {
  const B = layout.WORLD.bounds;
  const N = 46;
  const r = rng(99);
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = B.minX + r() * (B.maxX - B.minX);
    base[i * 3 + 1] = 0.3 + r() * 1.6;
    base[i * 3 + 2] = B.minZ + 0.5 + r() * (B.maxZ - B.minZ - 0.5);
    seeds[i] = r() * 100;
  }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    size: 0.03, map: radialTexture(), color: '#ffe3a8', transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  scene.add(pts);
  return (t) => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.13 + s) * 0.6;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.21 + s * 1.7) * 0.25;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + s * 0.7) * 0.5;
    }
    g.attributes.position.needsUpdate = true;
    m.opacity = 0.55 + 0.2 * Math.sin(t * 0.7);
  };
}

export function buildEnvironment(engine, layout) {
  const { scene } = engine;
  const T = (name, fn) => { const t0 = performance.now(); const r = fn(); timings[name] = Math.round(performance.now() - t0); return r; };
  const timings = {};
  const ground = T('ground', () => buildGround(engine, layout));
  const house = T('house', () => buildHouse(engine, layout));
  const fence = T('fence', () => buildFence(engine, layout));
  const garden = T('garden', () => buildGarden(engine, layout));
  const bg = T('background', () => buildBackground(engine, layout));
  const pollen = buildPollen(scene, layout);
  if (typeof window !== 'undefined') window.__envTimings = timings;

  // compartilha o estado da arandela com props (door.setHighlight)
  engine.userData = engine.userData || {};
  engine.userData.lampState = house.lampState;

  return {
    ground, house, fence, garden, background: bg,
    occluders: [...house.occluders, ...garden.occluders],
    sampleGround: ground.sample,
    update(dt, t) {
      shared.time.value = t;
      garden.update(dt, t);
      pollen(t);
    },
  };
}
