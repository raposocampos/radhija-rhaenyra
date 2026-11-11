// O SR. LUIZ, o porteiro do Recanto das Patinhas (Modo História, cap. 1): um senhor simpático de desenho, de corpo
// inteiro e rosto à mostra, no estilo do jogo (formas arredondadas, cores lisas por vértice, nada de textura de foto).
// Quepe azul-marinho com a pala preta, o cordão e a patinha dourada; bigode grisalho farto, óculos redondos, nariz de
// batata e bochechas coradas; camisa azul-clara de manga curta com o bolso (e a caneta), o crachá e as dragonas; a
// barriguinha por cima do cinto; calça escura e a mesma botina marrom das cenas (humans.js).
//
// Medidas: ~1,72 m do chão ao alto do quepe (as dogs têm ~40 cm). A origem fica no chão, entre os pés, e ele olha
// para +Z. Sentado, a cadeira fica atrás dele: createGuardChair() posta em CHAIR_OFFSET (o assento a 0,47 m).
//
// createSrLuiz() → { object, setPose(name, k?, { instant }?), update(dt, t), lookAt(p | null), say(on),
//                    reach(side, p | null), handPoint(side), pose, dispose() }
//   Poses: 'dorme' (sentado, cabeça caída, ronco: o peito sobe e desce e o bigode treme), 'acorda' (o susto: pula na
//   cadeira, o quepe voa, olhos arregalados; k 0..1 é o progresso, sem k anda sozinho em 1,4 s), 'sentado' (acordado),
//   'em-pe', 'anda' (k = metros andados; sem k, o passo sai do quanto o object andou desde o quadro anterior, ou anda no
//   lugar), 'abre-portao' (a mão direita vai à tranca, fecha e puxa; k 0..1, sem k em 1,6 s), 'acena', 'fala' (a mão
//   gesticula e a boca mexe embaixo do bigode). say(on) mexe a boca em qualquer pose.
//   reach('R' | 'L', {x, y, z} | null): a mão vai até um ponto do mundo (a tranca do portãozinho, a janela).
//   handPoint('R' | 'L') → {x, y, z}: onde está a palma agora (no mundo).
// Leve para o celular: ~30 malhas, ~5 mil triângulos, MeshStandardMaterial com cor por vértice, nenhuma luz.
import * as THREE from 'three';
import { mergeGeometries, RoundedBoxGeometry } from '../../world/util.js';
import { boot } from './humans.js';

const { clamp, lerp, smoothstep: ss } = THREE.MathUtils;
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;

/** Onde fica a cadeira em relação à origem dele (sentado, os pés ficam à frente do assento). */
export const CHAIR_OFFSET = { x: 0, z: -0.32 };
/** Altura do alto do quepe, em pé (m). */
export const SR_LUIZ_HEIGHT = 1.72;

const PAL = {
  skin: '#E7B48F', lid: '#DCA27E', nose: '#E59B7C', blush: '#F09C8A', ear: '#DE9F7E',
  hair: '#C8C4BE', hairDark: '#A39E97', stache: '#DAD6CF', stacheDark: '#A8A39B',
  shirt: '#A3C8EA', shirtDark: '#7EA6D0', shirtDeep: '#5F86B4',
  navy: '#2F4272', navyDark: '#1C2748', gold: '#F2C230', goldDark: '#C9971E',
  trousers: '#384152', trousersDark: '#2B3240', belt: '#4A3424', black: '#17181C', white: '#F7F5F0',
  iris: '#5A3A22', frame: '#6E4A2A', mouth: '#5B2328', tongue: '#D46B6B', pen: '#2E5FA8',
};

// ------------------------------------------------------------------------------------------------ geometria
const _c = new THREE.Color();
/** Pinta por vértice (cor fixa ou fn(x, y, z) → Color) e deixa a geometria pronta para fundir com as outras. */
function tint(geo, color) {
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  geo.clearGroups();
  const P = geo.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const c = typeof color === 'function' ? color(P.getX(i), P.getY(i), P.getZ(i)) : _c.set(color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** Peças pintadas numa malha só. */
function fuse(parts, material, name, shadow = true) {
  const m = new THREE.Mesh(mergeGeometries(parts), material);
  for (const g of parts) g.dispose();
  m.name = name;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
/** Elipsoide (raios rx, ry, rz) centrado na origem. */
const ell = (rx, ry, rz, w = 14, h = 10) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
/** Cápsula pendurada da origem para −Y (comprimento total len). */
const hang = (r, len, seg = 8) => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 1, seg).translate(0, -len / 2, 0);
/** Tronco de cone pendurado da origem para −Y. */
const hangCyl = (rt, rb, h, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open).translate(0, -h / 2, 0);
/** Cápsula de a até b. */
function rodAB(a, b, r, seg = 4) {
  const d = new V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 1, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()));
  return g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
}
const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
/** Anéis de controle {y, rx, zf, zb} → anéis intermediários (Catmull-Rom). */
function densify(rings, sub) {
  const out = [];
  for (let j = 0; j < rings.length - 1; j++) {
    const p0 = rings[Math.max(0, j - 1)], p1 = rings[j], p2 = rings[j + 1], p3 = rings[Math.min(rings.length - 1, j + 2)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub, r = {};
      for (const k of Object.keys(p1)) r[k] = catmull(p0[k], p1[k], p2[k], p3[k], t);
      out.push(r);
    }
  }
  out.push({ ...rings[rings.length - 1] });
  return out;
}
/**
 * Um corpo de anéis elípticos (rx de lado, zf para a frente e zb para trás), de baixo para cima, com a emenda nas costas
 * e as normais da emenda soldadas.
 */
function loft(rings, seg = 20) {
  const pos = [], idx = [];
  for (const { y, rx, zf, zb } of rings) {
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI + (i / seg) * TAU; // começa e termina nas costas
      const c = Math.cos(a);
      pos.push(Math.max(0, rx) * Math.sin(a), y, Math.max(0, c >= 0 ? zf : zb) * c);
    }
  }
  // os anéis podem vir de cima para baixo (a calça): a volta dos triângulos inverte para a face ficar para fora
  const down = rings[rings.length - 1].y < rings[0].y;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      if (down) idx.push(a, b + 1, a + 1, a, b, b + 1);
      else idx.push(a, a + 1, b + 1, a, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const N = g.attributes.normal;
  for (let j = 0; j < rings.length; j++) {
    const a = j * (seg + 1), b = a + seg;
    const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
    N.setXYZ(a, nx / l, ny / l, nz / l);
    N.setXYZ(b, nx / l, ny / l, nz / l);
  }
  return g;
}
/** A frente (z) de um corpo de anéis em (x, y): para pregar botões, o bolso e o crachá na camisa. */
function surfaceZ(rings, x, y) {
  let j = 0;
  while (j < rings.length - 2 && rings[j + 1].y < y) j++;
  const a = rings[j], b = rings[j + 1], t = clamp((y - a.y) / (b.y - a.y || 1), 0, 1);
  const rx = lerp(a.rx, b.rx, t), zf = lerp(a.zf, b.zf, t);
  return zf * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
}
/** Uma peça chapada (bolso, crachá) colada na frente de um corpo de anéis, virada para a normal dele. */
function onSurface(geo, rings, x, y, lift = 0.003) {
  const z = surfaceZ(rings, x, y);
  const dzdx = (surfaceZ(rings, x + 0.005, y) - surfaceZ(rings, x - 0.005, y)) / 0.01;
  const dzdy = (surfaceZ(rings, x, y + 0.005) - surfaceZ(rings, x, y - 0.005)) / 0.01;
  const n = new V3(-dzdx, -dzdy, 1).normalize();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), n));
  return geo.translate(x + n.x * lift, y + n.y * lift, z + n.z * lift);
}

