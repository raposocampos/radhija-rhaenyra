// Empurrão em pé da Rhaenyra, a parte do núcleo (game.js). Com o empurrar seguro (Shift · R1/RB · Empurrar), de frente
// para algo empurrável no alto (puzzle.shoveSpots) ou para a irmã, ela fica de pé nas traseiras, apoia as patas da
// frente e empurra no ritmo enquanto o botão estiver seguro (o roteiro é do controlador: pickShoveSpot, startShove…).
// Aqui ficam: a escolha do alvo (o ponto da irmã acompanha a irmã até as patas chegarem), o botão seguro, a entrega de
// cada empurrão (puzzle.onShove, ou a irmã) e a reação da irmã: um tranco para longe, passinhos para trás andando de
// verdade (com colisão; no Fica ela não sai do lugar) e a cara de "hmpf" olhando para a Rhaenyra. A trava da irmã sai em
// lockFor (como as travas dos extras), o olhar em lookFor e o tranco/"hmpf" em shovedFor/huffFor (para a pose, por cima
// de qualquer ação).
import { pickShoveSpot, startShove, airborne } from './dogController.js';

/** Id do ponto da irmã (ShoveSpot dinâmico). */
export const SISTER_SPOT = 'irma';
/** Reação da irmã (s): tranco, uns passinhos para longe até REACT_STEP, "hmpf" até REACT_DUR. */
export const REACT_JOLT = 0.14;
export const REACT_STEP = 0.66;
export const REACT_DUR = 1.6;
/** Velocidade dos passinhos (m/s): ~0,35 m no total. */
const STEP_SPEED = 1.1;
/** A irmã saiu do lugar desde que as patas chegaram (m): o próximo empurrão não acontece; ela desce. */
const SISTER_LEFT = 0.08;

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * @param {{ emit: import('../types').GameEmit }} opts
 */
