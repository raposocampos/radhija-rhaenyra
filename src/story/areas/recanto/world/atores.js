// RECANTO DAS PATINHAS — os atores das cenas e o que se mexe sem ser cenário:
//  - o Esquadrão Migalha (createPigeon de src/world/pigeon.js, vestido e animado POR FORA: o modelo das fases não
//    muda). Pombo-comum de desenho: corpo cinza-claro, capuz escuro com o furta-cor verde e violeta, duas barras pretas
//    nas asas, carúncula branca, postura de peito erguido. O CAPITÃO (quepe azul com a pala e o cachecol vermelho; mede
//    a cenoura com a asa e bate continência), o FARELO (o maior e gordinho, com migalhas no bico e no peito) e o SONECA
//    (touquinha de dormir, olhos sempre meio fechados). Cada um:
//      { object, setPose, peek, peck, setVisible, update(dt, t), salute(k), measure(k), shiver(k), lookAt(p | null),
//        carry(on), feetPoint() }.
//  - a CENOURA DE BORRACHA nova (a das fases é de pelúcia): laranja brilhante, com os gomos, as folhas de borracha e o
//    furinho do apito; squeeze(k) amassa no "fiu"; holdBy(pombo | null) prende nas patas dele: em voo, as duas patas
//    descem e os dedos fecham em volta dela (ela pende com a ponta para baixo e para trás e balança com atraso);
//    pousado, ela fica deitada no apoio com uma pata em cima. Presa, a posição dela é sempre função das patas.
//  - as MÃOS E PÉS humanos (kit de cenas): o braço da tutora e o porteiro antigo (só a botina e a mão), escondidos até
//    as cenas.
//  - o SR. LUIZ, o porteiro de corpo inteiro (src/story/scene/srLuiz.js), dormindo na cadeira giratória dentro da
//    guarita, de frente para o guichê (visível pela janela): props.srLuiz = { ...a API dele, chair, spot, reset() }.
//    Sentado, ele fica atrás do balcão de dentro (o tampo, de leste.js, termina em z = BOOTH.z1 − 0,6) e a ponta das
//    botinas fica embaixo do tampo. ATENÇÃO: o biombo escuro de leste.js (z = BOOTH.z1 − 0,76, do chão ao teto)
//    atravessa ele e a cadeira e o esconde da janela: precisa sair de lá (ou ir para trás da cadeira, z < BOOTH.z1 − 1,4).
//  - a PENA de pombo molhada (src/story/scene/feather.js), escondida até as cenas: props.feather = { object, setWet(k),
//    sill: { x, y, z, yaw }, placeOnSill() } (deitada no parapeito de fora, onde ela fica de manhã).
//  - o BICHANO, o gato da fase 9 (src/story/scene/bichano.js), dormindo no capô da caminhonete, na garagem:
//    props.bichano = { ...a API dele, spot, reset() } (dentro do colisor da caminhonete, acima das dogs).
//  - as SILHUETAS da Reconstrução da piscina: um pombo (o Farelo) e a boia de patinho murcha, translúcidos.
//  - a GAROA da abertura: riscos de chuva numa malha só (instâncias), em volta da casa.
//  - as MEIAS PERDIDAS (o colecionável do capítulo): { id, object, collect(), reset() }.
import * as THREE from 'three';
import { createPigeon } from '../../../../world/pigeon.js';
import { createSock } from '../../../../world/toys.js';
import { mergeGeometries } from '../../../../world/util.js';
import { createTutoraArm, createPorteiro } from '../../../scene/humans.js';
import { createSrLuiz, createGuardChair, CHAIR_OFFSET } from '../../../scene/srLuiz.js';
import { createFeather } from '../../../scene/feather.js';
import { createBichano } from '../../../scene/bichano.js';
import { ghostMaterial, ghostify } from '../../../faro/reconstruction.js';

const { smoothstep: ss, lerp, clamp } = THREE.MathUtils;
const C = (hex) => new THREE.Color(hex);
/** 1 em `at`, caindo a 0 a `half` de distância. */
const band = (v, at, half) => 1 - ss(Math.abs(v - at), half * 0.55, half);

// Medidas do pombo de src/world/pigeon.js (metros, sem a escala; os pés na origem e o bico para +z).
const HIP_Y = 0.075, HIP_Z = 0.012; // o nó `pes` fica no quadril
const ANKLE = [0.026, -0.0715, -0.008]; // o tornozelo direito, no nó `pes` (o esquerdo é o espelho em x)
const LEG_TOP = 0.001, TOE_R = 0.0032;
const TORSO_HALF = 0.083;

// ------------------------------------------------------------------------------------------------ a cenoura (forma)
const CARROT = { len: 0.24, z0: -0.24 * 0.42, rMax: 0.0405 };
/** O raio da cenoura (m) em z (folhas em −z, ponta em +z; a origem a 42% do corpo), sem os gomos. */
function carrotRadius(z) {
  const u = clamp((z - CARROT.z0) / CARROT.len, 0, 1);
  const shoulder = Math.sqrt(1 - Math.pow(1 - Math.min(1, u / 0.13), 2));
  const taper = 1 - 0.76 * Math.pow(u, 1.12);
  const tip = u > 0.9 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.9) / 0.1, 2))) : 1;
  return CARROT.rMax * (0.22 + 0.78 * shoulder) * taper * tip;
}
/**
 * A cenoura deitada num apoio plano: a reta em que ela encosta (o ombro gordo e perto da ponta), no plano (z, raio).
 * `beta` é o quanto a ponta desce; `height(z)`, a altura do eixo sobre o apoio.
 */
const CARROT_REST = (() => {
  const pts = [];
  for (let i = 0; i <= 80; i++) { const z = CARROT.z0 + CARROT.len * i / 80; pts.push([z, carrotRadius(z)]); }
  let best = { a: 0, b: CARROT.rMax, span: 0 };
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const [zi, ri] = pts[i], [zj, rj] = pts[j];
    if (zi > -0.02 || zj < -0.02 || zj - zi <= best.span) continue; // o peso fica entre os dois apoios
    const a = (rj - ri) / (zj - zi), b = ri - a * zi;
    if (pts.every(([z, r]) => r <= a * z + b + 1e-6)) best = { a, b, span: zj - zi };
  }
  const beta = Math.atan(-best.a);
  return { beta, height: (z) => (best.a * z + best.b) * Math.cos(beta) };
})();

// ------------------------------------------------------------------------------------------------ pintura e peças
const _c = new THREE.Color();
/**
 * Pinta uma geometria por vértice (cor fixa ou função da posição) e põe os efeitos do material do pombo
 * (pigeonFx: furta-cor, brilho próprio, matiz): os acessórios usam o mesmo material da plumagem.
 */
