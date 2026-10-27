// PANDORÓPOLIS — as nuvens que cobrem as áreas ainda fechadas (o leste e o centro até a fase 6, a chácara até a 9 e
// a estrada do norte, o Modo História) e a ponte levadiça do rio (levantada até a vez da chácara).
// Nuvens: bolos fofos instanciados (uma malha por área); ao abrir, sobem, espalham e somem em onda a partir da borda
// do lado de quem chega. Ponte: duas folhas de madeira com dobradiça em cada margem, que descem juntas; deitada, as
// patas pisam no alto das tábuas (um piso de pisar sem desenho, src/game/ground.js), e torres e guarda-corpo colidem.
// API: buildClouds(root, L) → { clouds: { setOpen(zone, open, { instant, delay }), isOpen(zone) },
//                                bridge: { setDown(down, { instant, delay }), get down() }, update(dt, t) }
import * as THREE from 'three';
import { foliageCluster, rng, mat, mergeGeometries, paint } from '../../../world/util.js';
import { rb, cyl } from './kit.js';

const PUFF_SPACING = 4.2;
/** Lado de onde cada área começa a abrir (quem chega vem do oeste). */
const OPEN_FROM = { leste: 'minX', chacara: 'minX', breve: 'maxZ' };
/**
 * Recuo dos bolos na borda que encosta numa área aberta (m): as nuvens são altas e, vistas pela câmera, cobririam a
 * lavanderia da fase 8 e o jardim da casa do outro lado da rua.
 */
const INSET = { leste: 2.6 };

/** Um bolo de nuvem (três ou quatro bolhas brancas, sombreado de cima). */
function puffGeometry(seed) {
  const R = rng(seed);
  const blobs = [{ x: 0, y: 0, z: 0, r: 1, sy: 0.72 }];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + R();
    blobs.push({ x: Math.cos(a) * 0.85, y: -0.15 + R() * 0.2, z: Math.sin(a) * 0.85, r: 0.62 + R() * 0.2, sy: 0.7 });
  }
  return foliageCluster(blobs, { detail: 1, amp: 0.1, freq: 1.4, seed, dark: '#c7d3e4', mid: '#eef3fa', light: '#ffffff', sunBias: 0.35, bottomDark: 0.3 });
}

