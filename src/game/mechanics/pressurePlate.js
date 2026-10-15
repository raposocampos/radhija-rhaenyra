// Placa de pressão genérica (tábua com molas, pedra que afunda…).
// requires: 'large' (só a Rhaenyra pesa o bastante) | 'any'. Pressionada por dogs e por caixotes.
// Forma: círculo { x, z, r } ou retângulo { x, z, hx, hz }. Emite plate:press {id, by, x, z} / plate:release {id, x, z}.
// prop?.setPress(t 0..1) recebe a descida animada.

export function createPressurePlate({ id, x, z, r = null, hx = null, hz = null, requires = 'any', emit, prop = null, margin = 0.35, pressRate = 7, releaseRate = 5 }) {
  const S = { pressed: false, by: null, t: 0, light: null, heldT: 0 };

  /** O centro (com folga proporcional ao raio da dog) está sobre a placa? */
  function on(px, pz, pr = 0) {
    const m = pr * margin;
    if (r != null) return Math.hypot(px - x, pz - z) < r + m;
    return Math.abs(px - x) < hx + m && Math.abs(pz - z) < hz + m;
  }
  const heavy = (c) => requires === 'any' || c.size === requires;

  /**
   * ctx: { ctrls, boxes?: [{ id, x, z }] } → { pressed, by, light (nome da dog leve demais em cima) }
   */
  /** @param {number} dt @param {{ ctrls?: Record<string, import('../../types').DogController>, boxes?: { id?: string, x: number, z: number }[] }} [ctx] */
  function update(dt, { ctrls, boxes = [] } = {}) {
    let by = null;
    let light = null;
    for (const n of Object.keys(ctrls || {})) {
      const c = ctrls[n];
      if (c.jumpT > 0 || !on(c.x, c.z, c.r)) continue; // no ar não pisa na placa
      if (heavy(c)) { by = by || n; } else light = n;
    }
    if (!by) for (const b of boxes) if (b && on(b.x, b.z, 0)) { by = b.id || 'crate'; break; }
    S.light = light;
    const was = S.pressed;
    S.pressed = !!by;
    S.by = by;
    S.heldT = S.pressed ? S.heldT + dt : 0;
    if (S.pressed && !was) emit?.('plate:press', { id, by, x, z });
    if (!S.pressed && was) emit?.('plate:release', { id, x, z });
    const target = S.pressed ? 1 : 0;
    const rate = S.pressed ? pressRate : releaseRate;
    const nt = S.t + Math.sign(target - S.t) * Math.min(Math.abs(target - S.t), rate * dt);
    if (nt !== S.t) {
      S.t = nt;
      prop?.setPress?.(S.t);
    }
    return { pressed: S.pressed, by, light };
  }

  function reset() {
    S.pressed = false;
    S.by = null;
    S.t = 0;
    S.light = null;
    S.heldT = 0;
    prop?.setPress?.(0);
  }

  /** Força o estado (depuração / ?stage=). */
  function force(pressed) {
    S.pressed = pressed;
    S.t = pressed ? 1 : 0;
    prop?.setPress?.(S.t);
  }

  return {
    id, x, z, update, reset, force, on,
    get pressed() { return S.pressed; },
    get by() { return S.by; },
    get t() { return S.t; },
    get light() { return S.light; },
    get heldT() { return S.heldT; },
    info: () => ({ pressed: S.pressed, by: S.by, t: +S.t.toFixed(2) }),
  };
}