function dye(geo, color, glow = 0) {
  const P = geo.attributes.position, n = P.count;
  const col = new Float32Array(n * 3), fx = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = typeof color === 'function' ? color(P.getX(i), P.getY(i), P.getZ(i)) : _c.set(color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    fx[i * 3 + 1] = glow;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('pigeonFx', new THREE.BufferAttribute(fx, 3));
  geo.deleteAttribute('uv');
  return geo;
}
/** Várias peças pintadas numa malha só (um desenho por acessório). */
function fused(parts, material, name, shadow = true) {
  const m = new THREE.Mesh(mergeGeometries(parts), material);
  for (const g of parts) g.dispose();
  m.name = name;
  m.castShadow = shadow;
  return m;
}
/** Cada vértice de uma malha do pombo: fn(posição, cor, fx, i) mexe na cor e nos efeitos no lugar. */
function eachVertex(mesh, fn) {
  const g = mesh.geometry, P = g.attributes.position, K = g.attributes.color, F = g.attributes.pigeonFx;
  const v = new THREE.Vector3(), c = new THREE.Color(), f = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    c.fromBufferAttribute(K, i);
    f[0] = F.getX(i); f[1] = F.getY(i); f[2] = F.getZ(i);
    fn(v, c, f, i);
    K.setXYZ(i, c.r, c.g, c.b);
    F.setXYZ(i, f[0], f[1], f[2]);
  }
}

const GLOW = 0.07; // um fio de brilho próprio: de noite o pombo não vira um vulto preto
/**
 * A plumagem de pombo-comum por cima do `tint` do modelo: barriga e flancos claros, capuz escuro descendo até o alto
 * do peito, pescoço furta-cor vivo (violeta embaixo, verde em cima), sobre branco, as DUAS BARRAS pretas atravessando
 * a asa e a carúncula branca maior. Só cor e efeitos por vértice: o material e as malhas são os do modelo.
 */
function repaint({ torso, neck, head, wings, tail, feetMesh }, tint) {
  const base = C(tint);
  const light = base.clone().lerp(C('#f2f3f5'), 0.42);
  const hood = base.clone().multiplyScalar(0.5).lerp(C('#4c4680'), 0.4);
  const headC = base.clone().multiplyScalar(0.58).lerp(C('#4d5d8c'), 0.32);
  const green = C('#1fae7c'), violet = C('#8d4cc4'), black = C('#15171d'), white = C('#f4f5f8');

  eachVertex(torso, (v, c, f) => {
    const hoodW = ss(v.z, 0.04, 0.1) * ss(v.y, -0.012, 0.04);
    const bellyW = ss(-v.y, -0.02, 0.05) * (1 - hoodW);
    const rumpW = ss(-v.z, 0.06, 0.12) * ss(v.y, 0, 0.04);
    c.lerp(light, 0.6 * bellyW).lerp(white, 0.65 * rumpW).lerp(hood, 0.8 * hoodW);
    f[0] = Math.max(f[0], 0.36 * hoodW);
    f[1] += GLOW + 0.1 * hoodW;
    f[2] = lerp(f[2], 0.9, hoodW);
  });
  eachVertex(neck, (v, c, f) => {
    const s = clamp((v.y + 0.012) / 0.09, 0, 1);
    const top = ss(s, 0.72, 0.92); // lá em cima emenda na cabeça
    c.copy(violet).lerp(green, ss(s, 0.3, 0.6)).lerp(headC, top);
    f[0] = 0.45 * (1 - top);
    f[1] += GLOW + 0.3 * (1 - top);
  });
  // a cabeça: a cor que mais se repete é a da plumagem (o resto é bico, carúncula e olhos)
  const count = new Map();
  eachVertex(head, (v, c) => { const k = c.getHex(); count.set(k, (count.get(k) || 0) + 1); });
  const plume = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const cere = C('#ece7df'), lobes = [], mid = new THREE.Vector3();
  eachVertex(head, (v, c, f, i) => {
    if (c.getHex() === plume) c.copy(headC);
    else if (Math.abs(c.r - cere.r) + Math.abs(c.g - cere.g) + Math.abs(c.b - cere.b) < 0.03 && f[1] > 0.01 && f[1] < 0.2) {
      lobes.push(i);
      mid.add(v);
      c.copy(white);
      f[1] = 0.22;
    }
    f[1] += GLOW;
  });
  if (lobes.length) {
    // a carúncula cresce em volta do próprio centro (na base e nos alvos dos olhos fechados, que guardam a cabeça toda)
    mid.divideScalar(lobes.length);
    const g = head.geometry;
    for (const P of [g.attributes.position, ...(g.morphAttributes.position || [])]) {
      for (const i of lobes) {
        P.setXYZ(i, mid.x + (P.getX(i) - mid.x) * 1.38, mid.y + 0.001 + (P.getY(i) - mid.y) * 1.38, mid.z + 0.001 + (P.getZ(i) - mid.z) * 1.3);
      }
    }
  }
  // as barras cruzam a asa dobrada de cima a baixo, em dois anéis de vértices da coberteira (u ao longo dela: a raiz
  // em WING_ROOT, no nó da asa, e o comprimento para trás e para baixo, como o modelo a monta)
  const axis = new THREE.Vector3(-0.15, -0.24, -1).normalize();
  wings.forEach((w, n) => {
    const sx = n ? 1 : -1;
    eachVertex(w, (v, c, f) => {
      const u = ((v.x * sx - 0.03) * axis.x + (v.y - 0.004) * axis.y + (v.z - 0.02) * axis.z) / 0.172;
      c.lerp(black, 0.95 * Math.max(band(u, 0.629, 0.075), band(u, 0.854, 0.07)));
      f[1] += GLOW;
    });
  });
  for (const m of [tail, feetMesh]) eachVertex(m, (v, c, f) => { f[1] += GLOW; });
}

