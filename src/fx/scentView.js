// Desenho do cheiro (src/game/mechanics/scent.js): nuvens verdes cartunescas feitas de bolhas que
// balançam e somem no fim da vida, e a prévia da mira do superbafo (pontinhos no chão + saídas de duto).
import * as THREE from 'three';
import { createResourceScope, ownResource } from '../core/resources.js';

const PUFFS = [
  [0, 0.55, 0, 1.0], [0.55, 0.42, 0.15, 0.72], [-0.5, 0.45, -0.1, 0.78], [0.15, 0.85, -0.35, 0.62],
  [-0.2, 0.38, 0.5, 0.66], [0.3, 0.3, -0.55, 0.58], [-0.42, 0.9, 0.25, 0.5],
];
const MAX_DOTS = 40;

/** Cria o desenho da fase. clear() reinicia nuvens; dispose() encerra a vista. */
export function createScentView(root) {
  const group = new THREE.Group();
  group.name = 'cheiro';
  root.add(group);
  const resources = createResourceScope(group);
  // A esfera sobrevive entre nuvens, inclusive quando nenhuma está na árvore.
  const sphere = ownResource(group, new THREE.SphereGeometry(1, 14, 10));
  const views = new Map();
  let time = 0;
  let disposed = false;

  function make() {
    const mat = new THREE.MeshStandardMaterial({
      color: '#9BE36B', emissive: '#3F7A1C', emissiveIntensity: 0.35, roughness: 1, metalness: 0,
      transparent: true, opacity: 0, depthWrite: false,
    });
    const g = new THREE.Group();
    const puffs = PUFFS.map(([x, y, z, s], i) => {
      const m = new THREE.Mesh(sphere, mat);
      m.userData.base = { x, y, z, s, ph: i * 1.7 };
      g.add(m);
      return m;
    });
    group.add(g);
    return { g, mat, puffs };
  }

  function sync(clouds, dt) {
    if (disposed) return;
    time += dt;
    const alive = new Set();
    for (const c of clouds) {
      alive.add(c.id);
      let v = views.get(c.id);
      if (!v) { v = make(); views.set(c.id, v); }
      v.g.visible = c.state === 'free';
      if (!v.g.visible) continue;
      const fadeIn = Math.min(1, c.age / 0.25);
      const fadeOut = Math.min(1, (c.life - c.age) / (c.life * 0.3));
      // espalhando: mais rala, mais baixa e mais transparente (não esconde as dogs)
      const R = c.r;
      const thin = Math.min(1, Math.max(0.3, 0.42 / R));
      v.mat.opacity = 0.55 * fadeIn * Math.max(0, fadeOut) * thin;
      v.g.position.set(c.x, 0, c.z);
      const puffS = 0.12 + R * 0.3;
      const puffY = 0.18 + R * 0.22;
      for (const m of v.puffs) {
        const b = m.userData.base;
        const wob = 1 + 0.08 * Math.sin(time * 3.1 + b.ph);
        m.position.set(b.x * R * 0.75, b.y * puffY, b.z * R * 0.75);
        m.scale.setScalar(b.s * puffS * wob);
      }
    }
    for (const [id, v] of views) {
      if (alive.has(id)) continue;
      group.remove(v.g);
      v.mat.dispose();
      views.delete(id);
    }
  }

  // ---------- prévia da mira ----------
  const dotGeo = new THREE.CircleGeometry(0.045, 12).rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#B8F28C', transparent: true, opacity: 0.85, depthWrite: false });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, MAX_DOTS);
  dots.count = 0;
  dots.renderOrder = 2;
  dots.frustumCulled = false;
  const ringGeo = new THREE.RingGeometry(0.16, 0.22, 24).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#B8F28C', transparent: true, opacity: 0.8, depthWrite: false });
  const rings = [new THREE.Mesh(ringGeo, ringMat), new THREE.Mesh(ringGeo, ringMat)];
  const preview = new THREE.Group();
  preview.name = 'mira-do-bafo';
  preview.add(dots, ...rings);
  preview.visible = false;
  group.add(preview);
  const _m = new THREE.Matrix4();

  /** p = scent.preview(...): pontinhos espaçados ao longo do caminho; anéis nas saídas de duto e no fim. */
  function showPreview(p) {
    if (disposed) return;
    const pts = p.points;
    let n = 0;
    let acc = 0;
    for (let i = 1; i < pts.length && n < MAX_DOTS; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      if (acc < 0.16) continue;
      acc = 0;
      const s = 1 - 0.5 * (n / MAX_DOTS);
      _m.makeScale(s, 1, s).setPosition(pts[i].x, 0.02, pts[i].z);
      dots.setMatrixAt(n++, _m);
    }
    dots.count = n;
    dots.instanceMatrix.needsUpdate = true;
    const ends = [...p.exits.slice(0, 1), pts[pts.length - 1]];
    rings.forEach((r, i) => {
      const e = ends[i];
      r.visible = !!e;
      if (e) r.position.set(e.x, 0.02, e.z);
    });
    preview.visible = true;
  }
  function hidePreview() { preview.visible = false; }

  function clear() {
    if (disposed) return;
    for (const v of views.values()) { group.remove(v.g); v.mat.dispose(); }
    views.clear();
    hidePreview();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    views.clear();
    resources.dispose();
  }

  return { sync, showPreview, hidePreview, clear, dispose, group };
}