// ------------------------------------------------------------------------------------------------ medidas do corpo
const HIP_X = 0.1, HIP_Y = -0.02; // as juntas do quadril, no nó da pelve
const THIGH = 0.38, SHIN = 0.355, ANKLE_Y = 0.12; // a coxa, a canela e o tornozelo acima da sola
const SPINE_Y = 0.06; // a cintura, acima do nó da pelve
const SHOULDER = [0.215, 0.345, -0.005]; // o ombro esquerdo (+x), no tronco
const UPPER = 0.27, FORE = 0.225; // o braço e o antebraço (até o punho)
const NECK = [0, 0.4, 0.005], HEAD_PIVOT = 0.07, HEAD_C = [0, 0.075, 0.008], HEAD_SCALE = 1.2; // a cabeça gira no alto do pescoço
const STAND_Y = 0.865; // a pelve em pé (as pernas quase esticadas)
const SEAT_Y = 0.595; // a pelve sentada (o assento a 0,47 m)
/** Uma volta do passo (dois passos), em metros. */
const WALK_CYCLE = (2 * 0.23) / 0.62;

// a camisa (no tronco: a cintura em y = 0) e a calça (na pelve)
const SHIRT = densify([
  { y: -0.035, rx: 0.176, zf: 0.16, zb: 0.13 },
  { y: 0.02, rx: 0.18, zf: 0.168, zb: 0.132 },
  { y: 0.09, rx: 0.2, zf: 0.235, zb: 0.138 },
  { y: 0.17, rx: 0.2, zf: 0.228, zb: 0.134 },
  { y: 0.25, rx: 0.194, zf: 0.185, zb: 0.128 },
  { y: 0.33, rx: 0.19, zf: 0.15, zb: 0.12 },
  { y: 0.385, rx: 0.165, zf: 0.122, zb: 0.108 },
  { y: 0.425, rx: 0.112, zf: 0.084, zb: 0.08 },
  { y: 0.446, rx: 0.055, zf: 0.05, zb: 0.048 },
  { y: 0.452, rx: 0.0, zf: 0.0, zb: 0.0 },
], 2);
const PANTS = densify([
  { y: 0.1, rx: 0.172, zf: 0.155, zb: 0.13 },
  { y: 0.03, rx: 0.183, zf: 0.165, zb: 0.14 },
  { y: -0.04, rx: 0.18, zf: 0.135, zb: 0.145 },
  { y: -0.09, rx: 0.155, zf: 0.1, zb: 0.13 },
  { y: -0.115, rx: 0.1, zf: 0.06, zb: 0.08 },
  { y: -0.125, rx: 0.0, zf: 0.0, zb: 0.0 },
], 2);

// ------------------------------------------------------------------------------------------------ as peças
/** A pelve: a calça, o cinto e a fivela. */
function buildPelvis(M) {
  const matte = [
    tint(loft(PANTS, 14), PAL.trousers),
    tint(loft([{ y: 0.034, rx: 0.192, zf: 0.18, zb: 0.149 }, { y: 0.079, rx: 0.192, zf: 0.18, zb: 0.149 }], 16), PAL.belt),
  ];
  const gloss = [tint(new THREE.BoxGeometry(0.062, 0.046, 0.012).translate(0, 0.056, 0.184), PAL.gold)];
  return [fuse(matte, M.matte, 'sr-luiz:calca'), fuse(gloss, M.gloss, 'sr-luiz:fivela', false)];
}

/** O tronco: a camisa com a barriga, os botões, o bolso com a caneta, o crachá, as dragonas e o colarinho. */
function buildTorso(M) {
  const shirt = tint(loft(SHIRT, 14), (x, y, z) => _c.set(PAL.shirt).lerp(_c.clone().set(PAL.shirtDark), clamp(0.55 - y * 2.2, 0, 0.55) * (z < 0 ? 0.7 : 0.25)));
  const matte = [shirt];
  // a carcela (a faixa dos botões) e os botões, seguindo a barriga
  const buttons = [];
  for (const y of [0.05, 0.13, 0.21, 0.29, 0.36]) {
    matte.push(tint(onSurface(new THREE.BoxGeometry(0.026, 0.085, 0.004), SHIRT, 0, y, 0.0015), PAL.shirtDark));
    buttons.push(tint(onSurface(ell(0.0075, 0.0075, 0.004, 6, 3), SHIRT, 0, y, 0.005), PAL.white));
  }
  // o bolso (esquerdo, +x) com a aba e a caneta azul
  matte.push(tint(onSurface(new THREE.BoxGeometry(0.078, 0.086, 0.008), SHIRT, 0.088, 0.262, 0.003), PAL.shirtDark));
  matte.push(tint(onSurface(new THREE.BoxGeometry(0.082, 0.026, 0.01), SHIRT, 0.088, 0.302, 0.006), PAL.shirtDeep));
  const pen = [
    tint(onSurface(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 6), SHIRT, 0.112, 0.31, 0.011), PAL.pen),
    tint(onSurface(new THREE.BoxGeometry(0.004, 0.03, 0.003), SHIRT, 0.112, 0.31, 0.018), '#d8dde2'),
  ];
  // o crachá (direito, −x): o cartão branco, a faixa azul, a foto e as linhas do nome, o prendedor
  const badge = [
    tint(onSurface(new THREE.BoxGeometry(0.062, 0.084, 0.006), SHIRT, -0.092, 0.25, 0.004), PAL.white),
    tint(onSurface(new THREE.BoxGeometry(0.058, 0.018, 0.004), SHIRT, -0.092, 0.281, 0.008), PAL.navy),
    tint(onSurface(new THREE.BoxGeometry(0.022, 0.026, 0.004), SHIRT, -0.106, 0.248, 0.008), PAL.skin),
    tint(onSurface(new THREE.BoxGeometry(0.022, 0.005, 0.004), SHIRT, -0.08, 0.255, 0.008), '#8a93a3'),
    tint(onSurface(new THREE.BoxGeometry(0.05, 0.006, 0.004), SHIRT, -0.092, 0.222, 0.008), PAL.gold),
    tint(onSurface(new THREE.BoxGeometry(0.014, 0.016, 0.006), SHIRT, -0.092, 0.297, 0.006), '#aab1ba'),
  ];
  // as dragonas azul-marinho nos ombros, com o botão dourado
  const epaulets = [];
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.13, 0.014, 0.065).rotateZ(-s * 0.42).translate(s * 0.13, 0.413, -0.004);
    matte.push(tint(g, PAL.navy));
    epaulets.push(tint(ell(0.009, 0.006, 0.009, 6, 3).translate(s * 0.085, 0.436, -0.002), PAL.gold));
  }
  // o colarinho: a gola em volta do pescoço e as duas pontas viradas para baixo, na frente
  matte.push(tint(new THREE.TorusGeometry(0.068, 0.017, 3, 10).rotateX(Math.PI / 2).scale(1.05, 0.75, 1).translate(0, 0.436, 0.004), PAL.shirt));
  for (const s of [-1, 1]) {
    const g = ell(0.032, 0.006, 0.04, 6, 4).rotateX(0.75).rotateY(-s * 0.55).rotateZ(s * 0.35).translate(s * 0.036, 0.418, 0.068);
    matte.push(tint(g, '#B4D4F0'));
  }
  return [fuse(matte, M.matte, 'sr-luiz:camisa'), fuse([...buttons, ...pen, ...badge, ...epaulets], M.gloss, 'sr-luiz:cracha-e-botoes', false)];
}

