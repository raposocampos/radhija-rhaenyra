// ARENA DOS PORQUINHOS (fase de desenvolvimento) — CENÁRIO.
// Gramado do cenário provisório (_placeholder.js, só o chão) + o quintal de verdade: cerca alta de tábuas no fundo e
// nos lados, a horta de terra com sulcos e a cerca baixa (com o vão da tábua quebrada), o chiqueiro
// (src/world/pigPen.js), o botão de pisar, o sininho, os canteiros de alface, o caixote com os legumes na frente
// (src/world/veggies.js), a caminha das dogs e os ossinhos. Os porquinhos são do puzzle (src/characters/pig.js).
import * as THREE from 'three';
import { buildPlaceholderWorld } from '../_placeholder.js';
import { rbox, woodMat, stdMat, shadowAll, mergeGeometries, rng, brassMat } from '../../world/util.js';
import { lettuce, plantMat } from '../../world/plants.js';
import { buildTreats } from '../../world/treats.js';
import { buildPigPen } from '../../world/pigPen.js';
import { createVeggie } from '../../world/veggies.js';

const TAU = Math.PI * 2;

/** Cerca alta de tábuas ao longo de um lado do quintal (de `from` a `to`; x ou z fixo em `at`; travessas por fora). */
function plankFence(planks, rails, { axis, at, from, to, out, h = 1.05 }) {
  const len = to - from;
  const n = Math.round(len / 0.14);
  const r = rng(Math.round(Math.abs(at) * 10 + Math.abs(from)));
  for (let i = 0; i < n; i++) {
    const c = from + (i + 0.5) * (len / n);
    const hh = h + (r() - 0.5) * 0.04;
    const g = rbox(0.12, hh, 0.022, 0.006);
    // o pé das tábuas fica enterrado (nenhuma face no plano do chão)
    if (axis === 'x') g.translate(c, hh / 2 - 0.03, at);
    else { g.rotateY(Math.PI / 2); g.translate(at, hh / 2 - 0.03, c); }
    planks.push(g);
  }
  for (const y of [0.22, h - 0.22]) {
    const g = rbox(len, 0.07, 0.03, 0.008);
    if (axis === 'x') g.translate(from + len / 2, y, at + out * 0.027);
    else { g.rotateY(Math.PI / 2); g.translate(at + out * 0.027, y, from + len / 2); }
    rails.push(g);
  }
}

/** Cerca baixa da horta: mourões e duas tábuas, com o vão da tábua quebrada (a de baixo caída, a de cima rachada). */
function hortaFence(root, H, B) {
  const wood = woodMat('#a77c52', { key: 'porcos-cerca-horta' });
  const parts = [];
  // mourões a cada 0,75 m, fora do vão, e os dois do vão
  const gapPosts = [H.gap.z0 - 0.04, H.gap.z1 + 0.04];
  const postAt = [...gapPosts];
  for (let z = B.minZ + 0.15; z < B.maxZ; z += 0.75) {
    if (z > H.gap.z0 - 0.2 && z < H.gap.z1 + 0.2) continue;
    postAt.push(z);
  }
  for (const z of postAt) {
    const g = rbox(0.07, H.fenceH + 0.09, 0.07, 0.01);
    g.translate(H.x, (H.fenceH + 0.09) / 2 - 0.03, z);
    parts.push(g);
  }
  const rail = (y, z0, z1, dx = 0) => {
    const g = rbox(0.03, 0.075, z1 - z0, 0.008);
    g.translate(H.x + 0.012 + dx, y, (z0 + z1) / 2);
    parts.push(g);
  };
  for (const y of [0.11, H.fenceH - 0.04]) {
    rail(y, B.minZ + 0.05, H.gap.z0 - 0.06);
    rail(y, H.gap.z1 + 0.06, B.maxZ - 0.05);
  }
  // no vão: a tábua de cima está lá (rachada, mais alta que a Radhija); a de baixo caiu no chão
  // (um pouco mais alta e para fora: as pontas cruzam as inteiras sem nenhuma face no mesmo plano)
  rail(H.fenceH - 0.034, H.gap.z0 - 0.1, H.gap.z0 + 0.05, 0.005);
  rail(H.fenceH - 0.034, H.gap.z1 - 0.05, H.gap.z1 + 0.1, 0.005);
  const fallen = rbox(0.075, 0.025, 0.42, 0.008);
  fallen.rotateY(0.5);
  fallen.translate(H.x - 0.34, 0.013, (H.gap.z0 + H.gap.z1) / 2 + 0.18);
  parts.push(fallen);
  const mesh = new THREE.Mesh(mergeGeometries(parts), wood);
  for (const g of parts) g.dispose();
  shadowAll(mesh);
  root.add(mesh);
  return mesh;
}

