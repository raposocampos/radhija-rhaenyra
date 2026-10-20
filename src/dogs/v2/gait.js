// Locomoção própria do modelo novo (etapa 2 da troca dos modelos, docs/ARQUITETURA.md §7). Por cima da pose do
// esqueleto guia, nas patas e na escápula, sempre que a dog anda, trota, galopa ou gira no lugar:
//   · a pata apoiada fica PLANTADA no chão (no mundo): não patina ao arrancar, frear, virar nem na voltinha;
//   · no balanço a pata sai de onde estava e pousa onde vai estar no meio do próximo apoio (prevê a velocidade e a
//     curva), chegando ao chão parada;
//   · no fim do apoio o pulso (frente) e o jarrete (trás) sobem um pouco com os dedos ainda no chão; no balanço as
//     dobras do pulso, do jarrete e dos dedos são as do modelo atual (retorno do usuário: dobrando mais e esticando,
//     a pata parecia "de borracha, mole demais"); a pata não estica;
//   · a escápula acompanha um pouco a pata da frente;
//   · ao parar, cada pata que ficou fora do lugar dá um passinho de ajuste, uma de cada vez.
// O ritmo (fase, apoio/balanço, passo/trote/galope) é o do guia (dogAnimation.js, "passada"), e o corpo (sobe e
// desce, balanço) fica no compasso das patas; numa curva fechada o compasso acelera só um pouco (até 1,35×) e, além
// disso, a pata gira um tanto junto com o corpo, como num pivô (passinhos acelerados ficavam "estranhos"). Na arrancada
// o ritmo do guia demora uns décimos de segundo para acompanhar a velocidade: o compasso daqui já é o da velocidade
// de agora (as primeiras passadas saem mais curtinhas), as patas que estão no tempo do balanço saem logo e a de trás
// nunca fica plantada até esticar a perna (retorno do usuário: "a pata traseira fica tempo demais no chão"). A
// comemoração e a voltinha antes do cocô ficam com as patas do guia (as aprovadas). As pisadas (sons, pegadas) saem
// daqui, no pouso de cada pata.
// As outras poses (sentar, pular, empurrar, extras...) são do guia. Na troca, as patas daqui deixam de ficar plantadas
// e deslizam até as do guia, e a mistura é das posições das juntas (pata, pulso/jarrete, joelho), não das rotações:
// a pata nunca afunda no chão nem estica no caminho (misturar as rotações dava isso, e o corpo saltava).
import * as THREE from 'three';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Fases de cada pata (FL, FR, HL, HR), as mesmas do guia: passo (lateral), trote (diagonais) e galope. */
const OFF_WALK = [0.25, 0.75, 0.0, 0.5];
const OFF_TROT = [0.0, 0.5, 0.5, 0.0];
const OFF_BOUND = [0.0, 0.08, 0.5, 0.58];

/**
 * Ritmo da passada do guia (dogAnimation.js, "passada"): frequência (ciclos/s), fração de apoio (beta) e a fase de
 * cada pata. Copiado de lá para as patas daqui pisarem junto com o corpo do guia.
 * @param {{ speed: number, turnS: number, w: Record<string, number> }} st @param {number} s
 */
export function gaitRhythm(st, s) {
  const v = st.speed;
  const w = st.w;
  const kS = 1 / Math.sqrt(s);
  const vEff = Math.max(v, Math.abs(st.turnS) * 0.1 * s);
  const fTrot = (1.8 + 1.6 * Math.min(vEff, 3)) * kS;
  const fBound = (4.6 + 0.15 * v) * kS;
  const f = lerp(fTrot, fBound, w.dash);
  const walk = Math.max(1 - sstep(0.55, 1.1, v), w.pre);
  const beta = lerp(lerp(0.62, 0.4, clamp(v / 2.4, 0, 1)), 0.3, w.dash);
  const off = [0, 1, 2, 3].map((i) => lerp(lerp(OFF_TROT[i], OFF_WALK[i], walk * (1 - w.dash)), OFF_BOUND[i], w.dash));
  return { f, beta, off, walk };
}

/** Poses que inclinam o corpo inteiro (de pé no empurrão, impulso na parede): a locomoção sai na hora. */
const hardGate = (A) => (A.wallK ?? -1) >= 0 || (A.shoveK || 0) > 0;

/**
 * Quanto a locomoção daqui vale (0..1): zero nas poses que o guia faz com as patas (sentar, reverência, pular,
 * escorregar, empurrar, puxar, lamber, chacoalhar, susto, parede, extras, pulinhos da comemoração...).
 * @param {{ w: Record<string, number>, hop: number, circling?: boolean }} st @param {import('../../types').DogAnim} A
 * @param {number} s
 */
