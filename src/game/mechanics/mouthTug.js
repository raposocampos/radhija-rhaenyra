// Puxar com a boca: a cordinha do portão (fase 1), a cordinha do portãozinho, a alça do gerador e as alças dos caixotes
// da despensa (fase 10). Retornos
// do usuário: "as cordas do portão elas de fato poderiam colocar na boca e puxar, sempre respeitando a física e o
// realismo"; depois, "o player puxar ela" (o gerador com dois puxões; os portões abrindo enquanto ela puxa) e, do
// passinho roteirizado, "como se tivesse sendo arrastado, ou como se tivesse um ímã".
//
// No E, a dog ANDA até a corda (o núcleo a move com o controle e a colisão de sempre: a trava pede `move`), vira de
// frente e morde (o ponto mordido vai para a boca, que fecha nele: pose de carregar 'rope'). Mordendo, ela segura: o
// direcional para longe da corda puxa (de ré, de frente para ela, em passinhos de força: `lock.pull`) e para perto dá
// folga; o E solta. A fase lê quanto ela puxou (`pulled`) e decide (o portão abre junto; o gerador engasga ou pega) e
// manda soltar (`release`). A corda não estica: o ponto mordido fica no máximo `len` m de onde ela prende. Com algo
// na boca, ou sem chegar à corda (algo no caminho), ela não morde (`phase` 'miss': a fase dá a dica).
// O passinho (planStep/driveStep) também leva a dog até o botão que ela aperta com a pata (fase 9).
//
// Uso na fase: const tug = createMouthTug({ dogs, ctrls, world });
//   no E: tug.start(c, { bite, anchor, len })   (bite: o ponto que ela morde, parado; anchor: onde a corda prende;
//         yaw: chegando sempre por esse rumo, como na alça do caixote; speed: a ré com o direcional todo para trás)
//   por quadro: tug.update(dt); tug.phase(), tug.pulled(); tug.release() para soltar
//   no prop: setGrip(tug.grip) (o prop pede a boca na hora de desenhar, depois da animação das dogs)
//   lockFor(name): tug.lockFor(name)   ·   reset(): tug.reset()
import * as THREE from 'three';

/**
 * O passinho: velocidade máxima (m/s), chegou (m), de frente (rad), o que já está perto (m, rad), tempo máximo e
 * quanto tempo sem chegar mais perto conta como "não dá para chegar" (s).
 */
