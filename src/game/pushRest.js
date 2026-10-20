// Onde as patas da frente apoiam empurrando de pé (dogAnimation.js: empurrando caixote ou carrinho, ou fazendo força
// nele): no desenho do objeto, não na caixa de colisão dele. A caixa pode ser maior que o desenho e mais alta que a
// beirada (no carrinho da fase 1 ela passa 6 cm de cada ponta e a beirada fica a 37,5 cm: a pata ficava no ar, retorno
// do usuário). Raios horizontais saem do centro da dog, para a frente, em várias alturas: a face é onde o desenho está
// mais perto; a beirada é o alto dela (coisa baixa: as patas vão em cima); as patas apoiam na altura da face mais
// perto da preferida.
import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
/** Folga para contar como a mesma face (m): uma tábua da borda, um saco mais para dentro, não. */
const FACE_TOL = 0.02;

/** O que o raio acertou aparece na tela? (escondido ou transparente de todo, não conta) @param {THREE.Object3D} o */
export function shown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  const m = /** @type {any} */ (o).material;
  return !(m && m.transparent && m.opacity <= 0.01);
}

/** Distância (m) do ponto (x, y, z) até o desenho `obj` na direção (dx, dz); Infinity se não há nada até `far`. */
function hitAt(obj, x, y, z, dx, dz, far) {
  _o.set(x, y, z);
  _d.set(dx, 0, dz);
  _ray.set(_o, _d);
  _ray.near = 0;
  _ray.far = far;
  for (const h of _ray.intersectObject(obj, true)) if (shown(h.object)) return h.distance;
  return Infinity;
}

/**
 * @param {THREE.Object3D} obj desenho do objeto (já no lugar)
 * @param {{ x: number, z: number, yaw: number }} at centro e rumo da dog
 * @param {{ near: number, pref: number, scale?: number }} o near: distância do centro até a caixa de colisão (m);
 *   pref: altura preferida das patas (m); scale: tamanho da dog (1 = Radhija)
 * @returns {{ gap: number, top: number, y: number } | null} distância até a face, alto da face (a beirada) e a altura
 *   das patas nela; null se os raios não acham o desenho
 */
export function pushRest(obj, at, { near, pref, scale = 1 }) {
  obj.updateMatrixWorld(true);
  const dx = Math.sin(at.yaw), dz = Math.cos(at.yaw);
  const far = near + 0.6;
  const y0 = 0.14 * scale, y1 = 0.64 * scale, step = 0.03 * scale;
  const ys = [], ds = [];
  for (let y = y0; y <= y1 + 1e-6; y += step) {
    ys.push(y);
    ds.push(hitAt(obj, at.x, y, at.z, dx, dz, far));
  }
  const dmin = Math.min(...ds);
  if (!Number.isFinite(dmin)) return null;
  // a face: as alturas em que o desenho está a até FACE_TOL do mais perto (da mais baixa à mais alta, contínuas a
  // partir da mais perto)
  // (frestas pequenas, como entre as tábuas da ponta do carrinho, não acabam a face)
  const iMin = ds.indexOf(dmin);
  const isFace = (i) => ds[i] <= dmin + FACE_TOL;
  const slit = Math.max(1, Math.round((0.05 * scale) / step)); // quantos raios seguidos podem passar por uma fresta
  let lo = iMin, hi = iMin;
  for (let i = iMin - 1, miss = 0; i >= 0 && miss <= slit; i--) {
    if (isFace(i)) { lo = i; miss = 0; } else miss++;
  }
  for (let i = iMin + 1, miss = 0; i < ys.length && miss <= slit; i++) {
    if (isFace(i)) { hi = i; miss = 0; } else miss++;
  }
  // a beirada, refinada entre a última altura da face e a seguinte; se a face passa do alto dos raios, é alta
  let top;
  if (hi === ys.length - 1) top = Infinity;
  else {
    let a = ys[hi], b = ys[hi + 1];
    for (let k = 0; k < 5; k++) {
      const m = (a + b) / 2;
      if (hitAt(obj, at.x, m, at.z, dx, dz, far) <= dmin + FACE_TOL) a = m;
      else b = m;
    }
    top = a;
  }
  // as patas: na altura da face (fora das frestas) mais perto da preferida
  let y = ys[lo];
  for (let i = lo; i <= hi; i++) if (isFace(i) && Math.abs(ys[i] - pref) < Math.abs(y - pref)) y = ys[i];
  if (Number.isFinite(top) && pref > top) y = top;
  return { gap: dmin, top, y };
}