/** A cabeça (sem as partes que mexem): rosto, orelhas, nariz, bochechas, cabelo grisalho, olhos e óculos. */
function buildHead(M) {
  const matte = [
    tint(ell(0.13 * 0.95, 0.13, 0.13 * 0.97, 15, 10), PAL.skin),
    tint(ell(0.106, 0.082, 0.1, 10, 7).translate(0, -0.052, 0.025), PAL.skin), // as bochechas e o queixo
    tint(ell(0.034 * 1.05, 0.034 * 0.95, 0.034 * 0.95, 10, 7).translate(0, -0.012, 0.128), PAL.nose),
  ];
  for (const s of [-1, 1]) {
    matte.push(tint(ell(0.016, 0.036, 0.026, 8, 5).rotateY(s * 0.3).translate(s * 0.123, 0.0, -0.004), (x) => _c.set(PAL.ear).lerp(_c.clone().set('#C98C6E'), clamp((Math.abs(x) - 0.128) * 90, 0, 0.7))));
    matte.push(tint(ell(0.024, 0.016, 0.01, 6, 4).translate(s * 0.07, -0.032, 0.1), PAL.blush));
    // as costeletas grisalhas, na frente das orelhas
    matte.push(tint(ell(0.011, 0.03, 0.016, 6, 4).translate(s * 0.118, 0.012, 0.03), PAL.hair));
  }
  // o cabelo: a coroa grisalha das orelhas para trás, abaixo do quepe (o alto é careca)
  const hair = new THREE.SphereGeometry(0.1345, 12, 3, Math.PI - 0.5, Math.PI + 1.0, 0.95, 0.9).scale(0.95, 1, 0.97);
  matte.push(tint(hair, (x, y) => _c.set(PAL.hair).lerp(_c.clone().set(PAL.hairDark), clamp(-y * 6, 0, 0.6))));
  // olhos: o branco, a íris castanha, a pupila e o brilho; os óculos redondos de aro marrom
  const gloss = [];
  for (const s of [-1, 1]) {
    const ex = s * 0.045;
    gloss.push(tint(ell(0.027, 0.03, 0.017, 9, 6).translate(ex, 0.024, 0.104), PAL.white));
    gloss.push(tint(ell(0.0135, 0.0135, 0.0047, 7, 4).translate(ex, 0.022, 0.1205), PAL.iris));
    gloss.push(tint(ell(0.0075, 0.0075, 0.003, 5, 3).translate(ex, 0.022, 0.1236), PAL.black));
    gloss.push(tint(ell(0.0038, 0.0038, 0.002, 5, 3).translate(ex + 0.006, 0.031, 0.1258), '#ffffff'));
    gloss.push(tint(new THREE.TorusGeometry(0.034, 0.0042, 3, 14).translate(ex, 0.024, 0.132), PAL.frame));
    gloss.push(tint(rodAB([s * 0.079, 0.03, 0.124], [s * 0.118, 0.022, 0.02], 0.0032), PAL.frame));
  }
  gloss.push(tint(new THREE.TorusGeometry(0.0135, 0.0035, 3, 6, Math.PI).translate(0, 0.024, 0.138), PAL.frame));
  const g = [...matte, ...gloss];
  for (const p of g) p.translate(HEAD_C[0], HEAD_C[1], HEAD_C[2]);
  return [fuse(matte, M.matte, 'sr-luiz:rosto'), fuse(gloss, M.gloss, 'sr-luiz:olhos-e-oculos', false)];
}

/** O quepe: a cinta, a copa, o cordão e a patinha dourados e a pala preta. Origem na base da cinta. */
function buildCap(M) {
  const matte = [
    tint(new THREE.CylinderGeometry(0.125, 0.125, 0.044, 14, 1, true).translate(0, 0.022, 0).scale(0.96, 1, 1), PAL.navyDark),
    tint(new THREE.LatheGeometry([[0.125, 0.042], [0.139, 0.06], [0.153, 0.082], [0.154, 0.095], [0.143, 0.104], [0.1, 0.11], [0.0, 0.112]].map(([r, y]) => new THREE.Vector2(r, y)), 14)
      .rotateX(-0.06).scale(0.96, 1, 1), (x, y) => _c.set(PAL.navy).lerp(_c.clone().set('#3b5288'), clamp((y - 0.08) * 20, 0, 0.6))),
  ];
  const gloss = [];
  // o cordão dourado na frente da cinta, com os dois botõezinhos nas pontas
  gloss.push(tint(new THREE.TorusGeometry(0.1275, 0.0042, 3, 12, Math.PI * 0.9).rotateX(Math.PI / 2).rotateY(-0.157).scale(0.96, 1, 1).translate(0, 0.024, 0), PAL.gold));
  for (const s of [-1, 1]) gloss.push(tint(ell(0.008, 0.008, 0.005, 5, 3).translate(s * 0.117, 0.024, 0.04), PAL.gold));
  // a pala: meia-lua chapada que sai da cinta e cai para a frente
  const sh = new THREE.Shape();
  const N = 14, A0 = 1.25;
  for (let i = 0; i <= N; i++) {
    const a = -A0 + (2 * A0 * i) / N;
    const x = 0.12 * Math.sin(a), z = 0.125 * Math.cos(a);
    if (i === 0) sh.moveTo(x, z); else sh.lineTo(x, z);
  }
  for (let i = N; i >= 0; i--) {
    const a = -A0 + (2 * A0 * i) / N;
    sh.lineTo(0.124 * Math.sin(a), 0.125 * Math.cos(a) + 0.062 * Math.pow(Math.cos(a * 1.05), 1.4));
  }
  const visor = new THREE.ExtrudeGeometry(sh, { depth: 0.007, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, 0.006, 0);
  const VP = visor.attributes.position;
  for (let i = 0; i < VP.count; i++) {
    // cai para fora em cone a partir da cinta (a pala inteira presa na beirada de baixo)
    const r = Math.hypot(VP.getX(i) / 0.96, VP.getZ(i));
    VP.setY(i, VP.getY(i) - Math.max(0, r - 0.122) * 0.42);
  }
  visor.computeVertexNormals();
  gloss.push(tint(visor, PAL.black));
  // a patinha dourada na frente da copa
  const paw = [ell(0.017, 0.014, 0.006, 8, 4)];
  for (const [x, y] of [[-0.019, 0.016], [-0.007, 0.024], [0.007, 0.024], [0.019, 0.016]]) paw.push(ell(0.0065, 0.0075, 0.005, 5, 3).translate(x, y, 0.001));
  for (const p of paw) gloss.push(tint(p.rotateX(-0.25).translate(0, 0.068, 0.147), PAL.gold));
  return [fuse(matte, M.matte, 'sr-luiz:quepe'), fuse(gloss, M.gloss, 'sr-luiz:quepe-pala', false)];
}

/** O bigode grisalho farto: dois lóbulos caídos para fora, as pontas e o tufo do meio. Origem embaixo do nariz. */
function buildStache(M) {
  const col = (x, y, z) => _c.set(PAL.stache).lerp(_c.clone().set(PAL.stacheDark), clamp(-y * 28 + Math.abs(x) * 6 - 0.15, 0, 0.75));
  const parts = [tint(ell(0.022, 0.018, 0.018, 8, 5).translate(0, 0.004, 0.006), col)];
  for (const s of [-1, 1]) {
    parts.push(tint(ell(0.04, 0.021, 0.022, 10, 6).rotateZ(-s * 0.28).translate(s * 0.03, -0.006, 0.0), col));
    parts.push(tint(ell(0.026, 0.014, 0.016, 8, 5).rotateZ(-s * 0.6).translate(s * 0.066, -0.021, -0.014), col));
    // fios soltos (o tufo não é liso)
    parts.push(tint(ell(0.012, 0.007, 0.01, 5, 3).rotateZ(-s * 0.9).translate(s * 0.05, -0.024, 0.008), col));
  }
  return fuse(parts, M.matte, 'sr-luiz:bigode');
}

/** A mão de desenho, quatro dedos (três e o polegar); o punho na origem, os dedos para −Y e a palma para −s·x. */
function buildHand(M, s) {
  const g = new THREE.Group();
  g.name = `sr-luiz:mao-${s > 0 ? 'esquerda' : 'direita'}`;
  const palm = fuse([tint(ell(0.023, 0.044, 0.04, 7, 5).translate(0, -0.04, 0), PAL.skin)], M.matte, 'palma');
  g.add(palm);
  const fingers = new THREE.Group();
  fingers.name = 'dedos';
  fingers.position.set(s * 0.002, -0.07, 0);
  const fl = [0.058, 0.064, 0.058];
  fingers.add(fuse([-0.025, 0, 0.025].map((z, i) => tint(hang(0.0135, fl[i], 5).translate(0, 0.006, z), PAL.skin)), M.matte, 'dedos'));
  g.add(fingers);
  const thumb = new THREE.Group();
  thumb.name = 'polegar';
  thumb.position.set(-s * 0.006, -0.026, 0.032);
  thumb.add(fuse([tint(hang(0.0145, 0.052, 6), PAL.skin)], M.matte, 'polegar'));
  g.add(thumb);
  g.scale.setScalar(1.25);
  /** 0 aberta … 1 fechada. */
  const grip = (k) => {
    fingers.rotation.z = -s * (0.12 + 1.45 * k);
    thumb.rotation.set(-0.55 - 0.2 * k, 0, -s * (0.35 + 0.75 * k));
  };
  grip(0.2);
  return { group: g, grip };
}

/** Um braço: o ombro (a manga curta), o cotovelo (o antebraço) e a mão. */
function buildArm(M, s) {
  const shoulder = new THREE.Group();
  shoulder.name = `sr-luiz:ombro-${s > 0 ? 'esquerdo' : 'direito'}`;
  shoulder.position.set(s * SHOULDER[0], SHOULDER[1], SHOULDER[2]);
  shoulder.add(fuse([
    tint(ell(0.066, 0.066, 0.064, 8, 5), PAL.shirt),
    tint(hangCyl(0.064, 0.069, 0.15, 10, true), PAL.shirt),
    tint(hangCyl(0.071, 0.073, 0.025, 10, true).translate(0, -0.148, 0), PAL.shirtDark),
    tint(hang(0.047, 0.16, 6).translate(0, -0.11, 0), PAL.skin),
  ], M.matte, 'manga'));
  const elbow = new THREE.Group();
  elbow.name = 'cotovelo';
  elbow.position.y = -UPPER;
  elbow.add(fuse([
    tint(ell(0.046, 0.046, 0.046, 6, 4), PAL.skin),
    tint(hangCyl(0.045, 0.035, FORE, 8, true), PAL.skin),
    tint(ell(0.035, 0.03, 0.035, 6, 4).translate(0, -FORE, 0), PAL.skin),
  ], M.matte, 'antebraco'));
  shoulder.add(elbow);
  const hand = buildHand(M, s);
  hand.group.position.y = -FORE;
  elbow.add(hand.group);
  return { s, shoulder, elbow, hand: hand.group, grip: hand.grip };
}

/** Uma perna: a coxa, a canela com a barra e a botina das cenas (humans.js), fundida numa malha. */
function buildLeg(M, s) {
  const hip = new THREE.Group();
  hip.name = `sr-luiz:perna-${s > 0 ? 'esquerda' : 'direita'}`;
  hip.position.set(s * HIP_X, HIP_Y, 0);
  hip.add(fuse([tint(hang(0.088, THIGH + 0.04, 8).translate(0, 0.02, 0), PAL.trousers)], M.matte, 'coxa'));
  const knee = new THREE.Group();
  knee.name = 'joelho';
  knee.position.y = -THIGH;
  knee.add(fuse([
    tint(ell(0.08, 0.08, 0.08, 8, 5), PAL.trousers),
    tint(hangCyl(0.076, 0.07, SHIN - 0.03, 10, true), PAL.trousers),
    tint(hangCyl(0.074, 0.079, 0.05, 10, true).translate(0, -(SHIN - 0.055), 0), PAL.trousersDark),
  ], M.matte, 'canela'));
  hip.add(knee);
  const ankle = new THREE.Group();
  ankle.name = 'tornozelo';
  ankle.position.y = -SHIN;
  knee.add(ankle);
  // a botina das cenas, assada numa malha só com as cores de cada peça
  const b = boot(new THREE.MeshStandardMaterial({ color: '#6B4426' }), new THREE.MeshStandardMaterial({ color: '#2A2420' }), 9);
  b.updateMatrixWorld(true);
  const parts = [];
  b.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    parts.push(tint(g, o.material.color));
    o.geometry.dispose();
    o.material.dispose();
  });
  const bootMesh = fuse(parts.map((g) => g.translate(0, -ANKLE_Y, 0)), M.boot, 'botina');
  ankle.add(bootMesh);
  return { s, hip, knee, ankle };
}

