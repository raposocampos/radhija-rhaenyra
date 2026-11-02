// Diretor de cena (kit de cenas do Modo História): o que os beats usam para mexer no mundo.
//  - Dogs: hold(nome) segura a dog numa pose roteirizada (o núcleo não a move: lockFor devolve uma trava com drive);
//    pose() põe no lugar, walk() leva por uma lista de pontos com o rumo suave, e a trava leva a ação, a inclinação, o
//    pulinho (airK), o deitar (lie), a pata erguida (press) e para onde olhar (look). release() devolve ao jogador.
//  - Câmera: shot({ from, look }) segura um plano (o focusShot do cameraRig com hold infinito; cut = sem transição),
//    dolly() faz o travelling mexendo nos mesmos pontos (o rig lê por referência a cada quadro), follow() volta ao
//    seguimento com uma transição e snapFollow() corta direto.
//  - Efeitos: balão de ícone, som (story:sfx), música (story:music), ambiente (story:ambience) e o preto (story:fade).
// Nada aqui muda o estado da missão: isso fica no commit de cada cena (src/story/scene/sequencer.js).
import { lerpAngle, smooth } from './sequencer.js';

const NAMES = ['radhija', 'rhaenyra'];

/**
 * @param {{ ctx: import('../../types').PuzzleContext<any>, balloons?: ReturnType<typeof import('./balloons.js').createBalloons> | null,
 *   emit: (name: string, payload?: object) => void }} opts
 */