/** Terra da horta (a leste da cerca baixa), com sulcos. */
function hortaSoil(root, H, B) {
  const x0 = H.x + H.t / 2, x1 = B.maxX;
  const soil = new THREE.Mesh(rbox(x1 - x0, 0.01, B.maxZ - B.minZ, 0.004), stdMat('#7a5a3e', { roughness: 1 }));
  soil.position.set((x0 + x1) / 2, 0.001, (B.minZ + B.maxZ) / 2);
  soil.receiveShadow = true;
  root.add(soil);
  const rows = [];
  for (let z = -1.0; z < B.maxZ - 0.3; z += 0.55) {
    const g = rbox(x1 - x0 - 1.4, 0.018, 0.14, 0.006);
    g.translate((x0 + x1) / 2 + 0.3, 0.0085, z);
    rows.push(g);
  }
  const furrows = new THREE.Mesh(mergeGeometries(rows), stdMat('#6b4d33', { roughness: 1 }));
  for (const g of rows) g.dispose();
  furrows.receiveShadow = true;
  root.add(furrows);
  return { soil, furrows };
}

/** Botão de pisar: base de pedra e o domo vermelho que afunda (setPress 0..1). */
function floorButton(root, cfg) {
  const g = new THREE.Group();
  g.name = 'botao-do-chiqueiro';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r + 0.06, cfg.r + 0.09, 0.05, 28), stdMat('#9a948a', { roughness: 0.9 }));
  base.position.y = 0.025;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(cfg.r + 0.01, 0.018, 8, 32).rotateX(Math.PI / 2), stdMat('#f2c14e', { roughness: 0.5 }));
  ring.position.y = 0.052;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(cfg.r * 0.86, 28, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e5483e', roughness: 0.38, emissive: '#5a0d08', emissiveIntensity: 0.25 }));
  dome.scale.y = 0.32;
  dome.position.y = 0.05;
  g.add(base, ring, dome);
  g.position.set(cfg.x, 0, cfg.z);
  shadowAll(g);
  root.add(g);
  return {
    object: g,
    /** 0 solto … 1 afundado. */
    setPress(t) {
      dome.scale.y = 0.32 - 0.22 * THREE.MathUtils.clamp(t, 0, 1);
    },
  };
}

/** Sininho num poste com braço: ring() faz o sino balançar. */
function bellPost(root, cfg) {
  const g = new THREE.Group();
  g.name = 'sininho';
  const wood = woodMat('#8d6240', { key: 'chiqueiro-mourao' });
  const post = new THREE.Mesh(rbox(0.08, 1.0, 0.08, 0.012), wood);
  post.position.y = 0.5;
  const arm = new THREE.Mesh(rbox(0.32, 0.05, 0.05, 0.01), wood);
  arm.position.set(0.12, 0.96, 0);
  const pivot = new THREE.Group();
  pivot.position.set(0.24, 0.93, 0);
  const bell = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0.01], [0.055, 0], [0.05, 0.012], [0.04, 0.03], [0.033, 0.06], [0.03, 0.085], [0.022, 0.105], [0, 0.115],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 20), brassMat());
  bell.position.y = -0.125;
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), stdMat('#3a3533', { metalness: 0.5, roughness: 0.4 }));
  clapper.position.y = -0.12;
  pivot.add(bell, clapper);
  g.add(post, arm, pivot);
  g.position.set(cfg.x, 0, cfg.z);
  g.rotation.y = -Math.PI / 2; // o braço aponta para a frente (sul), na direção de quem chega
  shadowAll(g);
  root.add(g);
  const st = { t: -1 };
  return {
    object: g,
    ring() { st.t = 0; },
    update(dt) {
      if (st.t < 0) { pivot.rotation.x = 0; return; }
      st.t += dt;
      const k = Math.exp(-st.t * 2.2);
      pivot.rotation.x = Math.sin(st.t * 14) * 0.5 * k;
      clapper.position.x = Math.sin(st.t * 14 - 0.8) * 0.02 * k;
      if (k < 0.01) st.t = -1;
    },
  };
}