// ------------------------------------------------------------------------------------------------ IK de dois ossos
const _d = new V3(), _pp = new V3(), _E = new V3(), _u = new V3(), _f = new V3(), _w = new V3(), _x = new V3(), _y = new V3();
const _m4 = new THREE.Matrix4();
/**
 * Dois ossos (o de cima gira inteiro; o de baixo dobra no próprio x): `top` fica em S, a ponta vai a T, o meio (cotovelo
 * ou joelho) vai para o lado de `pole`. S, T e pole no espaço do pai de `top`.
 */
function solve2(top, mid, S, T, pole, a, b) {
  _d.subVectors(T, S);
  let D = _d.length();
  if (D < 1e-6) { _d.set(0, -1, 0); D = 1e-6; } else _d.divideScalar(D);
  D = clamp(D, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _pp.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_pp.lengthSq() < 1e-10) _pp.set(0, 0, 1).addScaledVector(_d, -_d.z);
  _pp.normalize();
  _E.copy(S).addScaledVector(_d, a * cosA).addScaledVector(_pp, a * sinA);
  _u.subVectors(_E, S).divideScalar(a);
  _f.copy(S).addScaledVector(_d, D).sub(_E).divideScalar(b);
  // o plano da dobra: w ⟂ u, do lado do osso de baixo (estável com o braço esticado)
  _w.copy(_d).multiplyScalar(sinA).addScaledVector(_pp, -cosA).normalize();
  _y.copy(_u).negate();
  _x.crossVectors(_y, _w);
  _m4.makeBasis(_x, _y, _w);
  top.quaternion.setFromRotationMatrix(_m4);
  mid.rotation.set(-Math.atan2(_f.dot(_w), _f.dot(_u)), 0, 0);
}

// ------------------------------------------------------------------------------------------------ as poses
/**
 * Uma pose é um estado de números: a pelve (no object), o tronco, o pescoço e a cabeça (pitch, yaw, roll), os alvos dos
 * punhos (no tronco) com o lado do cotovelo e a direção da mão, os tornozelos (no object), o rosto e o quepe.
 */