export function createDirector({ ctx, balloons = null, emit }) {
  const { ctrls, cam, dogs } = ctx;
  /** @type {Record<string, any>} */
  const A = { radhija: null, rhaenyra: null };
  const shotFrom = { x: 0, y: 0, z: 0 };
  const shotLook = { x: 0, y: 0, z: 0 };
  let shotOn = false;
  let lastDt = 1 / 60;

  function actor(name) {
    if (!A[name]) {
      const c = ctrls[name];
      A[name] = {
        x: c.x, y: c.y || 0, z: c.z, yaw: c.yaw, speed: 0, action: 'none', slope: 0, airK: -1, crouch: 0,
        lie: null, press: null, look: null, walk: null, px: c.x, pz: c.z,
      };
    }
    return A[name];
  }

  /** Escreve a pose no controlador (como o pose() das fases 7, 9 e 10). */
  function write(name) {
    const a = A[name];
    const c = ctrls[name];
    if (!a || !c) return;
    const px = c.x, pz = c.z;
    c.x = a.x;
    c.z = a.z;
    c.y = a.y;
    c.yaw = a.yaw;
    c.wantYaw = a.yaw;
    c.v = 0;
    c.dashT = 0;
    c.jumpT = 0;
    c.animSpeed = a.speed;
    const idt = 1 / Math.max(1e-4, lastDt);
    c.vx = (c.x - px) * idt;
    c.vz = (c.z - pz) * idt;
  }

  /** Cabeça da dog no mundo (para balões e olhares). */
  function head(name, up = 0) {
    const c = ctrls[name];
    const vis = c.cfg.visual || { length: 0.6, headTop: 0.5 };
    const f = vis.length * 0.32;
    return { x: c.x + Math.sin(c.yaw) * f, y: (c.y || 0) + vis.headTop + up, z: c.z + Math.cos(c.yaw) * f };
  }

  return {
    /** Segura as dogs (todas, ou as do nome) nas poses da cena, de onde elas estão. */
    hold(...names) { for (const n of names.length ? names : NAMES) actor(n); },
    /** Devolve a dog ao jogador, no chão, onde ela está (reinicia a IA). */
    release(...names) {
      for (const n of names.length ? names : NAMES) {
        const a = A[n];
        if (!a) continue;
        A[n] = null;
        const c = ctrls[n];
        c.y = 0;
        c.animSpeed = 0;
        ctx.place(n, a.x, a.z, a.yaw);
      }
    },
    held: (name) => !!A[name],
    /** Põe a dog na pose (o que não vier fica como está). */
    pose(name, p) {
      const a = actor(name);
      Object.assign(a, p);
      if (p.walk === undefined && (p.x !== undefined || p.z !== undefined)) a.walk = null;
      write(name);
    },
    /**
     * Anda pelos pontos a `speed` m/s, virando suave; `face` (opcional) é para onde ela olha ao chegar.
     * @param {string} name @param {{ x: number, z: number }[]} pts @param {{ speed?: number, face?: number, action?: string }} [o]
     */
    walk(name, pts, { speed = 1.6, face = null, action = 'none' } = {}) {
      const a = actor(name);
      a.walk = { pts: pts.slice(), i: 0, speed, face };
      a.action = action;
      a.lie = null;
    },
    walking: (name) => !!A[name]?.walk,
    /** O estado do ator (para a cena ler e mexer: ação, pulinho, olhar). */
    actor,
    /** A trava do núcleo para a dog (drive: a fase move). */
    lockFor(name) {
      const a = A[name];
      if (!a) return null;
      return {
        action: a.action, faceX: a.x + Math.sin(a.yaw), faceZ: a.z + Math.cos(a.yaw), drive: true,
        slope: a.slope, airK: a.airK, crouch: a.crouch, lie: a.lie, press: a.press, look: a.look, reach: !!a.press,
      };
    },
    update(dt) {
      lastDt = dt > 0 ? dt : lastDt;
      for (const n of NAMES) {
        const a = A[n];
        if (!a) continue;
        if (a.walk) {
          const w = a.walk;
          const p = w.pts[w.i];
          if (!p) {
            a.walk = null;
            a.speed = 0;
          } else {
            const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
            const step = w.speed * dt;
            if (d <= step || d < 1e-4) {
              a.x = p.x;
              a.z = p.z;
              w.i++;
              if (w.i >= w.pts.length) {
                a.walk = null;
                a.speed = 0;
                if (w.face !== null) a.yaw = w.face;
              }
            } else {
              a.x += (dx / d) * step;
              a.z += (dz / d) * step;
              a.yaw = lerpAngle(a.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 9));
              a.speed = w.speed;
            }
          }
        } else if (a.speed > 0 && !a.keepSpeed) a.speed = Math.max(0, a.speed - dt * 6);
        write(n);
      }
    },

    // ---------------------------------------------------------------- câmera
    /** Segura um plano: a câmera em `from` olhando para `look`. cut: sem transição; inT: segundos da transição. */
    shot(from, look, { cut = false, inT = 0.9 } = {}) {
      Object.assign(shotFrom, from);
      Object.assign(shotLook, look);
      shotOn = true;
      cam.focusShot(look.x, look.z, { target: shotLook, from: shotFrom, hold: Infinity, inT: cut ? 0.0001 : inT, outT: 0.8 });
    },
    /** Travelling: mistura dois planos (k de 0 a 1, suavizado), mexendo no plano segurado. */
    dolly(fromA, fromB, lookA, lookB, k) {
      const e = smooth(k);
      for (const key of ['x', 'y', 'z']) {
        shotFrom[key] = fromA[key] + (fromB[key] - fromA[key]) * e;
        shotLook[key] = lookA[key] + (lookB[key] - lookA[key]) * e;
      }
    },
    /** Mexe só no ponto para onde a câmera olha (acompanhar uma dog, um pombo). */
    lookAt(p) { Object.assign(shotLook, p); },
    /** Volta ao seguimento da dog ativa, com uma transição de `outT` s. */
    follow(outT = 1.0) {
      if (!shotOn) return;
      shotOn = false;
      cam.behind?.(ctrls[ctx.activeDog].yaw);
      cam.focusShot(shotLook.x, shotLook.z, { target: { ...shotLook }, from: { ...shotFrom }, hold: 0, inT: 0.0001, outT });
    },
    /** Corta direto para o seguimento (no preto, ou ao pular a cena). */
    snapFollow() {
      shotOn = false;
      const c = ctrls[ctx.activeDog];
      cam.snapFollow(c.x, c.z, c.yaw);
    },
    get shotOn() { return shotOn; },

    // ---------------------------------------------------------------- efeitos
    /** Balão de ícone em cima da cabeça de uma dog (who) ou num ponto (at). */
    /** @param {string} icon @param {{ who?: string | null, at?: { x: number, y: number, z: number } | null, kind?: 'fala' | 'pensamento' | 'solto', life?: number, size?: number, up?: number, flip?: boolean }} [o] */
    balloon(icon, { who = null, at = null, kind = 'fala', life = 2, size = 0.42, up = 0.3, flip = false } = {}) {
      if (!balloons) return 0;
      return balloons.show(icon, { kind, life, size, flip, at, follow: who ? () => head(who, up) : null });
    },
    clearBalloons() { balloons?.clear(); },
    head,
    /** Latido de cena (a animação e o som de sempre, pelo dog:bark). */
    bark(name) {
      const c = ctrls[name];
      dogs[name]?.triggerBark?.();
      emit('dog:bark', { name, x: c.x, z: c.z, scene: true });
    },
    sfx(name, opts = {}) { emit('story:sfx', { name, ...opts }); },
    music(id) { emit('story:music', { id }); },
    ambience(kind) { emit('story:ambience', { kind }); },
    fade(to, dur = 0.5) { emit('story:fade', { to, dur }); },
    /** Solta tudo (fim de cena): devolve as dogs que ainda estiverem seguradas e a câmera ao seguimento. */
    cleanup({ snap = false } = {}) {
      balloons?.clear();
      for (const n of NAMES) if (A[n]) A[n] = null;
      if (snap) this.snapFollow();
      else this.follow(0.8);
    },
  };
}
