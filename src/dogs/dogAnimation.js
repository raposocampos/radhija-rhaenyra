// Animação procedural da dog, resolvida a cada quadro: trote/passo/galope com pés plantados (IK),
// todas as ações do jogo (sentar, empurrar, forçar, puxar a corda, comemorar, farejar, arrancada,
// girar o registro, chacoalhar, susto, pulo, impulso na parede, superbafo: mirar/soprar/orgulhosa, "eca!",
// Lambe-Lambe: lamber e ser lambida, descer o escorregador de barriga), olhar, boca, língua, orelhas com mola,
// cauda, piscadas, vento no pelo, inclinação numa rampa, sombra de contato e âncora do marcador.
// Entrada: update(dt, { speed, turn, action, lookAt, carrying, jump (altura do pulo), airK (0..1 no ar; −1 no chão),
//   lickPhase (0..1 da lambida, contato em 0,5; −1 sem), lickSide (±1), lickSolo, lickY (altura do ponto lambido, m;
//   −1 sem), slope (rad, + = focinho para cima),
//   wallK (0..1 do impulso na parede; −1 sem), wallGap (m do centro à parede), wallTop/wallOut (altura e saliência do
//   botão, m), wallPaws/wallSide (altura e afastamento das patinhas dianteiras pintadas, m), wallLat (quanto ela está
//   à esquerda do botão, m), poopK (0..1 da sequência do cocô; −1 sem), poopPre (0..1 da voltinha antes dela; −1 sem),
//   party (comemoração do segredo: { glee, bow, hop (m), air (0..1 no ar; −1 no chão), jump, brace, zoom }; null sem),
//   crouch (0..1: agachadinho de preparo antes de um pulinho roteirizado),
//   cheer (s desde que a irmã viu a comemoração; −1 sem), extra ({ kind, k (0..1), t (s) }: animação do cenário —
//   'drink' | 'eat' | 'dig' | 'sneeze' | 'nudge' | 'roll'; null sem), shoveK (0..1 de pé no empurrão; 0 sem),
//   shoveCycle (0..1 do empurrão atual; −1 sem), shoveN (empurrões dados), shoveGap/shoveY/shoveOver (distância do
//   centro à superfície, altura das patas e quanto além da face elas apoiam, m) }). Os extras ficam em
//   src/game/extras.js; a pose de pé do empurrão,
//   em src/dogs/shovePose.js (o roteiro é do controlador).
import * as THREE from 'three';
import { shoveStand, shoveBeat, shoveEnv } from './shovePose.js';

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);
const SIT_PITCH = 0.62; // inclinação da coluna sentada (rad)
const SIT_HIPS = 0.0; // flexão extra da garupa sentada

/**
 * Curva suave por quadros-chave [[p, valor], ...] (p crescente): cúbica com tangentes de Fritsch–Carlson
 * (não passa do alvo entre dois quadros e não para em cada um, como faria uma rampa suave por trecho).
 * @param {number[][]} keys @param {number} p
 */