function standing() {
  return {
    pel: [0, STAND_Y, 0], pelR: [0, 0, 0],
    spine: [-0.03, 0, 0], neck: [0.04, 0, 0], head: [-0.02, 0, 0],
    hL: [0.315, -0.12, 0.025], hR: [-0.315, -0.12, 0.025],
    pL: [0.4, 0, -1], pR: [-0.4, 0, -1],
    // a mão: a direção dos dedos e a da palma (no tronco) e o peso disso (0: segue o antebraço)
    dL: [0, -1, 0.15, -1, 0, 0, 0], dR: [0, -1, 0.15, 1, 0, 0, 0],
    gL: 0.22, gR: 0.22,
    fL: [0.11, ANKLE_Y, 0], fR: [-0.11, ANKLE_Y, 0], tL: 0, tR: 0,
    eyes: 1, brow: [0, 0], mouth: 0, cap: [0, 0, 0], breath: 0.006, snore: 0, belly: 0, talk: 0,
  };
}
function seatedBase() {
  const P = standing();
  P.pel = [0, SEAT_Y, -0.3];
  P.pelR = [-0.08, 0, 0];
  P.spine = [-0.03, 0, 0];
  P.neck = [0.04, 0, 0];
  P.head = [-0.04, 0, 0];
  P.fL = [0.15, ANKLE_Y, 0.02];
  P.fR = [-0.14, ANKLE_Y, 0.05];
  return P;
}
/** Acordado na cadeira: as mãos nas coxas. */
function seatedAwake() {
  const P = seatedBase();
  P.hL = [0.165, 0.045, 0.27];
  P.hR = [-0.165, 0.045, 0.27];
  P.pL = [1, -0.1, -0.7];
  P.pR = [-1, -0.1, -0.7];
  P.dL = [-0.05, -0.35, 1, -0.1, -1, 0.2, 1];
  P.dR = [0.05, -0.35, 1, 0.1, -1, 0.2, 1];
  P.gL = 0.3;
  P.gR = 0.3;
  P.brow = [0.15, 0];
  return P;
}
/** Dormindo na cadeira: recostado, a cabeça caída de lado, as mãos cruzadas na barriga e o quepe nos olhos. */
function asleep(t) {
  const P = seatedBase();
  const br = Math.sin((t * TAU) / 3.4); // a respiração do ronco (3,4 s)
  P.pelR = [-0.12, 0, 0.02];
  P.spine = [-0.13, 0.0, 0.04];
  P.neck = [0.2 + 0.03 * br, 0.06, 0.2];
  P.head = [0.06, 0.16, 0.24];
  P.hL = [0.08, 0.075, 0.258 + 0.01 * br];
  P.hR = [-0.05, 0.12, 0.265 + 0.01 * br];
  P.pL = [1, -0.6, -0.3];
  P.pR = [-1, -0.6, -0.3];
  P.dL = [-0.85, -0.35, 0.1, 0, 0.1, -1, 1];
  P.dR = [0.85, -0.2, 0.1, 0, 0.1, -1, 1];
  P.gL = 0.35;
  P.gR = 0.35;
  P.eyes = 0;
  P.brow = [-0.3, 0.2];
  P.mouth = 0.18 + 0.32 * ss(br, 0.3, 1); // no fim de puxar o ar, o ronco abre a boca
  P.cap = [0, 0.07, 0];
  P.breath = 0.032;
  P.snore = 1;
  return P;
}
/** O susto (k 0..1): pula na cadeira, os braços voam, o quepe sobe e cai de volta, e ele fica acordado, olhando. */
function waking(k, t) {
  const P = mixPose(asleep(t), seatedAwake(), ss(k, 0.08, 0.32));
  const jolt = ss(k, 0.06, 0.13) * (1 - ss(k, 0.18, 0.42));
  P.pel[1] += 0.09 * jolt;
  P.pel[2] += 0.03 * jolt;
  P.spine[0] -= 0.12 * jolt;
  P.neck[0] -= 0.25 * jolt;
  P.head[0] -= 0.12 * jolt;
  const up = jolt;
  P.hL = mixArr(P.hL, [0.37, 0.4, 0.14], up);
  P.hR = mixArr(P.hR, [-0.37, 0.44, 0.12], up);
  P.pL = mixArr(P.pL, [1, -1, 0], up);
  P.pR = mixArr(P.pR, [-1, -1, 0], up);
  P.dL = mixArr(P.dL, [0.3, 1, 0.1, 0, 0, 1, 1], up);
  P.dR = mixArr(P.dR, [-0.3, 1, 0.1, 0, 0, 1, 1], up);
  P.gL = lerp(P.gL, 0, up);
  P.gR = lerp(P.gR, 0, up);
  P.fL[1] += 0.05 * jolt; P.fR[1] += 0.04 * jolt;
  P.fL[2] += 0.08 * jolt; P.fR[2] += 0.1 * jolt;
  P.eyes = k < 0.07 ? 0 : 1 + 0.35 * ss(k, 0.07, 0.12) * (1 - ss(k, 0.5, 0.85));
  P.brow = [lerp(P.brow[0], 1.0, ss(k, 0.07, 0.12) * (1 - 0.6 * ss(k, 0.5, 0.9))), 0.25 * jolt];
  P.mouth = Math.max(0, 0.95 * ss(k, 0.07, 0.11) * (1 - ss(k, 0.3, 0.48)));
  // o quepe: sobe (girando para trás), para no ar e cai de volta no lugar com um quiquezinho
  const fly = clamp((k - 0.09) / 0.45, 0, 1);
  const arc = 4 * fly * (1 - fly);
  const bounce = Math.max(0, Math.sin(clamp((k - 0.54) / 0.1, 0, 1) * Math.PI)) * 0.012;
  P.cap = [0.14 * arc + bounce, lerp(0.07, 0, ss(k, 0.1, 0.5)) - 0.55 * arc, 0.12 * arc];
  // depois do susto, olha em volta
  P.head[1] += 0.35 * Math.sin((k - 0.55) * TAU * 1.1) * ss(k, 0.52, 0.62) * (1 - ss(k, 0.88, 1));
  return P;
}
function walking(phase) {
  const P = standing();
  const H = 0.23; // meio passo (uma volta = 2H / 0,62 = WALK_CYCLE)
  const foot = (p) => {
    p = ((p % 1) + 1) % 1;
    if (p < 0.62) {
      const u = p / 0.62;
      return { z: lerp(H, -H, u), y: 0, pitch: lerp(-0.22, 0, ss(u, 0, 0.18)) + 0.38 * ss(u, 0.72, 1) };
    }
    const u = (p - 0.62) / 0.38;
    return { z: lerp(-H, H, ss(u, 0, 1)), y: 0.085 * Math.sin(Math.PI * u), pitch: lerp(0.38, -0.22, ss(u, 0.15, 0.95)) };
  };
  const L = foot(phase), R = foot(phase + 0.5);
  const lift = (f) => 0.045 * Math.abs(Math.sin(f.pitch));
  P.fL = [0.12, ANKLE_Y + L.y + lift(L), L.z];
  P.fR = [-0.12, ANKLE_Y + R.y + lift(R), R.z];
  P.tL = L.pitch;
  P.tR = R.pitch;
  const c2 = Math.cos(phase * TAU * 2), s1 = Math.sin(phase * TAU);
  P.pel = [0.018 * s1, 0.822 + 0.02 * (0.5 - 0.5 * c2), 0]; // as pernas alcançam o chão no passo mais aberto
  P.pelR = [0.02, 0.08 * s1, -0.035 * s1];
  P.spine = [0.03, -0.11 * s1, 0.03 * s1];
  P.neck = [0.05 + 0.02 * c2, 0.03 * s1, 0];
  // os braços balançam ao contrário das pernas
  P.hL = [0.31, -0.11 + 0.02 * Math.abs(R.z / H), 0.04 + 0.15 * (R.z / H)];
  P.hR = [-0.31, -0.11 + 0.02 * Math.abs(L.z / H), 0.04 + 0.15 * (L.z / H)];
  P.belly = Math.sin(phase * TAU * 2 - 1.0);
  return P;
}
function gateOpening(k) {
  const P = standing();
  const reach = ss(k, 0, 0.35), grip = ss(k, 0.32, 0.5), pull = ss(k, 0.5, 0.95);
  P.spine = [-0.03 + 0.14 * reach - 0.16 * pull, -0.08 * reach, 0];
  P.neck = [0.04 + 0.08 * reach, -0.1 * reach, 0];
  P.hR = mixArr(mixArr(P.hR, [-0.13, 0.1, 0.36], reach), [-0.22, 0.08, 0.2], pull);
  P.pR = [-1, -0.4, -0.3];
  P.dR = [0, -0.15, 1, 1, 0, 0, reach];
  P.gR = 0.15 + 0.8 * grip;
  P.fR = [-0.12, ANKLE_Y, 0.1 * reach - 0.04 * pull];
  P.fL = [0.11, ANKLE_Y, -0.05 * pull];
  P.pel = [0, STAND_Y - 0.01 * reach, 0.04 * reach - 0.03 * pull];
  P.brow = [-0.1 * reach, -0.25 * pull];
  P.mouth = 0.15 * pull;
  return P;
}
function waving(t) {
  const P = standing();
  const w = Math.sin(t * TAU * 1.6);
  P.hR = [-0.36 + 0.06 * w, 0.6, 0.1];
  P.pR = [-1, -1, 0.2];
  P.dR = [-0.25 * w, 1, 0.1, 0, 0, 1, 1];
  P.gR = 0;
  P.head = [-0.06, 0.05, -0.1];
  P.spine = [-0.05, 0, 0.04];
  P.brow = [0.45, 0.1];
  P.eyes = 1.05;
  P.mouth = 0.22;
  return P;
}
function talking(t) {
  const P = standing();
  const g = Math.sin(t * 2.3), g2 = Math.sin(t * 1.3 + 1);
  P.hL = [0.24 + 0.03 * g2, 0.1 + 0.04 * g, 0.3];
  P.pL = [1, -0.6, -0.3];
  P.dL = [0.35, 0.15, 1, 0, 1, 0, 1];
  P.gL = 0.05;
  P.neck = [0.04 + 0.04 * Math.sin(t * 3.1), 0.06 * g2, 0];
  P.head = [-0.02, 0.05 * g, 0.04 * g2];
  P.brow = [0.25 + 0.2 * Math.max(0, g), 0.05];
  P.talk = 1;
  return P;
}
function mixArr(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }
function mixArrInto(out, a, b, t) { for (let i = 0; i < out.length; i++) out[i] = lerp(a[i], b[i], t); }
/** As poses sentadas (a cadeira atrás) e o que é das mãos na mistura entre poses. */
const SEATED = new Set(['dorme', 'acorda', 'sentado']);
const HAND_KEYS = ['hL', 'hR', 'pL', 'pR', 'dL', 'dR'];
/** Mistura duas poses (números e listas). */
function mixPose(a, b, t, out = {}) {
  for (const k of Object.keys(b)) {
    const va = a[k] ?? b[k], vb = b[k];
    if (Array.isArray(vb)) {
      const o = Array.isArray(out[k]) && out[k].length === vb.length ? out[k] : new Array(vb.length);
      for (let i = 0; i < vb.length; i++) o[i] = lerp(va[i], vb[i], t);
      out[k] = o;
    } else out[k] = lerp(va, vb, t);
  }
  return out;
}
const clonePose = (p) => mixPose(p, p, 0);
/** Quanto tempo a troca de pose leva (s). */
const BLEND = { 'dorme': 0.6, 'acorda': 0.08, 'sentado': 0.5, 'em-pe': 0.75, 'anda': 0.35, 'abre-portao': 0.3, 'acena': 0.35, 'fala': 0.35 };
/** Quanto dura o que anda sozinho (s), quando a cena não dá o k. */
const AUTO = { 'acorda': 1.4, 'abre-portao': 1.6 };
export const SR_LUIZ_POSES = Object.keys(BLEND);