/** Canteiro baixo de madeira com alfaces. */
function bed(root, b, h, seed) {
  const g = new THREE.Group();
  g.name = 'canteiro';
  const wood = woodMat('#9a6b45', { key: 'porcos-canteiro' });
  const frame = [];
  for (const s of [-1, 1]) {
    const a = rbox(b.hx * 2, h, 0.04, 0.008);
    a.translate(0, h / 2, s * (b.hz - 0.02));
    frame.push(a);
    const c = rbox(0.04, h, b.hz * 2 - 0.08, 0.008);
    c.translate(s * (b.hx - 0.02), h / 2, 0);
    frame.push(c);
  }
  const fm = new THREE.Mesh(mergeGeometries(frame), wood);
  for (const q of frame) q.dispose();
  const soil = new THREE.Mesh(rbox(b.hx * 2 - 0.08, 0.03, b.hz * 2 - 0.08, 0.006), stdMat('#5b3e2b', { roughness: 1 }));
  soil.position.y = h - 0.035;
  g.add(fm, soil);
  const r = rng(seed);
  const n = Math.max(2, Math.round((b.hx * 2) / 0.32));
  const geo = lettuce({ r: 0.1, seed });
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(geo, plantMat());
    l.position.set(-b.hx + (i + 0.5) * ((b.hx * 2) / n), h - 0.02, (r() - 0.5) * 0.06);
    l.rotation.y = r() * TAU;
    l.scale.setScalar(0.85 + r() * 0.3);
    g.add(l);
  }
  g.position.set(b.x, 0, b.z);
  shadowAll(g);
  root.add(g);
  return g;
}

/** Caixote de madeira com espigas e cenouras (enfeite; os legumes de pegar ficam na frente). */
function crate(root, C) {
  const g = new THREE.Group();
  g.name = 'caixote-de-legumes';
  const wood = woodMat('#b68a5c', { key: 'porcos-caixote' });
  const parts = [];
  for (const s of [-1, 1]) {
    for (const y of [0.07, 0.2]) {
      const a = rbox(C.hx * 2, 0.1, 0.025, 0.008);
      a.translate(0, y, s * (C.hz - 0.0125));
      parts.push(a);
      const b = rbox(0.025, 0.1, C.hz * 2 - 0.05, 0.008);
      b.translate(s * (C.hx - 0.0125), y, 0);
      parts.push(b);
    }
    const leg = rbox(0.05, C.h - 0.02, 0.05, 0.008);
    leg.translate(s * (C.hx - 0.03), (C.h - 0.02) / 2, C.hz - 0.03);
    parts.push(leg);
    const leg2 = rbox(0.05, C.h - 0.02, 0.05, 0.008);
    leg2.translate(s * (C.hx - 0.03), (C.h - 0.02) / 2, -C.hz + 0.03);
    parts.push(leg2);
  }
  const bottom = rbox(C.hx * 2 - 0.05, 0.02, C.hz * 2 - 0.05, 0.006);
  bottom.translate(0, 0.03, 0);
  parts.push(bottom);
  const m = new THREE.Mesh(mergeGeometries(parts), wood);
  for (const q of parts) q.dispose();
  g.add(m);
  // monte de legumes dentro (enfeite)
  const r = rng(9);
  const kinds = ['corn', 'carrot', 'corn', 'carrot', 'pumpkin', 'corn', 'carrot'];
  kinds.forEach((k, i) => {
    const v = createVeggie(/** @type {'corn' | 'carrot' | 'pumpkin'} */ (k));
    const x = -C.hx + 0.1 + (i / (kinds.length - 1)) * (C.hx * 2 - 0.2);
    v.object.position.set(x, 0.21 + (i % 2) * 0.03 + (k === 'pumpkin' ? 0.04 : 0), (r() - 0.5) * 0.18);
    v.object.rotation.set((r() - 0.5) * 0.3, 0.3 + (r() - 0.5) * 0.9, (r() - 0.5) * 0.3);
    g.add(v.object);
  });
  g.position.set(C.x, 0, C.z);
  shadowAll(g);
  root.add(g);
  return { group: g, wood: m };
}

/** Caminha redonda das dogs (o objetivo). */
function dogBed(root, D) {
  const g = new THREE.Group();
  g.name = 'caminha';
  const rim = new THREE.Mesh(new THREE.TorusGeometry(D.r, 0.09, 12, 32).rotateX(Math.PI / 2), stdMat('#5c8fc4', { roughness: 0.9 }));
  rim.position.y = 0.09;
  rim.scale.y = 0.9;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(D.r, D.r, 0.06, 32), stdMat('#f1e3c8', { roughness: 0.95 }));
  pad.position.y = 0.04;
  g.add(rim, pad);
  g.position.set(D.x, 0, D.z);
  shadowAll(g);
  root.add(g);
  return g;
}

