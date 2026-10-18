// FASE 7 · Os dois objetos do piquenique: a bolinha de tênis (no chão do parquinho) e o frisbee (no deque do
// escorregador). Cada um tem destaque quando é a vez dele: brilho pulsando, halo e estrelinhas, e a sombra
// de contato acompanha enquanto estiver no cenário (na boca de uma dog ou na toalha, a sombra some).
import * as THREE from 'three';
import { canvasTexture, contactShadow, radialTexture, vnoise3 } from '../../../world/util.js';
import { createFrisbee } from '../../../world/toys.js';
import { starTexture } from '../../../world/treats.js';

const TAU = Math.PI * 2;

/** Feltro amarelo com a costura em "S" (mesmo desenho da bolinha da fase 2). */
function tennisTexture() {
  return canvasTexture(256, 128, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const lon = u * TAU, lat = (0.5 - v) * Math.PI;
      const seam = Math.abs(lat - 0.42 * Math.sin(2 * lon) * Math.cos(lat * 0.2));
      const n = vnoise3(x * 0.35, y * 0.35, 0) * 0.5 + vnoise3(x * 1.3, y * 1.3, 2) * 0.5;
      let r = 205 + n * 40, gg = 232 + n * 22, b = 40 + n * 30;
      const k = Math.max(0, 1 - seam / 0.075);
      const line = k > 0 ? Math.min(1, k * 2.2) : 0;
      r += (246 - r) * line; gg += (246 - gg) * line; b += (236 - b) * line;
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, { repeat: false });
}

/**
 * Destaque de um objeto: halo, estrelinhas e brilho próprio pulsando; a sombra segue o objeto no cenário.
 * @param {THREE.Group} root @param {THREE.Object3D} obj @param {THREE.Material[]} glowMats @param {{ color: string, shadow: number, base?: number }} o
 */
function highlighter(root, obj, glowMats, { color, shadow, base = 0.08 }) {
  const homeParent = obj.parent;
  const starTex = starTexture();
  const sh = contactShadow(shadow, shadow, 0.5);
  root.add(sh);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.62, 0.62, 1);
  root.add(halo);
  const stars = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fffbe0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.08);
    root.add(s);
    return { s, ph: i * 2.1 };
  });
  let hl = 0, hlT = 0;
  const wp = new THREE.Vector3();
  return {
    set(on) { hlT = on ? 1 : 0; },
    reset() { hl = hlT = 0; },
    update(dt, t) {
      hl += (hlT - hl) * Math.min(1, dt * 4);
      const inScene = obj.parent === homeParent;
      obj.getWorldPosition(wp);
      const pulse = hl * (0.6 + 0.4 * Math.sin(t * 3.2));
      for (const m of glowMats) /** @type {any} */ (m).emissiveIntensity = base + 0.4 * pulse;
      sh.visible = inScene;
      sh.position.set(wp.x, wp.y + 0.006, wp.z);
      halo.visible = inScene && hl > 0.01;
      halo.position.copy(wp).y += 0.05;
      halo.material.opacity = 0.5 * pulse;
      stars.forEach((cs, i) => {
        const cyc = ((t * 0.8 + cs.ph) % 2.4) / 2.4;
        const f = Math.sin(cyc * Math.PI) * hl * (inScene ? 1 : 0);
        cs.s.material.opacity = f * 0.9;
        const a = t * 0.6 + i * 2.09;
        cs.s.position.set(wp.x + Math.cos(a) * 0.16, wp.y + 0.06 + cyc * 0.18, wp.z + Math.sin(a) * 0.12);
        cs.s.scale.setScalar(0.05 + f * 0.05);
      });
    },
  };
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildItems(root, layout) {
  const B = layout.BALL, F = layout.FRISBEE;
  // bolinha de tênis
  const ballObj = new THREE.Group();
  ballObj.name = 'ball';
  ballObj.userData.carryKind = 'ball';
  const felt = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: tennisTexture(), roughness: 0.85, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#f4ff9a'),
    emissive: '#c8e632', emissiveIntensity: 0.08,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(B.r, 32, 20), felt);
  core.rotation.set(0.4, 0.8, 0.2);
  core.castShadow = true;
  core.receiveShadow = true;
  const fuzz = new THREE.Mesh(new THREE.SphereGeometry(B.r * 1.06, 24, 16), new THREE.MeshStandardMaterial({ color: '#efff8a', transparent: true, opacity: 0.18, roughness: 1, depthWrite: false }));
  ballObj.add(core, fuzz);
  const ballHome = new THREE.Vector3(B.x, B.r, B.z);
  ballObj.position.copy(ballHome);
  root.add(ballObj);
  const ballHl = highlighter(root, ballObj, [felt], { color: '#e8ff6a', shadow: 0.1 });
  // frisbee no deque
  const frisbeeObj = createFrisbee(F.size);
  const frisbeeHome = new THREE.Vector3(F.x, F.y, F.z);
  frisbeeObj.position.copy(frisbeeHome);
  frisbeeObj.rotation.y = 0.4;
  root.add(frisbeeObj);
  const glow = [];
  frisbeeObj.traverse((/** @type {THREE.Mesh} */ o) => {
    if (!o.isMesh) return;
    const m = /** @type {THREE.MeshPhysicalMaterial} */ (o.material);
    m.emissive = new THREE.Color(m.color).multiplyScalar(0.5);
    m.emissiveIntensity = 0;
    glow.push(m);
  });
  const frisbeeHl = highlighter(root, frisbeeObj, glow, { color: '#ffb3a6', shadow: F.size * 0.6, base: 0 });

  /** @type {import('../../../types').ItemProp} */
  const ball = { object: ballObj, home: ballHome.clone(), setHighlight(on) { ballHl.set(on); } };
  /** @type {import('../../../types').ItemProp} */
  const frisbee = { object: frisbeeObj, home: frisbeeHome.clone(), setHighlight(on) { frisbeeHl.set(on); } };
  return {
    ball, frisbee,
    update(dt, t) {
      ballHl.update(dt, t);
      frisbeeHl.update(dt, t);
    },
    reset() {
      for (const [obj, home, rotY] of [[ballObj, ballHome, 0], [frisbeeObj, frisbeeHome, 0.4]]) {
        if (obj.parent !== root) root.add(obj);
        obj.position.copy(/** @type {THREE.Vector3} */ (home));
        obj.rotation.set(0, /** @type {number} */ (rotY), 0);
      }
      ballHl.reset();
      frisbeeHl.reset();
    },
  };
}