/**
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildClouds(root, L) {
  const cloudMat = mat('mapa-nuvem', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.12 }));
  const geos = [puffGeometry(3), puffGeometry(8)];
  /** @type {Record<string, { mesh: THREE.InstancedMesh, items: any[], open: boolean, k: number, target: number, delay: number }>} */
  const areas = {};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  for (const [ai, [key, z]] of Object.entries(L.ZONES).entries()) {
    const b = z.box;
    const R = rng(key.length * 7 + 1);
    const items = [];
    const nx = Math.max(1, Math.round((b.maxX - b.minX) / PUFF_SPACING));
    const nz = Math.max(1, Math.round((b.maxZ - b.minZ) / PUFF_SPACING));
    const from = OPEN_FROM[key] || 'minX';
    const x0 = b.minX + (INSET[key] ?? 0);
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const x = x0 + ((i + (R() - 0.5) * 0.7) / nx) * (b.maxX - x0);
        const zz = b.minZ + ((j + (R() - 0.5) * 0.7) / nz) * (b.maxZ - b.minZ);
        // ordem da onda de abertura (0 = a borda de quem chega)
        const order = from === 'minX' ? (x - b.minX) / (b.maxX - b.minX) : (b.maxZ - zz) / (b.maxZ - b.minZ);
        items.push({
          x, z: zz, y: 1.2 + R() * 1.6, s: 2.3 + R() * 1.3, ry: R() * Math.PI * 2, ph: R() * 6.28,
          order: Math.min(1, Math.max(0, order)) * 0.75 + R() * 0.25, dx: (R() - 0.5) * 2, dz: (R() - 0.5) * 2,
        });
      }
    }
    const mesh = new THREE.InstancedMesh(geos[ai % 2], cloudMat, items.length);
    mesh.name = `mapa:nuvens:${key}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(mesh);
    areas[key] = { mesh, items, open: false, k: 0, target: 0, delay: 0 };
  }

  /** Põe as instâncias de uma área para a abertura k (0 = fechada, 1 = aberta). */
  function pose(a, t) {
    a.items.forEach((it, i) => {
      // cada bolo some na sua vez da onda
      const local = THREE.MathUtils.clamp((a.k * 1.6 - it.order * 0.6), 0, 1);
      const ease = local * local * (3 - 2 * local);
      const bob = Math.sin(t * 0.5 + it.ph) * 0.12;
      p3.set(it.x + it.dx * ease * 3, it.y + bob + ease * 4.5, it.z + it.dz * ease * 3);
      e.set(0, it.ry + t * 0.02 * (i % 2 ? 1 : -1), 0);
      q.setFromEuler(e);
      const sc = it.s * (1 - ease) * (1 + Math.sin(t * 0.7 + it.ph) * 0.03);
      m4.compose(p3, q, s3.set(sc, sc, sc));
      a.mesh.setMatrixAt(i, m4);
    });
    a.mesh.instanceMatrix.needsUpdate = true;
    a.mesh.visible = a.k < 0.999;
  }

  // ---------- ponte levadiça ----------
  const B = L.BRIDGE;
  const bridge = new THREE.Group();
  bridge.name = 'mapa:ponte';
  root.add(bridge);
  const woodMat = mat('mapa-ponte', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  const span = B.x1 - B.x0;
  const half = span / 2;
  const leafGeo = (() => {
    const parts = [];
    const n = Math.round(half / 0.3);
    for (let i = 0; i < n; i++) {
      const g = rb(0.27, 0.08, B.w, 0.02, 1).translate(0.15 + i * 0.3, -0.04, 0);
      parts.push(paint(g, i % 2 ? '#c98a55' : '#b77a48'));
    }
    for (const s of [-1, 1]) {
      parts.push(paint(rb(half, 0.08, 0.1, 0.02, 1).translate(half / 2, 0.42, s * B.rail), '#8e5a33'));
      for (let k = 0; k <= 3; k++) parts.push(paint(rb(0.08, 0.42, 0.08, 0.02, 1).translate(0.1 + (k / 3) * (half - 0.2), 0.0, s * B.rail), '#8e5a33'));
    }
    return mergeGeometries(parts);
  })();
  /**
   * Folha: dobradiça na margem (x0 ou x1), a folha deitada em direção ao meio do rio. As tábuas vão de -0,04 a +0,04
   * da dobradiça: deitada, o alto delas fica em B.deck, onde as patas pisam (o piso invisível logo abaixo).
   */
  const leaves = [B.x0, B.x1].map((hx, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(hx, B.deck - 0.04, B.z);
    if (i === 1) pivot.rotation.y = Math.PI;
    const leaf = new THREE.Mesh(leafGeo, woodMat);
    leaf.name = 'mapa:ponte-folha';
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    pivot.add(leaf);
    bridge.add(pivot);
    return pivot;
  });
  // torres das margens com as correntes
  // (as torres e o guarda-corpo têm colisão: layout.js, BRIDGE_TOWERS e ponte-guarda-*)
  const towerParts = [];
  for (const t of L.BRIDGE_TOWERS) {
    towerParts.push(paint(rb(0.4, 2.2, 0.4, 0.05, 1).translate(t.x, 0, t.z), '#8e5a33'));
    towerParts.push(paint(new THREE.ConeGeometry(0.34, 0.4, 4).rotateY(Math.PI / 4).translate(t.x, 2.4, t.z), '#c2483a'));
  }
  for (const hx of [B.x0 - 0.25, B.x1 + 0.25]) towerParts.push(paint(rb(0.3, 0.2, B.w + 1.0, 0.04, 1).translate(hx, 2.0, B.z), '#8e5a33'));
  for (const p of towerParts) p.deleteAttribute('uv');
  const towers = new THREE.Mesh(mergeGeometries(towerParts), woodMat);
  towers.castShadow = true;
  towers.receiveShadow = true;
  bridge.add(towers);
  // correntes: do alto da torre até a ponta de cada folha (refeitas com a folha)
  const chainMat = mat('mapa-corrente', () => new THREE.MeshStandardMaterial({ color: '#5a5a62', roughness: 0.5, metalness: 0.6 }));
  const chains = [];
  for (const [i, hx] of [[0, B.x0 - 0.25], [1, B.x1 + 0.25]]) {
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(cyl(0.018, 0.018, 1, 5), chainMat);
      bridge.add(m);
      chains.push({ m, i, top: new THREE.Vector3(hx, 2.05, B.z + s * B.rail) });
    }
  }
  // O piso de pisar da ponte deitada (src/game/ground.js): uma tampa sem desenho no alto das tábuas, de dobradiça a
  // dobradiça, entre os guarda-corpos. Só conta com a ponte deitada de vez (descendo, o rio segue fechado: puzzle.js).
  // Não gira com as folhas: o círculo de busca do chão (ground.js) cobre a ponte inteira, de margem a margem.
  const deckFloor = new THREE.Mesh(
    new THREE.BoxGeometry(span, 0.02, 2 * B.rail - 0.1).translate(0, -0.01, 0),
    mat('mapa-ponte-piso', () => new THREE.MeshBasicMaterial({ visible: false })),
  );
  deckFloor.name = 'mapa:ponte-piso';
  deckFloor.position.set((B.x0 + B.x1) / 2, B.deck, B.z);
  deckFloor.userData.walkable = B.deck + 0.05;
  deckFloor.visible = false;
  root.add(deckFloor);
  const bState = { k: 0, target: 0, delay: 0 }; // k: 0 = levantada, 1 = abaixada
  const tipLocal = new THREE.Vector3(half - 0.05, 0.0, 0);
  const tipW = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  function poseBridge() {
    const ease = bState.k * bState.k * (3 - 2 * bState.k);
    const ang = (1 - ease) * 1.22; // levantada ~70°
    leaves.forEach((p) => { p.children[0].rotation.z = ang; });
    deckFloor.visible = bState.k >= 1;
    bridge.updateMatrixWorld(true);
    for (const c of chains) {
      const leaf = leaves[c.i].children[0];
      tipW.copy(tipLocal);
      leaf.localToWorld(tipW);
      tipW.z = c.top.z;
      dir.subVectors(tipW, c.top);
      const len = dir.length();
      c.m.position.copy(c.top);
      c.m.scale.set(1, len, 1);
      c.m.quaternion.setFromUnitVectors(up, dir.normalize());
    }
  }
  poseBridge();

  return {
    clouds: {
      setOpen(zone, open, { instant = false, delay = 0 } = {}) {
        const a = areas[zone];
        if (!a) return;
        a.open = !!open;
        a.target = open ? 1 : 0;
        a.delay = instant ? 0 : delay;
        if (instant) { a.k = a.target; pose(a, 0); a.mesh.boundingSphere = null; }
      },
      isOpen: (zone) => !!areas[zone]?.open,
    },
    bridge: {
      setDown(down, { instant = false, delay = 0 } = {}) {
        bState.target = down ? 1 : 0;
        bState.delay = instant ? 0 : delay;
        if (instant) { bState.k = bState.target; poseBridge(); }
      },
      get down() { return bState.target === 1; },
    },
    update(dt, t) {
      for (const a of Object.values(areas)) {
        if (a.delay > 0) { a.delay -= dt; continue; }
        if (a.k !== a.target) {
          a.k = THREE.MathUtils.clamp(a.k + Math.sign(a.target - a.k) * dt / 2.4, 0, 1);
          // abrindo, os bolos sobem e espalham: a esfera do recorte da câmera é refeita
          a.mesh.boundingSphere = null;
        }
        if (a.k < 0.999) pose(a, t);
        else a.mesh.visible = false;
      }
      if (bState.delay > 0) bState.delay -= dt;
      else if (bState.k !== bState.target) {
        bState.k = THREE.MathUtils.clamp(bState.k + Math.sign(bState.target - bState.k) * dt / B.lowerSec, 0, 1);
        poseBridge();
      }
    },
  };
}