/**
 * @param {import('../../types').LevelBuildArgs} args
 * @returns {import('../../types').LevelBuild<import('../../types').PorcosProps>}
 */
export function buildPorcosWorld({ root, layout }) {
  const { HORTA, PEN, PEN_LAYOUT, BUTTON, BELL, VEGGIES, CRATE, BEDS, BED_H, DOG_BED, COLLECTIBLES, WORLD } = layout;
  const B = WORLD.bounds;
  // só o chão e a bolinha do cenário provisório: o resto é desenhado aqui
  const skip = new Set(layout.STATIC_COLLIDERS.map((c) => c.id));
  const base = buildPlaceholderWorld({ root, layout, skip, colors: { ground: '#6f9150' } });

  // cerca alta de tábuas no fundo e nos lados (o sul fica aberto para a câmera)
  const planks = [], rails = [];
  plankFence(planks, rails, { axis: 'x', at: B.minZ - 0.012, from: B.minX + 0.06, to: B.maxX - 0.06, out: -1 });
  plankFence(planks, rails, { axis: 'z', at: B.minX - 0.012, from: B.minZ - 0.06, to: B.maxZ + 0.6, out: -1 });
  plankFence(planks, rails, { axis: 'z', at: B.maxX + 0.012, from: B.minZ - 0.06, to: B.maxZ + 0.6, out: 1 });
  const yardFence = new THREE.Group();
  yardFence.name = 'cerca-do-quintal';
  const pm = new THREE.Mesh(mergeGeometries(planks), woodMat('#c79a6b', { vertical: true, key: 'porcos-tabuas' }));
  const rm = new THREE.Mesh(mergeGeometries(rails), woodMat('#9a6b45', { key: 'porcos-travessas' }));
  for (const g of [...planks, ...rails]) g.dispose();
  yardFence.add(pm, rm);
  shadowAll(yardFence);
  root.add(yardFence);

  hortaSoil(root, HORTA, B);
  const lowFence = hortaFence(root, HORTA, B);
  const pen = buildPigPen(PEN, PEN_LAYOUT);
  root.add(pen.group);
  const button = floorButton(root, BUTTON);
  const bell = bellPost(root, BELL);
  for (const [i, b] of BEDS.entries()) bed(root, b, BED_H, 21 + i);
  const crateBox = crate(root, CRATE);
  dogBed(root, DOG_BED);

  // os três legumes de pegar, na frente do caixote
  const veggies = /** @type {Record<'corn' | 'carrot' | 'pumpkin', any>} */ ({});
  for (const kind of /** @type {('corn' | 'carrot' | 'pumpkin')[]} */ (['corn', 'carrot', 'pumpkin'])) {
    const v = createVeggie(kind);
    const p = VEGGIES[kind];
    v.object.position.set(p.x, v.groundY, p.z);
    v.object.rotation.y = kind === 'corn' ? 0.4 : kind === 'carrot' ? -0.5 : 0;
    root.add(v.object);
    veggies[kind] = Object.assign(v, { home: v.object.position.clone() });
  }

  // ossinhos: os da horta em cima da terra (e da terra batida do chiqueiro), o outro no gramado
  const inHorta = (c) => c.x > HORTA.x;
  const hortaTreats = buildTreats(root, COLLECTIBLES.filter(inHorta), { y: 0.0095 });
  const grassTreats = buildTreats(root, COLLECTIBLES.filter((c) => !inHorta(c)));

  /** @type {import('../../types').PorcosProps} */
  const props = {
    ...base.props,
    button,
    bell,
    penGate: pen.gate,
    veggies,
    collectibles: [...hortaTreats.list, ...grassTreats.list], // a coleta acha cada ossinho pelo id
    reset() {
      button.setPress(0);
      pen.gate.setOpen(0);
      for (const v of Object.values(veggies)) v.reset();
    },
  };
  return {
    props,
    seeThrough: [pen.group, crateBox.wood, lowFence],
    update(dt, t) {
      pen.update(dt, t);
      bell.update(dt);
      hortaTreats.update(dt, t);
      grassTreats.update(dt, t);
    },
  };
}
