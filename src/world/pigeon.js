// Pombo procedural (fases 4 e 10): fofo, mas com cara de pombo de praça. Corpo em gota com peito cheio, pescoço
// furta-cor (verde e violeta que trocam com o ângulo de visão), cabeça cinza-azulada com olho laranja brilhante, bico
// escuro com a carúncula branca, asas com as duas barras escuras e as primárias em degrau, cauda em leque com a faixa
// escura na ponta e pés rosados com unhas.
// createPigeon({ seed, tint, scale }) → { object, setPose(p), peek(), peck(), update(dt, t) }.
// setPose({ x, y, z, yaw, flying, flightProgress?, asleep }): posição dos pés; flying bate as asas; asleep encolhe o
// pescoço, afofa as penas, fecha os olhos e solta "zzz". peek() abre um olho só (latido); peck() bica duas vezes e
// bate as asas no lugar (acorda num susto e volta a cochilar se asleep continuar).
// Custo: 7 malhas e 1 material por pombo (cor, brilho e furta-cor por vértice). Asas, olhos e leque da cauda mudam
// por alvos de morph na GPU; o update não recria geometria.
import * as THREE from 'three';
import { canvasTexture, rng } from './util.js';
import { shareResource } from '../core/resources.js';

const { smoothstep: ss, lerp, clamp } = THREE.MathUtils;

// Medidas em metros: pés na origem, bico para +z. Pivôs no corpo (ou no pai indicado).
const TORSO = [0, 0.118, 0];
const NECK = [0, 0.162, 0.07]; // base do pescoço, dentro do peito
const HEAD = [0, 0.06, 0.026]; // no pescoço: topo, dentro da cabeça
const WING = [0.058, 0.168, 0.058]; // ombro direito
const TAIL = [0, 0.112, -0.115]; // raiz da cauda, dentro do traseiro
const HIP_Y = 0.075, HIP_Z = 0.012, LEG_X = 0.026;
const PECK = 1.05, BLINK = 0.16, LANDING = 0.24;
const FX0 = [0, 0, 0];

