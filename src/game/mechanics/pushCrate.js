// Caixote empurrável em 2 eixos (mini-Sokoban).
// - Só dogs 'large' empurram, segurando Shift, encostadas numa face e indo contra ela.
// - Desliza no eixo dominante do empurrão (X ou Z), com aceleração/desaceleração.
// - Colide (como caixa) com os colisores estáticos e dinâmicos do mundo; respeita limites
//   {minX,maxX,minZ,maxZ}; nunca esmaga a companheira (empurra-a; se não couber, para).
// - Gancho onLimit({x, z, axis, dir}) → true quando o puzzle assume (ex.: cair num vão e virar ponte).
// prop?.setPos(x, z). Emite crate:move {x, z, speed}, dog:pushStart / dog:pushEnd.
import { approach } from '../dogController.js';
import { penCircleBox } from '../collision.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createPushCrate({ id = 'crate', cfg, world, emit, prop = null, onLimit = null }) {
  const h = cfg.half;
  const col = world.addDynamic({ id, kind: 'crate', shape: 'box', x: cfg.start.x, z: cfg.start.z, hx: h, hz: h });
  const S = { x: cfg.start.x, z: cfg.start.z, v: 0, axis: 'x', dir: 0, pushing: false, pushOffT: 0, pusher: null, blockedBy: null, enabled: true, moved: 0 };

  function setPos(x, z) {
    S.x = x;
    S.z = z;
    col.x = x;
    col.z = z;
    prop?.setPos?.(x, z);
  }

  /** A caixa em (x, z) invade algum colisor do mundo? → id do colisor ou null. */
  function blockedAt(x, z) {
    const eps = 0.006;
    for (const list of [world.statics, world.dynamics]) {
      for (const c of list) {
        if (c === col || c.enabled === false || c.blocks === 'small' || c.companionOnly || c.kind === 'zone' || c.crateIgnore) continue;
        let hit = false;
        if (c.shape === 'box') hit = Math.abs(c.x - x) < c.hx + h - eps && Math.abs(c.z - z) < c.hz + h - eps;
        else if (c.shape === 'circle') hit = !!penCircleBox(c.x, c.z, Math.max(0, c.r - eps), x, z, h, h);
        else if (c.shape === 'segment') {
          // amostra o segmento (cápsula) contra a caixa
          const L = Math.hypot(c.bx - c.ax, c.bz - c.az);
          const n = Math.max(2, Math.ceil(L / 0.05));
          const tt = Math.max(0.001, (c.t ?? 0.05) - eps);
          for (let i = 0; i <= n && !hit; i++) {
            const px = c.ax + ((c.bx - c.ax) * i) / n;
            const pz = c.az + ((c.bz - c.az) * i) / n;
            if (penCircleBox(px, pz, tt, x, z, h, h)) hit = true;
          }
        }
        if (hit) return c.id || 'obstacle';
      }
    }
    return null;
  }

  /** Face de contato da dog c: { axis, dir (sentido do empurrão), faceDist, lateral } */
  function faceOf(c) {
    const dx = c.x - S.x;
    const dz = c.z - S.z;
    const ex = Math.abs(dx) - h;
    const ez = Math.abs(dz) - h;
    if (ex > ez) return { axis: 'x', dir: dx < 0 ? 1 : -1, faceDist: ex - c.r, lateral: Math.abs(dz) };
    return { axis: 'z', dir: dz < 0 ? 1 : -1, faceDist: ez - c.r, lateral: Math.abs(dx) };
  }

  /**
   * Intenção da dog ativa perto do caixote. → { intent?, action?, contact: 'push'|'needShift'|'strain'|null, face }
   */
  function modifyIntent(dt, c, intent, { shift }) {
    const out = { intent: null, action: null, contact: null };
    if (!S.enabled) return out;
    const moving = intent.speed > 0.05 && (intent.dx || intent.dz);
    let pushNow = false;
    let f = null;
    if (moving) {
      f = faceOf(c);
      const along = f.axis === 'x' ? intent.dx * f.dir : intent.dz * f.dir;
      const atFace = f.faceDist > -0.06 && f.faceDist < 0.1 && f.lateral < h + 0.03;
      if (atFace && along > 0.5) {
        if (c.size === 'large') {
          if (shift) pushNow = true;
          else out.contact = 'needShift';
        } else {
          out.contact = 'strain';
          out.action = 'strain';
        }
      } else if (c.size !== 'large') {
        const t = world.contacts(c.x, c.z, c.r, c.size, { margin: 0.05 }).find((k) => k.id === id);
        if (t && -(intent.dx * t.nx + intent.dz * t.nz) > 0.45) {
          out.contact = 'strain';
          out.action = 'strain';
        }
      }
    }
    if (pushNow) {
      out.contact = 'push';
      // muda de eixo só depois de parar
      if (f.axis !== S.axis && Math.abs(S.v) > 0.05) S.dir = 0;
      else {
        S.axis = f.axis;
        S.dir = f.dir;
      }
      S.pusher = c.name;
      S.pushOffT = 0;
      if (!S.pushing) {
        S.pushing = true;
        emit?.('dog:pushStart', { name: c.name, x: c.x, z: c.z });
      }
      // mantém a dog centralizada na face enquanto empurra
      const lat = f.axis === 'x' ? S.z - c.z : S.x - c.x;
      const corr = clamp(lat * 1.6, -0.35, 0.35);
      const ix = f.axis === 'x' ? f.dir : corr;
      const iz = f.axis === 'x' ? corr : f.dir;
      const L = Math.hypot(ix, iz);
      out.intent = { dx: ix / L, dz: iz / L, speed: Math.max(0.25, Math.abs(S.v) + 0.12), turnScale: 0.8 };
      out.action = 'push';
    } else {
      S.dir = 0;
      if (S.pushing) {
        S.pushOffT += dt;
        if (S.pushOffT > 0.15) endPush();
      }
    }
    out.face = f;
    return out;
  }

  function endPush() {
    if (!S.pushing) return;
    S.pushing = false;
    emit?.('dog:pushEnd', { name: S.pusher });
  }

  /** Dinâmica do caixote (depois do modifyIntent). comp: companheira (não pode ser esmagada). */
  /** @param {number} dt @param {{ comp?: import('../../types').DogController, pushSpeed?: number }} [ctx] */
  function update(dt, { comp, pushSpeed } = {}) {
    if (!S.enabled) return;
    const target = S.dir ? S.dir * (pushSpeed ?? cfg.pushSpeed) : 0;
    S.v = approach(S.v, target, (S.dir ? 3.2 : 7.0) * dt);
    S.blockedBy = null;
    if (Math.abs(S.v) < 1e-4) {
      S.v = 0;
      return;
    }
    const isX = S.axis === 'x';
    const dirSign = Math.sign(S.v);
    let nx = S.x;
    let nz = S.z;
    if (isX) nx += S.v * dt;
    else nz += S.v * dt;
    // limites
    const lo = isX ? cfg.minX : cfg.minZ;
    const hi = isX ? cfg.maxX : cfg.maxZ;
    const cur = isX ? nx : nz;
    if (cur <= lo || cur >= hi) {
      const lim = cur <= lo ? lo : hi;
      if (isX) nx = lim;
      else nz = lim;
      if (onLimit?.({ x: nx, z: nz, axis: S.axis, dir: dirSign, pushing: S.dir !== 0 })) {
        S.v = 0;
        return;
      }
      S.v = 0;
      S.blockedBy = 'limit';
    }
    if (nx === S.x && nz === S.z) return;
    const b = blockedAt(nx, nz);
    if (b) {
      S.v = 0;
      S.blockedBy = b;
      return;
    }
    const px = S.x;
    const pz = S.z;
    col.x = nx;
    col.z = nz;
    // não esmaga a companheira
    if (comp) {
      const p = penCircleBox(comp.x, comp.z, comp.r, nx, nz, h, h);
      if (p) {
        const res = world.resolve(comp.x, comp.z, comp.r, comp.size);
        if (world.overlaps(res.x, res.z, comp.r * 0.98, comp.size)) {
          col.x = px;
          col.z = pz;
          S.v = 0;
          S.blockedBy = 'companion';
          return;
        }
        comp.x = res.x;
        comp.z = res.z;
      }
    }
    setPos(nx, nz);
    S.moved += Math.hypot(nx - px, nz - pz);
    emit?.('crate:move', { x: nx, z: nz, speed: Math.abs(S.v), axis: S.axis });
  }

  function disable() {
    S.enabled = false;
    col.enabled = false;
    endPush();
    S.v = 0;
    S.dir = 0;
  }

  function reset() {
    S.enabled = true;
    col.enabled = true;
    S.v = 0;
    S.dir = 0;
    S.axis = 'x';
    S.pushing = false;
    S.pushOffT = 0;
    S.moved = 0;
    setPos(cfg.start.x, cfg.start.z);
  }

  return {
    id, col, modifyIntent, update, setPos, blockedAt, disable, reset, endPush, faceOf,
    get x() { return S.x; },
    get z() { return S.z; },
    get v() { return S.v; },
    get pushing() { return S.pushing; },
    get blockedBy() { return S.blockedBy; },
    get enabled() { return S.enabled; },
    get half() { return h; },
    info: () => ({ x: +S.x.toFixed(3), z: +S.z.toFixed(3), v: +S.v.toFixed(3), axis: S.axis, pushing: S.pushing, blockedBy: S.blockedBy, enabled: S.enabled }),
  };
}

