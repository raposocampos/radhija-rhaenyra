// FASE 10 · As galinhas do campinho, no milharal e nos legumes (NPCs de ambientação, inofensivas): ciscam, bicam o chão e andam à
// toa. Uma dog chegando DE FRENTE (no campo de visão dela) a faz sair correndo; chegando por trás, ela nem liga. Um
// latido perto (ou esbarrar nela, ou uma arrancada do lado) assusta de verdade: ela sai batendo as asas num voo curto
// e pousa mais longe. Nunca saem da área delas (cfg.area).
// API: createChickenFlock({ cfg, world, root, emit, createChicken }) →
//   { update(dt, { ctrls }), onBark(c), reset(), info(), hens }
// Eventos (com x, z): chicken:cluck · chicken:alarm (saiu correndo) · chicken:flap (voo curto) · chicken:land.

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * @param {{ cfg: any, world: import('../../types').CollisionWorld, root?: import('three').Object3D | null,
 *   emit?: import('../../types').GameEmit | null, createChicken: (o: { variant: number }) => any }} args
 */
export function createChickenFlock({ cfg, world, root = null, emit = null, createChicken }) {
  const A = cfg.area;
  const r = cfg.r;
  const fire = (name, p) => emit?.(name, p);
  // deterministas por galinha (as partidas automáticas repetem igual)
  let seed = 1;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const inArea = (x, z, m = r) => ({ x: clamp(x, A.minX + m, A.maxX - m), z: clamp(z, A.minZ + m, A.maxZ - m) });

  const hens = cfg.start.map((s, i) => {
    const model = createChicken({ variant: i % 2 });
    if (model?.object) root?.add(model.object);
    const id = `galinha-${i + 1}`;
    const col = world.addDynamic({ id, kind: 'npc', shape: 'circle', x: s.x, z: s.z, r });
    return { i, id, ignore: new Set([id]), model, col, home: s, x: s.x, z: s.z, y: 0, yaw: s.yaw, state: 'idle', t: 0, dur: 1, tx: s.x, tz: s.z, speed: 0, peck: 0, flap: 0, cool: 0, cluckT: 2 + i * 1.7, from: null };
  });

  function setState(H, state, dur, extra = {}) {
    Object.assign(H, { state, t: 0, dur }, extra);
  }
  /** Para onde fugir de (fx, fz): para longe, com um desvio, dentro da área. */
  function awayTarget(H, fx, fz, dist) {
    let a = Math.atan2(H.x - fx, H.z - fz) + (rnd() - 0.5) * 0.9;
    for (let k = 0; k < 6; k++) {
      const p = inArea(H.x + Math.sin(a) * dist, H.z + Math.cos(a) * dist, r + 0.05);
      if (Math.hypot(p.x - H.x, p.z - H.z) > dist * 0.6) return p;
      a += (k % 2 ? 1 : -1) * (k + 1) * 0.5;
    }
    return inArea(H.x + Math.sin(a) * dist, H.z + Math.cos(a) * dist, r + 0.05);
  }
  function scare(H, fx, fz) {
    if (H.state === 'glide') return;
    const p = awayTarget(H, fx, fz, cfg.glideDist + rnd() * 0.6);
    setState(H, 'glide', cfg.glideTime, { from: { x: H.x, z: H.z }, tx: p.x, tz: p.z });
    H.yaw = Math.atan2(p.x - H.x, p.z - H.z);
    H.col.enabled = false;
    fire('chicken:flap', { x: H.x, z: H.z, i: H.i });
  }
  function flee(H, fx, fz) {
    const p = awayTarget(H, fx, fz, 1.6 + rnd() * 0.8);
    setState(H, 'flee', 1.1 + rnd() * 0.5, { tx: p.x, tz: p.z });
    fire('chicken:alarm', { x: H.x, z: H.z, i: H.i });
  }
  /** Anda até (tx, tz) a `speed` m/s, virando para lá; devolve a distância que falta. */
  function walk(H, dt, speed, turn = 7) {
    const dx = H.tx - H.x, dz = H.tz - H.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.03) { H.speed = 0; return d; }
    const want = Math.atan2(dx, dz);
    H.yaw = wrap(H.yaw + clamp(wrap(want - H.yaw), -turn * dt, turn * dt));
    const facing = Math.cos(wrap(want - H.yaw));
    const step = Math.min(d, speed * dt * Math.max(0.2, facing));
    const res = world.move(H.x, H.z, Math.sin(H.yaw) * step, Math.cos(H.yaw) * step, r, 'large', { ignore: H.ignore });
    const p = inArea(res.x, res.z);
    H.speed = Math.hypot(p.x - H.x, p.z - H.z) / Math.max(dt, 1e-4);
    H.x = p.x;
    H.z = p.z;
    // presa num canto: desiste do alvo
    if (H.speed < speed * 0.15 && H.t > 0.4) { H.tx = H.x; H.tz = H.z; }
    return d;
  }

  function step(H, dt, dogs) {
    H.t += dt;
    H.cool = Math.max(0, H.cool - dt);
    // quem vê (de frente) foge correndo; por trás ela nem liga, a não ser que esbarrem nela ou passem em arrancada
    if (H.state !== 'glide' && H.state !== 'flee') {
      for (const c of dogs) {
        const d = Math.hypot(c.x - H.x, c.z - H.z);
        const ahead = Math.abs(wrap(Math.atan2(c.x - H.x, c.z - H.z) - H.yaw)) < cfg.seeAngle;
        if (d < r + c.r + 0.06 || (c.dashT > 0 && d < 1.1)) { scare(H, c.x, c.z); break; }
        if (ahead && d < cfg.seeR && H.cool <= 0) { flee(H, c.x, c.z); break; }
      }
    }
    H.peck = 0;
    H.flap = 0;
    H.y = 0;
    H.scratch = false;
    if (H.state === 'idle') {
      H.speed = 0;
      if (H.t >= H.dur) {
        if (rnd() < 0.55) setState(H, 'peck', 1.2 + rnd() * 1.4);
        else {
          const a = rnd() * TAU, d = 0.4 + rnd() * 0.9;
          const p = inArea(H.x + Math.sin(a) * d, H.z + Math.cos(a) * d, r + 0.1);
          setState(H, 'wander', 4, { tx: p.x, tz: p.z });
        }
      }
    } else if (H.state === 'peck') {
      H.speed = 0;
      // primeiro cisca (raspa a terra com as patas), depois bica rápido, com pausas
      H.scratch = H.t < H.dur * 0.4;
      const k = (H.t * 2.6) % 1;
      H.peck = H.scratch ? 0 : k < 0.35 ? Math.sin((k / 0.35) * Math.PI) : 0;
      if (H.t >= H.dur) setState(H, 'idle', 0.6 + rnd() * 1.6);
    } else if (H.state === 'wander') {
      if (walk(H, dt, cfg.walk, 5) < 0.05 || H.t >= H.dur) setState(H, rnd() < 0.6 ? 'peck' : 'idle', 1 + rnd() * 1.2);
    } else if (H.state === 'flee') {
      const left = walk(H, dt, cfg.run, 10);
      H.flap = 0.25;
      if (left < 0.08 || H.t >= H.dur) { setState(H, 'idle', 1.2 + rnd() * 0.8); H.cool = cfg.calm; }
    } else if (H.state === 'glide') {
      // voo curto: sobe batendo as asas, plana e pousa
      const u = Math.min(1, H.t / H.dur);
      const e = u * u * (3 - 2 * u);
      const tx = H.from.x + (H.tx - H.from.x) * e, tz = H.from.z + (H.tz - H.from.z) * e;
      const res = world.resolve(tx, tz, r, 'large', { ignore: H.ignore, airborne: true });
      const p = inArea(res.x, res.z);
      H.speed = 0;
      H.x = p.x;
      H.z = p.z;
      H.y = Math.sin(Math.PI * u) * cfg.glideHeight;
      H.flap = u < 0.75 ? 1 : 0.4;
      if (u >= 1) {
        H.col.enabled = true;
        H.y = 0;
        fire('chicken:land', { x: H.x, z: H.z, i: H.i });
        setState(H, 'idle', 1.4 + rnd() * 1.0);
        H.cool = cfg.calm;
      }
    }
    // cocoricó de vez em quando (mais quando assustada)
    H.cluckT -= dt;
    if (H.cluckT <= 0) {
      H.cluckT = 3 + rnd() * 5;
      if (H.state !== 'glide') fire('chicken:cluck', { x: H.x, z: H.z, i: H.i });
    }
    H.col.x = H.x;
    H.col.z = H.z;
    H.model?.setPose(H.x, H.y, H.z, H.yaw);
    H.model?.animate(dt, { speed: H.speed, peck: H.peck, flap: H.flap, alarm: H.state === 'flee' || H.cool > cfg.calm * 0.5, scratch: H.scratch, air: H.state === 'glide' ? 1 : 0 });
  }

  return {
    hens,
    /** @param {number} dt @param {{ ctrls: Record<string, any> }} ctx */
    update(dt, { ctrls }) {
      const dogs = Object.values(ctrls).filter((c) => (c.y || 0) < 0.3);
      for (const H of hens) step(H, dt, dogs);
    },
    /** Latido: as que estiverem perto se assustam (voo curto para longe), de frente ou de costas. */
    onBark(c) {
      for (const H of hens) if (Math.hypot(c.x - H.x, c.z - H.z) < cfg.scareR) scare(H, c.x, c.z);
    },
    reset() {
      seed = 1;
      for (const H of hens) {
        Object.assign(H, { x: H.home.x, z: H.home.z, y: 0, yaw: H.home.yaw, state: 'idle', t: 0, dur: 1 + H.i, speed: 0, peck: 0, flap: 0, cool: 0, cluckT: 2 + H.i * 1.7, from: null });
        H.col.enabled = true;
        H.col.x = H.x;
        H.col.z = H.z;
        H.model?.setPose(H.x, 0, H.z, H.yaw);
      }
    },
    info: () => hens.map((H) => ({ x: +H.x.toFixed(3), z: +H.z.toFixed(3), y: +H.y.toFixed(3), state: H.state })),
  };
}