export function locomotionGate(st, A, s) {
  const w = st.w;
  if (hardGate(A) || A.extra || (A.poopK ?? -1) >= 0 || A.party) return 0;
  if ((A.cheer ?? -1) >= 0 && A.cheer < 2) return 0;
  // comemoração (pulinhos, voltinha andando e reverência) e a voltinha antes do cocô: as patas do guia, aprovadas
  // pelo usuário (a voltinha é fechada demais para a pata plantada sem passinhos acelerados)
  if (A.action === 'celebrate' || st.circling || (A.poopPre ?? -1) >= 0) return 0;
  let g = (1 - w.sit) * (1 - w.bow) * (1 - w.jump) * (1 - w.slide) * (1 - w.tug) * (1 - w.turn) * (1 - Math.max(w.aim, w.blow))
    * (1 - w.push) * (1 - w.strain) * (1 - w.shake) * (1 - w.startled) * (1 - w.lick) * (1 - w.licked);
  g *= 1 - clamp(st.hop / (0.012 * s), 0, 1); // pulinhos da comemoração: patas encolhidas (do guia)
  return clamp(g, 0, 1);
}

/** Ossos de cada pata, na ordem do guia (FL, FR, HL, HR). */
const CHAINS = [
  { front: true, side: 1, names: ['scapL', 'FLu', 'FLl', 'FLc', 'FLp'] },
  { front: true, side: -1, names: ['scapR', 'FRu', 'FRl', 'FRc', 'FRp'] },
  { front: false, side: 1, names: ['HLu', 'HLl', 'HLm', 'HLp'] },
  { front: false, side: -1, names: ['HRu', 'HRl', 'HRm', 'HRp'] },
];

/**
 * @param {{ skel2: { bones: THREE.Bone[], rest: THREE.Vector3[], parentIdx: number[], index: Record<string, number> },
 *           retarget: { P2: THREE.Vector3[], Q2: THREE.Quaternion[] }, s: number }} opts
 */