export function keyed(keys, p) {
  const n = keys.length;
  if (p <= keys[0][0]) return keys[0][1];
  if (p >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 1;
  while (keys[i][0] < p) i++;
  const slope = (a, b) => (keys[b][1] - keys[a][1]) / (keys[b][0] - keys[a][0]);
  const tan = (k) => {
    if (k === 0 || k === n - 1) return 0;
    const s0 = slope(k - 1, k);
    const s1 = slope(k, k + 1);
    return s0 * s1 <= 0 ? 0 : (2 * s0 * s1) / (s0 + s1);
  };
  const [x0, y0] = keys[i - 1];
  const [x1, y1] = keys[i];
  const h = x1 - x0;
  const u = (p - x0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * tan(i - 1) * h + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * tan(i) * h;
}

// Impulso na parede (p = 0..1 do impulso; o toque no alto é em 0,52, como em dogController.js):
// agacha, salta ficando de pé contra a parede, as traseiras pegam impulso nas patinhas marcadas, uma dianteira
// aperta o botão no alto e ela desce de volta, de frente para a parede. O corpo gira em torno do quadril.
/** Corpo de pé (rad, focinho para cima): levanta antes de chegar perto, para a cabeça não bater na parede. */
const WALL_REAR = [[0, 0], [0.12, 0.08], [0.22, 0.55], [0.3, 1.0], [0.4, 1.28], [0.52, 1.36], [0.62, 1.26], [0.72, 0.88], [0.82, 0.45], [0.92, 0.08], [1, 0]];
/** Subida do quadril, em frações do pico (o pico depende da altura do botão). */
const WALL_LIFT = [[0, 0], [0.14, 0], [0.3, 0.3], [0.4, 0.62], [0.52, 1], [0.62, 0.9], [0.8, 0.38], [0.94, 0], [1, 0]];
/** Agachadinho antes do salto (frações de 3 cm na escala da dog). */
const WALL_CROUCH = [[0, 0], [0.12, 1], [0.26, 0]];
/** Distância do quadril à parede (m): longe enquanto levanta, encostada no alto, se afastando na volta. */
const WALL_DIST = [[0, 0.6], [0.2, 0.5], [0.3, 0.36], [0.4, 0.22], [0.52, 0.2], [0.62, 0.22], [0.72, 0.4], [0.82, 0.53], [1, 0.62]];

// Extras (src/game/extras.js). O cocô (p = 0..1 da agachada) como um cachorro de verdade: dianteiras retas e um pouco
// à frente, costas bem curvadas para cima (corcunda), garupa a meia altura, longe do chão (baixa demais parece xixi),
// traseiras dobradas com as patas lá na frente, debaixo da barriga, e o rabo esticado para fora. Faz força em três empurrões (tremidinha, olhos apertados); o cocô vai
// saindo a partir de POOP_DROP; levanta aliviada ("aaah", olhos fechados) e cava com as traseiras, olhando para trás.
// Antes (poopPre) ela anda a voltinha farejando: passo de caminhada, corpo curvado para dentro, a cabeça baixa
// varrendo o chão e o rabo abanando; na curva os apoios giram com o corpo (as patas não patinam). Depois (party) vêm
// a alegria, a reverência de brincadeira, os pulinhos e o freio dos zoomies; a irmã (cheer) se espanta e se alegra.
/** Agachada (0..1). */
const POOP_SQUAT = [[0, 0], [0.1, 1], [0.55, 1], [0.63, 0], [1, 0]];
/** Força: tremidinha e cara de concentração. */
const POOP_STRAIN = [[0, 0], [0.13, 0], [0.19, 1], [0.48, 1], [0.54, 0], [1, 0]];
/** Alívio: olhos fechados e boquinha aberta. */
const POOP_RELIEF = [[0, 0], [0.52, 0], [0.57, 1], [0.66, 1], [0.72, 0.35], [0.94, 0.35], [1, 0]];
/** Cavando com as traseiras. */
const POOP_SCRATCH = [[0, 0], [0.69, 0], [0.73, 1], [0.93, 1], [0.97, 0], [1, 0]];
/** Momento em que o cocô aparece e as patadas de cavar (o jogo solta a terrinha em cada uma). */
export const POOP_DROP = 0.3;
export const POOP_KICKS = Object.freeze({ from: 0.73, to: 0.93, n: 5 });
/** A irmã vendo a comemoração (s): olhos arregalados e orelhas em pé ("uau!"), depois alegria. */
const CHEER_WOW = [[0, 0], [0.07, 1], [0.5, 1], [0.78, 0]];
/** Patada de cavar: puxa a pata para trás rápido e devolve. */
const kickShape = (u) => sstep(0, 0.28, u) * (1 - sstep(0.42, 0.95, u));
/** Espirro (p da animação 'sneeze'): fareja, inclina a cabeça para trás, "atchim!" para baixo e sacode. */
const SNEEZE_PITCH = [[0, 0], [0.52, 0], [0.6, -0.42], [0.635, 0.6], [0.7, 0.12], [0.78, 0], [1, 0]];
const SNEEZE_OPEN = [[0, 0], [0.55, 0], [0.6, 0.45], [0.63, 1], [0.68, 0.2], [0.75, 0], [1, 0]];
export const SNEEZE_AT = 0.63;
/** Focinhada (p da animação 'nudge'). */
const NUDGE_LUNGE = [[0, 0], [0.32, 0], [0.42, 1], [0.52, 0], [1, 0]];
export const NUDGE_AT = 0.42;
/**
 * Rolar de costas (p da animação 'roll'): deita (as patas dobram e o corpo desce até o chão), tomba de lado, vira de
 * costas e se esfrega balançando de um lado para o outro com as patinhas para o ar, volta de lado, fica deitada de
 * bruços e levanta. ROLL_ANGLE é o giro em torno do comprimento do corpo (rad); a altura vem do contato com o chão
 * (lowestY, nas formas do modelo com a pose do quadro): nada passa do chão em nenhum ângulo.
 */
const ROLL_ANGLE = [[0, 0], [0.14, 0], [0.22, 0.55], [0.3, 1.55], [0.4, 2.75], [0.66, 2.75], [0.74, 1.6], [0.82, 0.45], [0.88, 0], [1, 0]];
/** Deitada (0..1): as patas dobram e o corpo encosta no chão. */
const ROLL_DOWN = [[0, 0], [0.03, 0], [0.15, 1], [0.86, 1], [0.97, 0], [1, 0]];
/** Esfregando as costas (0..1): balança de um lado para o outro e serpenteia a coluna. */
const ROLL_RUB = [[0, 0], [0.38, 0], [0.45, 1], [0.62, 1], [0.69, 0], [1, 0]];

/**
 * Partes do corpo como elipsoides presos aos ossos, tirados do desenho do modelo (dogModel.js) com metade do pelo e a
 * folga da união suave (até k/4 além das formas, na costura): { i (osso), c (centro no osso), r [x, y, z], ax (eixos
 * no osso) | null }.
 */
function bodyContacts(design, fur, BI, rest) {
  const out = [];
  if (!design) return out;
  let pad = 0.004;
  const add = (bone, c, r, ax = null) => {
    const i = BI[bone];
    if (i === undefined) return;
    const R = rest[i];
    out.push({ i, c: new THREE.Vector3(c[0] - R.x, c[1] - R.y, c[2] - R.z), r: r.map((v) => v + pad), ax });
  };
  for (const g of [...(design.bodyGroups || []), ...(design.earGroups || [])]) {
    pad = 0.004 + Math.max(g.k || 0, g.join || 0) * 0.25;
    for (const p of g.prims) {
      const f = p.fur ? (fur?.[p.fur] || 0) * 0.5 : 0;
      if (p.t === 0) add(p.bone, p.c, [p.r + f, p.r + f, p.r + f]);
      else if (p.t === 1) add(p.bone, p.c, [p.r[0] + f, p.r[1] + f, p.r[2] + f], p.m ? [p.m.slice(0, 3), p.m.slice(3, 6), p.m.slice(6, 9)] : null);
      else if (p.t === 2) {
        // cone arredondado: o casco convexo das duas esferas das pontas (achatado em x por sx)
        const k = 1 / (p.sx || 1);
        add(p.bone, p.a, [p.ra * k + f, p.ra + f, p.ra + f]);
        add(p.bone, p.b, [p.rb * k + f, p.rb + f, p.rb + f]);
      }
    }
  }
  pad = 0.004;
  if (design.face?.nose) add('head', design.face.nose, [design.face.noseR, design.face.noseR, design.face.noseR]);
  return out;
}
/** Cavando com as patas da frente: patadas por segundo. */
export const DIG_RATE = 3.2;

/** Estado da animação (aleatório no começo para as duas dogs não andarem em sincronia). */
function createAnimState() {
  return {
    t: Math.random() * 10,
    speed: 0,
    move: 0,
    phase: Math.random(),
    idle: 0,
    lean: 0,
    turnS: 0,
    w: { sit: 0, push: 0, strain: 0, tug: 0, celebrate: 0, sniff: 0, dash: 0, carry: 0, bow: 0, shake: 0, startled: 0, turn: 0, jump: 0, aim: 0, blow: 0, proud: 0, yuck: 0, lick: 0, licked: 0, slide: 0, pre: 0 },
    slope: 0,
    mud: 0, // lama (dog.setMud): orelhas e cauda mais caídas
    shakeT: 9,
    startT: 9,
    wet: 0,
    lookYaw: 0,
    lookPitch: 0,
    glanceT: 2,
    glanceYaw: 0,
    glancePitch: 0,
    blinkT: 1.5 + Math.random() * 2,
    blink: 0,
    bark: -1,
    celT: 0,
    hop: 0,
    spin: 0,
    wagPhase: 0,
    wagAmp: 0.25,
    wagFreq: 2,
    tailRaise: 0,
    ears: [
      { p: 0, pv: 0, o: 0.08, ov: 0 },
      { p: 0, pv: 0, o: 0.08, ov: 0 },
    ],
    headWorld: null,
    headVel: new THREE.Vector3(),
    headAcc: new THREE.Vector3(),
    mouthOpen: 0,
    prevAction: 'none',
    prevAir: false,
    prevWall: false,
    landT: 9, // tempo desde o último pouso (amortece o "agachadinho")
    wallTheta: 0, // corpo de pé no impulso na parede (rad)
    shoveTheta: 0, // corpo de pé no empurrão (rad)
    sb: { cock: 0, jolt: 0, press: 0, growl: 0 }, // ciclo do empurrão, suavizado
  };
}

/**
 * ctx: { object, inner, cfg (stats da dog no layout), s (escala), rig (dogRig.js), face (dogFace.js),
 *        carry (carryPose.js), furMat, shadow, shadowBase, markerAnchor, onFootstep(i) }
 * → { st (estado), update(dt, anim) }
 */
export function createDogAnimation(ctx) {
  const { object, inner, cfg, s, rig, face, carry, furMat, shadow, shadowBase, markerAnchor, onFootstep } = ctx;
  const { bones, BI, nB, rest, restOff, Lq, Wq, Wp, posOff, fk, setWorld, basisQuat, solve2 } = rig;
  const contacts = bodyContacts(ctx.design, ctx.fur, BI, rest);
  const _bm = bones.map(() => new THREE.Matrix4());
  /** O ponto mais baixo do corpo (y no referencial do objeto) com a pose deste quadro (rolar). */
  function lowestY() {
    inner.updateMatrix();
    for (let i = 0; i < nB; i++) {
      bones[i].updateMatrix();
      const p = rig.parentIdx[i];
      _bm[i].multiplyMatrices(p < 0 ? inner.matrix : _bm[p], bones[i].matrix);
    }
    let low = Infinity;
    for (const k of contacts) {
      const e = _bm[k.i].elements;
      const y = e[1] * k.c.x + e[5] * k.c.y + e[9] * k.c.z + e[13];
      let h2 = 0;
      for (let a = 0; a < 3; a++) {
        const v = k.ax ? k.ax[a] : null;
        const wy = v ? e[1] * v[0] + e[5] * v[1] + e[9] * v[2] : e[1 + 4 * a];
        h2 += (k.r[a] * wy) ** 2;
      }
      low = Math.min(low, y - Math.sqrt(h2));
    }
    return low;
  }
  const LEGS = rig.legs;
  const { eyes, lip, tongue, mouthW, lickTongue } = face;
  const st = createAnimState();

  // temporários
  const v3 = () => new THREE.Vector3();
  const q4 = () => new THREE.Quaternion();
  const _q = q4(), _q2 = q4(), _q3 = q4(), _qi = q4();
  const _e = new THREE.Euler();
  const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
  const _v = v3(), _v2 = v3(), _v3 = v3(), _T = v3(), _K = v3(), _H = v3(), _pole = v3(), _n = v3(), _d = v3();
  const _rootPos = v3();
  const _X = new THREE.Vector3(1, 0, 0);
  const qE = (out, x, y, z) => out.setFromEuler(_e.set(x, y, z, 'YXZ'));

  // Impulso na parede: pontos no referencial do objeto (x lateral, y altura, z = rumo à parede, que fica em
  // z = wallGap) → referencial da dog (inner, girado pela pose de pé). As patas encostam exatamente na parede.
  const _wallV = new THREE.Vector3();
  const wallCtx = { p: 0, gap: 0, top: 1.1, out: 0.05, paws: 1.03, side: 0.165, lat: 0.14 };
  function toInner(out, x, y, z) {
    const a = st.slope + st.wallTheta + st.shoveTheta; // inner.rotation.x = −a → volta com Rx(+a)
    const c = Math.cos(a), sn = Math.sin(a);
    const py = y - inner.position.y, pz = z - inner.position.z;
    return out.set(x - inner.position.x, py * c - pz * sn, py * sn + pz * c);
  }
  /** Distância (z do objeto) de um ponto do referencial da dog: o caminho inverso de toInner. */
  function objZ(T) {
    const a = st.slope + st.wallTheta + st.shoveTheta;
    return inner.position.z - T.y * Math.sin(a) + T.z * Math.cos(a);
  }
  /** Nenhum alvo de pata passa da parede (a almofadinha fica `margin` além do alvo). */
  function keepOffWall(T, margin) {
    const z = objZ(T);
    const lim = wallCtx.gap - margin;
    if (z <= lim) return;
    const a = st.slope + st.wallTheta + st.shoveTheta;
    const c = Math.cos(a), sn = Math.sin(a);
    const y = inner.position.y + T.y * c + T.z * sn;
    toInner(T, inner.position.x + T.x, y, lim);
  }
  /**
   * Alvo da pata li no impulso: as dianteiras se esticam no salto e apoiam na parede (a direita aperta o botão),
   * as traseiras pegam impulso nas patinhas marcadas e depois se recolhem; na volta, as dianteiras se preparam.
   */
  function wallLegTarget(li, leg, T) {
    const { p, gap, top, out, paws, side, lat } = wallCtx;
    // O alvo da IK é o punho (dianteiras) ou o calcanhar da pata (traseiras); de pé contra a parede, a almofadinha
    // fica ~3 cm além dele, rumo à parede, e 2–3 cm acima: os alvos recuam para a pata encostar sem atravessar.
    const face = gap - 0.03;
    if (leg.front) {
      // no salto, as dianteiras se esticam para cima (e um pouco para a frente), rumo à parede
      const reach = sstep(0.1, 0.26, p) * (1 - sstep(0.36, 0.44, p));
      T.z += reach * 0.06 * s;
      T.y += reach * 0.1 * s;
      const brace = sstep(0.62, 0.76, p) * (1 - sstep(0.9, 1, p));
      T.z += brace * 0.045 * s;
      const on = sstep(0.3, 0.38, p) * (1 - sstep(0.62, 0.72, p));
      if (on <= 0) {
        keepOffWall(T, 0.03);
        return;
      }
      // a esquerda apoia na patinha pintada; a direita apoia ao lado do corpo, sobe até o botão (ou a bolinha da
      // alavanca, que fica lat m à direita dela) e volta
      if (li === 0) toInner(_wallV, side - lat, paws - 0.022, face);
      else {
        const boop = sstep(0.42, 0.5, p) * (1 - sstep(0.55, 0.62, p));
        toInner(_wallV, lerp(-0.1, -lat - 0.01, boop), lerp(paws - 0.05, top, boop) - 0.025, lerp(face, gap - out - 0.02, boop));
      }
      T.lerp(_wallV, on);
      keepOffWall(T, 0.03);
    } else {
      const tuckK = sstep(0.5, 0.58, p) * (1 - sstep(0.7, 0.86, p));
      T.y += tuckK * 0.03 * s;
      T.z += tuckK * 0.02 * s;
      const on = sstep(0.33, 0.39, p) * (1 - sstep(0.5, 0.57, p));
      if (on > 0) {
        toInner(_wallV, leg.side * 0.055, 0.345, gap - 0.022);
        T.lerp(_wallV, on);
      }
      keepOffWall(T, 0.022);
    }
  }

  // Empurrão em pé (shovePose.js): a pose do quadro (ângulo, quadril, alvo das patas da frente) e o ciclo suavizado.
  const shoveCtx = { sk: 0, theta: 0, hy: 0, hz: 0, wy: 0, wz: 0, top: false, round: false, cock: 0, press: 0 };
  /** Altura de um ponto do referencial da dog (inner) no referencial do objeto. */
  function objY(T) {
    const a = st.slope + st.wallTheta + st.shoveTheta;
    return inner.position.y + T.y * Math.cos(a) + T.z * Math.sin(a);
  }
  /**
   * Alvo da pata li no empurrão em pé: as dianteiras apoiadas na superfície (num tronco redondo, mais juntinhas); a cada
   * empurrão elas armam (um tiquinho para trás e para cima, cotovelos dobrando) e batem esticando, junto com o tranco dos
   * ombros. As traseiras ficam firmes no chão debaixo do quadril, um pouco abertas. Entra e sai com o quanto ela está de
   * pé (sk). Nada abaixo do chão.
   */
  function shoveLegTarget(li, leg, T) {
    const C = shoveCtx;
    if (leg.front) {
      const lat = leg.side * (C.round ? 0.036 : 0.052) * s;
      const late = li === 1 ? 0.8 : 1; // a direita arma um tiquinho menos (as duas batem quase juntas)
      toInner(_wallV, lat, C.wy + C.cock * late * 0.025 * s, C.wz - C.cock * late * 0.045 * s + C.press * 0.01 * s);
      T.lerp(_wallV, sstep(0.3, 0.92, C.sk));
    } else {
      toInner(_wallV, leg.foot0.x + leg.side * 0.014 * s, leg.foot0.y, C.hz + 0.03 * s);
      T.lerp(_wallV, C.sk);
    }
    const floor = leg.foot0.y * 0.9;
    if (objY(T) < floor) {
      // abaixo do chão: sobe o alvo (no referencial do objeto) até a altura do apoio
      const a = st.slope + st.wallTheta + st.shoveTheta;
      const zo = inner.position.z - T.y * Math.sin(a) + T.z * Math.cos(a);
      toInner(T, inner.position.x + T.x, floor, zo);
    }
  }

  function update(dt, anim) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    const A = anim || {};
    carry.sync();
    const action = A.action || 'none';
    const speedIn = Math.max(0, A.speed || 0);
    const turn = A.turn || 0;
    st.t += dt;
    const t = st.t;
    const damp = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    const w = st.w;

    // ---------------- blends
    st.speed = damp(st.speed, speedIn, 14);
    const v = st.speed;
    st.move = damp(st.move, sstep(0.03, 0.3, v), 9);
    st.turnS = damp(st.turnS, turn, 8);
    if (action !== st.prevAction) {
      if (action === 'celebrate') st.celT = 0;
      if (action === 'shake') st.shakeT = 0;
      if (action === 'startled') st.startT = 0;
      st.prevAction = action;
    }
    if (v < 0.05 && action === 'none' && Math.abs(turn) < 0.4 && st.bark < 0) st.idle += dt;
    else st.idle = 0;
    const wantSit = action === 'sit' || (action === 'none' && st.idle > 5);
    w.sit = damp(w.sit, wantSit ? 1 : 0, wantSit ? 3.2 : 7);
    for (const k of ['push', 'strain', 'tug', 'celebrate', 'sniff', 'dash', 'turn']) w[k] = damp(w[k], action === k ? 1 : 0, k === 'dash' ? 10 : 6);
    w.shake = damp(w.shake, action === 'shake' ? 1 : 0, action === 'shake' ? 14 : 8);
    w.startled = damp(w.startled, action === 'startled' ? 1 : 0, action === 'startled' ? 22 : 5);
    st.shakeT += dt;
    st.startT += dt;
    // chacoalhar: onda de torção que vai da cabeça à cauda (~0,9 s); k = atraso do segmento
    const shakeEnvAt = (k) => {
      const u = st.shakeT - k * 0.07;
      return sstep(0, 0.1, u) * (1 - sstep(0.62, 0.9, u)) * w.shake;
    };
    const shakePh = st.shakeT * TAU * 6.2;
    const shk = (k) => Math.sin(shakePh - k * 0.9) * shakeEnvAt(k);
    const shkEnv = shakeEnvAt(1);
    // susto: tranco rápido para trás que assenta numa postura baixa e encolhida
    const jolt = sstep(0, 0.07, st.startT) * Math.exp(-Math.max(0, st.startT - 0.07) * 6) * w.startled;
    const ws = w.startled;
    w.carry = damp(w.carry, A.carrying ? 1 : 0, 6);
    // segredo (src/game/extras.js): voltinha (pre), comemoração de quem fez (party) e a irmã vendo (cheer)
    w.pre = damp(w.pre, (A.poopPre ?? -1) >= 0 ? 1 : 0, 5);
    const PY = A.party || null;
    const glee = PY ? PY.glee : 0;
    const pBrace = PY ? PY.brace : 0;
    const pAir = PY && PY.air >= 0 ? PY.air : -1;
    const curveW = Math.max(w.pre, PY ? PY.zoom : 0); // apoios girando com o corpo na curva
    const ct = A.cheer ?? -1;
    const wow = ct >= 0 ? keyed(CHEER_WOW, ct) : 0;
    const glad = ct >= 0 ? sstep(0.45, 0.75, ct) : 0;
    // pulo: o corpo inteiro sobe no arco (inner), o resto são poses; land = agachadinho logo após o pouso.
    // Os pulinhos da comemoração usam a mesma pose, mais contida.
    const jumpY = Math.max(0, A.jump || 0) + (PY ? PY.hop : 0);
    const inAir = (A.airK ?? -1) >= 0 || pAir >= 0;
    const airK = (A.airK ?? -1) >= 0 ? A.airK : pAir >= 0 ? pAir : 1;
    w.jump = damp(w.jump, inAir ? (pAir >= 0 ? PY.jump || 0.7 : 1) : 0, inAir ? 22 : 12);
    if (st.prevAir && !inAir) st.landT = 0;
    st.prevAir = inAir;
    // impulso na parede (quadros-chave WALL_*): wp = progresso, wEnv liga/desliga as poses nas pontas
    const wallOn = (A.wallK ?? -1) >= 0;
    const wp = wallOn ? clamp(A.wallK, 0, 1) : 0;
    const wEnv = wallOn ? sstep(0, 0.06, wp) * (1 - sstep(0.94, 1, wp)) : 0;
    const wallGap = A.wallGap ?? 0;
    const wallTop = clamp(A.wallTop || 1.1, 0.9, 1.45);
    const wallPeak = Math.max(0.2, wallTop - 0.84);
    const wTouch = wallOn ? sstep(0.5, 0.56, wp) * (1 - sstep(0.86, 1, wp)) : 0; // alcançou: carinha feliz
    if (st.prevWall && !wallOn) st.landT = 0;
    st.prevWall = wallOn;
    wallCtx.p = wp;
    wallCtx.gap = wallGap;
    wallCtx.top = wallTop;
    wallCtx.out = A.wallOut ?? 0.05;
    wallCtx.paws = A.wallPaws || wallTop - 0.07;
    wallCtx.side = A.wallSide || 0.165;
    wallCtx.lat = A.wallLat ?? 0;
    // empurrão em pé: o quanto está de pé (sk), a pose para o apoio e o ciclo de cada empurrão (suavizado)
    const sk = shoveEnv(A.shoveK ?? 0);
    const beat = shoveBeat(A.shoveCycle ?? -1);
    for (const k of ['cock', 'jolt', 'press', 'growl']) st.sb[k] = damp(st.sb[k], beat[k] * sstep(0.6, 0.95, sk), 30);
    const growl = sk * st.sb.growl; // rosnadinha: boquinha franzida
    shoveCtx.sk = sk;
    if (sk > 0.001) {
      const over = A.shoveOver ?? 0;
      const P = shoveStand({ hip: rest[BI.HLu], shoulder: rest[BI.FLu], lf: LEGS[0].a + LEGS[0].b, y: A.shoveY ?? 0.44, gap: A.shoveGap ?? 0.26, over, s });
      Object.assign(shoveCtx, P, { round: over <= 0.005, cock: st.sb.cock, press: st.sb.press });
    }
    st.landT += dt;
    const land = Math.max(st.landT < 0.5 ? Math.exp(-st.landT * 9) * sstep(0, 0.04, st.landT) : 0, clamp(A.crouch || 0, 0, 1));
    // superbafo: aim = enche o peito mirando; blow = "HÁÁÁ!"; proud = toda orgulhosa; yuck = vira a cara
    w.aim = damp(w.aim, action === 'bafoAim' ? 1 : 0, 9);
    w.blow = damp(w.blow, action === 'bafo' ? 1 : 0, 20);
    w.proud = damp(w.proud, action === 'proud' ? 1 : 0, 5);
    w.yuck = damp(w.yuck, action === 'yuck' ? 1 : 0, 7);
    // Lambe-Lambe: quem lambe ('lick') e quem é lambida ('licked') no mesmo ritmo (lickPhase; contato em 0,5).
    // A língua sai até 0,3, varre a irmã de baixo para cima até ~0,68 e volta; a cabeça balança de lado a cada
    // lambida (lickSide). Quem é lambida fecha os olhos, encolhe e é empurrada de leve a cada contato.
    const lp = A.lickPhase ?? -1;
    const lpk = lp >= 0 ? lp : 0;
    const lSide = A.lickSide ?? 1;
    const lSolo = !!A.lickSolo;
    w.lick = damp(w.lick, action === 'lick' ? 1 : 0, action === 'lick' ? 12 : 7);
    w.licked = damp(w.licked, action === 'licked' ? 1 : 0, action === 'licked' ? 9 : 5);
    w.slide = damp(w.slide, action === 'slide' ? 1 : 0, 10);
    const lExt = lp >= 0 ? sstep(0.04, 0.3, lpk) * (1 - sstep(0.64, 0.94, lpk)) : 0;
    const lSweep = lp >= 0 ? sstep(0.28, 0.68, lpk) : 0;
    const lTouch = lp >= 0 ? Math.sin(Math.PI * clamp((lpk - 0.3) / 0.38, 0, 1)) : 0;
    const lk = w.lick * (lSolo ? 0 : 1); // inclina o corpo na irmã
    const ls = w.lick * (lSolo ? 1 : 0); // lambidinha no próprio focinho
    const lr = w.licked * lTouch; // reação a cada lambida
    const lIn = lExt * (1 - lSweep); // estende o pescoço antes da varrida
    // Ponto lambido acima da boca (a Radhija na bochecha ou no ombro da Rhaenyra): em vez de baixar a cabeça, ela
    // ergue o peito, estica o pescoço para cima e a língua sai para a frente, varrendo para cima. lUp + lDn = lk;
    // com o ponto abaixo da boca (a Rhaenyra na Radhija), lUp = 0 e a pose é a de sempre.
    const lUp = (A.lickY ?? -1) >= 0 ? lk * sstep(0, 0.08, A.lickY - rest[BI.jaw].y) : 0;
    const lDn = lk - lUp;
    const lUpN = lk > 1e-3 ? lUp / lk : 0;
    st.slope = damp(st.slope, A.slope || 0, 14);
    // extras: cocô (pp) e animações do cenário (X); x* = peso de cada uma (0 fora dela)
    const pkIn = A.poopK ?? -1;
    const pp = pkIn >= 0 ? clamp(pkIn, 0, 1) : -1;
    const squat = pp >= 0 ? keyed(POOP_SQUAT, pp) : 0;
    const strainK = pp >= 0 ? keyed(POOP_STRAIN, pp) : 0;
    const reliefK = pp >= 0 ? keyed(POOP_RELIEF, pp) : 0;
    const scratchK = pp >= 0 ? keyed(POOP_SCRATCH, pp) : 0;
    const effort = strainK * (0.55 + 0.45 * Math.max(0, Math.sin(t * 8.2)));
    let kickLeg = -1;
    let kickU = 0;
    if (scratchK > 0) {
      const f = clamp((pp - POOP_KICKS.from) / (POOP_KICKS.to - POOP_KICKS.from), 0, 0.9999) * POOP_KICKS.n;
      kickLeg = Math.floor(f) % 2;
      kickU = f - Math.floor(f);
    }
    const X = A.extra || null;
    const xk = X ? clamp(X.k, 0, 1) : 0;
    const xt = X ? X.t || 0 : 0;
    const xEnv = X ? sstep(0, 0.12, xk) * (1 - sstep(0.86, 1, xk)) : 0;
    const xKind = X ? X.kind : '';
    const xDrink = xKind === 'drink' ? xEnv : 0;
    const xEat = xKind === 'eat' ? xEnv : 0;
    const xDig = xKind === 'dig' ? xEnv : 0;
    const xRoll = xKind === 'roll' ? keyed(ROLL_DOWN, xk) : 0;
    const xRub = xKind === 'roll' ? keyed(ROLL_RUB, xk) : 0;
    const xNudge = xKind === 'nudge' ? keyed(NUDGE_LUNGE, xk) : 0;
    const sneezeP = xKind === 'sneeze' ? keyed(SNEEZE_PITCH, xk) : 0;
    const sneezeO = xKind === 'sneeze' ? keyed(SNEEZE_OPEN, xk) : 0;
    const sneezeShake = xKind === 'sneeze' ? sstep(0.68, 0.72, xk) * (1 - sstep(0.84, 0.9, xk)) : 0;
    // cheirando: a cabeça desce até o chão; flores no alto (X.h m) abaixam menos
    const sniffLow = 1 - clamp((X?.h || 0) / 0.6, 0, 0.85);
    const sniffX = (xKind === 'sneeze' ? sstep(0, 0.1, xk) * (1 - sstep(0.5, 0.58, xk)) : xKind === 'nudge' ? sstep(0, 0.1, xk) * (1 - sstep(0.3, 0.4, xk)) : 0) * sniffLow;
    const lap = 0.5 + 0.5 * Math.sin(xt * TAU * 3.6);
    const chew = Math.max(0, Math.sin(xt * TAU * 2.6));
    const xStill = Math.max(squat, scratchK, xEnv, xRoll);
    const happyX = Math.max(reliefK * 0.9, scratchK * 0.7, xDig * 0.85, xRoll * 0.8, xEat * 0.55, xDrink * 0.45, glee, glad * 0.95, w.pre * 0.55);

    // comemoração: pulinhos → giro → "play bow"
    let hopTarget = 0, bowTarget = 0, spinTarget = null, celHappy = w.celebrate;
    if (action === 'celebrate') {
      st.celT += dt;
      const c = st.celT % 2.8;
      if (c < 0.9) {
        const u = (c % 0.45) / 0.45;
        hopTarget = Math.sin(Math.PI * u) * 0.075 * s;
      } else if (c < 1.65) {
        const u = (c - 0.9) / 0.75;
        spinTarget = TAU * Math.floor(st.celT / 2.8) + TAU * (u * u * (3 - 2 * u));
        hopTarget = Math.sin(Math.PI * u) * 0.05 * s;
      } else {
        bowTarget = 1;
      }
      if (spinTarget === null) spinTarget = TAU * Math.round(st.spin / TAU);
      st.spin = c >= 0.9 && c < 1.65 ? spinTarget : damp(st.spin, spinTarget, 10);
    } else {
      st.spin = damp(st.spin, TAU * Math.round(st.spin / TAU), 6);
      if (Math.abs(st.spin - TAU * Math.round(st.spin / TAU)) < 1e-3) st.spin = 0;
    }
    // a irmã, alegre, dá dois pulinhos nas patas da frente
    const cheerHop = ct >= 0.78 && ct < 1.38 ? Math.sin(Math.PI * fract((ct - 0.78) / 0.3)) * 0.026 * s * glad : 0;
    st.hop = action === 'celebrate' ? hopTarget : ct >= 0 ? cheerHop : damp(st.hop, 0, 12);
    w.bow = damp(w.bow, Math.max(bowTarget, PY ? PY.bow : 0), 7);
    inner.rotation.y = st.spin;
    // impulso na parede: o corpo fica de pé girando em torno do quadril (Hr), que sobe e se aproxima da parede
    let wallLiftY = 0;
    st.wallTheta = 0;
    inner.position.z = 0;
    if (wallOn) {
      const th = keyed(WALL_REAR, wp);
      const Hr = rest[BI.HLu];
      const hy = Hr.y + keyed(WALL_LIFT, wp) * wallPeak;
      const into = sstep(0.04, 0.24, wp) * (1 - sstep(0.8, 1, wp));
      const hz = lerp(Hr.z, wallGap - keyed(WALL_DIST, wp), into);
      const c = Math.cos(th), sn = Math.sin(th);
      wallLiftY = hy - (Hr.y * c + Hr.z * sn);
      inner.position.z = hz - (-Hr.y * sn + Hr.z * c);
      st.wallTheta = th;
    }
    // empurrão em pé: o mesmo giro pelo quadril, até o ângulo da pose (mais em pé quanto mais alto o apoio)
    let shoveLiftY = 0;
    st.shoveTheta = 0;
    if (sk > 0.001) {
      const Hr = rest[BI.HLu];
      const th = shoveCtx.theta * sk;
      const hy = lerp(Hr.y, shoveCtx.hy, sk);
      const hz = lerp(Hr.z, shoveCtx.hz, sk);
      const c = Math.cos(th), sn = Math.sin(th);
      shoveLiftY = hy - (Hr.y * c + Hr.z * sn);
      inner.position.z = hz - (-Hr.y * sn + Hr.z * c);
      st.shoveTheta = th;
    }
    inner.rotation.x = -st.slope - st.wallTheta - st.shoveTheta; // rampa, parede ou empurrão: o corpo inteiro inclina, as patas acompanham
    inner.position.y = st.hop + jumpY + wallLiftY + shoveLiftY;
    // rolar: de costas, balança de um lado para o outro se esfregando
    const rollA = xKind === 'roll' ? keyed(ROLL_ANGLE, xk) + Math.sin(xt * 5.4) * 0.24 * xRub : 0;
    const xBack = xKind === 'roll' ? sstep(1.3, 2.5, rollA) : 0; // de costas (patinhas para o ar)
    inner.rotation.z = rollA;
    inner.position.x = 0;
    if (rollA !== 0) {
      // gira em torno do meio do tronco (0, hc), que fica no lugar; a altura vem do contato com o chão (no fim)
      const hc = cfg.visual.shoulder * 0.72;
      inner.position.x = hc * Math.sin(rollA);
      inner.position.y += hc - hc * Math.cos(rollA);
    }

    // latido
    let barkEnv = 0;
    if (st.bark >= 0) {
      st.bark += dt;
      const u = st.bark / 0.38;
      if (u >= 1) st.bark = -1;
      else barkEnv = Math.sin(Math.PI * u) * (u < 0.5 ? 1 : 1 - (u - 0.5) * 0.6);
    }

    // ---------------- passada
    const kS = 1 / Math.sqrt(s);
    const vEff = Math.max(v, Math.abs(st.turnS) * 0.1 * s);
    const fTrot = (1.8 + 1.6 * Math.min(vEff, 3)) * kS;
    const fBound = (4.6 + 0.15 * v) * kS;
    let f = lerp(fTrot, fBound, w.dash);
    f = lerp(f, f * 0.72, w.push);
    f = lerp(f, 3.8, w.strain);
    const turning = sstep(0.4, 1.5, Math.abs(st.turnS)) * (1 - st.move);
    const gaitAmp = Math.max(st.move, turning * 0.6, w.strain) * (1 - Math.max(w.tug, w.turn)) * (1 - w.sit) * (1 - w.bow) * (1 - shkEnv * 0.9) * (1 - ws * 0.7) * (1 - w.jump) * (1 - Math.max(w.aim, w.blow)) * (1 - w.slide) * (1 - wEnv) * (1 - sk) * (1 - xStill);
    st.phase = fract(st.phase + f * dt);
    const L = v / Math.max(f, 0.5);
    const walk = Math.max(1 - sstep(0.55, 1.1, v), w.pre); // a voltinha é a passo (farejando)
    let beta = lerp(0.62, 0.4, clamp(v / 2.4, 0, 1));
    beta = lerp(beta, 0.3, w.dash);
    beta = lerp(beta, 0.66, w.push);
    beta = lerp(beta, 0.5, w.strain);
    let stroke = beta * L * (1 - w.strain) + w.strain * 0.06 * s;
    stroke *= 1 - w.tug;
    const lift = (0.026 * s * Math.min(1, 0.45 + v / 1.4) * Math.max(st.move, turning) + w.strain * 0.024 * s + w.push * 0.01 * s + w.dash * 0.02 * s) * (1 - w.sit);
    // fases de cada pata (FL, FR, HL, HR): passo (lateral), trote (diagonais), galope (bound)
    const offWalk = [0.25, 0.75, 0.0, 0.5];
    const offTrot = [0.0, 0.5, 0.5, 0.0];
    const offBound = [0.0, 0.08, 0.5, 0.58];

    // ---------------- corpo (raiz)
    const sp2 = st.phase * TAU;
    const trotK = (1 - w.dash) * gaitAmp;
    const bob = -0.0065 * s * Math.min(1, v / 1.2) * trotK * Math.cos(2 * (sp2 - beta * Math.PI));
    const sway = 0.003 * s * Math.sin(sp2) * trotK;
    const boundPitch = 0.15 * Math.sin(sp2 - 0.9) * w.dash;
    const boundY = 0.022 * s * (0.5 + 0.5 * Math.sin(sp2 - 2.4)) * w.dash;
    st.lean = damp(st.lean, clamp(-st.turnS * v * 0.075, -0.32, 0.32) * (1 - wEnv) * (1 - sk) * (1 - 0.75 * w.pre), 6);
    const breathe = Math.sin(t * (2.2 + 3 * st.move)) * 0.0016 * s;
    const tremble = w.strain * Math.sin(t * 57) * 0.0018 * s + w.aim * Math.sin(t * 41) * 0.0012 * s + effort * Math.sin(t * 52) * 0.0024 * s;

    let pitch = boundPitch + w.push * 0.11 + w.strain * 0.16 + w.sniff * 0.1 - w.tug * 0.13 - barkEnv * 0.04 - ws * 0.07 - jolt * 0.1 + w.turn * 0.06 + w.jump * (0.5 * airK - 0.24) + land * 0.08 - w.aim * 0.1 + w.blow * 0.12 - w.proud * 0.08 - w.yuck * 0.06 + lDn * (0.05 + 0.04 * lExt) - lUp * (0.07 + 0.03 * lIn)
      - squat * 0.04 + scratchK * 0.1 + (xDrink + xEat) * 0.2 + xDig * 0.16 + xNudge * 0.08 - pBrace * 0.12 - wow * 0.05;
    let rootY = bob + boundY + breathe - 0.012 * s * Math.min(1, v / 2) * (1 - w.dash) - w.push * 0.012 * s - w.strain * 0.016 * s - w.tug * 0.02 * s - w.sniff * 0.012 * s - ws * 0.03 * s - shkEnv * 0.006 * s - w.turn * 0.014 * s - land * 0.028 * s + w.aim * 0.006 * s - lr * 0.009 * s - w.slide * 0.045 * s - st.mud * 0.004 * s - (wallOn ? keyed(WALL_CROUCH, wp) * 0.03 * s : 0)
      - squat * 0.006 * s + effort * Math.sin(t * 61) * 0.001 * s - (xDrink + xEat) * 0.01 * s - xDig * 0.012 * s - pBrace * 0.016 * s
      + lUp * (0.01 + 0.006 * lIn) * s;
    let rootZ = -w.tug * 0.025 * s - barkEnv * 0.008 * s + w.strain * 0.01 * s - ws * 0.022 * s - jolt * 0.03 * s - w.turn * 0.012 * s - w.aim * 0.012 * s + w.blow * 0.015 * s - w.yuck * 0.02 * s + lk * (0.008 + 0.016 * lIn) * s
      + scratchK * 0.012 * s + xNudge * 0.07 * s + (xDrink + xEat) * 0.02 * s - pBrace * 0.012 * s - wow * 0.014 * s;
    const rootX = sway + tremble + shk(2) * 0.006 * s + ws * Math.sin(t * 47) * 0.0012 * s - lr * lSide * 0.004 * s;
    qE(_q, pitch, 0, st.lean + Math.sin(sp2) * 0.025 * trotK + shk(2) * 0.16);
    _rootPos.set(rest[0].x + rootX, rest[0].y + rootY, rest[0].z + rootZ);
    _m.compose(_rootPos, _q, _v.set(1, 1, 1));
    // sentar: gira em torno do peito; play bow: gira em torno do quadril
    if (w.sit > 0.001) {
      // pivô no ombro: as patas dianteiras continuam retas e plantadas; a garupa desce até o chão
      const C = rest[BI.FLu];
      _m2.makeTranslation(0, C.y - 0.004 * s * w.sit, C.z).multiply(_m3.makeRotationX(-SIT_PITCH * w.sit)).multiply(_m3.makeTranslation(0, -C.y, -C.z));
      _m.premultiply(_m2);
    }
    if (w.bow > 0.001) {
      const Hh = rest[BI.hips];
      _m2.makeTranslation(Hh.x, Hh.y + 0.01 * s * w.bow, Hh.z).multiply(_m3.makeRotationX(0.42 * w.bow)).multiply(_m3.makeTranslation(-Hh.x, -Hh.y, -Hh.z));
      _m.premultiply(_m2);
    }
    if (squat > 0.001) {
      const C = rest[BI.FLu];
      // inclina pouco (a garupa fica a meia altura); a corcunda vem do peito e da pelve dobrando (abaixo)
      _m2.makeTranslation(0, C.y, C.z).multiply(_m3.makeRotationX(-0.22 * squat)).multiply(_m3.makeTranslation(0, -C.y, -C.z));
      _m.premultiply(_m2);
    }
    _m.decompose(_rootPos, Lq[0], _v);
    Wq[0].copy(Lq[0]);
    Wp[0].copy(_rootPos);
    bones[0].position.copy(_rootPos);

    // coluna: curva na direção da curva, flexão no galope, rebolado na comemoração
    const spineYaw = clamp(st.turnS * 0.07, -0.25, 0.25) + w.pre * clamp(st.turnS * 0.045, -0.14, 0.14); // na voltinha, bem curvada
    const wiggle = w.bow * Math.sin(t * 14) * 0.18 + xRub * Math.sin(xt * 6.4) * 0.2; // de costas, serpenteia
    const flex = w.dash * Math.sin(sp2 - 0.4) * 0.12;
    // empurrão em pé: os ombros dão o tranco (o peito vai para a frente e desce um tiquinho rumo à coisa)
    const shoveJolt = sk * st.sb.jolt;
    qE(Lq[BI.chest], -flex + squat * 0.56 + shoveJolt * 0.07, spineYaw + shk(1.5) * 0.12 - xRub * Math.sin(xt * 6.4) * 0.12, shk(1.5) * 0.3);
    const wallFlex = wallOn ? sstep(0.34, 0.42, wp) * (1 - sstep(0.5, 0.6, wp)) * 0.22 : 0; // garupa encolhe no impulso
    qE(Lq[BI.hips], flex - w.sit * SIT_HIPS + ws * 0.12 + wallFlex + sk * 0.12 - squat * 0.8 - scratchK * 0.05, -spineYaw * 0.6 + wiggle - shk(3) * 0.14, -wiggle * 0.3 + shk(3) * 0.42);
    // (o tranco vai para a frente no mundo, não ao longo da coluna inclinada)
    posOff[BI.chest].set(0, -Math.sin(st.shoveTheta) * shoveJolt * 0.026 * s, w.dash * Math.cos(sp2 - 0.4) * 0.018 * s + Math.cos(st.shoveTheta) * shoveJolt * 0.026 * s);
    posOff[BI.hips].set(0, 0, -w.dash * Math.cos(sp2 - 0.4) * 0.018 * s);
    fk(BI.hips);
    fk(BI.chest);

    // ---------------- pernas (IK)
    for (let li = 0; li < 4; li++) {
      const leg = LEGS[li];
      const off = lerp(lerp(offTrot[li], offWalk[li], walk * (1 - w.dash)), offBound[li], w.dash);
      const p = fract(st.phase + off);
      let fz = 0, fy = 0, curl = 0, swingU = 0;
      const swing = p >= beta;
      if (!swing) {
        fz = stroke * (0.5 - p / beta);
      } else {
        const u = (p - beta) / (1 - beta);
        const e = u * u * (3 - 2 * u);
        fz = stroke * (-0.5 + e);
        fy = lift * Math.sin(Math.PI * u);
        curl = Math.sin(Math.PI * u);
        swingU = u;
      }
      fz *= gaitAmp;
      fy *= gaitAmp;
      curl *= gaitAmp;
      // pisada
      if (leg.swing && !swing && v > 0.2 && gaitAmp > 0.3) onFootstep(li);
      leg.swing = swing;
      void swingU;

      const T = _T.copy(leg.foot0);
      T.z += fz;
      T.y += fy;
      // voltinha e zoomies: na curva o apoio gira com o corpo (as dianteiras pisam para dentro da curva, as traseiras
      // para fora, e as patas do lado de dentro dão passos menores), então as patas plantadas não patinam
      if (curveW > 0.01 && v > 0.05) {
        const kc = clamp(st.turnS / Math.max(v, 0.3), -4, 4) * curveW; // 1/raio da curva (+ = esquerda)
        T.x += fz * leg.foot0.z * kc;
        T.z -= fz * leg.foot0.x * kc;
      }
      if (leg.front) {
        T.z += w.sit * 0.012 * s + w.bow * 0.075 * s + w.tug * 0.04 * s - w.sniff * 0.005 * s;
        T.y += w.bow * 0.004 * s;
        T.x += leg.side * w.bow * 0.006 * s;
        // no ar: dianteiras dobradas na subida, esticadas para a frente no pouso
        T.z += w.jump * (0.015 + 0.05 * airK) * s;
        T.y += w.jump * 0.04 * s * Math.sin(Math.PI * airK);
        // escorregando de barriga: patas da frente esticadas para a frente
        T.z += w.slide * 0.09 * s;
        T.y += w.slide * 0.055 * s;
        // extras: firmes um pouco à frente (agachada, cavando atrás; freando os zoomies); cavando com as da frente,
        // uma de cada vez
        T.z += scratchK * 0.02 * s + squat * 0.012 * s + pBrace * 0.05 * s;
        if (xDig > 0) {
          const f = xt * DIG_RATE;
          const mine = Math.floor(f) % 2 === li;
          const u = fract(f);
          if (mine) {
            T.z += xDig * (0.06 - 0.14 * sstep(0.12, 0.7, u)) * s;
            T.y += xDig * 0.05 * s * Math.sin(Math.PI * clamp(u / 0.55, 0, 1));
          } else T.z += xDig * 0.03 * s;
          T.x += leg.side * xDig * 0.01 * s;
        }
        T.x += leg.side * (xDrink + xEat) * 0.012 * s;
      } else {
        T.z += w.sit * 0.07 * s - (w.push + w.strain) * 0.025 * s + w.tug * 0.012 * s - w.turn * 0.02 * s;
        T.x += leg.side * (w.sit * 0.01 + shkEnv * 0.01 + ws * 0.006) * s;
        // no ar: traseiras estendidas para trás na decolagem, recolhidas depois
        T.z -= w.jump * 0.06 * (1 - airK) * s;
        T.y += w.jump * 0.035 * s * Math.sin(Math.PI * airK);
        // escorregando de barriga: traseiras esticadas para trás
        T.z -= w.slide * 0.075 * s;
        T.y += w.slide * 0.045 * s;
        // agachada: patas para a frente, debaixo da barriga, um pouco abertas (freando: traseiras debaixo do corpo)
        T.z += squat * 0.13 * s + pBrace * 0.035 * s;
        T.x += leg.side * squat * 0.025 * s;
        // cavando com as traseiras: patada para trás, uma de cada vez
        if (scratchK > 0 && kickLeg === li - 2) {
          const kz = kickShape(kickU);
          T.z -= scratchK * kz * 0.17 * s;
          T.y += scratchK * kz * 0.05 * s;
        }
      }
      // rolando: deitada de bruços, o corpo desce até ~13 cm (na escala) e as patas dobram até essa altura (as da
      // frente esticadas à frente, como uma esfinge; as traseiras debaixo da barriga); de costas ficam encolhidas
      // para o ar, pedalando em rodinhas (as diagonais juntas)
      if (xRoll > 0) {
        const lie = xRoll * (1 - xBack);
        const air = xRoll * xBack;
        const floorB = 0.13 * s;
        if (leg.front) {
          T.y = lerp(T.y, floorB + 0.035 * s, lie);
          T.z += lie * 0.07 * s;
          T.y = lerp(T.y, 0.14 * s, air);
          T.z -= air * 0.015 * s;
        } else {
          T.y = lerp(T.y, floorB + 0.022 * s, lie);
          T.z += lie * 0.05 * s;
          T.x += leg.side * lie * 0.025 * s;
          T.y = lerp(T.y, 0.13 * s, air);
          T.z += air * 0.04 * s;
          T.x += leg.side * air * 0.035 * s;
        }
        const ph = xt * 7.2 + [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5][li];
        T.z += xBack * Math.sin(ph) * 0.03 * s;
        T.y += xBack * Math.cos(ph) * 0.02 * s;
      }
      // pulinho: patas encolhidas
      const tuck = st.hop * 0.55 + (w.dash * Math.max(0, Math.sin(sp2 - 2.4)) * 0.015 * s);
      T.y += tuck;
      if (wallOn) wallLegTarget(li, leg, T);
      if (sk > 0.001) shoveLegTarget(li, leg, T);
      // planta do pé nunca abaixo do chão (com o corpo levantado o pé acompanha)
      const parent = leg.front ? BI.chest : BI.hips;
      fk(leg.iu);
      const Pp = Wp[leg.iu];
      // polo: cotovelo para trás, joelho para frente (girando com o tronco)
      _pole.set(0, leg.front ? -0.15 : 0.15, leg.front ? -1 : 1).applyQuaternion(Wq[parent]);
      if (!leg.front && w.sit > 0.001) {
        // SENTADA (anatomia de cão): jarrete no chão logo atrás do quadril, metatarso deitado
        // apontando para a frente, pata plantada à frente do jarrete; soldra para a FRENTE, ao lado
        // da barriga (polo no referencial da dog, não da garupa inclinada).
        const ks = sstep(0, 1, w.sit);
        _v.set(Pp.x + leg.side * 0.012 * s, leg.foot0.y - 0.004 * s, Pp.z - 0.016 * s + leg.c * 0.97);
        T.lerp(_v, ks);
        _v.set(leg.side * 0.34, 0.5, 1).normalize();
        _pole.lerp(_v, ks).normalize();
      }
      if (!leg.front && squat > 0.001) {
        // agachada: joelhos para a frente e um pouco para fora
        _v.set(leg.side * 0.45, 0.3, 1).normalize();
        _pole.lerp(_v, squat * 0.6).normalize();
      }

      if (leg.front) {
        solve2(Pp, T, leg.a, leg.b, _pole, _K);
        _n.crossVectors(_v.subVectors(_K, Pp), _v2.subVectors(T, _K)).normalize();
        basisQuat(_q, _v3.subVectors(_K, Pp), _n, leg.Bu);
        setWorld(leg.iu, _q);
        basisQuat(_q2, _v3.subVectors(T, _K), _n, leg.Bl);
        setWorld(leg.il, _q2);
        // de pé no empurrão: em cima de uma beirada a pata fica deitada; na face, virada para cima, almofadinha na casca
        qE(_q3, curl * 0.9 - w.bow * 0.0 + sk * (shoveCtx.top ? st.shoveTheta : st.shoveTheta - 1.2), 0, 0);
        setWorld(leg.ip, _q3);
      } else {
        // metatarso: vertical em pé, deitado para a frente sentado, flexiona no balanço
        const kickCurl = scratchK > 0 && kickLeg === li - 2 ? kickShape(kickU) * scratchK * 0.35 : 0;
        // de pé no empurrão: metatarso quase em pé no mundo (o corpo inclinou theta), pata um pouco à frente do jarrete
        const ang = curl * 0.45 - sstep(0, 1, w.sit) * 1.38 - squat * 0.85 + kickCurl - xRoll * 0.9 + st.shoveTheta - 0.3 * sk;
        _v.copy(leg.m0).applyAxisAngle(_X, ang);
        _H.copy(T).sub(_v); // jarrete = pata - metatarso
        const Mdir = _d.copy(_v); // cópia temporária
        const mdx = Mdir.x, mdy = Mdir.y, mdz = Mdir.z;
        solve2(Pp, _H, leg.a, leg.b, _pole, _K);
        _n.crossVectors(_v.subVectors(_K, Pp), _v2.subVectors(_H, _K)).normalize();
        basisQuat(_q, _v3.subVectors(_K, Pp), _n, leg.Bu);
        setWorld(leg.iu, _q);
        basisQuat(_q2, _v3.subVectors(_H, _K), _n, leg.Bl);
        setWorld(leg.il, _q2);
        _n.crossVectors(_v.subVectors(_K, Pp), _v2.subVectors(_H, _K)).normalize();
        basisQuat(_q3, _v3.set(mdx, mdy, mdz), _n, leg.Bm);
        setWorld(leg.im, _q3);
        qE(_qi, curl * 0.7 + st.shoveTheta, 0, 0); // de pé no empurrão, a pata continua deitada no chão
        setWorld(leg.ip, _qi);
      }
    }

    // ---------------- olhar
    let tYaw = 0, tPitch = 0;
    if (A.lookAt) {
      const ox = object.position.x, oz = object.position.z, yaw = object.rotation.y;
      const dx = A.lookAt.x - ox, dz = A.lookAt.z - oz;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const hp = Wp[BI.head];
      tYaw = clamp(Math.atan2(lx - hp.x, lz - hp.z), -1.15, 1.15);
      const hd = Math.hypot(lx - hp.x, lz - hp.z);
      tPitch = clamp(-Math.atan2((A.lookAt.y ?? 0.3) - (object.position.y + hp.y), Math.max(hd, 0.2)), -0.5, 0.55);
    } else {
      st.glanceT -= dt;
      if (st.glanceT <= 0) {
        st.glanceT = 1.8 + Math.random() * 3.5;
        const calm = 1 - st.move;
        st.glanceYaw = (Math.random() * 2 - 1) * 0.65 * calm;
        st.glancePitch = (Math.random() * 0.35 - 0.2) * calm;
      }
      tYaw = st.glanceYaw * (1 - st.move) + st.turnS * 0.12;
      tPitch = st.glancePitch * (1 - st.move);
    }
    tPitch *= 1 - wEnv; // de pé na parede a cabeça segue o corpo (compensada abaixo)
    tYaw *= 1 - Math.max(squat, xEnv) * 0.75;
    if (scratchK > 0) tYaw = lerp(tYaw, 1.05, scratchK * 0.85);
    const actionsBusy = Math.max(w.push, w.strain, w.tug, w.sniff, w.bow, w.turn, shkEnv);
    tYaw *= 1 - actionsBusy * 0.8;
    // voltinha: o focinho olha para dentro da curva e varre o chão de um lado para o outro
    tYaw += w.pre * (clamp(st.turnS * 0.09, -0.4, 0.4) + Math.sin(t * 4.1) * 0.1);
    st.lookYaw = damp(st.lookYaw, tYaw, 5);
    st.lookPitch = damp(st.lookPitch, tPitch, 5);

    // ---------------- pescoço e cabeça (cabeça estabilizada)
    const shake = w.tug * Math.sin(t * 15) * 0.32 + w.yuck * Math.sin(t * 13) * 0.22 + sneezeShake * Math.sin(t * 17) * 0.3 + growl * Math.sin(t * 41) * 0.012;
    // registro: torce a cabeça (rolagem) em catraca — gira devagar, volta rápido
    const tu = fract(t * 0.85);
    const turnRoll = w.turn * (tu < 0.72 ? lerp(-0.42, 0.48, sstep(0, 0.72, tu)) : lerp(0.48, -0.42, sstep(0.72, 1, tu)));
    const sniffTw = w.sniff * Math.sin(t * 19) * 0.04;
    const neckPitch = 0.05 + w.push * 0.42 + w.strain * 0.5 + w.sniff * 0.95 + w.tug * 0.25 + w.bow * 0.25 - w.carry * 0.08 - w.sit * 0.12 - barkEnv * 0.16 + st.lookPitch * 0.4 - ws * 0.3 + w.turn * 0.32 - w.jump * 0.18 * (1 - airK) - w.aim * 0.3 + w.blow * 0.2 - w.proud * 0.28 + w.yuck * 0.05
      + lDn * (0.14 + 0.3 * lIn - 0.1 * lSweep * lExt) - lUp * (0.3 + 0.12 * lIn) - ls * 0.1 - lr * 0.09 - w.slide * 0.2 + wEnv * st.wallTheta * 0.22 + sk * st.shoveTheta * 0.42 + shoveJolt * 0.1
      + squat * 0.14 + (xDrink + xEat) * 1.3 + xDig * 0.55 + sniffX * 0.95 + xNudge * 0.9 + xRoll * 0.3 * (1 - xBack) + xBack * 1.2 - wow * 0.18;
    const bodyPitchW = pitch - SIT_PITCH * w.sit + 0.42 * w.bow;
    const lickYaw = lk * lSide * 0.08 * lSweep - lr * lSide * 0.1;
    // impulso: no alto, a cabeça vira para a direita, olhando a pata no botão
    const wallYaw = wallOn ? -0.34 * sstep(0.36, 0.48, wp) * (1 - sstep(0.62, 0.76, wp)) : 0;
    qE(_q, bodyPitchW * 0.35 + neckPitch, st.lookYaw * 0.45 + shake * 0.3 + shk(0.5) * 0.25 + lickYaw * 0.4 + wallYaw * 0.45, shk(0.5) * 0.3 + turnRoll * 0.3);
    setWorld(BI.neck, _q);
    const headPitch = -0.05 - w.push * 0.3 - w.strain * 0.35 + w.sniff * 0.35 + w.tug * 0.1 - w.carry * 0.08 - barkEnv * 0.32 + st.lookPitch * 0.6 + sniffTw + bob * 4 - ws * 0.12 + w.turn * 0.12 - w.aim * 0.2 + w.blow * 0.18 - w.proud * 0.12
      + lDn * (0.28 * lIn - 0.32 * lSweep * lExt) + lUp * (0.1 * lIn - 0.3 * lSweep * lExt) - ls * (0.18 + 0.25 * lSweep * lExt) - lr * 0.34 - w.slide * 0.12 + wEnv * st.wallTheta * 0.18 + sk * st.shoveTheta * 0.3 + shoveJolt * 0.06
      + squat * 0.02 + (xDrink + xEat) * 0.85 + xEat * chew * 0.07 + xDig * 0.45 + sniffX * 0.35 + sneezeP + xNudge * 0.5 - xRoll * 0.15 * (1 - xBack) + xBack * 0.5 - wow * 0.1;
    const headTilt = celHappy * Math.sin(t * 3.1) * 0.18 + (1 - st.move) * Math.sin(t * 0.7) * 0.04 + w.proud * 0.12
      + lk * lSide * 0.2 * (0.35 + 0.65 * lExt) + ls * lSide * 0.08 - lr * lSide * 0.3 + wTouch * 0.24 + reliefK * 0.16 + xRoll * 0.15 + xRub * Math.sin(xt * 6.4 + 0.8) * 0.25
      + glee * Math.sin(t * 3.4) * 0.1 + glad * Math.sin(t * 2.6) * 0.14;
    qE(_q, headPitch, st.lookYaw + shake + shk(0) * 0.35 + lickYaw + wallYaw * 0.6, headTilt + st.lean * 0.4 + shk(0) * 0.6 + turnRoll);
    setWorld(BI.head, _q);
    fk(BI.jaw);

    // ---------------- boca (latido, comemoração, carregando)
    const pant = (celHappy * 0.6 + st.move * sstep(1.2, 2.4, v) * 0.5 + xRoll * 0.6 + scratchK * 0.3 + glee * 0.75 + glad * 0.6) * (1 - w.carry) * (1 - strainK);
    const openT = Math.max(barkEnv, pant * (0.55 + 0.45 * Math.sin(t * 9)) * (1 - ws), w.carry * carry.open, w.turn * 0.4, w.blow, w.proud * 0.35,
      w.lick * (0.28 + 0.6 * lExt), w.licked * 0.12, w.slide * 0.45 * (1 - w.carry), (wEnv * 0.3 + wTouch * 0.3) * (1 - w.carry),
      reliefK * 0.38 * (1 - w.carry), xDrink * (0.22 + 0.22 * lap), xEat * (0.08 + 0.42 * chew), sneezeO, wow * 0.32 * (1 - w.carry),
      growl * 0.12 * (1 - w.carry)) * (1 - sk * 0.85 * (1 - st.sb.growl));
    st.mouthOpen = damp(st.mouthOpen, openT, 20);
    const mo = st.mouthOpen;
    // rosnadinha: a boca fica mais curta e franzida (os cantos recolhem) e um tiquinho aberta
    lip.scale.set(mouthW * (1 - 0.3 * growl), 0.0022 * s + mo * 0.011 * s + growl * 0.0012 * s, 0.009 * s + mo * 0.004 * s);
    lip.position.set(0, -mo * 0.006 * s + growl * 0.0008 * s, -growl * 0.0015 * s);
    // língua comprida do Lambe-Lambe: estica em dois gomos, desce até a irmã e enrola para cima na varrida. Lambendo
    // para cima (lUpN), ela sai mais curta e para a frente: lambidinhas no queixo, sem subir até a testa da irmã.
    const lt = lExt * w.lick;
    if (lickTongue) {
      lickTongue.root.visible = lt > 0.02;
      if (lt > 0.02) {
        const short = 1 - 0.35 * lUpN;
        const L1 = lickTongue.length * (lSolo ? 0.42 : 0.55 * short) * lt;
        const L2 = lickTongue.length * (lSolo ? 0.38 : 0.5 * short) * lt;
        const wd = lickTongue.width * (0.8 + 0.2 * lt);
        lickTongue.base.scale.set(wd, 0.009 * s, Math.max(1e-4, L1));
        lickTongue.tipPivot.position.set(0, 0, L1 * 0.86);
        lickTongue.tip.scale.set(wd * 0.92, 0.008 * s, Math.max(1e-4, L2));
        const down = lerp(lerp(1.05, 0.62, lt) - 0.3 * lSweep, lerp(0.8, 0.5, lt) - 0.15 * lSweep, lUpN);
        lickTongue.root.rotation.set(lSolo ? lerp(0.5, -1.1, lSweep) : down, 0, lSolo ? 0 : lSide * 0.12 * lSweep);
        lickTongue.tipPivot.rotation.x = -(lSolo ? 0.5 + 1.1 * lSweep : 0.12 + 0.55 * lSweep * (1 - 0.45 * lUpN));
      }
    }
    tongue.visible = (mo > 0.15 || xDrink > 0.05) && lt < 0.1;
    tongue.scale.set(mouthW * 0.6, 0.004 * s, (0.012 + 0.022 * lap * xDrink) * s);
    tongue.position.set(0, -mo * 0.011 * s - 0.005 * s * lap * xDrink, 0.002 * s + 0.014 * s * lap * xDrink);

    // ---------------- orelhas (mola amortecida guiada pela aceleração da cabeça)
    {
      const hp = Wp[BI.head];
      _v.copy(hp).applyQuaternion(inner.quaternion).add(inner.position);
      _v.applyQuaternion(object.quaternion).add(object.position);
      if (!st.headWorld) st.headWorld = _v.clone();
      const idt = 1 / Math.max(dt, 1e-3);
      _v2.subVectors(_v, st.headWorld).multiplyScalar(idt);
      st.headWorld.copy(_v);
      _v3.subVectors(_v2, st.headVel).multiplyScalar(idt);
      st.headVel.lerp(_v2, 0.5);
      st.headAcc.lerp(_v3, 0.3);
      if (st.headAcc.length() > 60) st.headAcc.setLength(60);
      // aceleração no referencial da cabeça
      _q.copy(object.quaternion).multiply(inner.quaternion).multiply(Wq[BI.head]).invert();
      const aL = _v3.copy(st.headAcc).applyQuaternion(_q);
      const pitchT = w.dash * 1.15 + Math.min(v, 2.5) * 0.08 + w.push * 0.2 + w.strain * 0.3 + barkEnv * 0.2 + ws * 1.05 + w.blow * 0.9 + w.yuck * 0.7
        + w.lick * 0.22 + w.licked * (0.3 + 0.55 * lTouch) + w.slide * 1.25 + st.mud * 0.18 + wEnv * 0.45 + strainK * 0.35 + xRoll * 0.6 + sneezeO * 0.5 - wow * 0.25 + sk * 0.3 + growl * 0.25;
      const outT = 0.06 + w.dash * 0.35 + celHappy * 0.12 + barkEnv * 0.25 - w.sit * 0.03 - ws * 0.12 + shkEnv * (0.45 + 0.4 * Math.sin(shakePh - 0.4)) + w.aim * 0.2 - w.yuck * 0.05
        + w.lick * 0.06 + w.licked * 0.2 * lTouch + w.slide * 0.15 + squat * 0.08 + xRoll * 0.3 + glee * 0.12 + wow * 0.15 + glad * 0.08;
      const sub = dt > 0.02 ? 2 : 1;
      const h = dt / sub;
      for (let ei = 0; ei < 2; ei++) {
        const E = st.ears[ei];
        const se = ei === 0 ? 1 : -1;
        for (let k = 0; k < sub; k++) {
          const ap = 160 * (pitchT - E.p) - 9 * E.pv + aL.z * 0.12;
          const ao = 140 * (outT - E.o) - 8 * E.ov - aL.y * 0.1 - se * aL.x * 0.1;
          E.pv += ap * h; E.p += E.pv * h;
          E.ov += ao * h; E.o += E.ov * h;
        }
        E.p = clamp(E.p, -0.5, 1.5);
        E.o = clamp(E.o, -0.12, 1.1);
        qE(Lq[BI[ei === 0 ? 'earL0' : 'earR0']], E.p * 0.8, 0, se * E.o);
        qE(Lq[BI[ei === 0 ? 'earL1' : 'earR1']], E.p * 0.35 + E.pv * 0.012, 0, se * (E.o * 0.35 + E.ov * 0.01));
      }
    }

    // ---------------- cauda
    const happy = Math.max(celHappy, w.carry * 0.7, barkEnv, w.proud * 0.9, w.lick * 0.95, w.licked * 0.75, wEnv * 0.5, wTouch, happyX, sk * 0.15);
    const wagFreqT = lerp(lerp(2.0, 3.2, st.move), 7, happy) * (1 - w.sit * 0.5) * (1 - actionsBusy * 0.5 * (1 - w.pre));
    const wagAmpT = lerp(lerp(0.22, 0.16, st.move), 0.55, happy) * (1 - w.sit * 0.6) * (1 - (w.push + w.strain) * 0.7) * (1 - ws * 0.8) * (1 - squat * 0.95) * (1 - xRoll * 0.6) + w.bow * 0.2;
    st.wagFreq = damp(st.wagFreq, wagFreqT, 3);
    st.wagAmp = damp(st.wagAmp, wagAmpT, 3);
    st.wagPhase += st.wagFreq * dt * TAU;
    const raiseT = w.sit * -0.55 + (w.push + w.strain + w.sniff) * 0.15 + happy * 0.12 - w.dash * 0.35 + w.bow * 0.2 - ws * 0.95 + w.jump * 0.3 + w.proud * 0.35 + w.aim * 0.15 - w.yuck * 0.2
      + w.slide * 0.25 - st.mud * 0.35 + wEnv * 0.35 + squat * 0.42 + scratchK * 0.3 + xDig * 0.3 + w.pre * 0.12 + glee * 0.15 + wow * 0.25 + glad * 0.12
      - xRoll * 0.75 // rolando: o rabo vai para o lado da barriga (de costas, fica para o ar)
      - sk * st.shoveTheta * 0.9; // de pé: o rabo fica para fora, equilibrando
    st.tailRaise = damp(st.tailRaise, raiseT, 4);
    for (let k = 0; k < 4; k++) {
      const wag = Math.sin(st.wagPhase - k * 0.7) * st.wagAmp * (k === 0 ? 1 : 0.3) + shk(4 + k * 0.6) * (k === 0 ? 0.5 : 0.25);
      qE(Lq[BI.tail0 + k], k === 0 ? -st.tailRaise * 0.8 : -st.tailRaise * 0.12 + w.dash * 0.1, wag, k === 0 ? 0 : wag * 0.2);
    }

    // ---------------- piscadas
    st.blinkT -= dt;
    if (st.blinkT <= 0) {
      st.blink = 0.0001;
      st.blinkT = 1.8 + Math.random() * 3.8;
      if (Math.random() < 0.18) st.blinkT = 0.28; // piscada dupla
    }
    let lid = 0;
    if (st.blink > 0) {
      st.blink += dt;
      const u = st.blink / 0.16;
      if (u >= 1) st.blink = 0;
      else lid = Math.sin(Math.PI * u);
    }
    const squint = celHappy * 0.25 + w.strain * 0.3 + w.proud * 0.45 + w.yuck * 0.55 + w.blow * 0.4 + growl * 0.35
      + w.lick * (0.3 + 0.35 * lTouch * (1 - ls)) + w.licked * (0.55 + 0.45 * lTouch) + w.slide * 0.2 + wTouch * 0.35
      + effort * 0.55 + strainK * 0.15 + reliefK * 0.8 + scratchK * 0.15 + xEat * 0.25 + xRoll * 0.4 + sneezeO * 0.9
      + glee * 0.35 + glad * 0.4;
    const wide = 1 + ws * 0.22 + wow * 0.28;
    const lidK = lid * (1 - ws);
    for (const e of eyes) e.scale.set(wide, wide * Math.max(0.08, 1 - Math.max(lidK, squint * (1 - ws) * (1 - wow))), wide);

    // ---------------- aplica nos ossos
    for (let i = 0; i < nB; i++) {
      bones[i].quaternion.copy(Lq[i]);
      if (i > 0) bones[i].position.copy(restOff[i]).add(posOff[i]);
    }

    // rolar: o ponto mais baixo do corpo (tronco, cabeça, orelhas, patas e rabo) encosta no chão, ou no monte
    // (jumpY), em qualquer ângulo; entra e sai suave nas pontas, em pé, onde as patas já estão no chão
    if (xKind === 'roll' && contacts.length) {
      const cw = sstep(0, 0.03, xk) * (1 - sstep(0.97, 1, xk));
      inner.position.y += (jumpY - lowestY()) * cw;
    }

    // pelo: vento nas pontas durante a arrancada
    furMat.userData.uniforms.uWind.value.set(shk(1.5) * 0.9, 0.12 * w.dash + 0.1 * w.slide, -0.9 * w.dash - v * 0.04 - 0.9 * w.slide);

    // sombra de contato e marcador
    const rp = Wp[0];
    const cs = Math.cos(st.spin), sn = Math.sin(st.spin);
    shadow.position.x = rp.x * cs + rp.z * sn;
    shadow.position.z = -rp.x * sn + rp.z * cs - w.sit * 0.03 * s + inner.position.z * 0.6;
    shadow.rotation.y = st.spin;
    const lift01 = clamp(st.hop / (0.1 * s), 0, 1);
    const liftJ = clamp((jumpY + wallLiftY * 0.7) / 0.5, 0, 1); // sombra do pulo: fica no chão, menor e mais clara
    shadow.scale.set(shadowBase.x * (1 - lift01 * 0.3) * (1 - liftJ * 0.4), 1, shadowBase.z * (1 - w.sit * 0.25) * (1 - lift01 * 0.3) * (1 - liftJ * 0.4));
    shadow.material.opacity = 0.55 * (1 - lift01 * 0.5) * (1 - liftJ * 0.5);
    const hp = Wp[BI.head];
    markerAnchor.position.set(
      lerp(markerAnchor.position.x, hp.x * cs + hp.z * sn, 0.2),
      cfg.visual.headTop + 0.14 + st.hop + jumpY + wallLiftY + shoveLiftY,
      lerp(markerAnchor.position.z, -hp.x * sn + hp.z * cs, 0.2),
    );
  }

  return { st, update };
}