// ------------------------------------------------------------------------------------------------ o Sr. Luiz
export function createSrLuiz() {
  const M = {
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
    gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.08 }),
    boot: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 }),
  };
  const object = new THREE.Group();
  object.name = 'porteiro:sr-luiz';
  const pelvis = new THREE.Group();
  pelvis.name = 'sr-luiz:pelve';
  pelvis.rotation.order = 'YXZ';
  object.add(pelvis);
  for (const m of buildPelvis(M)) pelvis.add(m);
  const spine = new THREE.Group();
  spine.name = 'sr-luiz:tronco';
  spine.position.y = SPINE_Y;
  spine.rotation.order = 'YXZ';
  pelvis.add(spine);
  const [torso, torsoGloss] = buildTorso(M);
  spine.add(torso, torsoGloss);
  const neck = new THREE.Group();
  neck.name = 'sr-luiz:pescoco';
  neck.position.set(...NECK);
  neck.rotation.order = 'YXZ';
  neck.add(fuse([tint(hangCyl(0.058, 0.062, 0.115, 10, true).translate(0, 0.085, 0), PAL.skin)], M.matte, 'pescoco'));
  spine.add(neck);
  const head = new THREE.Group();
  head.name = 'sr-luiz:cabeca';
  head.position.y = HEAD_PIVOT;
  head.scale.setScalar(HEAD_SCALE);
  head.rotation.order = 'YXZ';
  neck.add(head);
  for (const m of buildHead(M)) head.add(m);
  const hc = new V3(...HEAD_C);
  // as pálpebras (meia esfera cor de pele que desce sobre o olho) com o risco dos cílios
  const lids = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(hc.x + s * 0.045, hc.y + 0.024, hc.z + 0.104);
    const dome = tint(new THREE.SphereGeometry(1, 10, 4, 0, TAU, 0, Math.PI / 2).scale(0.0288, 0.0318, 0.0188), PAL.lid);
    const lash = tint(new THREE.TorusGeometry(1, 0.07, 3, 8).rotateX(Math.PI / 2).scale(0.029, 0.03, 0.0192), '#3a2a22');
    g.add(fuse([dome, lash], M.matte, `palpebra-${s > 0 ? 'esquerda' : 'direita'}`, false));
    head.add(g);
    return g;
  });
  // as sobrancelhas grisalhas (cada uma sobe, desce e entorta)
  const brows = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(hc.x + s * 0.047, hc.y + 0.08, hc.z + 0.094);
    const geo = new THREE.CapsuleGeometry(0.0115, 0.036, 1, 6).rotateZ(Math.PI / 2).scale(1, 1.2, 0.9);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) - 7 * P.getX(i) * P.getX(i) + s * 0.08 * P.getX(i));
    geo.computeVertexNormals();
    g.rotation.y = s * 0.28;
    g.add(fuse([tint(geo, (x, y) => _c.set(PAL.hair).lerp(_c.clone().set(PAL.hairDark), clamp(-y * 40, 0, 0.5)))], M.matte, 'sobrancelha', false));
    head.add(g);
    return { g, s, y: g.position.y };
  });
  // a boca (embaixo do bigode: abre na fala, no ronco e no grito)
  const mouth = new THREE.Group();
  mouth.position.set(hc.x, hc.y - 0.078, hc.z + 0.117);
  mouth.add(fuse([
    tint(ell(0.022, 0.012, 0.009, 8, 5), PAL.mouth),
    tint(ell(0.012, 0.005, 0.005, 6, 3).translate(0, -0.006, 0.004), PAL.tongue),
  ], M.matte, 'boca', false));
  head.add(mouth);
  const stache = new THREE.Group();
  stache.name = 'sr-luiz:bigode';
  stache.position.set(hc.x, hc.y - 0.045, hc.z + 0.13);
  stache.add(buildStache(M));
  head.add(stache);
  const cap = new THREE.Group();
  cap.name = 'sr-luiz:quepe';
  const CAP0 = new V3(hc.x, hc.y + 0.058, hc.z - 0.004);
  cap.position.copy(CAP0);
  for (const m of buildCap(M)) cap.add(m);
  head.add(cap);
  const arms = { L: buildArm(M, 1), R: buildArm(M, -1) };
  spine.add(arms.L.shoulder, arms.R.shoulder);
  const legs = { L: buildLeg(M, 1), R: buildLeg(M, -1) };
  pelvis.add(legs.L.hip, legs.R.hip);
  object.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  // ---------------------------------------------------------------- estado
  const S = {
    name: 'em-pe', k: /** @type {number | null} */ (null), poseT: 0, blendT: 1, blendDur: 0.4, t: 0,
    from: standing(), cur: standing(), walk: 0, last: new V3(), hasLast: false,
    look: /** @type {{x:number,y:number,z:number}|null} */ (null), lookK: 0, lookYaw: 0, lookPitch: 0,
    say: false, talkK: 0, blinkT: 2.5, blink: 0,
    reach: { L: /** @type {{x:number,y:number,z:number}|null} */ (null), R: null }, reachK: { L: 0, R: 0 },
  };

  function target(t) {
    const k = S.k ?? (AUTO[S.name] ? clamp(S.poseT / AUTO[S.name], 0, 1) : 0);
    switch (S.name) {
      case 'dorme': return asleep(t);
      case 'acorda': return waking(k, t);
      case 'sentado': return seatedAwake();
      case 'anda': return walking((S.k ?? S.walk) / WALK_CYCLE);
      case 'abre-portao': return gateOpening(k);
      case 'acena': return waving(t);
      case 'fala': return talking(t);
      default: {
        const P = standing();
        P.pel[0] = 0.008 * Math.sin(t * 0.7);
        P.spine[2] = 0.012 * Math.sin(t * 0.7 + 0.5);
        P.head[1] = 0.05 * Math.sin(t * 0.37);
        return P;
      }
    }
  }

  const _qT = new THREE.Quaternion(), _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _qI = new THREE.Quaternion();
  const _S = new V3(), _T = new V3(), _P = new V3(), _v = new V3(), _hx = new V3(), _hy = new V3(), _hz = new V3();
  const _pelM = new THREE.Matrix4(), _pelInv = new THREE.Matrix4(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

  /** Põe o estado `P` no esqueleto. */
  function apply(P, t, dt) {
    pelvis.position.set(P.pel[0], P.pel[1], P.pel[2]);
    pelvis.rotation.set(P.pelR[0], P.pelR[1], P.pelR[2]);
    spine.rotation.set(P.spine[0], P.spine[1], P.spine[2]);
    neck.rotation.set(P.neck[0], P.neck[1], P.neck[2]);
    head.rotation.set(P.head[0], P.head[1], P.head[2]);
    // o olhar: o pescoço faz uma parte e a cabeça o resto (dormindo, quase nada)
    S.lookK += ((S.look ? 1 : 0) - S.lookK) * (1 - Math.exp(-dt * 7));
    if (S.lookK > 0.002) {
      if (S.look) {
        object.updateMatrixWorld(true);
        spine.worldToLocal(_v.set(S.look.x, S.look.y, S.look.z));
        _v.x -= NECK[0]; _v.y -= NECK[1] + 0.15; _v.z -= NECK[2];
        const f = 1 - Math.exp(-dt * 10);
        S.lookYaw += (clamp(Math.atan2(_v.x, _v.z), -1.2, 1.2) - S.lookYaw) * f;
        S.lookPitch += (clamp(-Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.6, 0.7) - S.lookPitch) * f;
      }
      const w = S.lookK * clamp(P.eyes, 0.15, 1);
      neck.rotation.y = lerp(neck.rotation.y, S.lookYaw * 0.4, w);
      head.rotation.y = lerp(head.rotation.y, S.lookYaw * 0.6, w);
      neck.rotation.x = lerp(neck.rotation.x, S.lookPitch * 0.4, w);
      head.rotation.x = lerp(head.rotation.x, S.lookPitch * 0.6, w);
      head.rotation.z *= 1 - 0.7 * w;
    }
    // a respiração e a barriga balançando
    const br = P.snore > 0.01 ? Math.sin((t * TAU) / 3.4) : Math.sin(t * 1.9);
    const b = P.breath * br;
    torso.scale.set(1 + 0.35 * b, 1 + 0.25 * b, 1 + b + 0.028 * P.belly);
    torsoGloss.scale.copy(torso.scale);
    // o rosto
    S.blinkT -= dt;
    if (S.blinkT <= 0) { S.blink = 0.0001; S.blinkT = 2.4 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3; }
    if (S.blink > 0) { S.blink += dt; if (S.blink > 0.14) S.blink = 0; }
    const blinkK = S.blink > 0 ? Math.sin(Math.PI * Math.min(1, S.blink / 0.14)) : 0;
    const open = P.eyes * (1 - blinkK * (P.eyes > 0.4 ? 1 : 0));
    const lidA = open <= 1 ? lerp(Math.PI / 2 + 0.15, -0.55, Math.max(0, open)) : -0.55 - (open - 1) * 1.6;
    for (const l of lids) l.rotation.x = lidA;
    for (const B of brows) {
      B.g.position.y = B.y + 0.012 * P.brow[0];
      B.g.rotation.z = -B.s * 0.35 * P.brow[1];
    }
    const flap = S.talkK * (0.25 + 0.65 * Math.abs(Math.sin(t * 11)) * (0.55 + 0.45 * Math.sin(t * 2.7)));
    const mo = Math.max(P.mouth, flap);
    mouth.scale.set(1 + 0.15 * mo, 0.18 + 1.5 * mo, 1);
    mouth.position.y = hc.y - 0.078 - 0.008 * mo;
    // o bigode: treme no sopro do ronco e acompanha a boca
    const exhale = P.snore * clamp(-br, 0, 1);
    stache.rotation.x = 0.07 * exhale * Math.sin(t * 57) - 0.08 * mo;
    stache.scale.set(1, 1 + 0.07 * exhale * Math.sin(t * 43) + 0.06 * mo, 1);
    stache.position.y = hc.y - 0.045 - 0.004 * mo;
    cap.position.set(CAP0.x, CAP0.y + P.cap[0], CAP0.z - 0.01 * P.cap[1]);
    cap.rotation.set(-0.1 + P.cap[1], 0, P.cap[2]);

    // as pernas: os tornozelos vão aos alvos (no object); a botina fica no rumo do chão (mais a ponta do pé)
    pelvis.updateMatrix();
    _pelM.copy(pelvis.matrix);
    _pelInv.copy(_pelM).invert();
    for (const side of /** @type {const} */ (['L', 'R'])) {
      const leg = legs[side], f = side === 'L' ? P.fL : P.fR, tp = side === 'L' ? P.tL : P.tR;
      _T.set(f[0], f[1], f[2]).applyMatrix4(_pelInv);
      _P.set(leg.s * 0.12, 0, 1).transformDirection(_pelInv);
      solve2(leg.hip, leg.knee, leg.hip.position, _T, _P, THIGH, SHIN);
      _qT.setFromEuler(_e.set(tp, 0, 0, 'YXZ'));
      _qA.setFromRotationMatrix(_pelM).multiply(leg.hip.quaternion).multiply(leg.knee.quaternion).invert();
      leg.ankle.quaternion.copy(_qA).multiply(_qT);
    }
    // os braços: os punhos vão aos alvos (no tronco), ou a um ponto do mundo (reach)
    for (const side of /** @type {const} */ (['L', 'R'])) {
      const arm = arms[side];
      const h = side === 'L' ? P.hL : P.hR, p = side === 'L' ? P.pL : P.pR, d = side === 'L' ? P.dL : P.dR;
      _T.set(h[0], h[1], h[2]);
      S.reachK[side] += ((S.reach[side] ? 1 : 0) - S.reachK[side]) * (1 - Math.exp(-dt * 8));
      if (S.reachK[side] > 0.002 && S.reach[side]) {
        object.updateMatrixWorld(true);
        const r = S.reach[side];
        spine.worldToLocal(_v.set(r.x, r.y, r.z));
        // o alvo é a palma: o punho fica um palmo antes, na reta do ombro
        _S.copy(arm.shoulder.position);
        const len = _v.distanceTo(_S);
        if (len > 0.09) _v.addScaledVector(_S.sub(_v).normalize(), 0.075);
        _T.lerp(_v, S.reachK[side]);
      }
      _P.set(p[0], p[1], p[2]);
      solve2(arm.shoulder, arm.elbow, arm.shoulder.position, _T, _P, UPPER, FORE);
      // a mão: segue o antebraço, ou vira para a direção pedida (os dedos e a palma, no tronco)
      const wgt = d[6];
      if (wgt > 0.001) {
        _hy.set(-d[0], -d[1], -d[2]).normalize();
        _hx.set(d[3], d[4], d[5]).multiplyScalar(-arm.s).addScaledVector(_hy, 0);
        _hx.addScaledVector(_hy, -_hx.dot(_hy));
        if (_hx.lengthSq() < 1e-8) _hx.set(1, 0, 0).addScaledVector(_hy, -_hy.x);
        _hx.normalize();
        _hz.crossVectors(_hx, _hy);
        _m4.makeBasis(_hx, _hy, _hz);
        _qT.setFromRotationMatrix(_m4);
        _qA.copy(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).invert().multiply(_qT);
        arm.hand.quaternion.slerpQuaternions(_qI, _qA, wgt);
      } else arm.hand.quaternion.identity();
      arm.grip(side === 'L' ? P.gL : P.gR);
    }
  }

  function update(dt, t) {
    S.t = t;
    S.poseT += dt;
    S.blendT += dt;
    // o quanto ele andou (a cena move o object): o passo segue o chão, sem patinar
    const at = object.position;
    if (S.hasLast) {
      const moved = Math.hypot(at.x - S.last.x, at.z - S.last.z);
      if (S.name === 'anda' && S.k == null) S.walk += moved > 1e-4 && moved < 0.5 ? moved : dt * 0.9;
    }
    S.last.copy(at);
    S.hasLast = true;
    S.talkK += ((S.say ? 1 : 0) - S.talkK) * (1 - Math.exp(-dt * 12));
    const T = target(t);
    if (T.talk) S.talkK = Math.max(S.talkK, T.talk);
    const u = S.blendDur > 0 ? ss(S.blendT / S.blendDur, 0, 1) : 1;
    mixPose(S.from, T, u, S.cur);
    if (u < 1) {
      // as mãos: ao sentar, só vão para a barriga ou para as coxas depois que o corpo desceu; ao levantar, saem antes
      // (nas duas, longe do tampo do balcão da guarita enquanto o corpo passa pela altura dele)
      const uh = SEATED.has(S.name) ? ss(u, 0.4, 1) : ss(u, 0, 0.6);
      for (const k of HAND_KEYS) mixArrInto(S.cur[k], S.from[k], T[k], uh);
    }
    apply(S.cur, t, dt);
  }

  const _hp = new V3();
  const api = {
    object,
    /** O nome da pose agora. */
    get pose() { return S.name; },
    /**
     * Troca de pose (com mistura curta) ou só o progresso dela (`k`). Com { instant: true }, a pose entra já pronta
     * (corte de câmera).
     * @param {string} name @param {number} [k] @param {{ instant?: boolean }} [opts]
     */
    setPose(name, k, opts = {}) {
      if (!BLEND[name]) name = 'em-pe';
      if (name !== S.name) {
        S.from = clonePose(S.cur);
        S.name = name;
        S.poseT = 0;
        S.blendT = 0;
        S.blendDur = BLEND[name];
        if (name === 'anda') S.walk = 0;
      }
      S.k = typeof k === 'number' && Number.isFinite(k) ? k : null;
      if (opts.instant) {
        S.blendT = S.blendDur;
        S.from = clonePose(target(S.t));
        update(0, S.t);
      }
    },
    update,
    /** A cabeça vira para um ponto do mundo; null volta ao normal. */
    lookAt(p) { S.look = p ? { x: p.x, y: p.y, z: p.z } : null; },
    /** A boca mexe embaixo do bigode (em qualquer pose). */
    say(on) { S.say = !!on; },
    /** A mão ('L' | 'R') vai até um ponto do mundo (a palma encosta nele); null devolve à pose. */
    reach(side, p) { const k = side === 'L' ? 'L' : 'R'; S.reach[k] = p ? { x: p.x, y: p.y, z: p.z } : null; },
    /** Onde está a palma da mão ('L' | 'R') agora, no mundo. */
    handPoint(side = 'R') {
      const h = arms[side === 'L' ? 'L' : 'R'].hand;
      h.updateWorldMatrix(true, false);
      _hp.set(0, -0.045, 0).applyMatrix4(h.matrixWorld);
      return { x: _hp.x, y: _hp.y, z: _hp.z };
    },
    setVisible(on) { object.visible = !!on; },
    /** As peças (para quem precisar de mais: o quepe, a cabeça, as mãos). */
    parts: { pelvis, spine, neck, head, cap, stache, mouth, arms, legs },
    dispose() {
      object.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const m of Object.values(M)) m.dispose();
      object.removeFromParent();
    },
  };
  S.cur = standing();
  apply(S.cur, 0, 0);
  return api;
}

