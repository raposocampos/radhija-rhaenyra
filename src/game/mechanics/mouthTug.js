// Puxar com a boca: a cordinha do portão (fase 1), a cordinha do portãozinho e a do gerador (fase 10). Retorno do
// usuário: "as cordas do portão elas de fato poderiam colocar na boca e puxar, sempre respeitando a física e o
// realismo". No E, a dog dá um passinho até a corda (se a boca não está nela: a fase a move, trava com `drive`),
// morde (o ponto mordido vai para a boca, que fecha nele: pose de carregar 'rope'), puxa na pose de puxar com a
// corda presa e, no fim, solta: a corda volta para o lugar dela. A corda não estica: o ponto mordido fica no máximo
// `len` m de onde ela prende. Com algo na boca, ou sem chegar à corda (algo no caminho), ela puxa como antes.
// O passinho (planStep/driveStep) também serve para chegar a um botão que ela aperta com a pata (fase 9).
//
// Uso na fase: const tug = createMouthTug({ dogs, ctrls, world });
//   no E: tug.start(c, { bite, anchor, len, dur })   (bite: o ponto que ela morde, parado; anchor: onde a corda prende)
//   por quadro: tug.update(dt)   ·   a fase espera tug.pullT() >= 0 para começar o puxão dela
//   no prop: setGrip(tug.grip) (o prop pede a boca na hora de desenhar, depois da animação das dogs)
//   lockFor(name): tug.lockFor(name)   ·   reset(): tug.reset()
import * as THREE from 'three';
import { resolveDogBody } from '../dogController.js';