const STEP = { speed: 0.85, arrive: 0.02, facing: 0.05, near: 0.025, turnNear: 0.15, back: 0.2, max: 1.8, stuck: 0.5 };
/** Mordida: tempo para o ponto mordido ir à boca e para voltar (s); longe assim da corda depois do passinho, não morde (m). */
const GRIP = { in: 0.14, out: 0.16, miss: 0.12 };
/** Puxando: a velocidade de ré com o direcional todo para trás (m/s). */
const PULL = { speed: 0.45 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (u) => u * u * (3 - 2 * u);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * @typedef {{ x1: number, z1: number, P: { x: number, z: number }, t: number, walk: boolean, best: number, stuck: number,
 *   move: null | { dx: number, dz: number, speed: number }, back: boolean }} Step
 */

/**
 * Passinho até um ponto: o meio do corpo vai ficar a `reach` m de `P`, de frente para ele (ou chegando pelo rumo `yaw`,
 * quando o ponto só se alcança de um lado, como o botão na base do ventilador). Ela anda (a trava pede `move`, o
 * núcleo a move com o controle de sempre) e vira de frente. Se ela já passou do ponto (teria de andar de ré), só vira.
 * → null se ela já está lá ou está no ar (o pulo segue; a fase faz a ação de onde ela está). A arrancada acaba aqui.
 * @param {any} c @param {{ x: number, z: number }} P @param {number} reach @param {any} world
 * @param {{ yaw?: number }} [o]
 * @returns {Step | null}
 */
export function planStep(c, P, reach, world, { yaw } = {}) {
  if (c.dashT > 0) c.dashT = 0;
  if (c.jumpT > 0) return null;
  const yaw1 = yaw ?? Math.atan2(P.x - c.x, P.z - c.z);
  let x1 = P.x - Math.sin(yaw1) * reach;
  let z1 = P.z - Math.cos(yaw1) * reach;
  if (world?.resolve) {
    const r = world.resolve(x1, z1, c.r, c.size);
    x1 = r.x;
    z1 = r.z;
  }
  const dist = Math.hypot(x1 - c.x, z1 - c.z);
  const turn = Math.abs(wrap(Math.atan2(P.x - c.x, P.z - c.z) - c.yaw));
  if (dist <= STEP.near && turn <= STEP.turnNear) return null;
  // um tiquinho para trás (passou do ponto): ela dá uns passinhos de ré, de frente para a coisa; mais longe, vira e anda
  const back = dist > STEP.near && dist < STEP.back && (x1 - c.x) * Math.sin(yaw1) + (z1 - c.z) * Math.cos(yaw1) < 0;
  const S = { x1, z1, P: { x: P.x, z: P.z }, t: 0, walk: dist > STEP.near, best: dist, stuck: 0, move: null, back };
  S.move = S.walk ? walkTo(S, dist, x1 - c.x, z1 - c.z) : null;
  return S;
}

/** A intenção de andar até o ponto do passinho: chega devagar (a velocidade cai perto dele); de ré, mais devagar. */
function walkTo(S, d, dx, dz) {
  return { dx: dx / d, dz: dz / d, speed: clamp(d * 3.5, 0.2, S.back ? 0.35 : STEP.speed), back: S.back };
}

/**
 * Um quadro do passinho (no update da fase): enquanto ela anda, a próxima intenção (S.move, que a trava passa ao
 * núcleo); chegou (ou não dá para chegar mais perto), ela vira de frente para o ponto. → true quando está pronta.
 * @param {any} c @param {Step} S @param {number} dt
 */
export function driveStep(c, S, dt) {
  S.t += dt;
  if (S.walk) {
    const dx = S.x1 - c.x, dz = S.z1 - c.z, d = Math.hypot(dx, dz);
    if (d < S.best - 0.002) {
      S.best = d;
      S.stuck = 0;
    } else S.stuck += dt;
    if (d > STEP.arrive && S.t < STEP.max && S.stuck < STEP.stuck) {
      S.move = walkTo(S, d, dx, dz);
      return false;
    }
    S.walk = false;
  }
  S.move = null;
  // de frente para o ponto (o núcleo vira a dog para faceX/faceZ); parada, sem embalo
  const want = Math.atan2(S.P.x - c.x, S.P.z - c.z);
  return (Math.abs(wrap(want - c.yaw)) < STEP.facing && Math.abs(c.v) < 0.12) || S.t > STEP.max + 0.8;
}

/**
 * @param {{ dogs: Record<string, any>, ctrls: Record<string, any>, world?: any }} o
 */
export function createMouthTug({ dogs, ctrls, world = null }) {
  /**
   * @type {null | { who: string, bite: { x: number, y: number, z: number }, anchor: THREE.Vector3, face: { x: number, z: number },
   *   len: number, phase: 'step' | 'grip' | 'hold' | 'let' | 'miss', t: number, grip: number, free: boolean, reach: number,
   *   carry: boolean, step: Step | null, back: boolean, x0: number, z0: number, ax: number, az: number, pulled: number,
   *   speed: number }}
   */
  let T = null;
  const _m = new THREE.Vector3();
  const _g = new THREE.Vector3();
  const mouthOf = (name, out) => {
    const s = dogs?.[name]?.mouthSocket;
    return s ? s.getWorldPosition(out) : null;
  };
  /** Boca livre: nada pendurado no encaixe da boca (a cenoura, um enfeite…). */
  const mouthFree = (name) => {
    const s = dogs?.[name]?.mouthSocket;
    return !!s && s.children.length === 0;
  };
  const setCarry = (on) => {
    if (!T || T.carry === on) return;
    T.carry = on;
    dogs?.[T.who]?.setCarryPose?.(on ? 'rope' : null);
  };
  function endTug() {
    setCarry(false);
    T = null;
  }
  /** A boca está mesmo na corda? (o desenho de agora, com a cabeça que desvia e tudo) */
  function mouthAt(name, bite) {
    const m = mouthOf(name, _m);
    return !!m && Math.hypot(m.x - bite.x, m.z - bite.z) <= GRIP.miss;
  }

  return {
    /**
     * A dog `c` vai até a corda que prende em `anchor`, morde no ponto `bite` (onde ele está, parado) e segura; a corda
     * alcança `len` m de `anchor`; segurando, ela fica de frente para `face` (padrão: anchor). `yaw`: ela chega sempre
     * por esse rumo (a alça do caixote, de frente para ele); `speed`: a ré do puxão (m/s).
     * @param {any} c
     * @param {{ bite: { x: number, y: number, z: number }, anchor: { x: number, y: number, z: number }, len: number,
     *   face?: { x: number, z: number }, yaw?: number, speed?: number }} o
     */
    start(c, { bite, anchor, len, face = anchor, yaw = undefined, speed = PULL.speed }) {
      endTug();
      const free = mouthFree(c.name);
      let step = null, reach = 0;
      const m = free ? mouthOf(c.name, _m) : null;
      const o = dogs?.[c.name]?.object;
      if (m && o) {
        // o quanto a boca fica à frente do meio do corpo (medido no desenho, que pode estar um quadro atrás do
        // controlador; encostada em algo, o desenho está recuado: head.info.back); o passinho leva o meio até essa
        // distância do ponto mordido, de frente para ele
        const oy = o.rotation.y;
        const back = dogs?.[c.name]?.head?.info?.back || 0;
        reach = clamp((m.x - o.position.x) * Math.sin(oy) + (m.z - o.position.z) * Math.cos(oy) + back, 0.2, 0.55);
        step = planStep(c, bite, reach, world, { yaw });
      } else if (c.dashT > 0) c.dashT = 0;
      T = {
        who: c.name, bite: { x: bite.x, y: bite.y, z: bite.z }, anchor: new THREE.Vector3(anchor.x, anchor.y, anchor.z),
        face: { x: face.x, z: face.z }, len, phase: step ? 'step' : 'grip', t: 0, grip: 0, free, reach, carry: false, step,
        back: !!step?.back, x0: c.x, z0: c.z, ax: 0, az: 1, pulled: 0, speed,
      };
      // sem passinho (já está na corda, ou no ar): só morde se a boca está mesmo nela
      if (!step && (!free || c.jumpT > 0 || !mouthAt(c.name, bite))) T.phase = 'miss';
    },
    /** Por quadro: o passinho, a mordida, o puxão (quanto ela já puxou) e a soltura. */
    update(dt) {
      if (!T) return;
      const c = ctrls[T.who];
      if (T.phase === 'miss') return;
      if (T.phase === 'step') {
        if (!driveStep(c, T.step, dt)) return;
        T.step = null;
        T.phase = T.free && mouthAt(T.who, T.bite) ? 'grip' : 'miss';
        T.t = 0;
        return;
      }
      T.t += dt;
      if (T.phase === 'grip') {
        T.grip = Math.min(1, T.t / GRIP.in);
        if (T.grip > 0.4) setCarry(true);
        if (T.grip >= 1) {
          // mordeu: segura; daqui ela puxa para longe da corda (o eixo vai de onde a corda prende até ela)
          T.phase = 'hold';
          T.x0 = c.x;
          T.z0 = c.z;
          const ax = c.x - T.anchor.x, az = c.z - T.anchor.z, L = Math.hypot(ax, az) || 1;
          T.ax = ax / L;
          T.az = az / L;
          T.pulled = 0;
        }
      } else if (T.phase === 'hold') {
        T.grip = 1;
        T.pulled = Math.max(0, (c.x - T.x0) * T.ax + (c.z - T.z0) * T.az);
      } else if (T.phase === 'let') {
        T.grip = Math.max(0, 1 - T.t / GRIP.out);
        if (T.grip < 0.2) setCarry(false);
        if (T.t >= GRIP.out) endTug();
      }
    },
    /** Solta a corda (a fase manda: puxou o bastante, ou o E). No passinho ou sem morder, desiste. */
    release() {
      if (!T) return;
      if (T.phase === 'grip' || T.phase === 'hold') {
        T.phase = 'let';
        T.t = 0;
      } else if (T.phase !== 'let') endTug();
    },
    /**
     * A trava de quem vai até a corda e segura: no passinho, a intenção de andar (move, de ré se ela passou do ponto) e
     * de frente para a corda; mordendo, a pose de puxar, a boca fechada e, segurando, o direcional puxando (pull). Ela
     * vai de propósito até a corda (reach: a cabeça não desvia dela). O E sempre chega à fase (soltar).
     */
    lockFor(name) {
      // soltando, ela já está livre (anda, troca de dog); a corda só termina de voltar no desenho
      if (!T || T.who !== name || T.phase === 'miss' || T.phase === 'let') return null;
      if (T.phase === 'step') return { action: 'none', faceX: T.step.P.x, faceZ: T.step.P.z, move: T.step.move, reach: true, letGo: true };
      /** @type {import('../../types').InputLock} */
      const L = { action: 'tug', faceX: T.face.x, faceZ: T.face.z, bite: T.grip > 0.3, reach: true, letGo: true };
      if (T.phase === 'hold') L.pull = { ax: T.ax, az: T.az, speed: T.speed };
      return L;
    },
    /**
     * O ponto mordido agora: na boca (k: o quanto, 0..1, na ida e na volta), no máximo `len` de onde a corda prende.
     * Chamado pelo prop na hora de desenhar (depois da animação das dogs, sem atraso de um quadro).
     * @returns {{ pos: THREE.Vector3, k: number } | null} null se ninguém está mordendo
     */
    grip() {
      if (!T || T.grip <= 0 || (T.phase !== 'grip' && T.phase !== 'hold' && T.phase !== 'let')) return null;
      const m = mouthOf(T.who, _g);
      if (!m) return null;
      const d = m.distanceTo(T.anchor);
      if (d > T.len) m.sub(T.anchor).multiplyScalar(T.len / d).add(T.anchor);
      return { pos: m, k: ease(T.grip) };
    },
    /** Onde a corda prende agora (a fase move junto com o portão, por exemplo). */
    setAnchor(x, y, z) {
      if (T) T.anchor.set(x, y, z);
    },
    /** Alguém (ou `name`) está indo até a corda, mordendo, segurando ou soltando? */
    busy: (name = null) => !!T && T.phase !== 'miss' && (name == null || T.who === name),
    /** Em que pé está: 'step' (indo), 'grip' (mordendo), 'hold' (segurando), 'let' (soltando), 'miss' (não mordeu) ou null. */
    phase: () => T?.phase ?? null,
    /** No passinho até a corda? */
    stepping: () => T?.phase === 'step',
    /** Segurando a corda (`name`, ou alguém)? */
    holding: (name = null) => T?.phase === 'hold' && (name == null || T.who === name),
    /** Quanto ela já puxou (m, para longe de onde mordeu). */
    pulled: () => (T?.phase === 'hold' ? T.pulled : 0),
    /** Quem está com a corda (ou null). */
    get who() { return T?.who ?? null; },
    /** A dog está mordendo (com a corda na boca)? */
    biting: () => !!T && (T.phase === 'grip' || T.phase === 'hold') && T.grip > 0.3,
    /** Esquece a tentativa que não mordeu (a fase já deu a dica). */
    clearMiss() {
      if (T?.phase === 'miss') T = null;
    },
    reset: endTug,
  };
}
