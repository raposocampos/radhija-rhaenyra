// Onde as patas da frente apoiam empurrando de pé (dogAnimation.js: empurrando caixote ou carrinho, ou fazendo força
// nele): no desenho do objeto, não na caixa de colisão dele. A caixa pode ser maior que o desenho e mais alta que a
// beirada (no carrinho da fase 1 ela passa 6 cm de cada ponta e a beirada fica a 37,5 cm: a pata ficava no ar, retorno
// do usuário). Raios horizontais saem da frente da dog, na largura do peito (cinco, de 4,5 em 4,5 cm), em várias
// alturas: a face é onde o desenho está mais perto; a beirada é o alto dela (coisa baixa: as patas vão em cima); as
// patas apoiam na altura da face mais perto da preferida. Uma face de verdade pega três raios ou mais: um pé fino (o
// cano do ventilador) só conta sem nenhuma face larga ao alcance, e aí as patas o abraçam (`round`, centradas nele,
// `lat`); sem nada ao alcance (o cano passou entre os raios), elas abraçam o eixo do meio do desenho. Com um raio só,
// no meio, o ventilador ora dava o cano, ora a grade, ora nada, e a pata ficava no ar (retorno do usuário).
// Desempenho (retorno do usuário: "como se o fps baixasse muito quando eu aperto o R1 pra empurrar algo"): uma medida
// são ~110 raios, e cada raio do Raycaster testava os triângulos de todas as malhas do objeto (o carrinho tem 56 malhas
// e 16 mil triângulos: 30 ms por medida). Agora cada raio só testa os triângulos das malhas cuja caixa ele cruza, da
// mais perto para a mais longe, e para no primeiro acerto que nenhuma caixa mais à frente pode bater (nearestHit: o
// mesmo resultado, test/chao.test.mjs confere contra o Raycaster).
import * as THREE from 'three';

const _ray = new THREE.Raycaster();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _box = new THREE.Box3();
const _c = new THREE.Vector3();
/** Folga para contar como a mesma face (m): uma tábua da borda, um saco mais para dentro, não. */
const FACE_TOL = 0.02;

/** O que o raio acertou aparece na tela? (escondido ou transparente de todo, não conta) @param {THREE.Object3D} o */
export function shown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  const m = /** @type {any} */ (o).material;
  return !(m && m.transparent && m.opacity <= 0.01);
}

/**
 * As malhas do desenho `obj` (ele e os filhos). Os raios só olham malhas: um brilho em sprite, sem câmera no raio,
 * quebraria o raycast do three.js. @param {THREE.Object3D} obj @returns {THREE.Mesh[]}
 */
export function meshesOf(obj) {
  /** @type {THREE.Mesh[]} */
  const out = [];
  obj.traverse((o) => {
    if (/** @type {any} */ (o).isMesh) out.push(/** @type {THREE.Mesh} */ (o));
  });
  return out;
}

/**
 * As malhas que aparecem e que o raio enxerga (camadas), cada uma com a caixa dela no mundo (onde estão agora), para os
 * raios de uma medida. @param {THREE.Mesh[]} meshes @returns {{ m: THREE.Mesh, box: THREE.Box3 | null, e: number }[]}
 */
export function prepareHits(meshes, raycaster = _ray) {
  const list = [];
  for (const m of meshes) {
    if (!shown(m) || !m.layers.test(raycaster.layers)) continue;
    const any = /** @type {any} */ (m);
    let box = null;
    if (any.isInstancedMesh) {
      // as instâncias espalhadas: a caixa de todas
      if (!any.boundingBox) any.computeBoundingBox();
      box = any.boundingBox ? new THREE.Box3().copy(any.boundingBox).applyMatrix4(m.matrixWorld) : null;
    } else if (!any.isSkinnedMesh && m.geometry) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      box = new THREE.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
    }
    list.push({ m, box, e: 0 }); // (sem caixa confiável, a malha é sempre testada)
  }
  return list;
}
const _hits = [];
/** @type {{ m: THREE.Mesh, box: THREE.Box3 | null, e: number }[]} */
const _cand = [];
const _p = new THREE.Vector3();
/**
 * A distância do acerto mais perto do raio (raycaster, entre near e far) nas malhas preparadas, ou Infinity: só os
 * triângulos das malhas cuja caixa o raio cruza, em ordem de distância da caixa, até a próxima caixa começar depois do
 * acerto (o mesmo que o primeiro acerto do Raycaster.intersectObjects com todas). @param {ReturnType<typeof prepareHits>} list
 */
