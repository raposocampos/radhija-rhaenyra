// FASE 2 · Operação Bolinha — cenário + props visuais.
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é adicionado dentro de `root` (descartado na troca de fase). Props: tipo Fase2Props em src/types.d.ts.
import * as THREE from 'three';
import { shared, radialTexture, rng } from '../../../world/util.js';
import { buildGround } from './ground.js';
import { buildArchitecture } from './architecture.js';
import { buildDressing } from './dressing.js';
import { buildProps } from './props.js';

/** Vaga-lumes e partículas de umidade no ar do crepúsculo. */
function buildFireflies(root, layout) {
  const B = layout.WORLD.bounds;
  const N = 34;
  const r = rng(71);
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = B.minX + r() * (B.maxX - B.minX);
    base[i * 3 + 1] = 0.25 + r() * 1.3;
    base[i * 3 + 2] = B.minZ + 0.6 + r() * (B.maxZ - B.minZ);
    seeds[i] = r() * 100;
  }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    size: 0.045, map: radialTexture(), color: '#f6ff9a', transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  root.add(pts);
  return (t) => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.17 + s) * 0.7;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.31 + s * 1.7) * 0.25;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.13 + s * 0.7) * 0.6;
    }
    g.attributes.position.needsUpdate = true;
    m.opacity = 0.65 + 0.3 * Math.sin(t * 1.9);
  };
}

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase2Props>}
 */
export function buildWorld({ engine, root, layout, params }) {
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const ground = T('ground', () => buildGround({ root, layout }));
  const arch = T('architecture', () => buildArchitecture({ root, layout }));
  const dressing = T('dressing', () => buildDressing({ root, layout }));
  const props = T('props', () => buildProps({ root, layout, engine }));
  const fireflies = buildFireflies(root, layout);
  if (typeof window !== 'undefined') window.__f2Timings = timings;

  // estado inicial dos props
  props.reset();

  return {
    props,
    env: { ground, arch, dressing },
    // objetos que podem ficar entre a câmera e as dogs (o núcleo aplica o "ver através")
    seeThrough: [...arch.seeThrough, props.gate.object],
    update(dt, t) {
      shared.time.value = t;
      arch.update(dt, t);
      dressing.update(dt, t);
      props.update(dt, t);
      fireflies(t);
    },
    dispose() {},
  };
}
