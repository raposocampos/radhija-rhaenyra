// Portão com dobradiça (generalização do portão da fase 1).
// cfg: { hinge:{x,z}, latchPost:{x,z}, length, closedYaw, openYaw, openTime?, closeTime? }
// Colisor dinâmico: segmento dobradiça → ponta (gira com a abertura). prop?.setOpen(t) recebe a mesma
// abertura usada na colisão (yaw = closedYaw + (openYaw − closedYaw)·t, folha ao longo de −Z local).
// Ao FECHAR, o portão espera se uma dog estiver no caminho da folha (nunca prende ninguém).
import { hingeTip, penCircleSegment } from '../collision.js';

const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));

export function createHingedGate({ id = 'gate', cfg, world, prop = null, thickness = 0.05 }) {
  const col = world.addDynamic({
    id, kind: 'gate', shape: 'segment',
    ax: cfg.hinge.x, az: cfg.hinge.z, bx: cfg.latchPost.x, bz: cfg.latchPost.z, t: thickness,
  });
  const S = { p: 0, t: 0, target: 0, locked: false, blocked: false };

  function apply(t) {
    S.t = t;
    const tip = hingeTip(cfg, t);
    col.bx = tip.x;
    col.bz = tip.z;
    prop?.setOpen?.(t);
  }

  function hitsDog(t, ctrls) {
    const tip = hingeTip(cfg, t);
    for (const n of Object.keys(ctrls || {})) {
      const c = ctrls[n];
      const p = penCircleSegment(c.x, c.z, c.r, cfg.hinge.x, cfg.hinge.z, tip.x, tip.z, thickness);
      if (p && p.depth > 0.01) return true;
    }
    return false;
  }

  /** Abre/fecha em direção a `target` (0..1). ctrls: dogs que o portão não pode prender ao fechar. */
  function update(dt, { ctrls } = {}) {
    const target = S.locked ? 1 : S.target;
    if (S.p === target) {
      S.blocked = false;
      return S.t;
    }
    const opening = target > S.p;
    const dur = opening ? cfg.openTime ?? 0.8 : cfg.closeTime ?? 0.9;
    let np = S.p + (opening ? 1 : -1) * (dt / Math.max(0.05, dur));
    np = opening ? Math.min(target, np) : Math.max(target, np);
    const nt = smoother(np);
    if (!opening && ctrls && hitsDog(nt, ctrls) && !hitsDog(S.t, ctrls)) {
      S.blocked = true; // alguém na passagem: espera
      return S.t;
    }
    S.blocked = false;
    S.p = np;
    apply(nt);
    return S.t;
  }

  function setTarget(t) { S.target = Math.max(0, Math.min(1, t)); }
  function lock() { S.locked = true; S.target = 1; }
  function set(t) {
    S.p = t;
    apply(smoother(t));
  }
  function reset() {
    S.locked = false;
    S.target = 0;
    S.blocked = false;
    set(0);
  }

  return {
    col, update, setTarget, lock, set, reset,
    isOpen: (th = 0.97) => S.t >= th,
    tip: () => hingeTip(cfg, S.t),
    get t() { return S.t; },
    get target() { return S.target; },
    get locked() { return S.locked; },
    get blocked() { return S.blocked; },
    info: () => ({ t: +S.t.toFixed(3), target: S.target, locked: S.locked, blocked: S.blocked }),
  };
}
