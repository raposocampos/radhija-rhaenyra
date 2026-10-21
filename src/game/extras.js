// Extras escondidos. Nada no jogo os anuncia (nenhuma dica, menu, tela de controles, conquista ou texto); a nota
// técnica fica em docs/ARQUITETURA.md ("Extras") para ninguém remover por engano.
//  • Cocô: código 'KeyC' (tecla C; R3 no controle). Só depois de pegar todos os ossinhos da fase e uma vez por
//    tentativa (reiniciar libera de novo). A dog ativa, parada no chão e sem nada na boca, fareja o chão e anda uma
//    voltinha de verdade (um círculo pequeno que caiba ali, sem atravessar nada; sem espaço, a volta encurta ou ela
//    só ajeita a direção), agacha, faz força, solta um cocozinho de desenho (src/world/poop.js) e cava com as
//    traseiras; a irmã por perto vira a cara. Depois vem a recompensa: o cocô brilha dourado com um jingle, ela sai em
//    zoomies (ou, sem espaço, dá um pulinho virando para ele), faz a reverência de brincadeira, pula de alegria e fica
//    toda orgulhosa; a irmã por perto se espanta e manda coraçõezinhos.
//  • Animações do cenário: E perto de um ponto da fase (EXTRAS na definição da fase), quando a fase não usou o E:
//    beber, comer, cavar, cheirar e espirrar, focinhar a bola, rolar, balançar, levar um esguicho. Valem sempre.
// Tudo avança por dt (pausa congela). O núcleo pergunta lockFor(nome) antes do puzzle e passa poopPre/poopK/party/
// cheer/extra para a animação (src/dogs/dogAnimation.js). Eventos: extra:start {kind}, extra:sniff, extra:strain,
// extra:plop, extra:relief, extra:scratch, extra:secret, extra:zoom, extra:skid, extra:yip, extra:bounce, extra:cheer,
// extra:end, extra:lap, extra:crunch, extra:dig, extra:sneeze, extra:nudge, extra:roll, extra:swing, extra:hop,
// extra:spurt (sempre com x, z), dog:land e dog:yuck (a irmã).
import { createPoop } from '../world/poop.js';
import { POOP_DROP, POOP_KICKS, SNEEZE_AT, NUDGE_AT, DIG_RATE } from '../dogs/dogAnimation.js';
import { buildPath, along, lastOf, speedProfile } from './walkPath.js';

/** Agachada (s), depois da voltinha. */
export const POOP_TIME = 4.8;
/** Voltinha antes de agachar: fareja parada, anda um círculo pequeno farejando o chão e se acomoda. */
const CIRCLE = Object.freeze({
  sniff: 0.45, // s farejando parada antes de sair andando
  settle: 0.32, // s parada no fim, antes de agachar
  radius: 0.5, // × comprimento da dog (Radhija 0,30 m; Rhaenyra 0,36 m); fecha de 1,1× a 0,9× ao longo da volta
  speed: Object.freeze({ small: 1.05, large: 1.15 }), // m/s no meio da volta (a passo, farejando)
});
/** Teto da voltinha (s): a mais longa que o planejamento escolhe. */
export const POOP_PRE = 4.2;
/**
 * Comemoração (s, contados do fim da cavada): pausa até o brilho (beat), zoomies ou pulinho virando (turn), reverência
 * (bow), pulinhos (hops × hop) e orgulhosa (proud). cheer: até onde a irmã vê (m).
 */
export const PARTY = Object.freeze({ beat: 0.15, turn: 0.62, bow: 0.82, hop: 0.34, hops: 2, proud: 0.75, cheer: 6 });
/** Teto da comemoração (s). */
export const PARTY_MAX = 5.2;
/** A irmã dá espaço durante o cocô: se está mais perto que isto (m), se afasta andando (m/s) e espera. */
const SPACE = Object.freeze({ r: 1.45, speed: 0.95 });
/** Zoomies: velocidade (m/s) e raios da curva (m) que ela tenta, do maior para o menor. */
const ZOOM = Object.freeze({ small: { v: 3.0, R: [0.55, 0.45] }, large: { v: 2.7, R: [0.62, 0.5] } });
/** Tempo que o cocô leva para sair (s), a partir de POOP_DROP. */
const POOP_OUT = 0.6;
/** Aliviada, ela dá um passinho à frente antes de cavar (as patadas não acertam o cocô). */
const STEP = { from: 0.61, to: 0.7, dist: 0.2 };
/** Duração de cada animação do cenário (s). */
export const EXTRA_TIME = Object.freeze({ drink: 3.0, eat: 3.0, dig: 2.6, sneeze: 2.4, nudge: 1.7, roll: 3.8, swing: 6.0, spurt: 2.4 });
const STRAIN_AT = [0.2, 0.31, 0.42];
const RELIEF_AT = 0.57;
const YUCK = { from: 0.45, to: 0.78, r: 4 };
const ALIGN_T = 0.25; // s para chegar ao ponto e virar para o objeto
const TAU = Math.PI * 2;
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mod = (a, m) => ((a % m) + m) % m;

/**
 * Quanto girar (rad, entre a e b) para terminar de perfil para a câmera (view = direção da câmera para a dog): a
 * agachada se lê melhor de lado. Sem câmera, o meio do intervalo.
 */
function profileTurn(yaw, side, view, a, b) {
  let best = (a + b) / 2;
  let bd = Infinity;
  for (const target of [view + Math.PI / 2, view - Math.PI / 2]) {
    const ang = a + mod(side * (target - yaw) - a, TAU);
    const d = Math.abs(ang - (a + b) / 2);
    if (ang <= b + 1e-6 && d < bd) {
      best = ang;
      bd = d;
    }
  }
  return best;
}

/** @typedef {import('../types').ExtraSpot} ExtraSpot */

