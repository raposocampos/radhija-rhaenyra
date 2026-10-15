// NPC Dona Gansa: patrulha → alerta → investida → recuo; latido → atraída → curiosa → volta.
// Reage só à dog ATIVA. Na investida, se encosta: knockback suave (action 'startled') + goose:hit.
// Colisor dinâmico circular (bloqueia as dogs). Movimento com world.move (nunca entra na água).
// cfg (layout GOOSE): { home, patrol:[a,b], radius, alertR, lureR, lureStop, curiousTime, walkSpeed,
//                       chargeSpeed, chargeTime, knockback, cooldown }
// Modelo: createGoose() de src/characters/goose.js (update(dt, {speed, turn, action, lookAt}), triggerHonk()).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const wrap = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

function closestOnSeg(px, pz, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const L2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.z) * abz) / L2));
  return { x: a.x + abx * t, z: a.z + abz * t };
}

export function createGooseNPC({ cfg, world, nav = null, root, emit, effects, createGoose, leash = 3.4, territory = 1.2 }) {
  const model = createGoose?.() || null;
  if (model?.object) root?.add(model.object);
  const r = cfg.radius ?? model?.radius ?? 0.22;
  const col = world.addDynamic({ id: 'gansa', kind: 'npc', shape: 'circle', x: cfg.home.x, z: cfg.home.z, r });
  const ignore = new Set(['gansa']);
  const look = new THREE.Vector3();
  const P = cfg.patrol;

  const S = {
    x: cfg.home.x, z: cfg.home.z, yaw: Math.PI, speed: 0, yawRate: 0,
    state: 'patrol', t: 0, idx: 0, pauseT: 0, cooldown: 0,
    target: null, lure: null, victim: null, chargeDx: 0, chargeDz: 0, route: [],
    stuckT: 0, action: 'idle', lookAt: null, hits: 0, lures: 0,
  };

  const distTo = (c) => Math.hypot(c.x - S.x, c.z - S.z);

  /** Rota até (tx, tz) pelo grafo de navegação da fase (contorna lago/ponte). → lista de pontos. */
  function plan(tx, tz) {
    if (!nav) return [{ x: tx, z: tz }];
    col.enabled = false; // o próprio colisor não conta no planejamento
    let res = null;
    try {
      res = nav.findPath({ x: S.x, z: S.z }, { x: tx, z: tz }, { r, size: 'large', flags: {} });
    } finally {
      col.enabled = true;
    }
    if (!res || res.direct) return [{ x: tx, z: tz }];
    const pts = res.waypoints.map((w) => ({ x: w.x, z: w.z }));
    return res.reachable ? [...pts, { x: tx, z: tz }] : pts;
  }
  /** Segue a rota S.route; → true ao chegar no último ponto. */
  function follow(speed, dt, ctrls, opts) {
    while (S.route.length > 1 && Math.hypot(S.route[0].x - S.x, S.route[0].z - S.z) < 0.25) S.route.shift();
    const p = S.route[0];
    if (!p) return true;
    const last = S.route.length === 1;
    const arrived = walkTo(p.x, p.z, speed, dt, ctrls, { ...opts, arrive: last ? opts?.arrive ?? 0.1 : 0.25 });
    if (arrived && !last) {
      S.route.shift();
      return false;
    }
    return arrived && last;
  }
  const distPatrol = () => {
    const q = closestOnSeg(S.x, S.z, P[0], P[1]);
    return Math.hypot(q.x - S.x, q.z - S.z);
  };

  function setState(s) {
    S.state = s;
    S.t = 0;
    S.stuckT = 0;
  }

  /** Anda em direção a (tx, tz). → true se chegou. avoid: dogs que ela não atropela. */
  function walkTo(tx, tz, speed, dt, ctrls, { avoid = true, arrive = 0.08 } = {}) {
    const dx = tx - S.x;
    const dz = tz - S.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) {
      S.speed = 0;
      return true;
    }
    faceDir(dx, dz, dt, 7);
    const step = Math.min(d, speed * dt);
    const res = world.move(S.x, S.z, (dx / d) * step, (dz / d) * step, r, 'large', { ignore });
    let ok = true;
    if (avoid && ctrls) {
      for (const n of Object.keys(ctrls)) {
        const c = ctrls[n];
        if (Math.hypot(c.x - res.x, c.z - res.z) < r + c.r + 0.03 && Math.hypot(c.x - S.x, c.z - S.z) >= Math.hypot(c.x - res.x, c.z - res.z)) ok = false;
      }
    }
    const moved = ok ? Math.hypot(res.x - S.x, res.z - S.z) : 0;
    if (ok) {
      S.x = res.x;
      S.z = res.z;
    }
    S.speed = moved / Math.max(dt, 1e-4);
    S.stuckT = moved < step * 0.3 ? S.stuckT + dt : 0;
    return false;
  }

  function faceDir(dx, dz, dt, rate = 6) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
    const want = Math.atan2(dx, dz);
    const d = wrap(want - S.yaw);
    const stp = Math.max(-rate * dt, Math.min(rate * dt, d * 10 * dt));
    S.yaw = wrap(S.yaw + stp);
    S.yawRate = stp / Math.max(dt, 1e-4);
  }

  function honk() {
    model?.triggerHonk?.();
    emit?.('goose:honk', { x: S.x, z: S.z });
  }

  function canAlert(active) {
    if (!active || S.cooldown > 0) return false;
    if (effects?.busy?.(active.name)) return false;
    return distTo(active) < cfg.alertR;
  }

  function startAlert(active) {
    setState('alert');
    S.victim = active.name;
    S.speed = 0;
    emit?.('goose:alert', { name: active.name, x: S.x, z: S.z });
    honk();
  }

  /** Latido (de qualquer dog). → true se a gansa foi atraída. */
  function onBark(c) {
    if (S.state === 'alert' || S.state === 'charge') return false;
    const d = distTo(c);
    if (d > cfg.lureR) return false;
    // ponto a lureStop de quem latiu, do lado da gansa
    const k = d > 1e-3 ? cfg.lureStop / d : 0;
    S.lure = { x: c.x + (S.x - c.x) * k, z: c.z + (S.z - c.z) * k, bx: c.x, bz: c.z, by: c.name };
    const first = S.state !== 'lured' && S.state !== 'curious';
    S.lures++;
    if (d <= cfg.lureStop + 0.1) setState('curious');
    else {
      setState('lured');
      S.route = plan(S.lure.x, S.lure.z);
    }
    if (first) honk();
    emit?.('goose:lured', { name: c.name, x: S.x, z: S.z, tx: S.lure.x, tz: S.lure.z });
    return true;
  }

  function update(dt, { active, ctrls }) {
    S.cooldown = Math.max(0, S.cooldown - dt);
    S.t += dt;
    S.lookAt = null;
    let action = 'idle';
    switch (S.state) {
      case 'patrol': {
        if (canAlert(active)) { startAlert(active); action = 'alert'; break; }
        if (S.pauseT > 0) {
          S.pauseT -= dt;
          S.speed = 0;
          action = 'idle';
          if (S.pauseT <= 0) S.idx = 1 - S.idx;
          break;
        }
        const p = P[S.idx];
        if (walkTo(p.x, p.z, cfg.walkSpeed, dt, ctrls) || S.stuckT > 1.0) S.pauseT = 1.3;
        action = S.speed > 0.05 ? 'walk' : 'idle';
        break;
      }
      case 'alert': {
        const v = ctrls?.[S.victim];
        if (!v || active?.name !== S.victim) { setState('retreat'); break; }
        faceDir(v.x - S.x, v.z - S.z, dt, 9);
        S.speed = 0;
        S.lookAt = { x: v.x, y: 0.3, z: v.z };
        action = S.t < 0.22 ? 'alert' : 'honk';
        if (S.t > 0.5) {
          setState('charge');
          const d = distTo(v) || 1;
          S.chargeDx = (v.x - S.x) / d;
          S.chargeDz = (v.z - S.z) / d;
          emit?.('goose:charge', { name: v.name, x: S.x, z: S.z });
        }
        break;
      }
      case 'charge': {
        const v = ctrls?.[S.victim];
        action = 'charge';
        if (!v || active?.name !== S.victim) { setState('retreat'); S.cooldown = cfg.cooldown; break; }
        // persegue com giro limitado
        const d = distTo(v);
        if (d > 1e-3) {
          const want = Math.atan2(v.x - S.x, v.z - S.z);
          const cur = Math.atan2(S.chargeDx, S.chargeDz);
          const nd = cur + Math.max(-3 * dt, Math.min(3 * dt, wrap(want - cur)));
          S.chargeDx = Math.sin(nd);
          S.chargeDz = Math.cos(nd);
        }
        faceDir(S.chargeDx, S.chargeDz, dt, 14);
        const step = cfg.chargeSpeed * dt;
        const res = world.move(S.x, S.z, S.chargeDx * step, S.chargeDz * step, r, 'large', { ignore });
        const moved = Math.hypot(res.x - S.x, res.z - S.z);
        S.x = res.x;
        S.z = res.z;
        S.speed = moved / Math.max(dt, 1e-4);
        S.lookAt = { x: v.x, y: 0.3, z: v.z };
        if (distTo(v) < r + v.r + 0.07) {
          // acertou: knockback suave para longe da gansa
          const kx = v.x - S.x;
          const kz = v.z - S.z;
          S.hits++;
          emit?.('goose:hit', { name: v.name, x: v.x, z: v.z });
          effects?.knock(v, kx, kz, cfg.knockback, { dur: 0.42, action: 'startled', face: { x: S.x, z: S.z }, then: { action: 'startled', dur: 0.22, face: { x: S.x, z: S.z } } });
          honk();
          setState('retreat');
          S.cooldown = cfg.cooldown + 0.6;
          break;
        }
        const far = Math.hypot(S.x - cfg.home.x, S.z - cfg.home.z) > leash;
        if (S.t > cfg.chargeTime || far || moved < step * 0.2) {
          setState('retreat');
          S.cooldown = cfg.cooldown;
        }
        break;
      }
      case 'retreat':
      case 'return': {
        const q = closestOnSeg(S.x, S.z, P[0], P[1]);
        const inTerritory = distPatrol() < territory;
        if (inTerritory && canAlert(active)) { startAlert(active); action = 'alert'; break; }
        let arrived;
        if (S.state === 'return' && S.route.length && !inTerritory) arrived = follow(cfg.walkSpeed, dt, ctrls, { arrive: 0.12 }) && distPatrol() < 0.15;
        else arrived = walkTo(q.x, q.z, cfg.walkSpeed * (S.state === 'retreat' ? 1.1 : 1), dt, ctrls, { arrive: 0.12 });
        action = S.speed > 0.05 ? 'walk' : 'idle';
        if (arrived || (S.stuckT > 1.5 && inTerritory)) {
          setState('patrol');
          S.pauseT = 0.6;
          const d0 = Math.hypot(P[0].x - S.x, P[0].z - S.z);
          const d1 = Math.hypot(P[1].x - S.x, P[1].z - S.z);
          S.idx = d0 > d1 ? 0 : 1;
        }
        break;
      }
      case 'lured': {
        const L = S.lure;
        // atraída: não empaca nas dogs (passa encostando), senão ficaria curiosa na cabeceira da ponte
        const arrived = follow(cfg.walkSpeed * 1.35, dt, ctrls, { arrive: 0.15, avoid: false });
        S.lookAt = { x: L.bx, y: 0.3, z: L.bz };
        action = 'walk';
        if (arrived || S.stuckT > 0.6) setState('curious');
        break;
      }
      case 'curious': {
        const L = S.lure;
        S.speed = 0;
        faceDir(L.bx - S.x, L.bz - S.z, dt, 4);
        S.lookAt = { x: L.bx, y: 0.25, z: L.bz };
        action = 'curious';
        if (S.t > cfg.curiousTime) {
          setState('return');
          const q = closestOnSeg(S.x, S.z, P[0], P[1]);
          S.route = plan(q.x, q.z);
          emit?.('goose:return', { x: S.x, z: S.z });
        }
        break;
      }
      default:
        setState('patrol');
    }
    S.action = action;
    col.x = S.x;
    col.z = S.z;
    if (model?.object) {
      model.object.position.set(S.x, 0, S.z);
      model.object.rotation.y = S.yaw;
    }
    if (S.lookAt) look.set(S.lookAt.x, S.lookAt.y, S.lookAt.z);
    model?.update?.(dt, { speed: S.speed, turn: S.yawRate, action, lookAt: S.lookAt ? look : null });
  }

  /** Só anima (comemoração / fora do jogo). */
  function animate(dt) {
    model?.update?.(dt, { speed: 0, turn: 0, action: S.state === 'curious' ? 'curious' : 'idle', lookAt: null });
  }

  function place(x, z, yaw = S.yaw) {
    S.x = x;
    S.z = z;
    S.yaw = yaw;
    col.x = x;
    col.z = z;
    if (model?.object) {
      model.object.position.set(x, 0, z);
      model.object.rotation.y = yaw;
    }
  }

  function reset() {
    S.state = 'patrol';
    S.t = 0;
    S.idx = 0;
    S.pauseT = 0;
    S.cooldown = 0;
    S.lure = null;
    S.route = [];
    S.victim = null;
    S.hits = 0;
    S.lures = 0;
    S.speed = 0;
    place(cfg.home.x, cfg.home.z, Math.PI);
  }

  /** Longe da cabeceira da ponte (atraída, curiosa ou voltando de longe)? */
  const isAway = () => (S.state === 'lured' || S.state === 'curious' || S.state === 'return') && distPatrol() > 0.9;

  return {
    model, col, update, animate, onBark, reset, place, isAway,
    get x() { return S.x; },
    get z() { return S.z; },
    get state() { return S.state; },
    get t() { return S.t; },
    get hits() { return S.hits; },
    get lures() { return S.lures; },
    get cooldown() { return S.cooldown; },
    /** Força a gansa curiosa num ponto (depuração / ?stage=). */
    forceCurious(x, z, bx, bz) {
      place(x, z);
      S.lure = { x, z, bx, bz, by: null };
      setState('curious');
    },
    info: () => ({ state: S.state, x: +S.x.toFixed(2), z: +S.z.toFixed(2), t: +S.t.toFixed(2), cooldown: +S.cooldown.toFixed(2), hits: S.hits, lures: S.lures, away: isAway() }),
  };
}