// ------------------------------------------------------------------------------------------------ acessórios
/** O quepe do Capitão (cabeça): faixa escura, copa azul aberta em cima, cordão e emblema dourados, pala preta. */
function quepe(k) {
  const navy = '#2f4272', dark = '#1b2647', gold = '#f2c230', black = '#15171e';
  const prof = [[0.0378, 0.011], [0.0415, 0.016], [0.047, 0.025], [0.046, 0.031], [0.037, 0.0358], [0.019, 0.0378], [0, 0.0382]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const cap = fused([
    dye(new THREE.CylinderGeometry(0.0378, 0.0372, 0.012, 20, 1, true).translate(0, 0.006, 0), dark),
    dye(new THREE.LatheGeometry(prof, 20), navy),
    dye(new THREE.TorusGeometry(0.0384, 0.0017, 5, 20).rotateX(Math.PI / 2).translate(0, 0.0118, 0), gold, 0.2),
    dye(new THREE.CylinderGeometry(0.031, 0.031, 0.003, 14, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.12).rotateX(0.28).translate(0, 0.0015, 0.027), black),
    dye(new THREE.SphereGeometry(0.0075, 8, 6).scale(1, 1.15, 0.5).translate(0, 0.0215, 0.0448), gold, 0.3),
  ], k.mat, 'quepe');
  // assentado no alto da cabeça, caído para trás (a testa e os olhos ficam de fora)
  cap.geometry.rotateX(-0.2).translate(0, 0.0405, 0.007);
  k.head.add(cap);
}
/** O cachecol vermelho do Capitão (pescoço): a volta listrada, o nó e as duas pontas com a franja clara. */
function cachecol(k) {
  const red = C('#d9372f'), dark = C('#ad2620'), cream = C('#f4e6c8');
  const knot = new THREE.Vector3(-0.025, 0.03, 0.051);
  // cada ponta: uma tira de pano que cai do nó, afastando do peito, com a franja clara embaixo
  const end = (len, wide, fan, out) => {
    const g = dye(new THREE.BoxGeometry(wide, len, 0.0055, 1, 5, 1).translate(0, -len / 2, 0), (x, y) => (y < -len * 0.84 ? cream : y < -len * 0.7 ? dark : red));
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const t = -P.getY(i) / len;
      P.setXYZ(i, P.getX(i) * (1 + 0.25 * t), P.getY(i), P.getZ(i) + out * t * t);
    }
    g.computeVertexNormals();
    return g.rotateZ(fan).translate(knot.x, knot.y - 0.004, knot.z + 0.004);
  };
  const scarf = fused([
    dye(new THREE.TorusGeometry(0.0392, 0.0092, 8, 20), (x, y) => (Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI * 2) * 10 + 0.001) % 2 ? dark : red))
      .rotateX(Math.PI / 2).scale(1, 1.12, 1).rotateX(0.32).translate(0, 0.033, 0.017),
    dye(new THREE.SphereGeometry(0.0115, 8, 6), red).translate(knot.x, knot.y, knot.z),
    end(0.066, 0.019, -0.1, 0.026),
    end(0.05, 0.017, -0.62, 0.016),
  ], k.mat, 'cachecol');
  k.neck.add(scarf);
}
/** A touquinha de dormir do Soneca (cabeça): cone listrado com a ponta caída para o lado, barra felpuda e pompom. */
function touca(k) {
  const blue = C('#6fa6e6'), pale = C('#e8f0fb'), wool = C('#f6f3ec');
  const H = 0.086, seg = 10;
  const cone = dye(new THREE.CylinderGeometry(0.0045, 0.0352, H, 12, seg, true).translate(0, H / 2, 0),
    (x, y) => (Math.floor(Math.round(y / H * seg) / 2) % 2 ? pale : blue));
  const P = cone.attributes.position;
  const droop = (t) => [0.064 * t * t, -0.052 * t * t * t, -0.014 * t * t];
  for (let i = 0; i < P.count; i++) {
    const d = droop(P.getY(i) / H);
    P.setXYZ(i, P.getX(i) + d[0], P.getY(i) + d[1], P.getZ(i) + d[2]);
  }
  cone.computeVertexNormals();
  const tip = droop(1);
  const cap = fused([
    cone,
    dye(new THREE.TorusGeometry(0.0362, 0.0085, 6, 14), wool, 0.12).rotateX(Math.PI / 2).translate(0, 0.002, 0),
    dye(new THREE.SphereGeometry(0.0125, 8, 6), wool, 0.12).translate(tip[0], H + tip[1] - 0.004, tip[2]),
  ], k.mat, 'touca-de-dormir');
  cap.geometry.rotateZ(-0.14).rotateX(-0.2).translate(0.002, 0.0405, 0.007);
  k.head.add(cap);
}
/** As migalhas do Farelo: no bico (cabeça) e grudadas no peito (tronco, no ponto da casca mais perto do alvo). */
function migalhas(k) {
  const bread = C('#f1d38d'), crust = C('#c98f3e');
  const crumb = (x, y, z, r, i) => dye(new THREE.SphereGeometry(r, 5, 3).scale(1, 0.72, 1.25).rotateY(i * 1.9).rotateX(i * 0.7), i % 3 ? bread : crust, 0.14)
    .translate(x, y, z);
  const onBeak = [[0.0048, 0.0062, 0.066, 0.0033], [-0.0042, 0.0034, 0.0715, 0.0027], [0.0012, -0.0032, 0.0615, 0.0029], [-0.0062, 0.0072, 0.059, 0.0024]];
  k.head.add(fused(onBeak.map(([x, y, z, r], i) => crumb(x, y, z, r, i)), k.mat, 'migalhas-do-bico', false));
  const P = k.torso.geometry.attributes.position;
  const onBreast = [[0.024, 0.014, 0.0046], [-0.017, -0.004, 0.0052], [0.005, -0.022, 0.004], [-0.032, 0.02, 0.0036], [0.034, -0.02, 0.0042], [-0.006, 0.03, 0.0034]];
  const parts = onBreast.map(([x, y, r], n) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < P.count; i++) {
      if (P.getZ(i) < 0.03) continue;
      const d = Math.hypot(P.getX(i) - x, P.getY(i) - y);
      if (d < bd) { bd = d; best = i; }
    }
    return crumb(P.getX(best), P.getY(best), P.getZ(best) + r * 0.35, r, n + 4);
  });
  k.torso.add(fused(parts, k.mat, 'migalhas-do-peito', false));
}

// ------------------------------------------------------------------------------------------------ as patas na cenoura
/** As peças soltas da malha dos pés (perna, coxa, cada dedo e cada unha), pelas ligações dos triângulos. */
function feetPieces(geo) {
  const P = geo.attributes.position, I = geo.index, n = P.count;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let k = 0; k < I.count; k += 3) {
    const a = find(I.getX(k));
    parent[find(I.getX(k + 1))] = a;
    parent[find(I.getX(k + 2))] = a;
  }
  /** @type {Map<number, { ids: number[], x: number, y: number, z: number }>} */
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { ids: [], x: 0, y: 0, z: 0 });
    const g = groups.get(r);
    g.ids.push(i);
    g.x += P.getX(i); g.y += P.getY(i); g.z += P.getZ(i);
  }
  return [...groups.values()].map((g) => {
    const cx = g.x / g.ids.length, cy = g.y / g.ids.length, cz = g.z / g.ids.length;
    const sx = cx >= 0 ? 1 : -1;
    let kind = 'leg'; // a perna (com as tampas) fica no eixo dela; a coxa, acima dos dedos
    if (Math.hypot(cx - sx * ANKLE[0], cz) > 0.0015 && cy < -0.06) {
      const a = Math.atan2((cx - sx * ANKLE[0]) * sx, cz - ANKLE[2]);
      kind = Math.abs(a) > 1.9 ? 'hind' : a > 0.26 ? 'outer' : a < -0.26 ? 'inner' : 'mid';
    }
    return { ids: g.ids, sx, kind };
  });
}
/**
 * Um alvo de morph dos pés com os dedos FECHADOS na cenoura. `F` é a cenoura no espaço do nó `pes` (origem `o` e eixos
 * `x`, `y`, `z` unitários, em unidades do pombo); cada perna de `legs` diz onde o tornozelo pousa na casca (`z` em
 * metros ao longo da cenoura, `phi` em volta dela, a partir de +y), para onde o pé aponta (`gamma`: 0 = para a ponta,
 * ±90° = em volta) e o quanto cada dedo abre (`aim`). A planta do pé é enrolada na casca de verdade (o raio da cenoura
 * em cada ponto), então os dedos e as unhas encostam nela; a perna inclina do quadril até o tornozelo novo.
 */