/** Passinho: velocidade (m/s), o que já está perto (m, rad) e a duração (s). */
const STEP = { speed: 0.9, near: 0.05, turn: 0.3, min: 0.15, max: 0.6 };
/** Mordida: tempo para o ponto mordido ir à boca e para voltar (s); longe assim da corda depois do passinho, não morde (m). */
const GRIP = { in: 0.12, out: 0.16, miss: 0.12 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (u) => u * u * (3 - 2 * u);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * @typedef {{ x0: number, z0: number, x1: number, z1: number, yaw0: number, yaw1: number, t: number, dur: number, back: boolean }} Step
 */

/**
 * Passinho até um ponto: o meio do corpo vai ficar a `reach` m de `P`, de frente para ele (ou chegando pelo rumo `yaw`,
 * quando o ponto só se alcança de um lado, como o botão na base do ventilador). → null se ela já está lá.
 * @param {any} c @param {{ x: number, z: number }} P @param {number} reach @param {any} world
 * @param {{ yaw?: number }} [o]
 * @returns {Step | null}
 */
export function planStep(c, P, reach, world, { yaw } = {}) {
  const yaw1 = yaw ?? Math.atan2(P.x - c.x, P.z - c.z);
  let x1 = P.x - Math.sin(yaw1) * reach;
  let z1 = P.z - Math.cos(yaw1) * reach;
  if (world?.resolve) {
    const r = world.resolve(x1, z1, c.r, c.size);
    x1 = r.x;
    z1 = r.z;
  }
  const dist = Math.hypot(x1 - c.x, z1 - c.z);
  const turn = Math.abs(wrap(yaw1 - c.yaw));
  if (dist <= STEP.near && turn <= STEP.turn) return null;
  const back = (x1 - c.x) * Math.sin(yaw1) + (z1 - c.z) * Math.cos(yaw1) < 0;
  return { x0: c.x, z0: c.z, x1, z1, yaw0: c.yaw, yaw1, t: 0, dur: clamp(Math.max(dist / STEP.speed, turn / 5), STEP.min, STEP.max), back };
}

/**
 * Um quadro do passinho: move a dog (com colisão: nada atravessa) e vira para o rumo. A fase chama no update e a
 * trava pede drive (o núcleo não a move). → true quando chegou.
 * @param {any} c @param {Step} S @param {number} dt @param {any} world
 */
export function driveStep(c, S, dt, world) {
  S.t += dt;
  const u = Math.min(1, S.t / S.dur);
  const e = ease(u);
  const px = c.x, pz = c.z, pyaw = c.yaw;
  c.x = S.x0 + (S.x1 - S.x0) * e;
  c.z = S.z0 + (S.z1 - S.z0) * e;
  if (world?.resolve) {
    const r = world.resolve(c.x, c.z, c.r, c.size);
    c.x = r.x;
    c.z = r.z;
  }
  if (world) resolveDogBody(c, world);
  c.yaw = wrap(S.yaw0 + wrap(S.yaw1 - S.yaw0) * Math.min(1, e * 1.5));
  const idt = 1 / Math.max(dt, 1e-4);
  c.vx = (c.x - px) * idt;
  c.vz = (c.z - pz) * idt;
  c.yawRate = wrap(c.yaw - pyaw) * idt;
  c.v = 0;
  // para a frente, as patas andam; o tiquinho para trás fica com os passinhos de ajuste (parada)
  c.animSpeed = S.back ? 0 : Math.hypot(c.vx, c.vz);
  if (u < 1) return false;
  c.vx = c.vz = 0;
  c.yawRate = 0;
  c.animSpeed = 0;
  return true;
}

/**
 * @param {{ dogs: Record<string, any>, ctrls: Record<string, any>, world?: any }} o
 */
export function createMouthTug({ dogs, ctrls, world = null }) {
  /**
   * @type {null | { who: string, bite: { x: number, y: number, z: number }, anchor: THREE.Vector3, face: { x: number, z: number },
   *   len: number, dur: number, t: number, grip: number, free: boolean, reach: number, carry: boolean, step: Step | null }}
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

  return {
    /**
     * A dog `c` vai puxar a corda que prende em `anchor`, mordendo no ponto `bite` (onde ele está, parado); a corda
     * alcança `len` m de `anchor`; o puxão dura `dur` s; durante ele, a dog fica de frente para `face` (padrão: anchor).
     * → quanto dura o passinho até a corda (0 se a boca já está nela).
     * @param {any} c
     * @param {{ bite: { x: number, y: number, z: number }, anchor: { x: number, y: number, z: number }, len: number, dur: number, face?: { x: number, z: number } }} o
     */
    start(c, { bite, anchor, len, dur, face = anchor }) {
      endTug();
      const free = mouthFree(c.name);
      let step = null, reach = 0;
      const m = free ? mouthOf(c.name, _m) : null;
      const o = dogs?.[c.name]?.object;
      if (m && o) {
        // o quanto a boca fica à frente do meio do corpo (medido no desenho, que pode estar um quadro atrás do
        // controlador; encostada em algo, o desenho está recuado: head.info.back); o passinho leva o meio até essa
        // distância do ponto mordido, de frente para ele (andando para a frente ou, se passou dele, um tiquinho para trás)
        const oy = o.rotation.y;
        const back = dogs?.[c.name]?.head?.info?.back || 0;
        reach = clamp((m.x - o.position.x) * Math.sin(oy) + (m.z - o.position.z) * Math.cos(oy) + back, 0.2, 0.55);
        step = planStep(c, bite, reach, world);
      }
      T = {
        who: c.name, bite: { x: bite.x, y: bite.y, z: bite.z }, anchor: new THREE.Vector3(anchor.x, anchor.y, anchor.z),
        face: { x: face.x, z: face.z }, len, dur, t: 0, grip: 0, free, reach, carry: false, step,
      };
      return step ? step.dur : 0;
    },
    /** Por quadro: o passinho (move a dog, com colisão), depois a mordida (vai, segura e solta). */
    update(dt) {
      if (!T) return;
      const c = ctrls[T.who];
      if (T.step) {
        if (!driveStep(c, T.step, dt, world)) return;
        T.step = null;
        // não chegou à corda (algo no caminho): puxa sem morder
        const mx = c.x + Math.sin(c.yaw) * T.reach, mz = c.z + Math.cos(c.yaw) * T.reach;
        if (Math.hypot(mx - T.bite.x, mz - T.bite.z) > GRIP.miss) T.free = false;
        return;
      }
      T.t += dt;
      if (T.free) {
        T.grip = T.t < T.dur - GRIP.out ? Math.min(1, T.t / GRIP.in) : Math.max(0, (T.dur - T.t) / GRIP.out);
        if (T.grip > 0.4) setCarry(true);
        else if (T.grip < 0.2 && T.t > GRIP.in) setCarry(false);
      }
      if (T.t >= T.dur) endTug();
    },
    /**
     * A trava de quem puxa: no passinho a fase move a dog (drive); puxando, de frente para a corda, mordendo. As duas
     * vão de propósito até a corda (reach: a cabeça não desvia dela).
     */
    lockFor(name) {
      if (!T || T.who !== name) return null;
      if (T.step) return { action: 'none', faceX: T.bite.x, faceZ: T.bite.z, drive: true, reach: true };
      return { action: 'tug', faceX: T.face.x, faceZ: T.face.z, bite: T.grip > 0.3, reach: true };
    },
    /**
     * O ponto mordido agora: na boca (k: o quanto, 0..1, na ida e na volta), no máximo `len` de onde a corda prende.
     * Chamado pelo prop na hora de desenhar (depois da animação das dogs, sem atraso de um quadro).
     * @returns {{ pos: THREE.Vector3, k: number } | null} null se ninguém está mordendo
     */
    grip() {
      if (!T || T.step || !T.free || T.grip <= 0) return null;
      const m = mouthOf(T.who, _g);
      if (!m) return null;
      const d = m.distanceTo(T.anchor);
      if (d > T.len) m.sub(T.anchor).multiplyScalar(T.len / d).add(T.anchor);
      return { pos: m, k: ease(T.grip) };
    },
    /** Alguém (ou `name`) está indo até a corda ou puxando? */
    busy: (name = null) => !!T && (name == null || T.who === name),
    /** No passinho até a corda? */
    stepping: () => !!T?.step,
    /** Quanto tempo (s) do puxão já passou (−1: nenhum puxão; no passinho, ainda não começou). */
    pullT: () => (T && !T.step ? T.t : -1),
    /** Quem está puxando (ou null). */
    get who() { return T?.who ?? null; },
    /** A dog está mordendo (com a corda na boca)? */
    biting: () => !!T && !T.step && T.free && T.grip > 0.3,
    reset: endTug,
  };
}
