// Locomoção própria do modelo novo (etapa 2 da troca dos modelos, docs/ARQUITETURA.md §7). Por cima da pose do
// esqueleto guia, nas patas e na escápula, sempre que a dog anda, trota, galopa ou gira no lugar:
//   · a pata apoiada fica PLANTADA no chão (no mundo): não patina ao arrancar, frear, virar nem na voltinha;
//   · no balanço a pata sai de onde estava e pousa onde vai estar no meio do próximo apoio (prevê a velocidade e a
//     curva), chegando ao chão parada;
//   · a pata rola: no fim do apoio o pulso (frente) e o jarrete (trás) sobem com os dedos ainda no chão; no balanço o
//     pulso dobra (a "botinha" vira para trás) e estica de novo antes de pousar;
//   · a escápula acompanha a pata da frente (o ombro vai para a frente e para trás com ela);
//   · ao parar, cada pata que ficou fora do lugar dá um passinho de ajuste, uma de cada vez.
// O ritmo (fase, apoio/balanço, passo/trote/galope) é o do guia (dogAnimation.js, "passada"): o corpo (sobe e desce,
// balanço) e as pisadas (sons, pegadas) continuam no compasso das patas. As outras poses (sentar, pular, empurrar,
// extras...) seguem do guia: aqui o peso cai a zero e as patas voltam à pose dele.
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

/**
 * Quanto a locomoção daqui vale (0..1): zero nas poses que o guia faz com as patas (sentar, reverência, pular,
 * escorregar, empurrar, puxar, lamber, chacoalhar, susto, parede, extras, pulinhos da comemoração...).
 * @param {{ w: Record<string, number>, hop: number, circling?: boolean }} st @param {import('../../types').DogAnim} A
 * @param {number} s
 */