function wrapFeet(geo, pieces, s, F, legs) {
  const P = geo.attributes.position;
  const out = new Float32Array(/** @type {Float32Array} */ (P.array));
  const A1 = new THREE.Vector3(), v = new THREE.Vector3();
  const onShell = (zc, phi, rad) => v.copy(F.o)
    .addScaledVector(F.y, Math.cos(phi) * rad).addScaledVector(F.x, Math.sin(phi) * rad).addScaledVector(F.z, zc / s);
  for (const leg of legs) {
    const ax = leg.sx * ANKLE[0], rho = carrotRadius(leg.z) / s + TOE_R;
    A1.copy(onShell(leg.z, leg.phi, rho));
    const cg = Math.cos(leg.gamma), sg = Math.sin(leg.gamma);
    for (const piece of pieces) {
      if (piece.sx !== leg.sx) continue;
      for (const i of piece.ids) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        if (piece.kind === 'leg') {
          const w = clamp((LEG_TOP - y) / (LEG_TOP - ANKLE[1]), 0, 1);
          v.set(x + w * (A1.x - ax), y + w * (A1.y - ANKLE[1]), z + w * (A1.z - ANKLE[2]));
        } else {
          const d = Math.hypot(x - ax, z - ANKLE[2]);
          const a = Math.atan2(x - ax, z - ANKLE[2]) + leg.aim[piece.kind] * leg.sx;
          const right = d * Math.sin(a), fwd = d * Math.cos(a);
          const zc = leg.z + (fwd * cg - right * sg) * s;
          onShell(zc, leg.phi + (fwd * sg + right * cg) / rho, carrotRadius(zc) / s + TOE_R + (y - ANKLE[1]));
        }
        out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
      }
    }
  }
  return out;
}
/**
 * As duas pegadas de um pombo de escala `s`, como alvos de morph da malha dos pés:
 *  - `garra` (em voo): as duas patas fecham em volta da cenoura pendurada embaixo delas, ao comprido, com a ponta para
 *    baixo e para trás;
 *  - `pisa` (pousado): a pata direita dá um passo à frente e fica em cima da cenoura deitada no apoio, atravessada.
 * Devolve, para cada uma, a cenoura no espaço do nó `pes` (`o`, `q`) e o ponto onde as patas seguram (`c`).
 */
function buildGrip(feetMesh, s) {
  const geo = feetMesh.geometry;
  const pieces = feetPieces(geo);
  const frame = (x, y, z) => ({
    x, y, z, o: new THREE.Vector3(), c: new THREE.Vector3(),
    q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)),
  });
  // em voo: o eixo da cenoura desce para trás (tau); os tornozelos fecham sobre os dois flancos de cima (phi0)
  const tau = 0.38, phi0 = 0.66, zg = -0.02;
  const G = frame(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, Math.cos(tau), -Math.sin(tau)), new THREE.Vector3(0, -Math.sin(tau), -Math.cos(tau)));
  G.c.set(0, ANKLE[1], ANKLE[2]).addScaledVector(G.y, -(carrotRadius(zg) / s + TOE_R) * Math.cos(phi0));
  G.o.copy(G.c).addScaledVector(G.z, -zg / s);
  const fly = { inner: 0.27, mid: 0.55, outer: 0.8, hind: -0.6 };
  const garra = wrapFeet(geo, pieces, s, G, [
    { sx: 1, z: zg, phi: -phi0, gamma: Math.PI, aim: fly },
    { sx: -1, z: zg, phi: phi0, gamma: Math.PI, aim: fly },
  ]);
  // pousado: a cenoura deitada à frente, a ponta para a direita e um pouco para trás (psi), encostada no apoio
  const psi = -0.25, zs = 0.03, fwd = 0.092, beta = CARROT_REST.beta;
  const dh = new THREE.Vector3(Math.cos(psi), 0, Math.sin(psi)), up = new THREE.Vector3(0, 1, 0);
  const R = frame(
    new THREE.Vector3(Math.sin(psi), 0, -Math.cos(psi)),
    dh.clone().multiplyScalar(Math.sin(beta)).addScaledVector(up, Math.cos(beta)),
    dh.clone().multiplyScalar(Math.cos(beta)).addScaledVector(up, -Math.sin(beta)),
  );
  R.c.set(0.03, -HIP_Y + CARROT_REST.height(zs) / s, fwd / s);
  R.o.copy(R.c).addScaledVector(R.z, -zs / s);
  const pisa = wrapFeet(geo, pieces, s, R, [
    { sx: 1, z: zs, phi: 0.18, gamma: psi - Math.PI / 2, aim: { inner: -0.08, mid: 0, outer: 0.08, hind: 0 } },
  ]);
  geo.morphAttributes.position = [
    Object.assign(new THREE.BufferAttribute(garra, 3), { name: 'garra' }),
    Object.assign(new THREE.BufferAttribute(pisa, 3), { name: 'pisa' }),
  ];
  geo.computeBoundingSphere(); // inclui os alvos: a pata à frente não some no recorte da câmera
  feetMesh.updateMorphTargets();
  return { fly: G, rest: R };
}

// ------------------------------------------------------------------------------------------------ um pombo do esquadrão
const STANCE = 0.2, NECK_UP = 0.016, HEAD_SCALE = 1.08;
const _v = new THREE.Vector3(), _hip = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

/**
 * Um pombo do esquadrão: o pombo do jogo, repintado e vestido, com o que as cenas pedem aplicado DEPOIS do update dele
 * (sem brigar com a animação: o que o pombo guarda de um quadro para o outro é devolvido antes do update seguinte).
 * `fat` engorda o tronco (x, y, z); `sleepy` deixa os olhos sempre meio fechados; `gear` veste os acessórios.
 */