export function createShove({ emit }) {
  /** @type {import('../types').ShoveSpot} */
  const sis = { id: SISTER_SPOT, x: 0, z: 0, nx: 0, nz: 1, y: 0.32, w: 0, over: 0.1, kind: 'sister', sister: null, look: { x: 0, y: 0.4, z: 0 } };
  /** Onde estava a irmã quando as patas chegaram (para saber se ela saiu). */
  const sisAt = { x: 0, z: 0, set: false };
  /** Reação da irmã: quem, há quanto tempo, para onde foi empurrada e por quem. */
  const R = { name: /** @type {import('../types').DogName | null} */ (null), t: 0, dx: 0, dz: 0, stay: false, byX: 0, byZ: 0, side: 0, fwd: 0 };

  /**
   * O ponto de apoio na irmã C para quem está em A: no lado do círculo dela virado para A, as patas nas costas. Se ela
   * estiver de frente para A, a cabeça dela passa do círculo: a superfície fica na frente da cabeça e as patas vão no
   * alto da cabeça e no pescoço (assim uma não entra na outra).
   */
  function sisterSpot(A, C) {
    const dx = A.x - C.x;
    const dz = A.z - C.z;
    const L = Math.hypot(dx, dz) || 1;
    const nx = dx / L;
    const nz = dz / L;
    const facing = sstep(0.2, 0.8, Math.sin(C.yaw) * nx + Math.cos(C.yaw) * nz);
    const head = (C.cfg.visual?.length ?? 0.6) * 0.42 - C.r; // quanto a cabeça passa do círculo, de frente
    const back = (C.cfg.visual?.shoulder ?? 0.3) + 0.02;
    const top = (C.cfg.visual?.headTop ?? 0.48) - 0.06;
    const d = C.r + Math.max(0, head) * facing;
    Object.assign(sis, {
      x: C.x + nx * d, z: C.z + nz * d, nx, nz,
      y: back + (top - back) * facing, over: C.r * 0.6 * (1 - facing) + 0.05 * facing, sister: C.name,
    });
    // olha para a cabeça da irmã
    const hl = (C.cfg.visual?.length ?? 0.6) * 0.42;
    sis.look.x = C.x + Math.sin(C.yaw) * hl;
    sis.look.y = C.cfg.visual?.headTop ?? 0.45;
    sis.look.z = C.z + Math.cos(C.yaw) * hl;
    return sis;
  }

  /**
   * Por quadro, com a dog ativa A e a companheira C. held = empurrar seguro (fora de trava); (dx, dz) = direção do
   * analógico no chão (zero sem entrada); spots = puzzle.shoveSpots(); sisterFree = a irmã pode ser empurrada (sem trava
   * da fase/extras, sem lambida); world = colisão (nada no caminho).
   * → true enquanto A está no empurrão em pé (o jogo zera a entrada e usa a ação 'shove').
   * @param {import('../types').DogController} A @param {import('../types').DogController} C
   * @param {{ held: boolean, dx?: number, dz?: number, spots?: import('../types').ShoveSpot[] | null, sisterFree?: boolean,
   *   world?: import('../types').CollisionWorld | null }} o
   */
  function frame(A, C, { held, dx = 0, dz = 0, spots = null, sisterFree = false, world = null }) {
    // trocou de dog no meio: a que virou companheira termina o empurrão em curso e desce
    if (C.shove) C.shoveHeld = false;
    if (A.shove) {
      A.shoveHeld = held;
      if (A.shove === sis) {
        if (A.shoveStage === 'up') {
          // até as patas chegarem, o ponto acompanha a irmã; depois fica onde estava
          sisterSpot(A, C);
          sisAt.set = false;
        } else if (!sisAt.set) {
          Object.assign(sisAt, { x: C.x, z: C.z, set: true });
        } else if (Math.hypot(C.x - sisAt.x, C.z - sisAt.z) > SISTER_LEFT) A.shoveStop = true;
      }
      return true;
    }
    if (!held || A.size !== 'large') return false;
    const list = spots ? [...spots] : [];
    if (sisterFree && !C.shove && !airborne(C) && !(R.name === C.name && R.t < REACT_STEP)) list.push(sisterSpot(A, C));
    const spot = pickShoveSpot(A, list, dx, dz, world);
    if (!spot) return false;
    startShove(A, spot);
    sisAt.set = false;
    emit('dog:rear', { name: A.name, id: spot.id, kind: spot.kind ?? null, x: A.x, z: A.z });
    return true;
  }

  /**
   * O empurrão de c chegou (c.shoveHit): emite dog:shove e entrega ao puzzle (puzzle.onShove) ou à irmã.
   * @param {import('../types').DogController} c @param {import('../types').DogController} comp a outra dog
   * @param {{ puzzle?: import('../types').Puzzle | null, stay?: Record<string, boolean>, ctrls?: Record<string, import('../types').DogController>, playing?: boolean }} o
   */
  function hit(c, comp, { puzzle = null, stay = {}, ctrls = {}, playing = true } = {}) {
    const spot = c.shoveHit;
    c.shoveHit = null;
    if (!spot) return;
    const px = spot.x + spot.nx * 0.04;
    const pz = spot.z + spot.nz * 0.04;
    emit('dog:shove', { name: c.name, id: spot.id, kind: spot.kind ?? null, n: c.shoveN, x: px, y: spot.y, z: pz });
    if (!playing) return;
    if (spot === sis) {
      if (comp && comp.name === spot.sister) react(comp, c, !!stay[comp.name]);
    } else puzzle?.onShove?.(c, spot, ctrls);
  }

  /** A irmã C foi empurrada por A: tranco, passinhos para trás (sem o Fica) e "hmpf". */
  function react(C, A, stayed) {
    const dx = C.x - A.x;
    const dz = C.z - A.z;
    const L = Math.hypot(dx, dz) || 1;
    // de que lado veio o empurrão, no corpo dela: side + = para a direita dela; fwd + = para a frente
    const ux = dx / L;
    const uz = dz / L;
    const fx = Math.sin(C.yaw);
    const fz = Math.cos(C.yaw);
    Object.assign(R, { name: C.name, t: 0, dx: ux, dz: uz, stay: stayed, byX: A.x, byZ: A.z, side: -(ux * fz - uz * fx), fwd: ux * fx + uz * fz });
    emit('dog:shoved', { name: C.name, by: A.name, x: C.x, z: C.z, stay: stayed });
  }

  /** Por quadro (pausa congela: o jogo só chama em 'playing'). */
  function update(dt) {
    if (R.name) {
      const before = R.t;
      R.t += dt;
      if (before < REACT_STEP && R.t >= REACT_STEP) emit('dog:huff', { name: R.name, x: R.byX, z: R.byZ });
      if (R.t >= REACT_DUR) R.name = null;
    }
  }

  /**
   * Trava da irmã durante a reação (como as travas dos extras): parada no tranco, uns passinhos para longe (move, com a
   * colisão normal: ela vira andando) e depois parada, sem girar o corpo (olha para trás com a cabeça: lookFor). No
   * Fica, a trava não vale (ela continua sentada).
   * @param {import('../types').DogController} C a irmã @returns {import('../types').InputLock | null}
   */
  function lockFor(C) {
    if (R.name !== C.name || R.stay) return null;
    const ahead = { faceX: C.x + Math.sin(C.yaw) * 2, faceZ: C.z + Math.cos(C.yaw) * 2 };
    if (R.t < REACT_JOLT || R.t >= REACT_STEP) return { action: 'none', ...ahead };
    const k = sstep(REACT_JOLT, REACT_JOLT + 0.12, R.t) * (1 - sstep(REACT_STEP - 0.12, REACT_STEP, R.t));
    return { action: 'none', ...ahead, move: { dx: R.dx, dz: R.dz, speed: STEP_SPEED * k } };
  }

  /** Para onde a irmã olha durante a reação (quem a empurrou), também no Fica; null fora dela. */
  function lookFor(name) {
    return R.name === name && R.t >= REACT_JOLT ? { x: R.byX, y: 0.45, z: R.byZ } : null;
  }

  /** Tranco de quem foi empurrada (para a pose): { k 0..1, side, fwd } ou null. */
  function shovedFor(name) {
    if (R.name !== name) return null;
    const k = sstep(0, 0.05, R.t) * (1 - sstep(REACT_JOLT, 0.5, R.t));
    return k > 0 ? { k, side: R.side, fwd: R.fwd } : null;
  }

  /** "Hmpf" de quem foi empurrada (0..1, para a pose): orelhas para trás, olhar torto e bufada. */
  function huffFor(name) {
    if (R.name !== name) return 0;
    return sstep(REACT_STEP - 0.1, REACT_STEP + 0.12, R.t) * (1 - sstep(REACT_DUR - 0.3, REACT_DUR, R.t));
  }

  function cancel() {
    R.name = null;
    R.t = 0;
    sisAt.set = false;
  }

  return {
    frame, hit, update, lockFor, lookFor, shovedFor, huffFor, cancel,
    /** A irmã está reagindo a um empurrão (para o jogo não tirar a trava dela). */
    reacting: (name) => R.name === name,
    info: () => (R.name ? { reacting: R.name, t: +R.t.toFixed(2), stay: R.stay } : null),
  };
}