/**
 * @param {{ emit: import('../types').GameEmit, ctrls: Record<import('../types').DogName, import('../types').DogController>,
 *   carries: (name: import('../types').DogName) => boolean, camera?: { position: { x: number, z: number } } | null,
 *   resolve?: (x: number, z: number, r: number, size: import('../types').DogSize) => { x: number, z: number },
 *   overlaps?: (x: number, z: number, r: number, size: import('../types').DogSize) => boolean,
 *   locked?: (name: import('../types').DogName) => boolean, staying?: (name: import('../types').DogName) => boolean,
 *   focus?: (x: number, z: number, opts: any) => void }} opts
 *   overlaps: o círculo encosta num colisor (a voltinha e os zoomies só vão por onde cabe); locked: a fase está
 *   movendo a dog (pose roteirizada): a irmã não para para reagir; staying: com o Fica, a irmã não sai do lugar;
 *   focus: plano de câmera de perto (o brilho do cocô).
 */
export function createExtras({ emit, ctrls, carries, camera = null, resolve = (x, z) => ({ x, z }), overlaps = () => false, locked = () => false, staying = () => false, focus = () => {} }) {
  /** @type {ExtraSpot[]} */
  let spots = [];
  /** @type {import('three').Object3D | null} */
  let root = null;
  /** @type {any} */
  let hooks = {};
  const fresh = () => ({
    used: false,
    /** @type {any} sequência do cocô em andamento (ver tryPoop) */
    poop: null,
    /** @type {null | { who: import('../types').DogName, spot: ExtraSpot, t: number, dur: number, x0: number, z0: number, yaw0: number, x: number, z: number, yaw: number, y: number, marks: Set<string>, n: number, slope: number, action: string }} */
    act: null,
    /** @type {ReturnType<typeof createPoop>[]} */
    poops: [],
  });
  let S = fresh();

  const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
  const grounded = (c) => !(c.jumpT > 0) && !(c.wallDur > 0) && (c.y || 0) < 0.02 && !(c.dashT > 0);
  /** Parada (no máximo um passinho): os extras não arrancam a dog do meio de uma corrida. */
  const still = (c) => Math.abs(c.animSpeed || 0) < 0.45;
  const busy = (n) => S.poop?.who === n || S.act?.who === n;
  /** Marca um momento da sequência (uma vez). */
  const once = (set, key, cond) => {
    if (!cond || set.has(key)) return false;
    set.add(key);
    return true;
  };

  // ------------------------------------------------------------------ cocô: onde cabe
  /** A dog c cabe em (x, z): sem colisor e sem encostar na irmã. */
  function roomy(c, x, z) {
    if (overlaps(x, z, c.r, c.size)) return false;
    const o = ctrls[other(c.name)];
    return !o || Math.hypot(x - o.x, z - o.z) > c.r + o.r + 0.04;
  }
  /** O caminho cabe inteiro (os primeiros `skip` m são onde ela já está); avoid: um círculo a não pisar (o cocô). */
  function pathFits(c, P, skip = 0.03, avoid = null) {
    for (let i = 0; i < P.s.length; i += 2) {
      if (P.s[i] < skip) continue;
      if (!roomy(c, P.x[i], P.z[i])) return false;
      if (avoid && Math.hypot(P.x[i] - avoid.x, P.z[i] - avoid.z) < avoid.r) return false;
    }
    return true;
  }
  /** Onde o cocô cai com a dog em (x, z) olhando para yaw: atrás dela (back × raio; side: para o lado, × raio). */
  const poopSpot = (c, x, z, yaw, back = 1.45, side = 0) => ({
    x: x - Math.sin(yaw) * c.r * back + Math.cos(yaw) * c.r * side,
    z: z - Math.cos(yaw) * c.r * back - Math.sin(yaw) * c.r * side,
  });
  /**
   * O chão livre mais perto de atrás dela (encostada em algo, o cocô não cai dentro dele): atrás, um pouco para os
   * lados e, num cantinho apertado, em volta dela. null: nenhum chão livre ali (o cocô nem começa).
   */
  function freePoopSpot(c, x, z, yaw) {
    for (const [back, side] of [[1.45, 0], [1.45, 0.6], [1.45, -0.6], [1.2, 0.9], [1.2, -0.9], [1.2, 0]]) {
      const spot = poopSpot(c, x, z, yaw, back, side);
      if (!overlaps(spot.x, spot.z, 0.05, c.size)) return spot;
    }
    for (const a of [0.6, -0.6, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
      for (const d of [1.5, 1.9]) {
        const spot = poopSpot(c, x, z, yaw, d * Math.cos(a), d * Math.sin(a));
        if (!overlaps(spot.x, spot.z, 0.05, c.size)) return spot;
      }
    }
    return null;
  }
  /**
   * A voltinha que cabe: um círculo pequeno (de 0,8 a 1,3 volta, terminando de perfil para a câmera); sem espaço, um
   * raio menor, meia volta ou só um quarto de volta para ajeitar a direção. → { path, side, prof } ou null (nem isso
   * cabe: ela fareja parada e agacha onde está).
   */
  function planCircle(c) {
    const R = CIRCLE.radius * (c.cfg?.visual?.length ?? 0.6);
    const view = camera ? Math.atan2(c.x - camera.position.x, c.z - camera.position.z) : c.yaw + Math.PI / 2;
    const tries = [[R, 0.8, 1.3], [R * 0.8, 0.8, 1.3], [R * 0.62, 0.55, 1.05], [R * 0.48, 0.3, 0.8], [R * 0.36, 0.12, 0.62]];
    for (const [r, a, b] of tries) {
      const mid = ((a + b) / 2) * TAU;
      const sides = [1, -1].map((side) => ({ side, ang: profileTurn(c.yaw, side, view, a * TAU, b * TAU) }))
        .sort((p, q) => Math.abs(p.ang - mid) - Math.abs(q.ang - mid));
      for (const { side, ang } of sides) {
        const k0 = side / (r * 1.1);
        const k1 = side / (r * 0.9);
        const path = buildPath(c.x, c.z, c.yaw, [{ len: ang / ((Math.abs(k0) + Math.abs(k1)) / 2), k0, k1 }]);
        const end = lastOf(path);
        const spot = poopSpot(c, end.x, end.z, end.yaw);
        if (!pathFits(c, path) || overlaps(spot.x, spot.z, 0.05, c.size)) continue;
        const speed = c.size === 'large' ? CIRCLE.speed.large : CIRCLE.speed.small;
        return { path, side, prof: speedProfile(path.len, speed, 0.22, 0.3) };
      }
    }
    return null;
  }
  /**
   * Zoomies: ela dispara para a frente (o cocô fica para trás), faz a curva e volta correndo, freando de frente para o
   * cocô. O caminho precisa caber (sem colisor, sem a irmã e sem passar por cima do cocô). Entre os que cabem, o que
   * termina com ela de frente para a câmera. → { path, side, prof } ou null.
   */
  function planZoom(c, P) {
    const Z = c.size === 'large' ? ZOOM.large : ZOOM.small;
    const stop = c.r + 0.26; // freia a esta distância do cocô
    const poop = { x: P.px, z: P.pz, r: c.r + 0.07 };
    const found = [];
    for (const Rz of Z.R) {
      for (const side of [1, -1]) {
        const k = side / Rz;
        const segs = (La) => [{ len: 0.18, k0: 0, k1: 0 }, { len: 0.22, k0: 0, k1: k }, { len: La, k0: k, k1: k }, { len: 0.22, k0: k, k1: 0 }];
        // o arco que deixa ela de frente para o cocô no fim da curva: o erro de mira troca de sinal
        const aim = (La) => {
          const e = lastOf(buildPath(c.x, c.z, c.yaw, segs(La)));
          return wrap(Math.atan2(poop.x - e.x, poop.z - e.z) - e.yaw) * side;
        };
        let a = 0.6 * Math.PI * Rz;
        let ea = aim(a);
        let La = -1;
        for (let b = a + 0.04; b < 1.8 * Math.PI * Rz; b += 0.04) {
          const eb = aim(b);
          if (ea > 0 && eb <= 0 && ea - eb < Math.PI) {
            La = a + ((b - a) * ea) / (ea - eb);
            break;
          }
          a = b;
          ea = eb;
        }
        if (La < 0) continue;
        const e = lastOf(buildPath(c.x, c.z, c.yaw, segs(La)));
        const L3 = Math.hypot(poop.x - e.x, poop.z - e.z) - stop;
        if (L3 < 0.1) continue;
        const path = buildPath(c.x, c.z, c.yaw, [...segs(La), { len: L3, k0: 0, k1: 0 }]);
        if (!pathFits(c, path, 0.03, poop)) continue;
        // no fim ela fica de frente para a câmera, com o cocô à vista entre as duas (de costas, ela o esconderia)
        const end = lastOf(path);
        const face = camera ? Math.cos(end.yaw - Math.atan2(camera.position.x - end.x, camera.position.z - end.z)) : 0;
        found.push({ path, side, face, prof: speedProfile(path.len, Z.v, 0.16, 0.26) });
      }
      if (found.length) break;
    }
    found.sort((p, q) => q.face - p.face);
    return found[0] || null;
  }

  // ------------------------------------------------------------------ cocô
  /**
   * Tenta começar o cocô com a dog ativa c. allTreats: pegou todos os ossinhos da fase. free: nada travando a dog
   * (puzzle, Lambe-Lambe, superbafo). → true se começou.
   */
  function tryPoop(c, { allTreats, free = true }) {
    if (S.used || S.poop || S.act || !allTreats || !free) return false;
    if (!grounded(c) || !still(c) || carries(c.name)) return false;
    const plan = planCircle(c);
    // sem a voltinha ela agacha onde está: precisa de chão livre por perto para o cocô
    if (!plan && !freePoopSpot(c, c.x, c.z, c.yaw)) return false;
    S.used = true;
    const walk = plan ? plan.prof.T : 0.5; // sem espaço nem para ajeitar a direção: fareja mais um pouquinho
    const pre = CIRCLE.sniff + walk + CIRCLE.settle;
    S.poop = {
      who: c.name, phase: 'pre', t: -pre, pre, walk, plan, x0: c.x, z0: c.z,
      x: c.x, z: c.z, yaw: c.yaw, step: 0, px: c.x, pz: c.z, marks: new Set(), kick: 0,
      /** @type {any} */ party: null, cheer: -1, cheerOn: false,
      out: { x: c.x, z: c.z, yaw: c.yaw, k: 0, d: 0, v: 0 },
    };
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = 0;
    emit('extra:start', { kind: 'poop', name: c.name, x: c.x, z: c.z });
    return true;
  }
  function stepPoop(dt) {
    const P = S.poop;
    if (!P) return;
    const c = ctrls[P.who];
    P.t += dt;
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = 0;
    c.yawRate = 0;
    if (P.t < 0) stepCircle(P, c);
    else if (P.t < POOP_TIME) stepSquat(P, c);
    else stepParty(P, c, dt);
  }
  /** Voltinha: fareja parada, anda o círculo (o passo acompanha a velocidade de verdade) e para. */
  function stepCircle(P, c) {
    const tau = P.t + P.pre;
    const walkT = tau - CIRCLE.sniff;
    const o = P.out;
    if (P.plan) {
      P.plan.prof.at(Math.min(Math.max(0, walkT), P.walk), o);
      along(P.plan.path, o.d, o);
      if (walkT > 0 && walkT < P.walk && overlaps(o.x, o.z, c.r * 0.97, c.size)) {
        // algo que se mexe entrou no caminho: ela para onde está e se acomoda ali
        P.plan = null;
        P.x0 = c.x;
        P.z0 = c.z;
        P.t = Math.max(P.t, -CIRCLE.settle);
        return;
      }
      c.x = o.x;
      c.z = o.z;
      c.yaw = wrap(o.yaw);
      if (walkT > 0 && walkT < P.walk) {
        c.animSpeed = o.v;
        c.yawRate = o.k * o.v;
      }
    } else {
      c.x = P.x0;
      c.z = P.z0;
    }
    // fungadas: parada, no meio da volta e perto do fim
    const k = walkT / P.walk;
    if (once(P.marks, 'sniff', tau > 0.05)) emit('extra:sniff', { name: P.who, x: c.x, z: c.z });
    if (P.plan && once(P.marks, 'sniff2', k > 0.42)) emit('extra:sniff', { name: P.who, x: c.x, z: c.z });
    if (P.plan && once(P.marks, 'sniff3', k > 0.8)) emit('extra:sniff', { name: P.who, x: c.x, z: c.z });
  }
  /** Agachada: travada no lugar onde a voltinha terminou (o passinho à frente só o que couber). */
  function stepSquat(P, c) {
    if (once(P.marks, 'squat', true)) {
      P.phase = 'squat';
      P.x = c.x;
      P.z = c.z;
      P.yaw = c.yaw;
      const fx = Math.sin(P.yaw);
      const fz = Math.cos(P.yaw);
      P.step = [STEP.dist, STEP.dist / 2].find((d) => roomy(c, P.x + fx * d, P.z + fz * d)) ?? 0;
    }
    c.yaw = P.yaw;
    const p = Math.min(1, P.t / POOP_TIME);
    // o passinho à frente (as patas andam: animSpeed acompanha o passo)
    const su = Math.min(1, Math.max(0, (p - STEP.from) / (STEP.to - STEP.from)));
    const se = su * su * (3 - 2 * su);
    c.x = P.x + Math.sin(P.yaw) * P.step * se;
    c.z = P.z + Math.cos(P.yaw) * P.step * se;
    if (su > 0 && su < 1) c.animSpeed = (P.step * 6 * su * (1 - su)) / ((STEP.to - STEP.from) * POOP_TIME);
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const back = c.r * 1.45;
    STRAIN_AT.forEach((k, i) => { if (once(P.marks, `s${i}`, p >= k)) emit('extra:strain', { name: P.who, x: c.x, z: c.z, n: i }); });
    if (once(P.marks, 'plop', p >= POOP_DROP)) {
      const spot = freePoopSpot(c, P.x, P.z, P.yaw) ?? poopSpot(c, P.x, P.z, P.yaw);
      P.px = spot.x;
      P.pz = spot.z;
      dropPoop(spot.x, spot.z);
      emit('extra:plop', { name: P.who, x: spot.x, z: spot.z });
    }
    if (once(P.marks, 'relief', p >= RELIEF_AT)) emit('extra:relief', { name: P.who, x: c.x, y: c.cfg?.visual?.headTop ?? 0.5, z: c.z });
    // patadas de cavar: terrinha voando para trás, do lado de cada pata
    const kf = ((p - POOP_KICKS.from) / (POOP_KICKS.to - POOP_KICKS.from)) * POOP_KICKS.n;
    const ki = Math.floor(kf + 0.72); // a terrinha sai no meio da patada
    if (kf > -0.7 && ki > P.kick && ki <= POOP_KICKS.n) {
      P.kick = ki;
      const side = (ki - 1) % 2 === 0 ? 1 : -1;
      const sx = -fz * side * c.r * 0.45;
      const sz = fx * side * c.r * 0.45;
      emit('extra:scratch', { name: P.who, x: c.x - fx * back * 0.9 + sx, z: c.z - fz * back * 0.9 + sz, dirX: -fx, dirZ: -fz });
    }
  }
  /** Começa a comemoração: zoomies se couberem (senão o pulinho virando) e a linha do tempo do resto. */
  function startParty(P, c) {
    P.phase = 'party';
    P.x = c.x;
    P.z = c.z;
    P.yaw = c.yaw;
    const zoom = planZoom(c, P);
    // pulinho virando: gira para o lado que mostra a carinha para a câmera no meio do pulo
    const toCam = camera ? Math.atan2(camera.position.x - c.x, camera.position.z - c.z) : c.yaw;
    const side = Math.cos(c.yaw + Math.PI / 2 - toCam) >= Math.cos(c.yaw - Math.PI / 2 - toCam) ? 1 : -1;
    const m1 = PARTY.beat + (zoom ? zoom.prof.T : PARTY.turn);
    const bow0 = m1 + 0.04;
    const hop0 = bow0 + PARTY.bow;
    const proud0 = hop0 + PARTY.hop * PARTY.hops;
    const big = c.size === 'large';
    P.party = {
      zoom, side, m1, bow0, hop0, proud0, end: proud0 + PARTY.proud, yaw0: c.yaw, action: 'none', air: '',
      hopH: big ? 0.15 : 0.13, bounceH: big ? 0.065 : 0.055,
      pose: { glee: 0, bow: 0, hop: 0, air: -1, jump: 0, brace: 0, zoom: 0 },
    };
  }
  function stepParty(P, c, dt) {
    if (!P.party) startParty(P, c);
    const Y = P.party;
    const tau = P.t - POOP_TIME;
    const pose = Y.pose;
    pose.glee = smooth(tau / 0.3) * (1 - smooth((tau - (Y.end - 0.4)) / 0.4));
    pose.bow = 0;
    pose.hop = 0;
    pose.air = -1;
    pose.jump = 0;
    pose.brace = 0;
    pose.zoom = 0;
    Y.action = 'none';
    // a recompensa: o cocô brilha dourado com o jingle; a irmã por perto vê
    if (once(P.marks, 'secret', tau >= PARTY.beat)) {
      S.poops.at(-1)?.shine();
      emit('extra:secret', { name: P.who, x: P.px, y: 0.08, z: P.pz });
      // a câmera chega um pouco mais perto do cocô brilhando (os zoomies cabem no quadro) e volta
      focus(P.px, P.pz, { hold: Math.max(1.4, Y.m1 - PARTY.beat), inT: 0.6, outT: 0.9, scale: 0.78, y: 0.2 });
      const o = ctrls[other(P.who)];
      if (o && grounded(o) && Math.hypot(o.x - c.x, o.z - c.z) < PARTY.cheer) P.cheer = tau;
    }
    if (P.cheer >= 0 && P.cheerOn && once(P.marks, 'cheer', tau - P.cheer >= 0.55)) {
      const o = ctrls[other(P.who)];
      emit('extra:cheer', { name: o.name, x: o.x, z: o.z });
    }
    // 1) zoomies (acelera, faz a curva inclinada e freia de frente para o cocô) ou o pulinho virando para ele
    const mt = tau - PARTY.beat;
    if (Y.zoom && mt > 0) {
      const Z = Y.zoom;
      const o = P.out;
      Z.prof.at(Math.min(mt, Z.prof.T), o);
      along(Z.path, o.d, o);
      if (mt < Z.prof.T && overlaps(o.x, o.z, c.r * 0.97, c.size)) {
        // algo que se mexe entrou no caminho: freia ali mesmo e a comemoração segue dali
        const left = Z.prof.T - mt;
        Y.m1 -= left;
        Y.bow0 -= left;
        Y.hop0 -= left;
        Y.proud0 -= left;
        Y.end -= left;
        Y.zoom = null;
        Y.halted = true;
        emit('extra:skid', { name: P.who, x: c.x, z: c.z, dirX: Math.sin(c.yaw), dirZ: Math.cos(c.yaw) });
      } else {
        c.x = o.x;
        c.z = o.z;
        c.yaw = wrap(o.yaw);
      }
      if (Y.zoom && mt < Z.prof.T) {
        const u = mt / Z.prof.T;
        c.animSpeed = o.v;
        c.yawRate = o.k * o.v;
        pose.zoom = 1;
        pose.brace = smooth((u - 0.8) / 0.09) * (1 - smooth((u - 0.95) / 0.05));
        if (o.v > 1.5) Y.action = 'dash';
        if (once(P.marks, 'zoom', true)) emit('extra:zoom', { name: P.who, x: c.x, z: c.z, dur: Z.prof.T });
        if (once(P.marks, 'skid', u >= 0.8)) emit('extra:skid', { name: P.who, x: c.x, z: c.z, dirX: Math.sin(c.yaw), dirZ: Math.cos(c.yaw) });
      }
    } else if (!Y.zoom && !Y.halted && mt > 0 && mt < PARTY.turn) {
      // agacha, pula girando meia volta no ar e pousa de frente para o cocô
      const air = (mt - 0.1) / 0.4;
      if (air > 0 && air < 1) {
        pose.air = air;
        pose.hop = 4 * Y.hopH * air * (1 - air);
        pose.jump = 1; // pulo de verdade: patas encolhidas, sem passo no ar
      }
      const yaw = wrap(Y.yaw0 + Y.side * Math.PI * smooth(air));
      c.yawRate = wrap(yaw - c.yaw) / Math.max(dt, 1e-4);
      c.yaw = yaw;
    }
    // 2) reverência de brincadeira para o cocô, com um latidinho feliz
    const bt = (tau - Y.bow0) / PARTY.bow;
    if (bt > 0 && bt < 1) {
      pose.bow = smooth(bt / 0.2) * (1 - smooth((bt - 0.72) / 0.28));
      if (once(P.marks, 'yip', bt >= 0.32)) emit('extra:yip', { name: P.who, x: c.x, z: c.z });
    }
    // 3) dois pulinhos de alegria (o segundo um pouco mais baixo)
    const ht = tau - Y.hop0;
    if (ht > 0 && ht < PARTY.hop * PARTY.hops) {
      const i = Math.floor(ht / PARTY.hop);
      const air = ((ht - i * PARTY.hop) / PARTY.hop - 0.16) / 0.66;
      if (air > 0 && air < 1) {
        pose.air = air;
        pose.hop = 4 * Y.bounceH * (i ? 0.85 : 1) * air * (1 - air);
        pose.jump = 0.7; // pulinho: a pose do pulo, mais contida
      }
    }
    // decolagem e pouso (som e poeirinha)
    const up = pose.air >= 0;
    if (up && !Y.air) {
      Y.air = ht > 0 ? 'bounce' : 'turn';
      if (Y.air === 'turn') emit('extra:hop', { name: P.who, x: c.x, z: c.z });
    } else if (!up && Y.air) {
      emit(Y.air === 'turn' ? 'dog:land' : 'extra:bounce', { name: P.who, x: c.x, z: c.z });
      Y.air = '';
    }
    // 4) toda orgulhosa
    if (tau >= Y.proud0) Y.action = 'proud';
    if (tau >= Y.end) {
      emit('extra:end', { kind: 'poop', name: P.who, x: c.x, z: c.z });
      S.poop = null;
    }
  }
  // cocozinho do tamanho da dog (a Radhija é menor)
  const who0 = () => S.poop?.who ?? 'radhija';
  const c0Scale = (n) => (n === 'rhaenyra' ? 0.7 : 0.6);
  function dropPoop(x, z) {
    const poop = createPoop({ scale: c0Scale(who0()) });
    poop.object.position.set(x, 0, z);
    // a carinha olha para a câmera
    const cx = camera?.position.x ?? x;
    const cz = camera?.position.z ?? z + 5;
    poop.object.rotation.y = Math.atan2(cx - x, cz - z);
    root?.add(poop.object);
    poop.appear(POOP_OUT);
    S.poops.push(poop);
  }
  /**
   * Trava da dog que está no cocô e da irmã. A irmã dá espaço o tempo todo: perto demais, se afasta andando (com
   * colisão, pelo núcleo) até SPACE.r e espera ali, sem seguir a outra; na hora do cocô vira a cara; na comemoração
   * para e olha.
   */
  function poopLock(name) {
    const P = S.poop;
    if (!P) return null;
    const c = ctrls[name];
    if (P.who === name) {
      const action = P.t < 0 ? (P.t + P.pre < CIRCLE.sniff + P.walk * 0.88 ? 'sniff' : 'none') : P.party ? P.party.action : 'none';
      return { action, faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true };
    }
    P.cheerOn = false;
    if (name !== other(P.who) || locked(name)) return null;
    const w = ctrls[P.who];
    if (P.party && P.cheer >= 0) {
      // vê a irmã comemorar: para, vira para ela e acompanha
      P.cheerOn = true;
      return { action: 'none', faceX: w.x, faceZ: w.z };
    }
    const ax = c.x - w.x;
    const az = c.z - w.z;
    const dw = Math.hypot(ax, az) || 1e-6;
    // perto demais: se afasta andando (na comemoração ela já está longe e só espera; com o Fica, não sai do lugar)
    const move = !P.party && !staying(name) && dw < SPACE.r ? { dx: ax / dw, dz: az / dw, speed: SPACE.speed } : undefined;
    const p = P.t / POOP_TIME;
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    if (P.phase === 'squat' && p > YUCK.from && p < YUCK.to && d < YUCK.r) {
      if (!P.marks.has('yuck')) {
        P.marks.add('yuck');
        emit('dog:yuck', { name, x: c.x, z: c.z });
      }
      const bx = c.x - P.px;
      const bz = c.z - P.pz;
      const L = Math.hypot(bx, bz) || 1;
      return { action: 'yuck', faceX: c.x + (bx / L) * 2, faceZ: c.z + (bz / L) * 2, move };
    }
    // espera onde está, olhando para a frente (ela se afastou: fica de costas, dando privacidade)
    return { action: 'none', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), move };
  }

  // ------------------------------------------------------------------ animações do cenário
  /** O ponto mais perto que a dog c alcança (de frente e dentro do raio), ou null. */
  function spotFor(c, flags) {
    let best = null;
    let bd = Infinity;
    for (const sp of spots) {
      if (sp.size && sp.size !== c.size) continue;
      if (sp.when && !flags?.[sp.when]) continue;
      const pos = spotPos(sp);
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d > (sp.r ?? 0.6) || d >= bd) continue;
      const face = sp.face ?? pos;
      const want = Math.atan2(face.x - c.x, face.z - c.z);
      if (d > 0.08 && Math.abs(wrap(want - c.yaw)) > 1.35) continue; // de costas não vale
      best = sp;
      bd = d;
    }
    return best;
  }
  /** Posição atual do ponto (a bola anda). */
  function spotPos(sp) {
    if (sp.kind === 'nudge' && hooks.ball) return { x: hooks.ball.x, z: hooks.ball.z };
    return { x: sp.x, z: sp.z };
  }
  /**
   * E perto de um ponto do cenário (a fase não usou o E). flags: navFlags do puzzle; free: nada em curso na dog
   * (superbafo mirando ou soprando, Lambe-Lambe). Com a boca cheia não vale (comer, beber, cheirar). → true se começou.
   */
  function interact(c, flags = {}, free = true) {
    if (!free || S.poop || S.act || !grounded(c) || carries(c.name)) return false;
    const sp = spotFor(c, flags);
    if (!sp) return false;
    const pos = spotPos(sp);
    let stand = sp.stand ?? { x: c.x, z: c.z };
    if (sp.kind === 'nudge') {
      // pertinho da bola, do lado de onde ela veio
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const L = Math.hypot(dx, dz) || 1;
      const gap = c.r + 0.13;
      stand = { x: pos.x - (dx / L) * gap, z: pos.z - (dz / L) * gap };
    }
    const face = sp.face ?? pos;
    const yaw = Math.atan2(face.x - stand.x, face.z - stand.z);
    S.act = {
      who: c.name, spot: sp, t: 0, dur: EXTRA_TIME[sp.kind] ?? 2.5, x0: c.x, z0: c.z, yaw0: c.yaw,
      x: stand.x, z: stand.z, yaw, y: 0, marks: new Set(), n: 0, slope: 0, action: 'none',
    };
    c.v = 0;
    c.vx = c.vz = 0;
    emit('extra:start', { kind: sp.kind, id: sp.id, name: c.name, x: pos.x, z: pos.z });
    return true;
  }
  function stepAct(dt) {
    const A = S.act;
    if (!A) return;
    const c = ctrls[A.who];
    A.t += dt;
    const k = Math.min(1, A.t / A.dur);
    const sp = A.spot;
    A.action = 'none';
    A.slope = 0;
    let x = A.x;
    let z = A.z;
    let y = 0;
    let yaw = A.yaw;
    // chega ao ponto e vira para o objeto (com sp.hop, pula para dentro e no fim pula de volta)
    const hopT = 0.42;
    const a = smooth(A.t / (sp.hop ? hopT : ALIGN_T));
    if (sp.kind !== 'swing') {
      x = A.x0 + (A.x - A.x0) * a;
      z = A.z0 + (A.z - A.z0) * a;
      yaw = A.yaw0 + wrap(A.yaw - A.yaw0) * a;
      if (sp.hop) {
        // dentro, em cima do piso do ponto (a areia fica sp.y acima do chão)
        const floor = sp.y ?? 0;
        const back = A.dur - A.t;
        y = floor;
        if (A.t < hopT) y = floor * a + Math.sin(Math.PI * Math.min(1, A.t / hopT)) * 0.2;
        else if (back < hopT) {
          const u = smooth(1 - back / hopT);
          x = A.x + (A.x0 - A.x) * u;
          z = A.z + (A.z0 - A.z) * u;
          y = floor * (1 - u) + Math.sin(Math.PI * Math.min(1, 1 - back / hopT)) * 0.2;
        }
        if (once(A.marks, 'hopIn', A.t > 0.02)) emit('extra:hop', { name: A.who, x: A.x0, z: A.z0 });
        if (once(A.marks, 'hopOut', A.dur - A.t < hopT)) emit('extra:hop', { name: A.who, x: A.x, z: A.z });
        if (once(A.marks, 'land', A.t >= hopT)) emit('dog:land', { name: A.who, x: A.x, z: A.z });
      }
    }
    const pos = spotPos(sp);
    if (sp.kind === 'drink' || sp.kind === 'eat') {
      const rate = sp.kind === 'drink' ? 3.6 : 2.6;
      const n = Math.floor(Math.max(0, A.t - 0.4) * rate);
      if (k < 0.86 && n > A.n) {
        A.n = n;
        emit(sp.kind === 'drink' ? 'extra:lap' : 'extra:crunch', { name: A.who, x: pos.x, z: pos.z, color: sp.color });
      }
    } else if (sp.kind === 'dig') {
      const n = Math.floor(Math.max(0, A.t - 0.3) * DIG_RATE);
      if (k < 0.86 && n > A.n) {
        A.n = n;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        emit('extra:dig', { name: A.who, x: x + fx * c.r * 1.2, z: z + fz * c.r * 1.2, dirX: -fx, dirZ: -fz, color: sp.color });
      }
    } else if (sp.kind === 'sneeze') {
      if (once(A.marks, 'sniff', k >= 0.08)) emit('extra:sniff', { name: A.who, x: pos.x, z: pos.z });
      if (once(A.marks, 'sneeze', k >= SNEEZE_AT)) emit('extra:sneeze', { name: A.who, x: x + Math.sin(yaw) * 0.3, y: 0.35, z: z + Math.cos(yaw) * 0.3, particles: sp.particles, color: sp.color });
    } else if (sp.kind === 'nudge') {
      if (once(A.marks, 'nudge', k >= NUDGE_AT)) {
        emit('extra:nudge', { name: A.who, x: pos.x, z: pos.z });
        hooks.ball?.roll(Math.sin(yaw), Math.cos(yaw));
      }
    } else if (sp.kind === 'roll') {
      // sobe na pilha, rola e desce
      const up = smooth(A.t / 0.35) * (1 - smooth((k - 0.88) / 0.12));
      y = (sp.y ?? 0) * up;
      const n = Math.floor(A.t * 2.2);
      if (k > 0.2 && k < 0.8 && n > A.n) {
        A.n = n;
        emit('extra:roll', { name: A.who, x, z, color: sp.color });
      }
    } else if (sp.kind === 'swing') {
      const r = rideSwing(A, c, k);
      x = r.x; z = r.z; y = r.y; yaw = r.yaw;
    } else if (sp.kind === 'spurt') {
      // fareja o irrigador, leva um esguicho no focinho, se assusta e se sacode
      A.action = k < 0.38 ? 'sniff' : k < 0.5 ? 'startled' : k < 0.9 ? 'shake' : 'none';
      if (once(A.marks, 'spurt', k >= 0.38)) emit('extra:spurt', { name: A.who, x: pos.x, y: 0.3, z: pos.z, dirX: Math.sin(yaw + Math.PI), dirZ: Math.cos(yaw + Math.PI) });
      if (once(A.marks, 'shake', k >= 0.5)) emit('extra:shake', { name: A.who, x, y: 0.35, z });
    }
    c.x = x;
    c.z = z;
    c.y = y;
    c.yaw = yaw;
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = 0;
    A.y = y;
    if (k >= 1) finishAct(c);
  }
  /** Balanço: pula no assento, balança indo e voltando e desce na frente. */
  function rideSwing(A, c, k) {
    const sw = hooks.swing;
    const sp = A.spot;
    const seat = sp.seat ?? 0;
    const T = A.t;
    const D = A.dur;
    const hopIn = 0.55;
    const hopOut = 0.6;
    // ângulo do balanço: cresce, balança e acalma
    const ride = Math.max(0, Math.min(T - hopIn, D - hopOut - hopIn));
    const amp = 0.42 * smooth(ride / 1.4) * (1 - smooth((ride - (D - hopIn - hopOut - 1.3)) / 1.3));
    const ang = T > hopIn && T < D - hopOut ? amp * Math.sin(ride * 2.6) : 0;
    sw?.setAngle(seat, T < D - 0.05 ? ang : null);
    const P = sw ? sw.seatAt(seat, ang) : { x: sp.x, y: 0.4, z: sp.z, faceYaw: 0 };
    const yawSeat = P.faceYaw;
    if (once(A.marks, 'in', T > 0.02)) emit('extra:hop', { name: A.who, x: A.x0, z: A.z0 });
    let x, z, y, yaw;
    if (T < hopIn) {
      const u = smooth(T / hopIn);
      x = A.x0 + (P.x - A.x0) * u;
      z = A.z0 + (P.z - A.z0) * u;
      y = P.y * u + Math.sin(Math.PI * Math.min(1, T / hopIn)) * 0.18;
      yaw = A.yaw0 + wrap(yawSeat - A.yaw0) * u;
      A.action = 'none';
    } else if (T < D - hopOut) {
      x = P.x; z = P.z; y = P.y; yaw = yawSeat;
      A.action = 'sit';
      A.slope = -ang * 0.55;
      const n = Math.round((ride * 2.6) / Math.PI);
      if (amp > 0.12 && n > A.n) {
        A.n = n;
        emit('extra:swing', { name: A.who, x, z });
      }
    } else {
      const u = smooth((T - (D - hopOut)) / hopOut);
      const fx = Math.sin(yawSeat);
      const fz = Math.cos(yawSeat);
      const lx = P.x + fx * 0.7;
      const lz = P.z + fz * 0.7;
      x = P.x + (lx - P.x) * u;
      z = P.z + (lz - P.z) * u;
      y = P.y * (1 - u) + Math.sin(Math.PI * u) * 0.12;
      yaw = yawSeat;
      A.action = 'none';
      if (once(A.marks, 'out', u > 0.92)) emit('dog:land', { name: A.who, x, z });
    }
    void k;
    return { x, z, y, yaw };
  }
  function finishAct(c) {
    const A = S.act;
    if (A.spot.kind === 'swing') hooks.swing?.setAngle(A.spot.seat ?? 0, null);
    c.y = 0;
    // desceu da pilha ou do balanço: fora de qualquer colisor
    const res = resolve(c.x, c.z, c.r, c.size);
    c.x = res.x;
    c.z = res.z;
    emit('extra:end', { kind: A.spot.kind, name: A.who, x: c.x, z: c.z });
    S.act = null;
  }

  // ------------------------------------------------------------------ API
  return {
    /** Fase nova: pontos do cenário, raiz da cena (o cocô vai nela) e ganchos do cenário (balanço, bola). */
    setLevel({ spots: list = [], root: r = null, hooks: h = {} } = {}) {
      spots = list;
      root = r;
      hooks = h || {};
      S = fresh();
    },
    tryPoop,
    interact,
    busy,
    /** Por quadro, depois do puzzle (só jogando). */
    update(dt) {
      stepPoop(dt);
      stepAct(dt);
      for (const p of S.poops) p.update(dt);
    },
    /** Trava da dog (o núcleo pergunta antes do puzzle). */
    lockFor(name) {
      const c = ctrls[name];
      const lock = poopLock(name);
      if (lock) return lock;
      if (S.act?.who === name) return { action: S.act.action, faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true, slope: S.act.slope };
      return null;
    },
    /** Progresso da agachada da dog (0..1) ou −1. */
    poopK(name) {
      const P = S.poop;
      return P?.who === name && P.t >= 0 && P.t < POOP_TIME ? P.t / POOP_TIME : -1;
    },
    /** Progresso da voltinha antes da agachada (0..1) ou −1. */
    poopPre(name) {
      const P = S.poop;
      return P?.who === name && P.t < 0 ? Math.min(1, Math.max(0, 1 + P.t / P.pre)) : -1;
    },
    /** Pose da comemoração de quem fez o cocô ({ glee, bow, hop, air, brace, zoom }) ou null. */
    party(name) {
      const P = S.poop;
      return P?.who === name && P.party ? P.party.pose : null;
    },
    /** Segundos desde que a irmã viu a comemoração (−1 sem). */
    cheer(name) {
      const P = S.poop;
      return P && P.cheerOn && P.cheer >= 0 && name === other(P.who) ? P.t - POOP_TIME - P.cheer : -1;
    },
    /** Animação do cenário da dog ({ kind, k, t }) ou null (o balanço e o esguicho usam ações que já existem). */
    extraAnim(name) {
      const A = S.act;
      if (!A || A.who !== name || A.spot.kind === 'swing' || A.spot.kind === 'spurt') return null;
      return { kind: A.spot.kind, k: Math.min(1, A.t / A.dur), t: A.t, h: A.spot.h ?? 0 };
    },
    /** Interrompe o que estiver acontecendo (comemoração da fase, troca de fase); o cocô no chão fica. */
    cancel() {
      if (S.act) {
        const c = ctrls[S.act.who];
        if (S.act.spot.kind === 'swing') hooks.swing?.setAngle(S.act.spot.seat ?? 0, null);
        c.y = 0;
        const res = resolve(c.x, c.z, c.r, c.size);
        c.x = res.x;
        c.z = res.z;
      }
      if (S.poop) ctrls[S.poop.who].yawRate = 0;
      S.poop = null;
      S.act = null;
    },
    /** Reinício da tentativa: libera o cocô de novo e tira (e libera) os do chão. */
    reset() {
      this.cancel();
      for (const p of S.poops) p.dispose();
      hooks.ball?.reset?.();
      S = fresh();
    },
    info: () => {
      const P = S.poop;
      return {
        used: S.used,
        poop: P ? {
          who: P.who, phase: P.phase, k: +Math.max(-1, P.t / POOP_TIME).toFixed(3), t: +P.t.toFixed(3), pre: +P.pre.toFixed(3),
          circle: P.plan ? +P.plan.path.len.toFixed(2) : 0, zoom: P.party ? !!P.party.zoom : null,
          party: P.party ? +(P.t - POOP_TIME).toFixed(3) : -1, end: P.party ? +P.party.end.toFixed(3) : -1, cheer: P.cheer >= 0,
        } : null,
        act: S.act ? { who: S.act.who, kind: S.act.spot.kind, id: S.act.spot.id, k: +(S.act.t / S.act.dur).toFixed(3) } : null,
        poops: S.poops.length, spots: spots.map((s) => s.id),
      };
    },
  };
}