export function createGait({ skel2, retarget, s }) {
  const { bones, rest, parentIdx, index: I } = skel2;
  const { P2, Q2 } = retarget;
  const V = () => new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

  const legs = CHAINS.map((C) => {
    const idx = C.names.map((n) => I[n]);
    const off = (j) => rest[idx[j + 1]].clone().sub(rest[idx[j]]); // osso j → filho (repouso)
    const leg = {
      ...C, idx,
      // dianteira: alto da escápula → ombro → cotovelo → pulso → pata; traseira: quadril → joelho → jarrete → pata
      upper: C.front ? off(1) : off(0), // ombro→cotovelo / quadril→joelho
      lower: C.front ? off(2) : off(1), // cotovelo→pulso / joelho→jarrete
      distal: C.front ? off(3) : off(2), // pulso→pata / jarrete→pata
      scapOff: C.front ? off(0) : null, // alto da escápula → ombro
      neutral: rest[idx[idx.length - 1]].clone(), // pata parada (no chão, debaixo do corpo)
      // onde a pata pousa andando (no meio do apoio): a da frente um pouco atrás do lugar dela (alcance da pata quase
      // esticada; no fim do apoio o pulso rola e ela alcança mais para trás)
      land: rest[idx[idx.length - 1]].clone().add(new THREE.Vector3(0, 0, C.front ? -0.012 * s : 0)),
      n0: V(),
      a: 0, b: 0,
      // estado: no ar (swing), por tempo (passinho de ajuste) ou pela fase; u = progresso do balanço
      swing: false, timed: false, settle: false, u: 0, u0: 0, rate: 0, lift: 0, phSwing: false, stanceT: 0,
      over: false, dragged: false, stretch: 1,
      reachBack: 1, // traseira: até onde a pata apoiada vai para trás antes de a perna ficar reta (m; abaixo)
      off: -1, // fase desta pata no ciclo (a do guia, mudando devagar: passo ↔ trote sem a pata pular)
      foot: rest[idx[idx.length - 1]].clone(), from: V(),
      // alvos do quadro: junta de cima (ombro/quadril) antes da descida do tronco, pulso/jarrete, giro do tronco, dedos
      R0: V(), J: V(), qY: new THREE.Quaternion(), toe: 0,
      stanceK: -1, // progresso do apoio (0..1; −1 = no ar)
      Q: idx.map(() => new THREE.Quaternion()),
    };
    leg.n0.crossVectors(leg.upper, leg.lower).normalize();
    leg.a = leg.upper.length();
    leg.b = leg.lower.length();
    if (!C.front) {
      // do lugar dela, com o metatarso em pé; um tanto antes disso ela sai do chão (ver "conforto", em apply)
      const hip = rest[idx[0]], hock = rest[idx[2]];
      const dy = hip.y - hock.y, maxD = (leg.a + leg.b) * 0.995;
      leg.reachBack = Math.sqrt(Math.max(0, maxD * maxD - dy * dy)) + (hock.z - hip.z);
    }
    return leg;
  });

  // temporários (cada um com um papel só)
  const bA = V(), bB = V(), bC = V(), bD = V(); // basis()
  const _m = new THREE.Matrix4(), _mr = new THREE.Matrix4();
  const kD = V(), kDir = V(), kPl = V(); // solve2()
  const Sh = V(), Wr = V(), Kn = V(), Pole = V(), Nrm = V(), Seg = V(), Ax = V(), Fw = V(), Tg = V();
  const qT = new THREE.Quaternion(), qL = new THREE.Quaternion();

  /** Quaternion que leva a direção de repouso `r` (com a normal n0) para `dir` (com a normal `n`). */
  function basis(out, r, n0, dir, n) {
    const e1 = bA.copy(dir).normalize();
    const e3 = bB.copy(n).addScaledVector(e1, -n.dot(e1)).normalize();
    const e2 = bC.crossVectors(e3, e1);
    _m.makeBasis(e1, e2, e3);
    const r1 = bA.copy(r).normalize();
    const r3 = bB.copy(n0).addScaledVector(r1, -n0.dot(r1)).normalize();
    const r2 = bD.crossVectors(r3, r1);
    _mr.makeBasis(r1, r2, r3).transpose();
    return out.setFromRotationMatrix(_m.multiply(_mr));
  }
  /** IK de 2 ossos: de P até T (trazido para o alcance), junta do meio em outK dobrando para `pole`. */
  function solve2(P, T, a, b, pole, outK) {
    kD.subVectors(T, P);
    let d = kD.length();
    const maxD = (a + b) * 0.998, minD = Math.abs(a - b) + 1e-4;
    if (d > maxD) { kD.multiplyScalar(maxD / d); d = maxD; T.copy(P).add(kD); }
    if (d < minD) { kD.multiplyScalar(minD / Math.max(d, 1e-6)); d = minD; T.copy(P).add(kD); }
    kDir.copy(kD).divideScalar(d);
    kPl.copy(pole).addScaledVector(kDir, -pole.dot(kDir)).normalize();
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    outK.copy(P).addScaledVector(kDir, x).addScaledVector(kPl, h);
  }
  /** Normal do plano da pata (P → joelho K → T); reta demais, a do repouso girada com o tronco. */
  function legNormal(out, P, K, T, leg, qParent) {
    out.crossVectors(Seg.subVectors(K, P), Fw.subVectors(T, K));
    if (out.lengthSq() < 1e-12) out.copy(leg.n0).applyQuaternion(qParent);
    return out.normalize();
  }
  /** Só o giro (em torno do vertical) de uma rotação. */
  function yawOf(out, q) {
    Fw.copy(Z).applyQuaternion(q);
    return out.setFromAxisAngle(bD.set(0, 1, 0), Math.atan2(Fw.x, Fw.z));
  }

  // ---------------------------------------------------------------- movimento do corpo sobre o chão
  const prev = { ok: false, x: 0, z: 0, yaw: 0, ox: 0, oz: 0, oyaw: 0 };
  const mv = { v: 0, w: 0 }; // velocidade (m/s, para a frente) e giro (rad/s) do corpo, medidos e suavizados
  let weight = 0;
  let still = 0; // s parada
  let drop = 0; // quanto o tronco desceu para as patas alcançarem o chão (m)
  let staticN = 0; // quadros seguidos parada no mundo
  let wasOwn = false; // no quadro anterior, só a locomoção mexia nas patas
  let wasMoving = false; // no quadro anterior, andando ou girando
  let ph = 0; // fase das patas: a do guia; mais rápida numa curva fechada (e volta ao compasso dele depois)
  let lastG = -1; // fase do guia no quadro anterior
  /** @type {[number, number][]} pisadas do quadro (pata, passada m/s): o dog.js avisa o jogo no fim do quadro */
  const steps = [];
  const info = { boost: 1, drags: 0 }; // para testes e capturas
  const MAX_DROP = 0.01 * s, MAX_STRETCH = 1;
  let pivotK = 1; // quanto a pata apoiada gira com o mundo (1) ou junto com o corpo (pivô, numa curva bem fechada)
  /** Leva um ponto parado no chão do referencial do corpo do quadro anterior para o de agora. */
  const carry = (p, lx, lz, dy) => {
    const x1 = p.x - lx, z1 = p.z - lz, c = Math.cos(dy), sn = Math.sin(dy);
    p.x = x1 * c - z1 * sn;
    p.z = x1 * sn + z1 * c;
  };
  /** Onde está agora o ponto `p` do corpo de daqui a tau s (o corpo anda mv.v e gira mv.w). */
  const ahead = (out, p, tau) => {
    const th = mv.w * pivotK * tau, c = Math.cos(th), sn = Math.sin(th), d = mv.v * tau;
    return out.set(p.x * c + p.z * sn + d * Math.sin(th / 2), p.y, -p.x * sn + p.z * c + d * Math.cos(th / 2));
  };
  /** A pata sai do chão: pela fase (timed = false) ou por tempo (rate = 1/duração: passo extra ou de ajuste). */
  function startSwing(leg, timed, lift, rate) {
    leg.swing = true;
    leg.timed = timed;
    leg.settle = false;
    leg.u = 0;
    leg.u0 = 0;
    leg.rate = rate;
    leg.lift = lift;
    leg.from.copy(leg.foot);
  }
  function resetFeet(fromGuide) {
    for (const leg of legs) {
      const pi = leg.idx[leg.idx.length - 1];
      leg.foot.copy(fromGuide ? P2[pi] : leg.neutral);
      leg.foot.y = Math.max(leg.neutral.y, leg.foot.y);
      leg.swing = false;
      leg.timed = false;
      leg.settle = false;
      leg.over = false;
      leg.stanceT = 1;
      leg.u = 0;
    }
  }

  /**
   * Aplica a locomoção nos ossos (depois do retarget.apply do quadro). Devolve o peso aplicado (0 = nada).
   * @param {number} dt @param {import('../../types').DogAnim} A @param {any} st (estado do guia)
   * @param {THREE.Object3D} inner @param {THREE.Object3D} object
   */
  function apply(dt, A, st, inner, object) {
    // --- quanto o corpo andou e girou desde o quadro anterior (no referencial do corpo de antes)
    const oy = object.rotation.y;
    const yaw = oy + st.spin;
    const co = Math.cos(oy), so = Math.sin(oy);
    const ox = object.position.x + inner.position.x * co + inner.position.z * so;
    const oz = object.position.z - inner.position.x * so + inner.position.z * co;
    let lx = 0, lz = 0, dyaw = 0;
    let teleport = !prev.ok;
    if (prev.ok) {
      const wx = ox - prev.x, wz = oz - prev.z;
      dyaw = wrapAngle(yaw - prev.yaw);
      const cp = Math.cos(prev.yaw), sp = Math.sin(prev.yaw);
      lx = wx * cp - wz * sp;
      lz = wx * sp + wz * cp;
      // o objeto (o centro do jogo) parado: com o desenho recuando (cabeça que desvia, head.js), ele anda e o desenho não
      const objStill = Math.abs(object.position.x - prev.ox) < 1e-7 && Math.abs(object.position.z - prev.oz) < 1e-7
        && Math.abs(wrapAngle(oy - prev.oyaw)) < 1e-7;
      // mais rápido que qualquer corrida ou giro: foi posta em outro lugar (troca de fase, recomeço)
      if (Math.hypot(wx, wz) > Math.max(0.15, 9 * dt) || Math.abs(dyaw) > Math.max(0.6, 25 * dt)) teleport = true;
      else if (objStill && Math.hypot(wx, wz) < 1e-7 && Math.abs(dyaw) < 1e-7 && dt > 0) {
        // parada no mundo, mas andando (sandbox e testes, como numa esteira): o chão passa pela velocidade pedida
        if (++staticN >= 3) {
          lz = (A.speed || 0) * dt;
          dyaw = (A.turn || 0) * dt;
        }
      } else staticN = 0;
    }
    prev.ok = true;
    prev.x = ox;
    prev.z = oz;
    prev.yaw = yaw;
    prev.ox = object.position.x;
    prev.oz = object.position.z;
    prev.oyaw = oy;
    if (dt > 0 && !teleport) {
      const k = 1 - Math.exp(-20 * dt);
      mv.v += (lz / dt - mv.v) * k;
      mv.w += (dyaw / dt - mv.w) * k;
    }

    const gate = locomotionGate(st, A, s);
    // empurrão em pé e parede: o corpo inteiro inclina, a troca é rápida
    weight += (gate - weight) * (1 - Math.exp(-(gate > weight ? 10 : hardGate(A) ? 30 : 14) * dt));
    if (gate < 0.02 && weight < 0.02) weight = 0;
    // só andando (nenhuma outra pose mexendo nas patas) a pata fica plantada e dá passos
    const own = gate > 0.98;
    const resumed = own && !wasOwn; // a locomoção acabou de voltar (depois de sentar, pular...)
    wasOwn = own;
    const R = gaitRhythm(st, s);
    if (weight < 0.02 || teleport || lastG < 0) {
      ph = st.phase;
      lastG = st.phase;
      for (let li = 0; li < 4; li++) legs[li].off = R.off[li];
    }
    // a fase de cada pata vai para a do ritmo no máximo 0,8 ciclo por segundo (do passo ao trote a pata não pula)
    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      const e = fract(R.off[li] - leg.off + 0.5) - 0.5;
      leg.off = fract(leg.off + clamp(e, -0.8 * dt, 0.8 * dt));
    }
    if (weight < 0.02) {
      // as patas estão na pose do guia (sentada, no ar...): a locomoção recomeça de onde elas estiverem
      resetFeet(true);
      if (weight === 0) {
        drop = 0;
        wasMoving = false;
        return 0;
      }
    } else if (teleport) resetFeet(false);

    const moving = Math.abs(mv.v) > 0.05 || Math.abs(mv.w) > 0.35;
    const started = moving && !wasMoving; // começou a andar (ou a girar) agora
    wasMoving = moving;
    still = moving ? 0 : still + dt;
    const fast = clamp(mv.v / 1.8, 0, 1);
    const dash = st.w.dash;
    // compasso: o do guia. Se a passada não cabe no alcance da pata, ele acelera: numa curva fechada (o giro leva a
    // pata para o lado, onde ela alcança bem menos que para a frente) e na arrancada (o ritmo do guia demora uns
    // décimos de segundo para acompanhar a velocidade); no galope, não (a passada comprida, com o voo, é a dele)
    const fStraight = (Math.abs(mv.v) * R.beta) / (0.18 * s);
    const fCurve = fStraight + (Math.abs(mv.w) * 0.2 * s * R.beta) / (0.12 * s);
    const demand = fCurve / lerp(R.f, Math.max(fStraight, R.f), dash);
    // arrancada: o ritmo que o guia terá nesta velocidade (ele ainda está no de uma velocidade menor); acc = o quanto
    // ela está acelerando à frente do guia (0 andando no compasso dele)
    const RN = gaitRhythm({ speed: Math.max(st.speed, Math.abs(mv.v)), turnS: st.turnS, w: st.w }, s);
    const acc = clamp((mv.v - st.speed) / 0.3, 0, 1);
    const boost = Math.max(clamp(demand, 1, 1.35), clamp(RN.f / R.f, 1, 1.9));
    // além disso a pata apoiada gira um tanto junto com o corpo (pivô): na curva fechada ela torce no chão em vez de dar
    // passinhos acelerados
    pivotK = demand > 1.35 ? clamp(1.35 / demand, 0.35, 1) : 1;
    info.boost = boost;
    ph = fract(ph + fract(st.phase - lastG) * boost);
    lastG = st.phase;
    if (boost < 1.02) ph = fract(ph + (fract(st.phase - ph + 0.5) - 0.5) * (1 - Math.exp(-4 * dt)));
    const f = R.f * boost;
    // acelerando, o apoio também já é o desta velocidade (mais curto: a passada cabe no alcance da pata)
    const beta = lerp(R.beta, Math.min(R.beta, RN.beta), acc);
    const swingDur = (1 - beta) / f;
    const stanceDur = beta / f;
    const stepSpeed = Math.max(Math.abs(mv.v), Math.abs(mv.w) * 0.2 * s);
    // conforto da traseira: a pata apoiada sai do chão um tanto depois de onde ela sairia no ritmo desta velocidade, e
    // sempre antes de a perna ficar reta (sem isso, na arrancada ela ia até o limite e era arrastada esticada)
    const halfN = (Math.abs(mv.v) * RN.beta) / RN.f / 2;

    const lifting = () => legs.reduce((n, l) => n + (l.swing ? 1 : 0), 0);
    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      // os pontos parados no chão acompanham o movimento do corpo
      if (!teleport) {
        carry(leg.foot, lx, lz, dyaw * pivotK);
        carry(leg.from, lx, lz, dyaw * pivotK);
      }
      if (!own) {
        // outra pose está mexendo nas patas: nada de passos; a pata desliza até a do guia (e a segue)
        leg.swing = leg.timed = leg.settle = false;
        leg.stanceT = 1;
        leg.foot.lerp(P2[leg.idx[leg.idx.length - 1]], 1 - Math.exp(-12 * dt));
        leg.phSwing = fract(ph + leg.off) >= beta;
        continue;
      }
      if (!leg.swing) leg.stanceT += dt;
      const p = fract(ph + leg.off);
      const phSwing = p >= beta;
      const edge = phSwing && !leg.phSwing;
      leg.phSwing = phSwing;
      const uPh = phSwing ? (p - beta) / (1 - beta) : 0;
      const lift = (leg.front ? 0.03 : 0.025) * s * (0.75 + 0.45 * fast) + dash * 0.02 * s;
      // decola na virada da fase (andando; não logo depois de um passo extra); se a locomoção acabou de assumir, a pata
      // que está no tempo do balanço já sai no ar (senão ela ficaria para trás, plantada no meio da passada)
      // (também logo que ela começa a andar: a pata parada no tempo do balanço não espera a volta seguinte)
      if (!leg.swing && moving && phSwing && (edge || uPh < (resumed || started ? 0.9 : 0.35)) && leg.stanceT > 0.35 * stanceDur) {
        if (edge || uPh < 0.35) {
          startSwing(leg, false, lift, 0);
          leg.u0 = uPh;
        } else startSwing(leg, true, lift, 1 / clamp((1 - uPh) * swingDur, 0.1, 0.3)); // atrasada: balanço inteiro, curto
      }
      // longe demais (curva fechada, empurrada): um passo extra, fora do ritmo, se no máximo uma outra pata está no ar
      // (arrancando, duas: no começo de uma corrida a dog fica um instante com três patas no ar)
      const room = lifting() < (acc > 0.3 ? 3 : 2);
      if (!leg.swing && moving && leg.over && leg.stanceT > 0.3 * stanceDur && room) {
        startSwing(leg, true, lift, 1 / clamp(swingDur, 0.1, 0.25));
      }
      // traseira atrás demais na arrancada: passo de conforto antes de a perna esticar (só acelerando: freando, a pata
      // atrás do lugar é normal e os passinhos de ajuste ao parar cuidam dela). Arrancando forte, ela sai mesmo com as
      // outras no ar (o trote rápido já tem um instante sem pata no chão); nunca fica arrastada esticada
      if (!leg.front && !leg.swing && moving && acc > 0 && leg.stanceT > 0.3 * stanceDur && (room || acc > 0.3)) {
        const comfort = Math.min(1.2 * halfN + 0.02 * s, leg.reachBack - 0.012 * s);
        if (leg.land.z - leg.foot.z > comfort) startSwing(leg, true, lift, 1 / clamp((1 - RN.beta) / RN.f, 0.1, 0.22));
      }
      if (leg.swing) {
        // a fase voltou ao apoio: no fim do balanço, pousa; antes do fim (o ritmo mudou: passo ↔ trote, parando), a
        // pata termina o balanço no tempo dela em vez de pousar de repente
        if (!leg.timed && !phSwing) {
          if (leg.u < 0.97) {
            leg.timed = true;
            leg.rate = 1 / clamp(swingDur, 0.06, 0.3);
          } else leg.u = 1;
        }
        if (leg.timed) leg.u = Math.min(1, leg.u + leg.rate * dt);
        else {
          // pela fase, mas nunca aos saltos (no máximo 3× um balanço normal por quadro)
          const uT = clamp((uPh - leg.u0) / Math.max(1 - leg.u0, 1e-3), 0, 1);
          leg.u = clamp(uT, leg.u, leg.u + (3 * dt) / Math.max(swingDur, 0.05));
        }
        // pousa onde a pata vai estar no meio do próximo apoio (prevê pela velocidade medida, que muda suave: parando,
        // o alvo vai chegando ao lugar dela sem pular); o passinho de ajuste vai direto ao lugar
        const left = (1 - leg.u) * (leg.timed ? 1 / leg.rate : swingDur);
        Fw.lerpVectors(leg.neutral, leg.land, clamp(Math.abs(mv.v) / 0.3, 0, 1));
        const T = leg.settle ? Tg.copy(leg.neutral) : ahead(Tg, Fw, left + stanceDur / 2);
        leg.foot.lerpVectors(leg.from, T, sstep(0, 1, leg.u));
        leg.foot.y = leg.neutral.y + leg.lift * Math.sin(Math.PI * leg.u);
        if (leg.u >= 1) {
          // pisada: som e pegada no pouso (os passinhos de ajuste, parada, quase não fazem barulho)
          if (weight > 0.5 && (stepSpeed > 0.2 || leg.settle)) steps.push([li, leg.settle ? 0.1 : stepSpeed]);
          leg.swing = false;
          leg.timed = false;
          leg.settle = false;
          leg.stanceT = 0;
          leg.foot.y = leg.neutral.y;
        }
      } else leg.foot.y = leg.neutral.y;
    }
    // parada: a pata mais fora do lugar dá um passinho de ajuste (uma de cada vez)
    if (own && !moving && still > 0.08 && !legs.some((l) => l.swing)) {
      let best = null, far = 0.014 * s;
      for (const leg of legs) {
        const d = Math.hypot(leg.foot.x - leg.neutral.x, leg.foot.z - leg.neutral.z);
        if (d > far) { far = d; best = leg; }
      }
      if (best) {
        startSwing(best, true, 0.014 * s, 1 / 0.2);
        best.settle = true;
      }
    }

    // --- alvos (no referencial do corpo, inner): a pata, o pulso/jarrete que a leva e a junta de cima (ombro/quadril)
    let need = 0;
    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      const stanceK = leg.swing ? 0 : clamp(fract(ph + leg.off) / beta, 0, 1); // 0 = pousou, 1 = decolando
      leg.stanceK = leg.swing ? -1 : stanceK;
      const su = leg.swing ? leg.u : 0;
      const flex = leg.swing ? sstep(0, 0.28, su) * (1 - sstep(0.55, 0.92, su)) : 0;
      const roll = own && moving && !leg.swing ? sstep(0.6, 1, stanceK) : 0; // dedos no chão, pulso/jarrete subindo
      const ip = parentIdx[leg.idx[0]];
      const qp = Q2[ip];
      yawOf(leg.qY, qp);
      Ax.copy(X).applyQuaternion(leg.qY); // eixo de lado do tronco (as dobras das juntas)
      let ang;
      if (leg.front) {
        // escápula: gira um pouco no alto acompanhando a pata (pata à frente → ombro à frente)
        const sig = clamp(-((leg.foot.z - leg.neutral.z) / (0.2 * s)) * 0.3, -0.18, 0.18);
        leg.Q[0].copy(qp).multiply(qT.setFromAxisAngle(X, sig));
        leg.R0.copy(leg.scapOff).applyQuaternion(leg.Q[0]).add(P2[leg.idx[0]]);
        // pulso: no apoio em cima da pata, sobe um pouco no fim; no balanço dobra como no modelo atual (até 0,9 rad,
        // a pata inteira junto) e estica de novo antes de pousar
        ang = 0.2 * roll + 0.9 * flex - 0.05 * (leg.swing ? sstep(0.7, 1, su) : 0);
        leg.toe = leg.swing ? ang : 0; // dedos: deitados no apoio; no ar, com o pulso
      } else {
        leg.R0.copy(rest[leg.idx[0]]).sub(rest[ip]).applyQuaternion(qp).add(P2[ip]);
        // metatarso: pousa quase em pé e inclina para trás no empurrão (jarrete à frente da pata); no balanço o
        // jarrete dobra (a pata sobe para trás) e depois a pata vem para a frente para pousar
        // (como no modelo atual: metatarso até 0,45 rad e dedos até 0,7 no balanço; no apoio, só um pouco no fim)
        ang = leg.swing
          ? 0.45 * flex - 0.08 * sstep(0.5, 0.8, su) * (1 - sstep(0.85, 1, su))
          : own && moving ? lerp(0, 0.15, sstep(0.3, 1, stanceK)) : 0;
        leg.toe = leg.swing ? 0.7 * flex : 0;
      }
      Wr.copy(leg.distal).applyQuaternion(leg.qY).applyAxisAngle(Ax, ang);
      leg.J.copy(leg.foot).sub(Wr);
      // apoiada e longe demais da junta de cima: quanto o tronco precisa descer; mais que MAX_DROP, a pata pede um passo
      // extra (e, sem poder dar, é arrastada para perto)
      leg.over = false;
      leg.dragged = false;
      if (own && !leg.swing) {
        const dx = leg.J.x - leg.R0.x, dz = leg.J.z - leg.R0.z, dy = leg.R0.y - leg.J.y;
        const maxD = (leg.a + leg.b) * (MAX_STRETCH - 0.005);
        const n = dx * dx + dy * dy + dz * dz > maxD * maxD ? dy - Math.sqrt(Math.max(0, maxD * maxD - dx * dx - dz * dz)) : 0;
        if (n > MAX_DROP) {
          leg.over = true;
          if (!moving || lifting() >= 2) {
            // arrastada para perto, devagar (nunca um salto)
            const ex = leg.neutral.x - leg.foot.x, ez = leg.neutral.z - leg.foot.z;
            const k = Math.min(0.2, (0.004 * s) / Math.max(Math.hypot(ex, ez), 1e-6));
            leg.foot.x += ex * k;
            leg.foot.z += ez * k;
            leg.J.copy(leg.foot).sub(Wr);
            leg.dragged = true;
            info.drags++;
          }
        }
        if (gate > 0.9) need = Math.max(need, Math.min(n, MAX_DROP));
      }
    }
    // passada comprida: o tronco desce um pouco (suave; volta devagar)
    const want = need;
    drop += (want - drop) * (1 - Math.exp(-(want > drop ? 25 : 6) * dt));
    const dropW = drop * weight;
    bones[0].position.y -= dropW;

    // --- IK das patas. Na troca com uma pose do guia, os alvos (junta de cima, joelho, pulso/jarrete e pata) são
    // misturados pelo peso entre os do guia e os daqui: a pata vai de uma pose à outra por um caminho que existe
    const w = weight;
    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      const qp = Q2[parentIdx[leg.idx[0]]];
      const o = leg.front ? 1 : 0; // a dianteira começa na escápula
      const iR = leg.idx[o], iK = leg.idx[o + 1], iJ = leg.idx[o + 2], iP = leg.idx[o + 3];
      const Rt = Sh.copy(leg.R0);
      Rt.y -= dropW;
      Pole.set(0, leg.front ? -0.15 : 0.15, leg.front ? -1 : 1).applyQuaternion(qp); // cotovelo para trás, joelho para a frente
      const J = leg.J;
      const Fb = Tg.copy(leg.foot); // a pata deste quadro (a guardada continua plantada)
      if (w < 0.999) {
        Rt.lerpVectors(P2[iR], Rt, w);
        Fb.lerpVectors(P2[iP], leg.foot, w);
        J.lerpVectors(P2[iJ], J, w);
        // pulso/jarrete no comprimento certo da quartela/metatarso
        J.sub(Fb).setLength(leg.distal.length()).add(Fb);
        // joelho/cotovelo para o lado do do guia
        Fw.addVectors(P2[iR], P2[iJ]).multiplyScalar(0.5);
        Seg.subVectors(P2[iK], Fw);
        if (Seg.lengthSq() > 1e-10) Pole.normalize().multiplyScalar(w).addScaledVector(Seg.normalize(), 1 - w);
        if (leg.front) leg.Q[0].slerpQuaternions(Q2[leg.idx[0]], qT.copy(leg.Q[0]), w);
      }
      // (MAX_STRETCH = 1: a pata não estica; com mais, os dois gomos alongariam antes de a pata sair do lugar)
      leg.stretch = clamp(Rt.distanceTo(J) / ((leg.a + leg.b) * 0.998), 1, MAX_STRETCH);
      solve2(Rt, J, leg.a * leg.stretch, leg.b * leg.stretch, Pole, Kn);
      legNormal(Nrm, Rt, Kn, J, leg, qp);
      basis(leg.Q[o], leg.upper, leg.n0, Seg.subVectors(Kn, Rt), Nrm);
      basis(leg.Q[o + 1], leg.lower, leg.n0, Seg.subVectors(J, Kn), Nrm);
      basis(leg.Q[o + 2], leg.distal, leg.n0, Seg.subVectors(Fb, J), Nrm);
      leg.Q[o + 3].copy(leg.qY).multiply(qT.setFromAxisAngle(X, leg.toe));
      if (w < 0.999) leg.Q[o + 3].slerpQuaternions(Q2[iP], qT.copy(leg.Q[o + 3]), w);
      setChain(leg, w);
    }
    return weight;
  }

  /**
   * Passa as rotações da cadeia (no referencial do corpo) para os ossos. As rotações são sempre as da IK daqui (na troca
   * com uma pose do guia, a mistura já foi feita nos alvos); só o comprimento dos gomos vai do do guia ao daqui por w.
   */
  function setChain(leg, w) {
    const ids = leg.idx;
    for (let j = 0; j < ids.length; j++) {
      const i = ids[j];
      const p = parentIdx[i];
      qL.copy(j === 0 ? Q2[p] : leg.Q[j - 1]).invert().multiply(leg.Q[j]);
      const bone = bones[i];
      Seg.copy(rest[i]).sub(rest[p]); // posição local: a do repouso (o comprimento do gomo)
      const o = leg.front ? 1 : 0;
      if (j === o + 1 || j === o + 2) Seg.multiplyScalar(leg.stretch); // gomos esticados (cotovelo/joelho e pulso/jarrete)
      bone.quaternion.copy(qL);
      if (w >= 0.999) bone.position.copy(Seg);
      else bone.position.lerp(Seg, w);
    }
  }

  return {
    apply,
    /** Esquece o movimento anterior (a dog foi posta em outro lugar): as patas voltam para debaixo do corpo. */
    reset() {
      prev.ok = false;
      lastG = -1;
      steps.length = 0;
      mv.v = 0;
      mv.w = 0;
    },
    /** Estado das patas (testes e capturas): no ar ou apoiada e a posição no referencial do corpo. */
    legs,
    get weight() { return weight; },
    /** As pisadas do último quadro (pata, passada m/s), uma vez só. */
    takeSteps() {
      const out = steps.slice();
      steps.length = 0;
      return out;
    },
    /** Compasso das patas sobre o do guia (curvas fechadas) e quantas vezes uma pata foi arrastada. */
    info,
    /** Quanto o tronco desceu (m) para as patas plantadas alcançarem o chão. */
    get drop() { return drop * weight; },
    /** Velocidade (m/s) e giro (rad/s) do corpo sobre o chão, medidos. */
    get motion() { return mv; },
  };
}