/** Material único do pombo: cor por vértice, furta-cor (pigeonFx.x = intensidade, .z = matiz) e brilho próprio (.y). */
function plumageMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 pigeonFx;\nvarying vec3 vPigeonFx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPigeonFx = pigeonFx;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPigeonFx;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // furta-cor: o matiz anda do verde para o violeta conforme a pena vira de lado para a câmera
        vec3 pigeonView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        float pigeonFacing = clamp(dot(normal, pigeonView), 0.0, 1.0);
        float pigeonHue = clamp(vPigeonFx.z + (0.6 - pigeonFacing) * 1.2, 0.0, 1.0);
        vec3 pigeonIrid = mix(vec3(0.05, 0.32, 0.18), vec3(0.32, 0.08, 0.38), pigeonHue);
        diffuseColor.rgb = mix(diffuseColor.rgb, pigeonIrid, vPigeonFx.x * 0.88);
        roughnessFactor = mix(roughnessFactor, 0.34, vPigeonFx.x);
        metalnessFactor = mix(metalnessFactor, 0.28, vPigeonFx.x);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // brilho do olho e da carúncula; borda levemente clara de penugem
        totalEmissiveRadiance += diffuseColor.rgb * (vPigeonFx.y + pow(1.0 - pigeonFacing, 3.0) * 0.14);`);
  };
  m.customProgramCacheKey = () => 'pigeon-plumage-1';
  return m;
}

/** Soma as normais de vértices na mesma posição (emendas e polos das esferas ficam lisos). */
function weldNormals(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  /** @type {Map<string, number[]>} */
  const groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
    const list = groups.get(key);
    if (list) list.push(i); else groups.set(key, [i]);
  }
  const v = new THREE.Vector3();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of list) v.set(v.x + n.getX(i), v.y + n.getY(i), v.z + n.getZ(i));
    v.normalize();
    for (const i of list) n.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

/**
 * Esfera unitária deformada por shape(x, y, z, out); cor e efeitos calculados nas coordenadas da esfera.
 * @param {number} wSeg @param {number} hSeg
 * @param {(x: number, y: number, z: number, out: THREE.Vector3) => void} shape
 * @param {(x: number, y: number, z: number) => THREE.Color} color
 * @param {(x: number, y: number, z: number) => number[]} [fx]
 * @param {boolean} [alongZ] polos na frente e atrás (tronco) em vez de em cima e embaixo
 */
function blob(wSeg, hSeg, shape, color, fx, alongZ = false) {
  const geo = new THREE.SphereGeometry(1, wSeg, hSeg);
  if (alongZ) geo.rotateX(Math.PI / 2);
  const p = geo.attributes.position, out = new THREE.Vector3();
  const col = new Float32Array(p.count * 3), eff = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    color(x, y, z).toArray(col, i * 3);
    const f = fx ? fx(x, y, z) : FX0;
    eff[i * 3] = f[0]; eff[i * 3 + 1] = f[1]; eff[i * 3 + 2] = f[2];
    shape(x, y, z, out);
    p.setXYZ(i, out.x, out.y, out.z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('pigeonFx', new THREE.BufferAttribute(eff, 3));
  geo.computeVertexNormals();
  return weldNormals(geo);
}

/** Pena canônica: raiz em z = 0 e ponta em z = 1; espessura (x) e largura (y) unitárias; raiz mais estreita. */
function featherShape() {
  const geo = new THREE.SphereGeometry(1, 6, 9).rotateX(Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getZ(i) + 1) / 2;
    p.setXYZ(i, p.getX(i) * 0.5, p.getY(i) * 0.5 * (0.5 + 0.5 * ss(u, 0, 0.45)), u);
  }
  geo.computeVertexNormals();
  return weldNormals(geo);
}

/**
 * Coberteiras: folha larga em concha. Dobrada, a borda de cima (y < 0) curva forte em direção ao dorso e a de
 * baixo encosta no flanco; aberta, a borda de trás arqueia para baixo.
 */
function panelShape() {
  const geo = new THREE.SphereGeometry(1, 12, 12).rotateX(Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getZ(i) + 1) / 2, y = p.getY(i);
    p.setXYZ(i, p.getX(i) * 0.5 - (y < 0 ? 1.4 : 0.12) * y * y * (1 - 0.4 * u), y * 0.5 * (1 - 0.3 * u), u);
  }
  geo.computeVertexNormals();
  return weldNormals(geo);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
/**
 * Põe uma peça canônica (pena/coberteira) no lugar: raiz em `at`, comprimento (+z) ao longo de `dir`, dorso (+x)
 * virado para `back`. Sempre uma rotação própria: os alvos de morph interpolam sem virar a peça do avesso.
 * @param {number[]} at @param {number[]} dir @param {number[]} back
 * @param {number} thick @param {number} width @param {number} len
 */
function frame(at, dir, back, thick, width, len) {
  _c.fromArray(dir).normalize();
  _a.fromArray(back);
  _a.addScaledVector(_c, -_a.dot(_c)).normalize();
  _b.crossVectors(_c, _a);
  return new THREE.Matrix4().makeBasis(_a.multiplyScalar(thick), _b.multiplyScalar(width), _c.multiplyScalar(len))
    .setPosition(at[0], at[1], at[2]);
}
/** Posição + eixo y local apontando para dir (+ escala). */
function along(pos, dir, scale = [1, 1, 1]) {
  _q.setFromUnitVectors(_up, _c.fromArray(dir).normalize());
  return new THREE.Matrix4().compose(_a.fromArray(pos), _q, _b.fromArray(scale));
}
const place = (x, y, z, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z);

/**
 * Junta peças numa só geometria (um draw call por parte móvel). Cada peça pode ter uma matriz por alvo de morph
 * (mesma topologia), e cor/efeitos são calculados nas coordenadas canônicas da peça.
 */
class Parts {
  /** @param {number} [targets] */
  constructor(targets = 0) {
    this.targets = targets;
    /** @type {{ geo: THREE.BufferGeometry, color?: any, fx?: any, at: (THREE.Matrix4 | null)[] }[]} */
    this.items = [];
  }
  /**
   * @param {THREE.BufferGeometry} geo
   * @param {{ color?: THREE.Color | ((x: number, y: number, z: number) => THREE.Color),
   *   fx?: number[] | ((x: number, y: number, z: number) => number[]),
   *   at?: THREE.Matrix4 | (THREE.Matrix4 | null)[] }} [opts] at: base e, opcional, uma por alvo (null = base)
   */
  add(geo, { color, fx, at } = {}) {
    this.items.push({ geo, color, fx, at: Array.isArray(at) ? at : [at || new THREE.Matrix4()] });
    return this;
  }
  /** @param {{ mirror?: boolean, names?: string[] }} [opts] mirror: espelha em x (asa esquerda), faces para fora */
  build({ mirror = false, names = [] } = {}) {
    const states = 1 + this.targets;
    let nv = 0, ni = 0;
    for (const { geo } of this.items) { nv += geo.attributes.position.count; ni += geo.index.count; }
    const pos = [], nor = [];
    for (let s = 0; s < states; s++) { pos.push(new Float32Array(nv * 3)); nor.push(new Float32Array(nv * 3)); }
    const col = new Float32Array(nv * 3), eff = new Float32Array(nv * 3), idx = new Uint16Array(ni);
    const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    for (const { geo, color, fx, at } of this.items) {
      const P = geo.attributes.position, N = geo.attributes.normal;
      const C = geo.attributes.color, F = geo.attributes.pigeonFx;
      for (let i = 0; i < P.count; i++) {
        const k = (vo + i) * 3, x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        if (color) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
        } else if (C) { col[k] = C.getX(i); col[k + 1] = C.getY(i); col[k + 2] = C.getZ(i); }
        const f = fx ? (typeof fx === 'function' ? fx(x, y, z) : fx) : null;
        if (f) { eff[k] = f[0]; eff[k + 1] = f[1]; eff[k + 2] = f[2]; }
        else if (F) { eff[k] = F.getX(i); eff[k + 1] = F.getY(i); eff[k + 2] = F.getZ(i); }
      }
      for (let s = 0; s < states; s++) {
        const m = at[s] || at[0];
        nm.getNormalMatrix(m);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m);
          n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
          if (mirror) { v.x = -v.x; n.x = -n.x; }
          v.toArray(pos[s], (vo + i) * 3);
          n.toArray(nor[s], (vo + i) * 3);
        }
      }
      const I = geo.index;
      for (let j = 0; j < I.count; j += 3) {
        const a = I.getX(j), b = I.getX(j + 1), c = I.getX(j + 2);
        idx[io++] = vo + a; idx[io++] = vo + (mirror ? c : b); idx[io++] = vo + (mirror ? b : c);
      }
      vo += P.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos[0], 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor[0], 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setAttribute('pigeonFx', new THREE.BufferAttribute(eff, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    if (this.targets) {
      out.morphAttributes.position = pos.slice(1).map((a, i) => Object.assign(new THREE.BufferAttribute(a, 3), { name: names[i] || '' }));
      out.morphAttributes.normal = nor.slice(1).map((a) => new THREE.BufferAttribute(a, 3));
    }
    out.computeBoundingSphere(); // inclui os alvos: asa aberta não some no recorte da câmera
    return out;
  }
}

let _zzz = null;
function zzzTexture() {
  if (_zzz) return _zzz;
  _zzz = canvasTexture(64, 64, (g, w, h) => {
    g.font = '700 40px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(74,52,38,0.9)';
    g.strokeText('z', w / 2, h / 2 + 2);
    g.fillStyle = '#fff8ec';
    g.fillText('z', w / 2, h / 2 + 2);
  }, { repeat: false });
  return shareResource(_zzz);
}

/** Meia senoide entre a e b (0 fora). */
const pulse = (p, a, b) => (p > a && p < b ? Math.sin(Math.PI * (p - a) / (b - a)) : 0);

/** @param {{ seed?: number, tint?: string, scale?: number }} [opts] */
export function createPigeon({ seed = 1, tint = '#8f96a6', scale = 1 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();
  root.name = 'pombo';
  const body = new THREE.Group(); // tudo acompanha a inclinação do tronco; os pés resolvem o apoio
  root.add(body);
  const mat = plumageMaterial();

  // Paleta: o tint de cada pombo vira dorso, barriga, cabeça e asas; detalhes têm cor própria.
  const C = (hex) => new THREE.Color(hex);
  const base = C(tint);
  const mantle = base.clone();
  const belly = base.clone().multiplyScalar(0.84);
  const headC = base.clone().multiplyScalar(0.78).lerp(C('#7f8db0'), 0.12);
  const slate = base.clone().multiplyScalar(0.6); // fundo do furta-cor
  const rump = base.clone().lerp(C('#e6e8ee'), 0.32);
  const wingC = base.clone().lerp(C('#d2d6dd'), 0.3);
  const barC = C('#262a33');
  const primC = base.clone().multiplyScalar(0.72);
  const tailC = base.clone().multiplyScalar(0.8);
  const tipC = C('#25282f');
  const pink = C('#e3858e'), clawC = C('#3d3337');
  const tmp = new THREE.Color();
  const band = (v, at, half) => 1 - ss(Math.abs(v - at), half * 0.55, half);

  // ---------------------------------------------------------------- tronco: peito cheio, dorso descendo à cauda
  const torso = new THREE.Mesh(new Parts().add(blob(24, 16, (x, y, z, o) => {
    const back = 1 - ss(z, -1, 0.25);
    const ry = lerp(0.084 * (1 - 0.45 * back), 0.07 * (1 - 0.26 * back), ss(y, -0.35, 0.35));
    o.set(x * 0.083 * (1 - 0.4 * back), y * ry + 0.028 * z,
      z * (z > 0 ? 0.128 : 0.158) + 0.02 * Math.max(0, z) * Math.max(0, 0.35 - y));
  }, (x, y, z) => tmp.copy(mantle)
    .lerp(belly, ss(-y, -0.1, 0.6))
    .lerp(rump, 0.8 * ss(-z, 0.55, 0.9) * ss(y, 0, 0.5))
    .lerp(slate, 0.7 * ss(z, 0.62, 0.92) * ss(y, -0.2, 0.35)),
  // só o alto do peito, emendando no pescoço, é furta-cor; o resto do peito é cinza
  (x, y, z) => [0.6 * ss(z, 0.62, 0.92) * ss(y, -0.2, 0.35), 0, 0.78], true)).build(), mat);
  torso.name = 'tronco';
  torso.position.fromArray(TORSO);

  // ---------------------------------------------------------------- pescoço furta-cor: violeta embaixo, verde em cima
  const neckPivot = new THREE.Group();
  neckPivot.position.fromArray(NECK);
  const neck = new THREE.Mesh(new Parts().add(blob(18, 12, (x, y, z, o) => {
    const s = (y + 1) / 2;
    const rad = lerp(0.047, 0.031, Math.pow(s, 0.85));
    o.set(x * rad, -0.012 + s * 0.09, z * rad * 0.97 + s * 0.032 + Math.max(0, z) * 0.008 * (1 - s));
  }, (x, y) => tmp.copy(slate).lerp(headC, ss((y + 1) / 2, 0.72, 0.9)),
  (x, y, z) => {
    const s = (y + 1) / 2;
    return [1 - ss(s, 0.66, 0.86), 0, lerp(0.85, 0.12, ss(s, 0.2, 0.62)) + 0.15 * Math.max(0, z) * (1 - s)];
  })).build(), mat);
  neck.name = 'pescoco';
  neckPivot.add(neck);

  // ---------------------------------------------------------------- cabeça: testa inclinada, bico, carúncula, olhos
  const headParts = new Parts(2); // alvos: olho direito fechado, olho esquerdo fechado
  headParts.add(blob(20, 14, (x, y, z, o) => {
    let Y = y * 0.042 + 0.016, Z = z * 0.045 + 0.012;
    if (z > 0) { Y -= Math.max(0, y) * z * z * 0.011; Z += z * z * 0.005 * (1 - Math.abs(y)); }
    o.set(x * 0.04, Y, Z);
  }, () => headC, (x, y) => [0.65 * ss(-y, 0.45, 0.95), 0, 0.15]));
  // bico fino e escuro, a ponta descendo de leve
  const beakGeo = new THREE.ConeGeometry(1, 1, 10, 3).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const bp = beakGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) - 0.55 * bp.getZ(i) * bp.getZ(i));
  beakGeo.computeVertexNormals();
  weldNormals(beakGeo);
  const beakDir = new THREE.Vector3(0, -0.22, 1).normalize();
  const beakUp = new THREE.Vector3(0, 1, 0.22).normalize();
  const beakAt = (x, y, z, sx, sy, sz) => new THREE.Matrix4().makeBasis(
    new THREE.Vector3(sx, 0, 0), beakUp.clone().multiplyScalar(sy), beakDir.clone().multiplyScalar(sz)).setPosition(x, y, z);
  const beakC = C('#3a3337'), beakTip = C('#5b5054');
  headParts.add(beakGeo, { color: (x, y, z) => tmp.copy(beakC).lerp(beakTip, ss(z, 0.5, 1)), at: beakAt(0, 0.0105, 0.05, 0.0085, 0.0072, 0.032) });
  // carúncula: um calombo branco em cima da base do bico (dois gominhos colados)
  const lobe = new THREE.SphereGeometry(1, 8, 6);
  for (const sx of [-1, 1]) {
    headParts.add(lobe, { color: C('#ece7df'), fx: [0, 0.04, 0], at: beakAt(sx * 0.0026, 0.0172, 0.057, 0.0052, 0.0052, 0.0105) });
  }
  // olhos: pele clara em volta, íris laranja que brilha, pupila e dois reflexos; fechados viram um risquinho
  const eyeBall = new THREE.SphereGeometry(1, 10, 6), spark = new THREE.SphereGeometry(1, 6, 4);
  const ringC = C('#cfc9c8'), pupilC = C('#100a0a'), white = C('#ffffff');
  const irisIn = C('#ffbb3d'), irisOut = C('#e05a1c'), irisRim = C('#7a2410');
  for (const sx of [1, -1]) {
    const c = new THREE.Vector3(sx * 0.0366, 0.0245, 0.0268);
    const nrm = new THREE.Vector3(sx * 0.93, 0.195, 0.296).normalize();
    c.addScaledVector(nrm, -0.0025); // meio embutido: o olho não salta da silhueta
    const up =new THREE.Vector3(0, 1, 0).addScaledVector(nrm, -nrm.y).normalize();
    const side = new THREE.Vector3().crossVectors(up, nrm);
    const fwd = new THREE.Vector3(0, 0, 1).addScaledVector(nrm, -nrm.z).addScaledVector(up, -up.z).normalize();
    const eyeAt = (dn, du, df, sa, sb, sc) => new THREE.Matrix4().makeBasis(
      side.clone().multiplyScalar(sa), up.clone().multiplyScalar(sb), nrm.clone().multiplyScalar(sc))
      .setPosition(c.clone().addScaledVector(nrm, dn).addScaledVector(up, du).addScaledVector(fwd, df));
    const states = (open, shut) => (sx > 0 ? [open, shut, null] : [open, null, shut]);
    const hidden = eyeAt(-0.005, 0, 0, 0.0003, 0.0003, 0.0003);
    // fechado: a pele vira uma pálpebra pequena, quase rente, sob o risquinho escuro
    headParts.add(eyeBall, { color: ringC, at: states(eyeAt(-0.0015, 0, 0, 0.0148, 0.0148, 0.0055), eyeAt(0.0012, 0, 0, 0.0105, 0.0105, 0.0022)) });
    headParts.add(eyeBall, {
      color: (x, y) => { const d = Math.hypot(x, y); return tmp.copy(irisIn).lerp(irisOut, ss(d, 0.35, 0.8)).lerp(irisRim, ss(d, 0.86, 1)); },
      fx: (x, y) => [0, 0.3 * (1 - ss(Math.hypot(x, y), 0.4, 0.9)), 0],
      at: states(eyeAt(0.0012, 0, 0, 0.0122, 0.0122, 0.0055), eyeAt(-0.004, 0, 0, 0.004, 0.004, 0.002)),
    });
    headParts.add(eyeBall, { color: pupilC, at: states(eyeAt(0.0052, 0, 0, 0.0058, 0.0062, 0.0025), eyeAt(0.0036, -0.0008, 0, 0.0125, 0.0015, 0.0016)) });
    headParts.add(spark, { color: white, fx: [0, 1.4, 0], at: states(eyeAt(0.0068, 0.0045, 0.0035, 0.0024, 0.0024, 0.0024), hidden) });
    headParts.add(spark, { color: white, fx: [0, 0.9, 0], at: states(eyeAt(0.0064, -0.0035, -0.004, 0.0011, 0.0011, 0.0011), hidden) });
  }
  const head = new THREE.Mesh(headParts.build({ names: ['olho-direito-fechado', 'olho-esquerdo-fechado'] }), mat);
  head.name = 'cabeca';
  head.position.fromArray(HEAD);
  neckPivot.add(head);

  // ---------------------------------------------------------------- asas: coberteiras com barras, secundárias e primárias
  // Três formas por pena: dobrada (base), aberta na batida de força e com o punho flexionado na recuperação.
  const feather = featherShape();
  const wingParts = new Parts(2);
  const S = (x, y, z) => [x - WING[0], y - WING[1], z - WING[2]]; // corpo → ombro
  wingParts.add(panelShape(), {
    // as duas barras escuras atravessam a metade de trás da asa dobrada, de cima a baixo
    color: (x, y, u) => tmp.copy(wingC).lerp(barC,
      Math.max(band(u + 0.12 * y, 0.58, 0.075), band(u + 0.12 * y, 0.8, 0.07)) * ss(y, -0.46, -0.3)),
    at: [
      frame(S(0.088, 0.172, 0.078), [-0.15, -0.24, -1], [1, 0.22, 0], 0.03, 0.088, 0.172),
      frame([0, 0, 0.004], [1, 0.02, -0.12], [0, 1, 0], 0.016, 0.084, 0.15),
      frame([0, 0.004, 0], [1, 0.14, -0.5], [0, 1, 0.3], 0.016, 0.08, 0.13),
    ],
  });
  for (let i = 0; i < 4; i++) {
    // secundárias: as pontas arredondadas aparecem em fila sob a borda das coberteiras
    const len = 0.08 - 0.004 * i;
    wingParts.add(feather, {
      color: (x, y, u) => tmp.copy(wingC).lerp(primC, 0.45 * ss(u, 0.7, 1)),
      at: [
        frame(S(0.086 - 0.006 * i, 0.136 - 0.002 * i, 0.03 - 0.027 * i), [-0.05 - 0.05 * i, -0.42, -1], [1, 0.15, 0], 0.006, 0.034, len),
        frame([0.022 + 0.024 * i, -0.003, -0.012 + 0.002 * i], [0.1 + 0.06 * i, -0.04, -1], [0, 1, 0], 0.006, 0.034, len),
        frame([0.018 + 0.02 * i, 0.003 + 0.004 * i, -0.012 - 0.012 * i], [0.22 + 0.06 * i, 0.08, -1], [0, 1, 0.15], 0.006, 0.034, len),
      ],
    });
  }
  for (let i = 0; i < 5; i++) {
    // primárias: dobradas, deitam sobre o traseiro e as pontas escuras cruzam por cima da cauda
    const len = 0.13 - 0.009 * i, wid = 0.03 - 0.002 * i;
    const open = 0.06 + 0.21 * i, rec = 0.75 + 0.14 * i; // leque dos "dedos" e varrida para trás na recuperação
    wingParts.add(feather, {
      color: (x, y, u) => tmp.copy(primC).lerp(tipC, ss(u, 0.6, 0.95)),
      at: [
        frame(S(0.066 - 0.004 * i, 0.135 - 0.001 * i, -0.03 - 0.01 * i), [-0.25 - 0.02 * i, -0.05, -1], [1, 1, 0], 0.006, wid, len),
        frame([0.108 - 0.006 * i, 0.004 - 0.0008 * i, 0.002 - 0.011 * i], [Math.cos(open), 0.02, -Math.sin(open)], [0, 1, 0.05], 0.0065, wid, len),
        frame([0.085 - 0.005 * i, 0.026, -0.045 - 0.01 * i], [Math.cos(rec), 0.15, -Math.sin(rec)], [-0.35, 1, -0.25], 0.0065, wid, len),
      ],
    });
  }
  const wingNames = ['aberta', 'recuperacao'];
  const wings = [-1, 1].map((sx) => {
    const wing = new THREE.Mesh(wingParts.build({ mirror: sx < 0, names: wingNames }), mat);
    wing.name = `asa-${sx < 0 ? 'esquerda' : 'direita'}`;
    wing.position.set(sx * WING[0], WING[1], WING[2]);
    body.add(wing);
    return { wing, sx };
  });

  // ---------------------------------------------------------------- cauda: leque de dez penas com a faixa escura
  const tailParts = new Parts(1); // alvo: leque aberto (voo e pouso)
  tailParts.add(feather, { color: belly, at: frame([0, -0.012, 0.016], [0, -0.5, -1], [0, -1, 0.5], 0.018, 0.046, 0.055) });
  for (let j = 0; j < 10; j++) {
    const o = j - 4.5, ao = Math.abs(o), lift = (4.5 - ao) * 0.0013, len = 0.104 - ao * 0.0024;
    tailParts.add(feather, {
      color: (x, y, u) => tmp.copy(tailC).lerp(tipC, ss(u, 0.74, 0.84)),
      at: [
        frame([o * 0.0045, 0.004 + lift, 0.004 - ao * 0.002], [o * 0.065, -0.19 - ao * 0.004, -1], [-o * 0.05, 1, 0.2], 0.007, 0.034, len),
        frame([o * 0.0055, 0.004 + lift * 0.6, 0.004 - ao * 0.002], [o * 0.2, -0.16, -1], [-o * 0.02, 1, 0.16], 0.007, 0.034, len),
      ],
    });
  }
  tailParts.add(feather, {
    color: (x, y, u) => tmp.copy(rump).lerp(mantle, 0.5 * ss(u, 0.5, 1)),
    at: [
      frame([0, 0.014, 0.022], [0, -0.24, -1], [0, 1, -0.2], 0.022, 0.058, 0.075),
      frame([0, 0.014, 0.022], [0, -0.2, -1], [0, 1, -0.2], 0.022, 0.07, 0.075),
    ],
  });
  const tail = new THREE.Mesh(tailParts.build({ names: ['leque'] }), mat);
  tail.name = 'cauda';
  tail.position.fromArray(TAIL);

  // ---------------------------------------------------------------- pés rosados: pernas curtas, calças de pena e unhas
  const feet = new THREE.Group();
  feet.name = 'pes';
  feet.position.set(0, HIP_Y, HIP_Z); // quadril dentro do tronco: o recolhimento gira aqui, não no chão
  const legGeo = new THREE.CylinderGeometry(0.0046, 0.0056, 0.073, 7);
  const thighGeo = new THREE.SphereGeometry(1, 8, 6);
  const toeGeo = new THREE.CapsuleGeometry(0.0032, 0.024, 2, 6);
  const backToeGeo = new THREE.CapsuleGeometry(0.003, 0.009, 2, 6);
  const clawGeo = new THREE.ConeGeometry(0.0022, 0.0075, 5);
  const feetParts = new Parts();
  for (const sx of [-1, 1]) {
    const x = sx * LEG_X;
    feetParts.add(legGeo, { color: pink, at: place(x, 0.0395 - HIP_Y, 0) });
    feetParts.add(thighGeo, { color: belly, at: place(x * 0.95, 0.052 - HIP_Y, -0.006, 0.014, 0.019, 0.017) });
    const ankle = new THREE.Vector3(x, 0.0035 - HIP_Y, 0.004 - HIP_Z);
    const toe = (geo, dir, reach) => {
      const d = new THREE.Vector3().fromArray(dir).normalize();
      feetParts.add(geo, { color: pink, at: along(ankle.clone().addScaledVector(d, reach / 2).toArray(), d.toArray()) });
      const cd = d.clone().setY(d.y - 0.28).normalize();
      feetParts.add(clawGeo, { color: clawC, at: along(ankle.clone().addScaledVector(d, reach).addScaledVector(cd, 0.0025).toArray(), cd.toArray()) });
    };
    for (const a of [-0.52, 0, 0.52]) toe(toeGeo, [Math.sin(a), -0.03, Math.cos(a)], 0.03);
    toe(backToeGeo, [sx * 0.3, -0.02, -1], 0.015);
  }
  feet.add(new THREE.Mesh(feetParts.build(), mat));
  body.add(torso, neckPivot, tail, feet);
  root.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // "zzz" de quem cochila
  const zs = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.08);
    root.add(s);
    return s;
  });

  const pose = { x: 0, y: 0, z: 0, yaw: 0, flying: false, asleep: false, flightProgress: null };
  const st = {
    sleepK: 0, peekT: 0, peckT: 0, phase: r() * 10, flap: 0, airK: 0,
    flightAge: 0, landingT: 0, wasFlying: false, yawReady: false,
    // olhar em volta (giros rápidos de cabeça), piscadas e o lado em que a cabeça tomba no cochilo
    lookT: 0.5 + r() * 1.5, lookYaw: 0, lookTilt: 0, yaw: 0, tilt: 0,
    blinkT: 1 + r() * 2.5, blinkP: 1, sleepSide: r() < 0.5 ? -1 : 1,
  };
  const hip = new THREE.Vector3();
  root.scale.setScalar(scale);
  return {
    object: root,
    /** @param {Partial<typeof pose>} p */
    setPose(p) {
      if (p.flying && !pose.flying) pose.flightProgress = null;
      Object.assign(pose, p);
    },
    /** Abre um olho só e volta a dormir (reação ao latido). */
    peek() { st.peekT = 1.1; },
    /** Bica duas vezes e bate as asas no lugar, sem sair da posição; no ar, não faz nada. */
    peck() { if (!pose.flying) st.peckT = PECK; },
    /** @param {number} dt @param {number} t */
    update(dt, t) {
      root.position.set(pose.x, pose.y, pose.z);
      if (!st.yawReady) { root.rotation.y = pose.yaw; st.yawReady = true; }
      const turn = Math.atan2(Math.sin(pose.yaw - root.rotation.y), Math.cos(pose.yaw - root.rotation.y));
      root.rotation.y += turn * (1 - Math.exp(-dt * 12));
      if (pose.flying && !st.wasFlying) { st.flap = 0; st.flightAge = 0; st.landingT = 0; st.peckT = 0; }
      if (!pose.flying && st.wasFlying) st.landingT = LANDING;
      st.wasFlying = pose.flying;
      st.flightAge = pose.flying ? st.flightAge + dt : 0;
      st.landingT = Math.max(0, st.landingT - dt);
      st.airK += ((pose.flying ? 1 : 0) - st.airK) * (1 - Math.exp(-dt * (pose.flying ? 18 : 11)));
      const air = st.airK;
      const brake = pose.flying && pose.flightProgress !== null ? ss(pose.flightProgress, 0.72, 1) : 0;

      // Bicada: susto (penas afofadas, olhos arregalados), duas estocadas do pescoço e asas batendo no lugar.
      st.peckT = Math.max(0, st.peckT - dt);
      const pp = st.peckT > 0 ? 1 - st.peckT / PECK : 1;
      const fuss = st.peckT > 0 ? ss(pp, 0, 0.08) * (1 - ss(pp, 0.72, 1)) : 0;
      const lunge = pulse(pp, 0.1, 0.32) + pulse(pp, 0.4, 0.62);
      if (st.peekT > 0) st.peekT -= dt;
      const sleepTarget = pose.asleep && !pose.flying && st.peekT <= 0 && st.peckT <= 0 ? 1 : 0;
      st.sleepK += (sleepTarget - st.sleepK) * (1 - Math.exp(-dt * (sleepTarget > st.sleepK ? 3 : 7)));
      const k = st.sleepK;

      // Acordado e parado: olha em volta com giros rápidos de cabeça e pisca de vez em quando.
      const calm = (1 - k) * (1 - air) * (1 - fuss);
      st.lookT -= dt;
      if (st.lookT <= 0) {
        st.lookT = 0.8 + r() * 2.4;
        st.lookYaw = r() < 0.3 ? 0 : (r() - 0.5) * 1.4;
        st.lookTilt = r() < 0.4 ? (r() - 0.5) * 0.6 : 0;
      }
      const snap = 1 - Math.exp(-dt * 18);
      st.yaw += (st.lookYaw * calm - st.yaw) * snap;
      st.tilt += (st.lookTilt * calm - st.tilt) * snap;
      st.blinkT -= dt;
      if (st.blinkT <= 0) { st.blinkT = 1.8 + r() * 3.4; st.blinkP = 0; }
      st.blinkP += dt;
      const blink = st.blinkP < BLINK && st.peekT <= 0 ? Math.sin(Math.PI * st.blinkP / BLINK) * (1 - air) : 0;
      // espiada: só o olho direito abre
      head.morphTargetInfluences[0] = Math.max(k, blink) * (1 - fuss);
      head.morphTargetInfluences[1] = Math.max(k, blink, st.peekT > 0 ? 0.95 : 0) * (1 - fuss);

      // Respiração; dormindo e no susto as penas afofam.
      const breath = Math.sin(t * (1.5 + 1.4 * (1 - k)) + st.phase);
      const puff = 0.09 * k + 0.05 * fuss;
      torso.scale.set(1 + puff, 1 + 0.4 * puff + 0.012 * breath * (1 - air), 1 + 0.3 * puff);
      neck.scale.set(1 + 0.8 * puff, 1 - 0.3 * k, 1 + 0.8 * puff);

      // Pescoço e cabeça: encolhidos no cochilo, estocada na bicada e cabeça estável (no nível) durante o voo.
      neckPivot.position.set(NECK[0], NECK[1] - 0.032 * k, NECK[2] - 0.016 * k);
      const neckPitch = -0.35 * k + 0.85 * lunge + 0.25 * air - 0.12 * fuss;
      neckPivot.rotation.set(neckPitch, st.yaw * 0.35, 0);
      head.rotation.set(0.3 * k + 0.45 * lunge + 0.1 * fuss - (neckPitch + body.rotation.x) * air * 0.9,
        st.yaw * 0.65, st.tilt + 0.16 * k * st.sleepSide);

      // Mais energia ao decolar; descida firme e recuperação mais longa/flexível.
      st.flap = (st.flap + dt * (4.6 + 1.2 * Math.exp(-st.flightAge * 8)) * air) % 1;
      const down = st.flap < 0.42;
      const stroke = down ? st.flap / 0.42 : (st.flap - 0.42) / 0.58;
      const arc = (1 - Math.cos(stroke * Math.PI)) / 2;
      const elevation = down ? 1.1 - 1.95 * arc : -0.85 + 1.95 * arc;
      const recover = down ? 0 : Math.sin(stroke * Math.PI) * 0.85;
      const flick = fuss * (0.35 + 0.25 * Math.sin(t * 26 + st.phase));
      for (const { wing, sx } of wings) {
        const idle = 0.025 + 0.01 * breath;
        wing.position.x = sx * (WING[0] + 0.006 * k + 0.004 * fuss);
        wing.rotation.z = sx * (lerp(idle, elevation, air) + flick * (1 - air));
        wing.rotation.y = -sx * 0.12 * air * Math.sin(stroke * Math.PI);
        wing.morphTargetInfluences[0] = air * (1 - recover) + 0.8 * fuss * (1 - air);
        wing.morphTargetInfluences[1] = air * recover;
      }

      const tuck = pose.flying ? air * (1 - brake) : 0;
      const settle = Math.sin((st.landingT / LANDING) * Math.PI);
      body.position.y = -0.04 * k + air * (0.012 + 0.006 * Math.cos(st.flap * Math.PI * 2)) - 0.012 * settle;
      const pitch = (pose.flying ? air * (0.18 - 0.6 * brake) : 0) + 0.22 * lunge;
      body.rotation.x += (pitch - body.rotation.x) * (1 - Math.exp(-dt * 14));
      body.rotation.z += (clamp(-turn * 0.18, -0.16, 0.16) * air - body.rotation.z) * (1 - Math.exp(-dt * 10));
      if (pose.flying) {
        // Pés recolhidos para trás no voo; na frenagem descem e avançam para o contato.
        feet.rotation.set(0.95 * tuck - body.rotation.x * brake - 0.3 * brake, 0, -body.rotation.z * brake);
        feet.scale.y = 1 - 0.25 * tuck;
      } else {
        // Pés verticais no apoio, quadris sempre presos ao corpo. As pernas flexionam
        // no impacto, no sono e na bicada; a altura do corpo é resolvida a partir do contato.
        feet.quaternion.copy(body.quaternion).invert();
        feet.scale.y = 1 - 0.35 * settle - 0.45 * k - 0.08 * lunge; // dormindo, a barriga encosta no apoio
        hip.copy(feet.position).applyQuaternion(body.quaternion);
        body.position.y = HIP_Y * feet.scale.y - hip.y;
      }
      // Cauda: sobe e abre o leque no voo, mais ainda na frenagem e no pouso; no susto, levanta.
      tail.rotation.x += (air * (0.12 + 0.35 * brake) + 0.18 * fuss - 0.05 * k - tail.rotation.x) * (1 - Math.exp(-dt * 12));
      tail.morphTargetInfluences[0] = Math.min(1, air * (0.3 + 0.7 * brake) + 0.6 * fuss + 0.6 * settle);
      zs.forEach((s, i) => {
        const c = ((t * 0.45 + i / 3) % 1);
        s.position.set(0.05 + c * 0.08, 0.25 + c * 0.2, 0.06 + Math.sin(c * 6 + i) * 0.02);
        s.material.opacity = k * Math.sin(c * Math.PI) * 0.95;
        s.scale.setScalar(0.05 + c * 0.05);
      });
    },
  };
}