// ------------------------------------------------------------------------------------------------ a cadeira da guarita
/**
 * A cadeira giratória da guarita: a base de cinco pés com rodinhas, a coluna cromada, o assento estofado gasto e o
 * encosto. Origem no chão, no meio da base; o assento (alto a 0,47 m) olha para +Z. setSwivel(a) gira o assento.
 */
export function createGuardChair() {
  const matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const gloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.55 });
  const object = new THREE.Group();
  object.name = 'porteiro:cadeira';
  const base = [];
  const shiny = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    const ex = Math.sin(a) * 0.27, ez = Math.cos(a) * 0.27;
    base.push(tint(rodAB([0, 0.085, 0], [ex, 0.065, ez], 0.018, 6), '#2b2b30'));
    base.push(tint(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 7).rotateZ(Math.PI / 2).rotateY(a).translate(ex, 0.026, ez), '#1d1d21'));
    base.push(tint(new THREE.BoxGeometry(0.012, 0.03, 0.02).rotateY(a).translate(ex, 0.05, ez), '#3a3a40'));
  }
  base.push(tint(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 10).translate(0, 0.085, 0), '#2b2b30'));
  shiny.push(tint(new THREE.CylinderGeometry(0.024, 0.024, 0.27, 8, 1, true).translate(0, 0.24, 0), '#c9ced3'));
  object.add(fuse(base, matte, 'cadeira-base'));
  object.add(fuse(shiny, gloss, 'cadeira-coluna', false));
  const top = new THREE.Group();
  top.name = 'cadeira-assento';
  const seat = tint(new RoundedBoxGeometry(0.47, 0.085, 0.45, 1, 0.035).translate(0, 0.428, 0), (x, y, z) => {
    // o estofado azul-escuro com o meio mais claro de gasto
    const worn = Math.max(0, 1 - Math.hypot(x / 0.16, (z + 0.02) / 0.15));
    return _c.set('#3b4458').lerp(_c.clone().set('#56607a'), 0.6 * worn * (y > 0.45 ? 1 : 0));
  });
  const parts = [
    seat,
    tint(new THREE.BoxGeometry(0.2, 0.03, 0.2).translate(0, 0.372, 0), '#2b2b30'),
    tint(new RoundedBoxGeometry(0.42, 0.36, 0.065, 1, 0.03).rotateX(-0.12).translate(0, 0.8, -0.215), '#3b4458'),
    tint(new THREE.BoxGeometry(0.05, 0.36, 0.03).rotateX(-0.06).translate(0, 0.53, -0.24), '#2b2b30'),
  ];
  top.add(fuse(parts, matte, 'cadeira-estofado'));
  object.add(top);
  return {
    object,
    /** Gira o assento e o encosto (rad). */
    setSwivel(a) { top.rotation.y = a; },
    dispose() {
      object.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      matte.dispose();
      gloss.dispose();
      object.removeFromParent();
    },
  };
}
