// Efeitos aplicados às dogs pelas mecânicas: empurrão animado (knockback), ação temporária que trava
// a entrada (shake, startled…) e "molhada" com decaimento (dog.setWet?.(k)).
// O deslocamento usa world.move (sub-passos + colisão): nunca entra na água, numa parede nem sai dos limites.
// Uso no puzzle: effects.update(dt, ctrls) por quadro; effects.lockFor(name) dentro do lockFor do puzzle.

const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);

export function createDogEffects({ world, dogs }) {
  const st = {};
  const get = (n) => (st[n] ||= { kb: null, action: null, actionT: 0, face: null, wet: 0, wetHold: 0 });

  /**
   * Empurra a dog até (tx, tz) em `dur` s (com colisão). Depois faz `then` ({action, dur, face}).
   * Zera a velocidade e a arrancada da dog.
   */
  function pushTo(c, tx, tz, { dur = 0.4, action = 'startled', face = null, then = null } = {}) {
    const s = get(c.name);
    s.kb = { sx: c.x, sz: c.z, dx: tx - c.x, dz: tz - c.z, t: 0, dur: Math.max(0.05, dur), done: 0 };
    s.action = action;
    s.actionT = dur + (then ? 0 : 0.05);
    s.face = face;
    s.then = then;
    c.v = 0;
    c.dashT = 0;
  }

  /** Empurrão na direção (nx, nz) por `dist` m. */
  function knock(c, nx, nz, dist, opts = {}) {
    const L = Math.hypot(nx, nz) || 1;
    pushTo(c, c.x + (nx / L) * dist, c.z + (nz / L) * dist, opts);
  }

  /** Ação temporária que trava a entrada (ex.: 'shake' 0,9 s). */
  function act(name, action, dur, face = null) {
    const s = get(name);
    s.action = action;
    s.actionT = dur;
    s.face = face;
    s.then = null;
  }

  function setWet(name, k = 1, hold = 1.5) {
    const s = get(name);
    s.wet = Math.max(s.wet, k);
    s.wetHold = hold;
    dogs?.[name]?.setWet?.(s.wet);
  }

  function update(dt, ctrls) {
    for (const n of Object.keys(ctrls)) {
      const c = ctrls[n];
      const s = get(n);
      if (s.kb) {
        const k = s.kb;
        k.t += dt;
        const p = easeOut(Math.min(1, k.t / k.dur));
        const step = p - k.done;
        k.done = p;
        const res = world.move(c.x, c.z, k.dx * step, k.dz * step, c.r, c.size);
        if (Number.isFinite(res.x) && Number.isFinite(res.z)) {
          c.x = res.x;
          c.z = res.z;
        }
        c.v = 0;
        if (k.t >= k.dur) s.kb = null;
      }
      if (s.actionT > 0) {
        s.actionT -= dt;
        if (s.actionT <= 0) {
          s.actionT = 0;
          if (s.then) {
            const th = s.then;
            s.then = null;
            s.action = th.action;
            s.actionT = th.dur;
            s.face = th.face || null;
          } else s.action = null;
        }
      }
      if (s.wet > 0) {
        if (s.wetHold > 0) s.wetHold -= dt;
        else {
          s.wet = Math.max(0, s.wet - dt / 5);
          dogs?.[n]?.setWet?.(s.wet);
        }
      }
    }
  }

  /** Trava de entrada enquanto houver empurrão/ação. → { action, faceX, faceZ } | null */
  function lockFor(name) {
    const s = st[name];
    if (!s || (!s.kb && s.actionT <= 0)) return null;
    return { action: s.action || 'startled', faceX: s.face?.x, faceZ: s.face?.z };
  }

  const busy = (name) => !!st[name] && (!!st[name].kb || st[name].actionT > 0);

  function reset() {
    for (const n of Object.keys(st)) {
      if (st[n].wet > 0) dogs?.[n]?.setWet?.(0);
      delete st[n];
    }
  }

  function info(name) {
    const s = st[name];
    if (!s) return { busy: false, wet: 0 };
    return { busy: busy(name), action: s.actionT > 0 || s.kb ? s.action : null, wet: +s.wet.toFixed(2) };
  }

  return { pushTo, knock, act, setWet, update, lockFor, busy, reset, info, wet: (n) => st[n]?.wet || 0 };
}