function squadPigeon({ id, seed, scale, tint, fat = [1, 1, 1], gear = [], sleepy = 0, name = '' }) {
  const p = createPigeon({ seed, scale, tint });
  p.object.name = name || `pombo:${id}`;
  const mesh = (n) => /** @type {THREE.Mesh} */ (p.object.getObjectByName(n));
  const torso = mesh('tronco'), neck = mesh('pescoco'), head = mesh('cabeca'), tail = mesh('cauda');
  const wings = [mesh('asa-esquerda'), mesh('asa-direita')];
  const feet = p.object.getObjectByName('pes');
  const feetMesh = /** @type {THREE.Mesh} */ (feet.children[0]);
  const body = torso.parent, neckPivot = neck.parent;
  repaint({ torso, neck, head, wings, tail, feetMesh }, tint);
  head.scale.setScalar(HEAD_SCALE);
  for (const g of gear) g({ head, neck, torso, mat: torso.material });
  const grip = buildGrip(feetMesh, scale);

  const pose = { x: 0, y: 0, z: 0, yaw: 0, flying: false, asleep: false, flightProgress: null };
  const ph = seed * 1.37;
  const S = {
    salute: 0, measure: 0, shiver: 0, look: null, lookK: 0, lookYaw: 0, lookPitch: 0,
    carry: false, carryK: 0, hold: false, hang: 0, air: 0, sleep: 0, addPitch: 0, addRoll: 0,
    // o balanço da carga nas patas (pêndulo no quadril) e de onde ele tira a aceleração do pombo
    swX: 0, swZ: 0, wX: 0, wZ: 0, twist: 0, has: false, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
  };

  /** A carga atrasa: pêndulo amortecido puxado pela aceleração do pombo (frente, lado, sobe e desce) e pela curva. */
  function swing(dt) {
    const r = p.object, at = r.position;
    const jump = Math.hypot(at.x - S.px, at.y - S.py, at.z - S.pz);
    if (S.has && dt > 1e-4 && dt < 0.2 && jump < 0.9) {
      const f = 1 - Math.exp(-dt * 14);
      const nx = S.vx + ((at.x - S.px) / dt - S.vx) * f, ny = S.vy + ((at.y - S.py) / dt - S.vy) * f, nz = S.vz + ((at.z - S.pz) / dt - S.vz) * f;
      const ax = clamp((nx - S.vx) / dt, -14, 14), ay = clamp((ny - S.vy) / dt, -8, 10), az = clamp((nz - S.vz) / dt, -14, 14);
      S.vx = nx; S.vy = ny; S.vz = nz;
      const sy = Math.sin(r.rotation.y), cy = Math.cos(r.rotation.y);
      // para a frente (+z do pombo) e para o lado (+x); o ar segura a carga para trás, e subir pesa
      const aF = ax * sy + az * cy + 0.5 * (nx * sy + nz * cy) + 0.6 * ny, aS = ax * cy - az * sy;
      const g = 9.8 + ay, ell = 0.22, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        S.wX += ((-g * Math.sin(S.swX) + aF * Math.cos(S.swX)) / ell - 5.5 * S.wX) * h;
        S.wZ += ((-g * Math.sin(S.swZ) - aS * Math.cos(S.swZ)) / ell - 5.5 * S.wZ) * h;
        S.swX += S.wX * h;
        S.swZ += S.wZ * h;
        if (S.swX < -0.22 || S.swX > 0.55) { S.swX = clamp(S.swX, -0.22, 0.55); S.wX = 0; }
        if (Math.abs(S.swZ) > 0.42) { S.swZ = clamp(S.swZ, -0.42, 0.42); S.wZ = 0; }
      }
      const turn = Math.atan2(Math.sin(r.rotation.y - S.yaw), Math.cos(r.rotation.y - S.yaw)) / dt;
      S.twist += (clamp(-turn * 0.12, -0.4, 0.4) - S.twist) * (1 - Math.exp(-dt * 7));
    } else if (!S.has || jump >= 0.9) {
      S.vx = S.vy = S.vz = 0;
    }
    S.px = at.x; S.py = at.y; S.pz = at.z; S.yaw = r.rotation.y; S.has = true;
  }

  /** A cenoura nas patas agora: posição e rumo no mundo, misturando a pegada de voo e a de pousado. */
  function holdPose(pos, quat) {
    feet.updateWorldMatrix(true, false);
    feet.getWorldQuaternion(_q);
    _p1.copy(grip.fly.o).applyMatrix4(feet.matrixWorld);
    _p2.copy(grip.rest.o).applyMatrix4(feet.matrixWorld);
    _qa.copy(_q).multiply(grip.fly.q);
    _qb.copy(_q).multiply(grip.rest.q);
    pos.lerpVectors(_p2, _p1, S.air);
    quat.slerpQuaternions(_qb, _qa, S.air);
  }

  return {
    id,
    object: p.object,
    /** Como o setPose do pombo (aceita só parte dos campos). */
    setPose(q) {
      if (q.flying && !pose.flying) pose.flightProgress = null;
      Object.assign(pose, q);
      p.setPose(q);
    },
    peek: () => p.peek(),
    peck: () => p.peck(),
    /** 0..1: a asa direita sobe até a cabeça (continência). */
    salute(k) { S.salute = k; },
    /** 0..1: a asa direita se estica para a frente (medindo a cenoura). */
    measure(k) { S.measure = k; },
    /** 0..1: encharcado e com frio (tremidinho, penas eriçadas, mais redondo, a cabeça encolhida). */
    shiver(k) { S.shiver = clamp(k || 0, 0, 1); },
    /** A cabeça vira para um ponto do mundo { x, y, z } (até onde um pescoço de pombo vai); null volta ao normal. */
    lookAt(at) { S.look = at || null; },
    /** Com carga: voo pesado (nariz para cima, batida mais funda e mais rápida, sobe-e-desce, torto). */
    carry(on) { S.carry = !!on; },
    /** O ponto do mundo onde as patas seguram (em voo, entre as duas, embaixo; pousado, debaixo da pata da frente). */
    feetPoint() {
      feet.updateWorldMatrix(true, false);
      _p1.copy(grip.fly.c).applyMatrix4(feet.matrixWorld);
      _p2.copy(grip.rest.c).applyMatrix4(feet.matrixWorld).lerp(_p1, S.air);
      return { x: _p2.x, y: _p2.y, z: _p2.z };
    },
    setVisible(on) { p.object.visible = on; },
    // uso da cenoura (holdBy): fecha ou abre os dedos, e onde ela fica
    _grip(on) { S.hold = !!on; },
    _holdPose: holdPose,
    update(dt, t) {
      // devolve o que foi somado no quadro anterior (o pombo suaviza a inclinação do corpo de um quadro para o outro)
      body.rotation.x -= S.addPitch;
      body.rotation.z -= S.addRoll;
      S.carryK += ((S.carry ? 1 : 0) - S.carryK) * (1 - Math.exp(-dt * 6));
      const dtp = dt * (1 + 0.3 * S.carryK * (pose.flying ? 1 : 0)); // com carga, a batida é mais rápida
      p.update(dtp, t);

      S.air += ((pose.flying ? 1 : 0) - S.air) * (1 - Math.exp(-dtp * (pose.flying ? 18 : 11)));
      const sleepTo = pose.asleep && !pose.flying ? 1 : 0;
      S.sleep += (sleepTo - S.sleep) * (1 - Math.exp(-dtp * (sleepTo > S.sleep ? 3 : 7)));
      S.hang += ((S.hold ? 1 : 0) - S.hang) * (1 - Math.exp(-dt * (S.hold ? 16 : 9)));
      const air = S.air, awake = 1 - S.sleep, sh = S.shiver, heavy = S.carryK * air;
      const brake = pose.flying && pose.flightProgress !== null ? ss(pose.flightProgress, 0.72, 1) : 0;
      const tremor = sh > 0 ? (Math.sin(t * 43 + ph) * 0.6 + Math.sin(t * 71 + ph * 3) * 0.4) * (0.6 + 0.4 * Math.sin(t * 2.7 + ph)) : 0;

      // postura: pousado, o peito sobe (silhueta de pombo); com carga, voa de nariz para cima e torto
      S.addPitch = -STANCE * (1 - air) * (1 - 0.55 * S.sleep) - 0.42 * heavy * (1 - brake);
      S.addRoll = 0.1 * heavy * Math.sin(t * 2.9 + ph) + 0.03 * sh * tremor;
      body.rotation.x += S.addPitch;
      body.rotation.z += S.addRoll;
      body.position.x = 0.0022 * sh * tremor;
      if (heavy > 0.001) body.position.y += heavy * (2.2 * (body.position.y - 0.012 * air) + 0.016 * Math.sin(t * 3.7 + ph) - 0.01);

      // tronco: gordinho (Farelo) e eriçado no frio; pescoço esticado quando acordado, encolhido no frio
      const puff = 1 + 0.1 * sh;
      torso.scale.set(torso.scale.x * fat[0] * puff, torso.scale.y * fat[1] * (1 + 0.07 * sh), torso.scale.z * fat[2] * (1 + 0.04 * sh));
      neck.scale.x *= 1 + 0.16 * sh;
      neck.scale.z *= 1 + 0.16 * sh;
      neckPivot.position.y += NECK_UP * awake * (1 - 0.4 * air) - 0.014 * sh;
      neckPivot.position.z += 0.004 * awake;
      head.rotation.x += -S.addPitch * lerp(0.75, 0.9, air) + 0.14 * sh; // a cabeça continua no nível
      if (sleepy) for (let i = 0; i < 2; i++) head.morphTargetInfluences[i] = Math.max(head.morphTargetInfluences[i], sleepy);

      // asas: acompanham o tronco mais largo; com carga batem mais fundo; no frio, afastadas e tremendo
      for (let i = 0; i < 2; i++) {
        const w = wings[i], sx = i ? 1 : -1;
        w.position.x += sx * (TORSO_HALF * (fat[0] * puff - 1) * 0.8 + 0.004 * sh);
        w.rotation.z = sx * (w.rotation.z * sx * (1 + 0.16 * heavy) - 0.05 * heavy + (0.1 + 0.025 * tremor) * sh * (1 - air));
      }
      const wingR = wings[1];
      if (S.salute > 0 || S.measure > 0) {
        const s = S.salute, m = S.measure, k = 1 - Math.max(s, m);
        wingR.rotation.z = wingR.rotation.z * k + (1.55 * s + 1.05 * m);
        wingR.rotation.y = wingR.rotation.y * k + (-0.95 * s - 0.25 * m);
        wingR.rotation.x = 0.35 * s - 0.55 * m;
      }
      tail.morphTargetInfluences[0] = Math.max(tail.morphTargetInfluences[0], 0.35 * sh);

      // pés: o quadril fica em cima do apoio com a postura nova; presos à cenoura, descem e balançam com ela
      _hip.set(0, HIP_Y, HIP_Z).applyQuaternion(body.quaternion);
      body.position.z = (HIP_Z - _hip.z) * (1 - air);
      if (!pose.flying) {
        feet.quaternion.copy(body.quaternion).invert();
        feet.scale.y = lerp(feet.scale.y, 1, S.hang); // com a pata na cenoura, as pernas não encolhem
        body.position.y = HIP_Y * feet.scale.y - _hip.y;
        S.has = false;
        S.swX *= 0.8; S.swZ *= 0.8; S.wX = 0; S.wZ = 0; S.twist *= 0.8;
      } else if (S.hang > 0.001) {
        swing(dt);
        _q.copy(body.quaternion).invert().multiply(_q2.setFromEuler(_e.set(S.swX, S.twist, S.swZ)));
        feet.quaternion.slerp(_q, S.hang);
        feet.scale.y = lerp(feet.scale.y, 1, S.hang);
      } else {
        S.has = false;
      }
      feetMesh.morphTargetInfluences[0] = S.hang * air;
      feetMesh.morphTargetInfluences[1] = S.hang * (1 - air);

      // olhar: por cima do olhar à toa do pombo, com o pescoço fazendo uma parte e a cabeça o resto
      S.lookK += ((S.look ? 1 : 0) - S.lookK) * (1 - Math.exp(-dt * 9));
      if (S.lookK > 0.002) {
        if (S.look) {
          body.updateWorldMatrix(true, false);
          body.worldToLocal(_v.set(S.look.x, S.look.y, S.look.z));
          _v.x -= neckPivot.position.x; _v.y -= neckPivot.position.y + 0.076; _v.z -= neckPivot.position.z + 0.038;
          const f = 1 - Math.exp(-dt * 12);
          S.lookYaw += (clamp(Math.atan2(_v.x, _v.z), -1.75, 1.75) - S.lookYaw) * f;
          S.lookPitch += (clamp(-Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.7, 0.6) - S.lookPitch) * f;
        }
        const w = S.lookK * (1 - 0.85 * S.sleep);
        neckPivot.rotation.y = lerp(neckPivot.rotation.y, S.lookYaw * 0.4, w);
        neckPivot.rotation.x += S.lookPitch * 0.3 * w;
        head.rotation.y = lerp(head.rotation.y, S.lookYaw * 0.6, w);
        head.rotation.x += S.lookPitch * 0.7 * w;
        head.rotation.z *= 1 - w;
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------ a cenoura de borracha
/**
 * A cenoura de borracha (≈ 0,29 m com as folhas; 7,5 cm no ombro), ponta para +Z, folhas para −Z; a origem a 42% do
 * corpo. `holdBy(pombo | null)` prende nas patas de um pombo do esquadrão (o update da peça a posiciona a cada quadro,
 * depois dos pombos); solta, fica onde estava e quem chamou volta a posicioná-la pelo `object`.
 */
function rubberCarrot() {
  const g = new THREE.Group();
  g.name = 'cenoura-de-borracha';
  // o corpo: torno com mais pontos no ombro, na ponta e em cada gomo
  const rings = [0.2, 0.305, 0.42, 0.53, 0.645, 0.75, 0.85];
  const us = new Set();
  for (let i = 0; i <= 26; i++) us.add(+(i / 26).toFixed(4));
  for (let i = 1; i < 8; i++) us.add(+(0.13 * i / 8).toFixed(4));
  for (let i = 1; i < 6; i++) us.add(+(0.9 + 0.1 * i / 6).toFixed(4));
  for (const r of rings) for (const d of [-0.014, 0, 0.014]) us.add(+(r + d).toFixed(4));
  const prof = [new THREE.Vector2(0, 0)];
  for (const u of [...us].sort((a, b) => a - b)) prof.push(new THREE.Vector2(Math.max(0, carrotRadius(CARROT.z0 + u * CARROT.len)), u * CARROT.len));
  const bodyGeo = new THREE.LatheGeometry(prof, 24);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.translate(0, 0, CARROT.z0);
  // os gomos da borracha: vincos em arco (cada um pega um pedaço da volta), mais fundos e mais escuros
  const pos = bodyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const orange = C('#f77f14'), crease = C('#cf5a08'), crown = C('#e06a0c'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const u = (z - CARROT.z0) / CARROT.len, th = Math.atan2(y, x);
    let dip = 0;
    rings.forEach((r, k) => { dip = Math.max(dip, band(u, r, 0.016) * ss(Math.cos(th - k * 2.4), -0.55, 0.1)); });
    pos.setXYZ(i, x * (1 - 0.055 * dip), y * (1 - 0.055 * dip), z);
    c.copy(orange).lerp(crown, 1 - ss(u, 0, 0.07)).lerp(crease, 0.8 * dip);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const rubber = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.22, emissive: '#f26a0c', emissiveIntensity: 0.1,
  });
  const body = new THREE.Mesh(bodyGeo, rubber);
  body.name = 'cenoura-corpo';
  body.castShadow = true;
  g.add(body);
  // as folhas de borracha: um tufo de lâminas gordas saindo de um colarinho
  const leafA = C('#2f9440'), leafB = C('#63c24f');
  const blade = (az, tilt, len, wide) => {
    const b = new THREE.SphereGeometry(1, 8, 5).scale(wide, wide * 0.42, len / 2).translate(0, 0, -len / 2);
    const P = b.attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      c.copy(leafA).lerp(leafB, ss(-P.getZ(i) / len, 0.15, 0.95));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    b.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return b.rotateX(tilt).rotateZ(az).translate(0, 0, CARROT.z0 + 0.004);
  };
  const collar = new THREE.TorusGeometry(0.0105, 0.0052, 6, 12).translate(0, 0, CARROT.z0 - 0.001);
  const rgb = leafA.toArray();
  collar.setAttribute('color', new THREE.BufferAttribute(new Float32Array(collar.attributes.position.count * 3).map((_, i) => rgb[i % 3]), 3));
  const tuft = [collar, blade(0, 0, 0.052, 0.011)];
  for (let i = 0; i < 4; i++) tuft.push(blade(0.5 + i * Math.PI / 2, 0.42 + (i % 2) * 0.12, 0.046 - (i % 2) * 0.006, 0.0105));
  const leaves = new THREE.Mesh(mergeGeometries(tuft), new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: '#2f9440', emissiveIntensity: 0.08,
  }));
  for (const t of tuft) t.dispose();
  leaves.name = 'cenoura-folhas';
  leaves.castShadow = true;
  g.add(leaves);
  // o furinho do apito, no flanco perto do ombro (acompanha a casca e amassa com ela)
  const zh = -0.052, rh = carrotRadius(zh), slope = (carrotRadius(zh - 0.004) - carrotRadius(zh + 0.004)) / 0.008;
  const whistle = new THREE.Group();
  whistle.name = 'cenoura-apito';
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0052, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a1204', roughness: 0.6 }));
  hole.position.y = 0.0012;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0017, 5, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9620c', roughness: 0.35 }));
  rim.position.y = 0.0004;
  whistle.add(hole, rim);
  whistle.position.set(0, rh, zh);
  whistle.rotation.x = Math.atan(slope);
  body.add(whistle);
  g.userData.carryKind = 'carrot';

  const H = { by: null, fresh: false, blend: 1, from: new THREE.Vector3(), fromQ: new THREE.Quaternion(), to: new THREE.Vector3(), toQ: new THREE.Quaternion() };
  return {
    object: g,
    /** 0..1: amassada no "fiu". */
    squeeze(k) { body.scale.set(1 + 0.12 * k, 1 - 0.22 * k, 1); },
    setVisible(on) { g.visible = on; },
    /**
     * Prende a cenoura nas patas de um pombo do esquadrão (ou solta, com null). De perto, ela chega às patas num
     * instante (sem pulo); de longe (estado montado de uma vez), já aparece no lugar.
     */
    holdBy(pigeon) {
      const next = pigeon && pigeon._holdPose ? pigeon : null;
      if (next === H.by) return;
      if (H.by) H.by._grip(false);
      H.by = next;
      if (next) { next._grip(true); H.fresh = true; g.visible = true; }
    },
    /** Quem está segurando (ou null). */
    get heldBy() { return H.by; },
    _update(dt) {
      const by = H.by;
      if (!by || !by.object.visible) return;
      by._holdPose(H.to, H.toQ);
      if (H.fresh) {
        H.fresh = false;
        H.blend = g.position.distanceTo(H.to) < 0.45 ? 0 : 1;
        H.from.copy(g.position);
        H.fromQ.copy(g.quaternion);
      }
      if (H.blend < 1) {
        H.blend = Math.min(1, H.blend + dt / 0.14);
        const k = H.blend * H.blend * (3 - 2 * H.blend);
        g.position.lerpVectors(H.from, H.to, k);
        g.quaternion.slerpQuaternions(H.fromQ, H.toQ, k);
      } else {
        g.position.copy(H.to);
        g.quaternion.copy(H.toQ);
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------ os lugares dos três
/** O piso de dentro da guarita (leste.js: a laje de 5 cm). */
const BOOTH_FLOOR = 0.05;
/**
 * O Sr. Luiz na guarita (a origem dele: o chão entre os pés). Sentado de frente para o guichê (+Z), no meio da metade
 * que abre (a do leste, a do windowAnchor); a ponta das botinas embaixo do balcão de dentro (leste.js: o tampo vai da
 * parede do sul, por dentro, até 0,46 m para o norte, de 0,765 a 0,8 m do chão). Daqui ele também fica de pé sem as
 * coxas atravessarem o tampo (a barriga passa por cima dele). A cadeira fica em CHAIR_OFFSET, atrás dele.
 * @param {any} L
 */
export function srLuizSpot(L) {
  const B = L.BOOTH;
  return { x: (B.x0 + B.x1) / 2 + 0.36, y: BOOTH_FLOOR, z: B.z1 - 0.72, yaw: 0 };
}
/**
 * O Bichano no capô da caminhonete, perto da frente (de onde as dogs chegam) e do lado do depósito. O capô (garagem.js,
 * o miolo entre os para-lamas) sobe da frente para a cabine: y = 1,029 + 0,054 · (z − 0,42), com z a partir do
 * para-choque da frente. Ele olha para a entrada da garagem (o norte), um pouco para o oeste.
 * @param {any} L
 */
export function bichanoSpot(L) {
  const C = L.CAR;
  const zl = 0.66;
  return { x: (C.x0 + C.x1) / 2 + 0.25, y: 1.08 - 0.051 + (zl - 0.42) * 0.054 + 0.003, z: C.z0 + zl, yaw: Math.PI + 0.3, tilt: -Math.atan(0.054) };
}
/**
 * A pena deitada no parapeito de fora (de manhã): perto da ponta do leste, atravessada (o parapeito tem 20 cm).
 * @param {any} L
 */
export function featherSill(L) {
  const SO = L.SILL.out;
  return { x: SO.x + 0.25, y: SO.y + 0.0015, z: SO.z + 0.01, yaw: 1.35 };
}

/** A boia de patinho murcha (para a silhueta da Reconstrução): um anel amassado com a cabeça de patinho caída. */
function limpDuckFloat(material) {
  const g = new THREE.Group();
  g.name = 'boia-de-patinho';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 20), material);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 1, 0.45);
  ring.position.y = 0.025;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), material);
  head.position.set(0.17, 0.05, 0);
  head.scale.set(1, 0.7, 1);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), material);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.24, 0.045, 0);
  g.add(ring, head, beak);
  return g;
}