export function nearestHit(list, raycaster = _ray) {
  const R = raycaster.ray;
  _cand.length = 0;
  for (const it of list) {
    if (!it.box) it.e = 0;
    else if (it.box.containsPoint(R.origin)) it.e = 0;
    else {
      const p = R.intersectBox(it.box, _p);
      if (!p) continue;
      it.e = p.distanceTo(R.origin);
    }
    if (it.e <= raycaster.far) _cand.push(it);
  }
  _cand.sort((a, b) => a.e - b.e);
  let best = Infinity;
  for (const it of _cand) {
    if (it.e > best) break;
    _hits.length = 0;
    it.m.raycast(raycaster, _hits);
    for (const h of _hits) if (h.distance < best && h.distance >= raycaster.near && h.distance <= raycaster.far) best = h.distance;
  }
  return best;
}

/** Distância (m) do ponto (x, y, z) até as malhas na direção (dx, dz); Infinity se não há nada até `far`. */
function hitAt(list, x, y, z, dx, dz, far) {
  _o.set(x, y, z);
  _d.set(dx, 0, dz);
  _ray.set(_o, _d);
  _ray.near = 0;
  _ray.far = far;
  return nearestHit(list, _ray);
}

/**
 * @param {THREE.Object3D} obj desenho do objeto (já no lugar)
 * @param {{ x: number, z: number, yaw: number }} at centro e rumo da dog
 * @param {{ near: number, pref: number, scale?: number }} o near: distância do centro até a caixa de colisão (m);
 *   pref: altura preferida das patas (m); scale: tamanho da dog (1 = Radhija)
 * @returns {{ gap: number, top: number, y: number, round: boolean, lat: number } | null} distância até a face, alto da
 *   face (a beirada), a altura das patas nela, se é um pé fino (as patas o abraçam) e para que lado ele está (m, + = a
 *   esquerda de quem olha para a frente, o x do corpo); null se o desenho está todo atrás da dog
 */
export function pushRest(obj, at, { near, pref, scale = 1 }) {
  obj.updateWorldMatrix(true, true);
  const meshes = prepareHits(meshesOf(obj));
  const dx = Math.sin(at.yaw), dz = Math.cos(at.yaw);
  const far = near + 0.6;
  const y0 = 0.14 * scale, y1 = 0.64 * scale, step = 0.03 * scale;
  const lats = [-2, -1, 0, 1, 2].map((k) => k * 0.045 * scale);
  /** O desenho mais perto na altura y, entre os raios da largura do peito → [distância, quantos raios nela, meio deles]. */
  const scan = (y) => {
    const dl = lats.map((l) => hitAt(meshes, at.x + dz * l, y, at.z - dx * l, dx, dz, far));
    const d = Math.min(...dl);
    if (!Number.isFinite(d)) return [Infinity, 0, 0];
    const on = lats.filter((l, i) => dl[i] <= d + FACE_TOL);
    return [d, on.length, on.reduce((a, b) => a + b, 0) / on.length];
  };
  const ys = [], ds = [], ws = [], cs = [];
  for (let y = y0; y <= y1 + 1e-6; y += step) {
    const [d, w, c] = scan(y);
    ys.push(y);
    ds.push(d);
    ws.push(w);
    cs.push(c);
  }
  // com alguma face larga ao alcance, os pés finos não contam
  const wide = ws.some((n) => n >= 3);
  const use = (i) => Number.isFinite(ds[i]) && (!wide || ws[i] >= 3);
  let dmin = Infinity, iMin = -1;
  for (let i = 0; i < ds.length; i++) {
    if (use(i) && ds[i] < dmin) {
      dmin = ds[i];
      iMin = i;
    }
  }
  if (iMin < 0) {
    // nada ao alcance dos raios (o cano fino passou entre eles, a grade fica alta): as patas abraçam o eixo do meio
    _box.setFromObject(obj).getCenter(_c);
    const fwd = (_c.x - at.x) * dx + (_c.z - at.z) * dz;
    if (fwd <= 0) return null;
    return { gap: Math.max(near * 0.5, fwd - 0.02 * scale), top: Infinity, y: Math.min(Math.max(pref, y0), y1), round: true, lat: (_c.x - at.x) * dz - (_c.z - at.z) * dx };
  }
  // a face: as alturas em que o desenho está a até FACE_TOL do mais perto (da mais baixa à mais alta, contínuas a
  // partir da mais perto)
  // (frestas pequenas, como entre as tábuas da ponta do carrinho, não acabam a face)
  const isFace = (i) => use(i) && ds[i] <= dmin + FACE_TOL;
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
      const [d, w] = scan(m);
      if (d <= dmin + FACE_TOL && (!wide || w >= 3)) a = m;
      else b = m;
    }
    top = a;
  }
  // as patas: na altura da face (fora das frestas) mais perto da preferida
  let iy = lo;
  for (let i = lo; i <= hi; i++) if (isFace(i) && Math.abs(ys[i] - pref) < Math.abs(ys[iy] - pref)) iy = i;
  let y = ys[iy];
  if (Number.isFinite(top) && pref > top) y = top;
  return { gap: dmin, top, y, round: !wide, lat: wide ? 0 : cs[iy] };
}