export function locomotionGate(st, A, s) {
  const w = st.w;
  if ((A.wallK ?? -1) >= 0 || A.extra || (A.poopK ?? -1) >= 0 || A.party) return 0;
  if ((A.cheer ?? -1) >= 0 && A.cheer < 2) return 0;
  // comemoração: os pulinhos e a reverência são do guia; a voltinha andando, daqui
  if (A.action === 'celebrate' && !st.circling) return 0;
  let g = (1 - w.sit) * (1 - w.bow) * (1 - w.jump) * (1 - w.slide) * (1 - w.tug) * (1 - w.turn) * (1 - Math.max(w.aim, w.blow))
    * (1 - w.push) * (1 - w.strain) * (1 - w.shake) * (1 - w.startled) * (1 - w.lick) * (1 - w.licked);
  g *= 1 - clamp(A.shoveK || 0, 0, 1);
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
      n0: V(),
      a: 0, b: 0,
      // estado: no ar (swing), por tempo (passinho de ajuste) ou pela fase; u = progresso do balanço
      swing: false, timed: false, u: 0, u0: 0, rate: 0, lift: 0, phSwing: false,
      foot: rest[idx[idx.length - 1]].clone(), from: V(),
      // alvos do quadro: junta de cima (ombro/quadril) antes da descida do tronco, pulso/jarrete, giro do tronco, dedos
      R0: V(), J: V(), qY: new THREE.Quaternion(), toe: 0,
      stanceK: -1, // progresso do apoio (0..1; −1 = no ar)
      Q: idx.map(() => new THREE.Quaternion()),
    };
    leg.n0.crossVectors(leg.upper, leg.lower).normalize();
    leg.a = leg.upper.length();
    leg.b = leg.lower.length();
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
  const prev = { ok: false, x: 0, z: 0, yaw: 0 };
  const mv = { v: 0, w: 0 }; // velocidade (m/s, para a frente) e giro (rad/s) do corpo, medidos e suavizados
  let weight = 0;
  let still = 0; // s parada
  let drop = 0; // quanto o tronco desceu para as patas alcançarem o chão (m)
  /** Leva um ponto parado no chão do referencial do corpo do quadro anterior para o de agora. */
  const carry = (p, lx, lz, dy) => {
    const x1 = p.x - lx, z1 = p.z - lz, c = Math.cos(dy), sn = Math.sin(dy);
    p.x = x1 * c - z1 * sn;
    p.z = x1 * sn + z1 * c;
  };
  /** Onde está agora o ponto `p` do corpo de daqui a tau s (o corpo anda mv.v e gira mv.w). */
  const ahead = (out, p, tau) => {
    const th = mv.w * tau, c = Math.cos(th), sn = Math.sin(th), d = mv.v * tau;
    return out.set(p.x * c + p.z * sn + d * Math.sin(th / 2), p.y, -p.x * sn + p.z * c + d * Math.cos(th / 2));
  };
  function resetFeet(fromGuide) {
    for (const leg of legs) {
      const pi = leg.idx[leg.idx.length - 1];
      leg.foot.copy(fromGuide ? P2[pi] : leg.neutral);
      leg.foot.y = Math.max(leg.neutral.y, leg.foot.y);
      leg.swing = false;
      leg.timed = false;
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
      // mais rápido que qualquer corrida ou giro: foi posta em outro lugar (troca de fase, recomeço)
      if (Math.hypot(wx, wz) > Math.max(0.15, 9 * dt) || Math.abs(dyaw) > Math.max(0.6, 25 * dt)) teleport = true;
      else if (Math.hypot(wx, wz) < 1e-7 && Math.abs(dyaw) < 1e-7 && dt > 0) {
        // parada no mundo, mas andando (sandbox e testes, como numa esteira): o chão passa pela velocidade da animação
        lz = (st.speed || 0) * dt;
        dyaw = (st.turnS || 0) * dt;
      }
    }
    prev.ok = true;
    prev.x = ox;
    prev.z = oz;
    prev.yaw = yaw;
    if (dt > 0 && !teleport) {
      const k = 1 - Math.exp(-12 * dt);
      mv.v += (lz / dt - mv.v) * k;
      mv.w += (dyaw / dt - mv.w) * k;
    }

    const gate = locomotionGate(st, A, s);
    weight += (gate - weight) * (1 - Math.exp(-(gate > weight ? 10 : 14) * dt));
    if (gate < 0.02 && weight < 0.02) weight = 0;
    if (weight < 0.02) {
      // as patas estão na pose do guia (sentada, no ar...): a locomoção recomeça de onde elas estiverem
      resetFeet(true);
      if (weight === 0) {
        drop = 0;
        return 0;
      }
    } else if (teleport) resetFeet(false);

    const R = gaitRhythm(st, s);
    const moving = Math.abs(mv.v) > 0.05 || Math.abs(mv.w) > 0.35;
    still = moving ? 0 : still + dt;
    const fast = clamp(mv.v / 1.8, 0, 1);
    const dash = st.w.dash;
    const swingDur = (1 - R.beta) / R.f;
    const stanceDur = R.beta / R.f;

    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      // os pontos parados no chão acompanham o movimento do corpo
      if (!teleport) {
        carry(leg.foot, lx, lz, dyaw);
        carry(leg.from, lx, lz, dyaw);
      }
      const p = fract(st.phase + R.off[li]);
      const phSwing = p >= R.beta;
      const edge = phSwing && !leg.phSwing;
      leg.phSwing = phSwing;
      const uPh = phSwing ? (p - R.beta) / (1 - R.beta) : 0;
      // decola na virada da fase (andando); se a locomoção acabou de assumir, ainda no começo do balanço
      if (!leg.swing && moving && phSwing && (edge || uPh < 0.35)) {
        leg.swing = true;
        leg.timed = false;
        leg.u = 0;
        leg.u0 = uPh;
        leg.from.copy(leg.foot);
        leg.lift = (leg.front ? 0.03 : 0.025) * s * (0.75 + 0.45 * fast) + dash * 0.02 * s;
      }
      if (leg.swing) {
        if (leg.timed) leg.u = Math.min(1, leg.u + leg.rate * dt);
        else leg.u = phSwing ? Math.max(leg.u, clamp((uPh - leg.u0) / Math.max(1 - leg.u0, 1e-3), 0, 1)) : 1;
        // pousa onde a pata vai estar no meio do próximo apoio (parada: no lugar dela)
        const T = moving && !leg.timed ? ahead(Tg, leg.neutral, (1 - leg.u) * swingDur + stanceDur / 2) : Tg.copy(leg.neutral);
        leg.foot.lerpVectors(leg.from, T, sstep(0, 1, leg.u));
        leg.foot.y = leg.neutral.y + leg.lift * Math.sin(Math.PI * leg.u);
        if (leg.u >= 1) {
          leg.swing = false;
          leg.timed = false;
          leg.foot.y = leg.neutral.y;
        }
      } else leg.foot.y = leg.neutral.y;
    }
    // parada: a pata mais fora do lugar dá um passinho de ajuste (uma de cada vez)
    if (!moving && still > 0.08 && !legs.some((l) => l.swing)) {
      let best = null, far = 0.014 * s;
      for (const leg of legs) {
        const d = Math.hypot(leg.foot.x - leg.neutral.x, leg.foot.z - leg.neutral.z);
        if (d > far) { far = d; best = leg; }
      }
      if (best) {
        best.swing = true;
        best.timed = true;
        best.u = 0;
        best.rate = 1 / 0.2;
        best.lift = 0.014 * s;
        best.from.copy(best.foot);
      }
    }

    // --- alvos (no referencial do corpo, inner): a pata, o pulso/jarrete que a leva e a junta de cima (ombro/quadril)
    const k = 0.55 + 0.45 * Math.max(fast, dash); // passo: dobras menores; trote e galope: maiores
    let need = 0;
    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      const stanceK = leg.swing ? 0 : clamp(fract(st.phase + R.off[li]) / R.beta, 0, 1); // 0 = pousou, 1 = decolando
      leg.stanceK = leg.swing ? -1 : stanceK;
      const su = leg.swing ? leg.u : 0;
      const flex = leg.swing ? sstep(0, 0.28, su) * (1 - sstep(0.55, 0.92, su)) : 0;
      const roll = moving && !leg.swing ? sstep(0.6, 1, stanceK) : 0; // dedos no chão, pulso/jarrete subindo
      const ip = parentIdx[leg.idx[0]];
      const qp = Q2[ip];
      yawOf(leg.qY, qp);
      Ax.copy(X).applyQuaternion(leg.qY); // eixo de lado do tronco (as dobras das juntas)
      let ang;
      if (leg.front) {
        // escápula: gira no alto acompanhando a pata (pata à frente → ombro à frente)
        const sig = clamp(-((leg.foot.z - leg.neutral.z) / (0.2 * s)) * 0.55, -0.32, 0.32);
        leg.Q[0].copy(qp).multiply(qT.setFromAxisAngle(X, sig));
        leg.R0.copy(leg.scapOff).applyQuaternion(leg.Q[0]).add(P2[leg.idx[0]]);
        // pulso: no apoio em cima da pata e rolando no fim (o calcanhar sai primeiro); no balanço dobra para trás e
        // estica de novo antes de pousar
        ang = 0.8 * roll + (1.25 + 0.55 * k) * flex - 0.08 * (leg.swing ? sstep(0.7, 1, su) : 0);
        leg.toe = leg.swing ? ang + 0.5 * flex : 0; // dedos: deitados no apoio; no ar acompanham o pulso
      } else {
        leg.R0.copy(rest[leg.idx[0]]).sub(rest[ip]).applyQuaternion(qp).add(P2[ip]);
        // metatarso: pousa quase em pé e inclina para trás no empurrão (jarrete à frente da pata); no balanço o
        // jarrete dobra (a pata sobe para trás) e depois a pata vem para a frente para pousar
        ang = leg.swing
          ? 0.75 * k * sstep(0, 0.25, su) * (1 - sstep(0.4, 0.85, su)) - 0.2 * sstep(0.45, 0.8, su) * (1 - sstep(0.85, 1, su))
          : moving ? lerp(-0.08, 0.42, sstep(0, 1, stanceK)) : 0;
        leg.toe = leg.swing ? 0.6 * flex * k : 0;
      }
      Wr.copy(leg.distal).applyQuaternion(leg.qY).applyAxisAngle(Ax, ang);
      leg.J.copy(leg.foot).sub(Wr);
      // apoiada e longe demais da junta de cima: quanto o tronco precisa descer para a pata continuar plantada
      if (!leg.swing) {
        const dx = leg.J.x - leg.R0.x, dz = leg.J.z - leg.R0.z, dy = leg.R0.y - leg.J.y;
        const maxD = (leg.a + leg.b) * 0.985;
        if (dx * dx + dy * dy + dz * dz > maxD * maxD) need = Math.max(need, dy - Math.sqrt(Math.max(0, maxD * maxD - dx * dx - dz * dz)));
      }
    }
    // passada comprida: o tronco desce um pouco (suave; volta devagar)
    const want = Math.min(need, 0.025 * s);
    drop += (want - drop) * (1 - Math.exp(-(want > drop ? 25 : 6) * dt));
    const dropW = drop * weight;
    bones[0].position.y -= dropW;

    // --- IK das patas
    for (let li = 0; li < 4; li++) {
      const leg = legs[li];
      const qp = Q2[parentIdx[leg.idx[0]]];
      const Rt = Sh.copy(leg.R0);
      Rt.y -= dropW;
      const J = leg.J;
      Pole.set(0, leg.front ? -0.15 : 0.15, leg.front ? -1 : 1).applyQuaternion(qp); // cotovelo para trás, joelho para a frente
      solve2(Rt, J, leg.a, leg.b, Pole, Kn);
      legNormal(Nrm, Rt, Kn, J, leg, qp);
      const o = leg.front ? 1 : 0; // a dianteira começa na escápula
      basis(leg.Q[o], leg.upper, leg.n0, Seg.subVectors(Kn, Rt), Nrm);
      basis(leg.Q[o + 1], leg.lower, leg.n0, Seg.subVectors(J, Kn), Nrm);
      basis(leg.Q[o + 2], leg.distal, leg.n0, Seg.subVectors(leg.foot, J), Nrm);
      leg.Q[o + 3].copy(leg.qY).multiply(qT.setFromAxisAngle(X, leg.toe));
      setChain(leg, weight);
    }
    return weight;
  }

  /** Passa as rotações da cadeia (no referencial do corpo) para os ossos, misturando com as do guia pelo peso w. */
  function setChain(leg, w) {
    const ids = leg.idx;
    for (let j = 0; j < ids.length; j++) {
      const i = ids[j];
      const p = parentIdx[i];
      qL.copy(j === 0 ? Q2[p] : leg.Q[j - 1]).invert().multiply(leg.Q[j]);
      const bone = bones[i];
      Seg.copy(rest[i]).sub(rest[p]); // posição local: a do repouso (o comprimento do gomo)
      if (w >= 0.999) {
        bone.quaternion.copy(qL);
        bone.position.copy(Seg);
      } else {
        bone.quaternion.slerp(qL, w);
        bone.position.lerp(Seg, w);
      }
    }
  }

  return {
    apply,
    /** Esquece o movimento anterior (a dog foi posta em outro lugar): as patas voltam para debaixo do corpo. */
    reset() {
      prev.ok = false;
      mv.v = 0;
      mv.w = 0;
    },
    /** Estado das patas (testes e capturas): no ar ou apoiada e a posição no referencial do corpo. */
    legs,
    get weight() { return weight; },
    /** Quanto o tronco desceu (m) para as patas plantadas alcançarem o chão. */
    get drop() { return drop * weight; },
    /** Velocidade (m/s) e giro (rad/s) do corpo sobre o chão, medidos. */
    get motion() { return mv; },
  };
}