/**
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildAtores(root, L) {
  const group = new THREE.Group();
  group.name = 'recanto:atores';
  root.add(group);

  // ---------------------------------------------------------------- o Esquadrão Migalha
  // tons um pouco diferentes para reconhecer cada um: o Capitão azulado, o Farelo mais claro e quente, o Soneca escuro
  const FARELO = { seed: 3, scale: 1.58, tint: '#b9b5b0', fat: [1.17, 1.1, 1.08] };
  const squad = {
    cap: squadPigeon({ id: 'capitao', seed: 7, scale: 1.38, tint: '#a7afc0', gear: [quepe, cachecol] }),
    far: squadPigeon({ id: 'farelo', ...FARELO, gear: [migalhas] }),
    son: squadPigeon({ id: 'soneca', seed: 11, scale: 1.3, tint: '#969db3', gear: [touca], sleepy: 0.5 }),
  };
  for (const p of Object.values(squad)) {
    group.add(p.object);
    p.setPose({ x: 0, y: -50, z: 0, flying: false });
    p.object.visible = false;
  }

  // ---------------------------------------------------------------- a cenoura de borracha
  const carrot = rubberCarrot();
  group.add(carrot.object);
  carrot.object.visible = false;

  // ---------------------------------------------------------------- mãos e pés humanos (só nas cenas)
  const tutora = createTutoraArm();
  const porteiro = createPorteiro();
  tutora.object.visible = false;
  porteiro.object.visible = false;
  group.add(tutora.object, porteiro.object);

  // ---------------------------------------------------------------- o Sr. Luiz, dormindo na cadeira da guarita
  const LZ = srLuizSpot(L);
  const chair = createGuardChair();
  const srLuiz = Object.assign(createSrLuiz(), {
    chair,
    spot: LZ,
    /** De volta à guarita: sentado, dormindo, a cadeira no lugar. */
    reset() {
      const o = srLuiz.object;
      o.visible = true;
      o.position.set(LZ.x, LZ.y, LZ.z);
      o.rotation.set(0, LZ.yaw, 0);
      const s = Math.sin(LZ.yaw), c = Math.cos(LZ.yaw);
      chair.object.position.set(LZ.x + CHAIR_OFFSET.x * c + CHAIR_OFFSET.z * s, LZ.y, LZ.z - CHAIR_OFFSET.x * s + CHAIR_OFFSET.z * c);
      chair.object.rotation.set(0, LZ.yaw, 0);
      chair.object.visible = true;
      chair.setSwivel(0);
      srLuiz.lookAt(null);
      srLuiz.say(false);
      srLuiz.reach('L', null);
      srLuiz.reach('R', null);
      srLuiz.setPose('dorme', undefined, { instant: true });
    },
  });
  srLuiz.reset();
  group.add(srLuiz.object, chair.object);

  // ---------------------------------------------------------------- a pena de pombo (só nas cenas)
  const feather = Object.assign(createFeather(), {
    sill: featherSill(L),
    /** Deitada no parapeito de fora, como ela fica de manhã. */
    placeOnSill() {
      const s = feather.sill;
      feather.object.visible = true;
      feather.object.position.set(s.x, s.y, s.z);
      feather.object.rotation.set(0, s.yaw, 0);
    },
  });
  feather.object.visible = false;
  group.add(feather.object);

  // ---------------------------------------------------------------- o Bichano, no capô da caminhonete
  const BS = bichanoSpot(L);
  const bichano = Object.assign(createBichano(), {
    spot: BS,
    /** De volta ao capô, dormindo. */
    reset() {
      const o = bichano.object;
      o.visible = true;
      o.position.set(BS.x, BS.y, BS.z);
      o.rotation.set(BS.tilt, BS.yaw, 0); // XYZ: o rumo e depois a inclinação do capô (em torno do x do mundo)
      bichano.lookAt(null);
      bichano.say(false);
      bichano.setPose('dorme', undefined, { instant: true });
    },
  });
  bichano.reset();
  group.add(bichano.object);

  // ---------------------------------------------------------------- as silhuetas da Reconstrução da piscina
  // o pombo fantasma é o Farelo (mesma escala, mesma barriga, mesma postura), só no material das silhuetas
  const gMat = ghostMaterial('#cfe6ff', 0.5);
  const ghostPigeon = squadPigeon({ id: 'silhueta', ...FARELO, seed: 21, name: 'silhueta:pombo' });
  ghostify(ghostPigeon.object, gMat);
  const ghostFloat = ghostify(limpDuckFloat(gMat), gMat);
  ghostFloat.name = 'silhueta:boia';
  const ghosts = { pigeon: ghostPigeon, float: ghostFloat, material: gMat };

  // ---------------------------------------------------------------- a garoa (só na abertura)
  const RAIN_N = 260;
  const rainBox = { x0: L.HOUSE.x0 - 1, x1: L.HOUSE.x1 + 2, z0: L.HOUSE.z0 - 4.5, z1: L.HOUSE.z0 + 1.2, y1: 5.5 };
  const streak = new THREE.PlaneGeometry(0.012, 0.32);
  const rainMat = new THREE.MeshBasicMaterial({ color: '#b8cfee', transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const rain = new THREE.InstancedMesh(streak, rainMat, RAIN_N);
  rain.name = 'recanto:garoa';
  rain.frustumCulled = false;
  rain.visible = false;
  const drops = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.12));
  const v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < RAIN_N; i++) {
    drops.push({ x: rainBox.x0 + rnd() * (rainBox.x1 - rainBox.x0), y: rnd() * rainBox.y1, z: rainBox.z0 + rnd() * (rainBox.z1 - rainBox.z0), s: 3.2 + rnd() * 1.4 });
    m4.compose(v.set(drops[i].x, drops[i].y, drops[i].z), q, one);
    rain.setMatrixAt(i, m4);
  }
  group.add(rain);
  const R = { k: 0 };
  const rainApi = {
    object: rain,
    /** 0..1: o quanto chove (opacidade); 0 esconde. */
    setOn(k) {
      R.k = k;
      rain.visible = k > 0.001;
      rainMat.opacity = 0.42 * k;
    },
    update(dt) {
      if (!rain.visible) return;
      for (let i = 0; i < RAIN_N; i++) {
        const d = drops[i];
        d.y -= d.s * dt;
        d.x -= 0.35 * dt;
        if (d.y < 0) { d.y += rainBox.y1; d.x = rainBox.x0 + rnd() * (rainBox.x1 - rainBox.x0); }
        m4.compose(v.set(d.x, d.y, d.z), q, one);
        rain.setMatrixAt(i, m4);
      }
      rain.instanceMatrix.needsUpdate = true;
    },
  };

  // ---------------------------------------------------------------- as meias perdidas
  const socks = L.SOCKS.map((s, i) => {
    const sock = createSock(0.24);
    sock.name = `meia-${s.id}`;
    const holder = new THREE.Group();
    holder.add(sock);
    group.add(holder);
    const st = { got: false, anim: -1, phase: i * 1.7 };
    const home = new THREE.Vector3(s.x, s.y + 0.16, s.z);
    const reset = () => {
      st.got = false; st.anim = -1;
      holder.visible = true;
      holder.position.copy(home);
      holder.scale.setScalar(1);
      holder.rotation.set(0, i * 1.3, s.id === 'antena' ? 0 : 0.5);
    };
    reset();
    return {
      id: s.id,
      object: holder,
      collect() { if (!st.got) { st.got = true; st.anim = 0; } },
      reset,
      get collected() { return st.got; },
      _update(dt, t) {
        if (st.anim >= 0) {
          st.anim += dt;
          const k = Math.min(1, st.anim / 0.5);
          holder.position.y = home.y + k * 0.35;
          holder.scale.setScalar(Math.max(0.001, 1 - k));
          holder.rotation.y += dt * 10;
          if (k >= 1) { holder.visible = false; st.anim = -1; }
          return;
        }
        if (st.got) return;
        // a da antena balança no vento; as outras respiram devagar
        if (s.id === 'antena') holder.rotation.z = Math.sin(t * 2.1 + st.phase) * 0.22;
        else holder.position.y = home.y + Math.sin(t * 1.6 + st.phase) * 0.012;
      },
    };
  });

  return {
    props: {
      squad, carrot, rain: rainApi, socks,
      humans: { tutora, porteiro },
      srLuiz, feather, bichano,
      ghosts,
    },
    seeThrough: [],
    signs: [],
    update(dt, t) {
      for (const p of Object.values(squad)) if (p.object.visible) p.update(dt, t);
      if (srLuiz.object.visible) srLuiz.update(dt, t);
      if (bichano.object.visible) bichano.update(dt, t);
      carrot._update(dt); // depois dos pombos: presa, ela sai das patas de quem segura
      rainApi.update(dt);
      for (const s of socks) s._update(dt, t);
    },
    reset() {
      carrot.holdBy(null);
      for (const p of Object.values(squad)) {
        p.object.visible = false;
        p.salute(0); p.measure(0); p.shiver(0); p.lookAt(null); p.carry(false);
      }
      carrot.object.visible = false;
      carrot.squeeze(0);
      tutora.object.visible = false;
      porteiro.object.visible = false;
      srLuiz.reset();
      bichano.reset();
      feather.object.visible = false;
      feather.setWet(0.45);
      rainApi.setOn(0);
      for (const s of socks) s.reset();
    },
    // as mãos, a botina, o Sr. Luiz, a cadeira, a pena e o Bichano liberam o que é deles; o resto fica na árvore para o
    // escopo de recursos da área liberar
    dispose() {
      tutora.dispose();
      porteiro.dispose();
      srLuiz.dispose();
      chair.dispose();
      feather.dispose();
      bichano.dispose();
    },
  };
}
