// Irrigador giratório: `jets` jatos igualmente espaçados girando a `omega` rad/s dentro do disco de raio r.
// Ângulo dos jatos: a partir de +X no plano XZ, girando para +Z (direção = (cos a, sin a) em (x, z)) —
// é o mesmo valor passado a prop.setAngle(a).
// Acerto: a dog (círculo) cruza o setor do jato: |Δângulo| < halfWidth + asin(r_dog / d), minR < d < r.
// Molhou → sprinkler:hit, empurrada para fora do disco (ponto válido mais próximo da direção radial;
// senão, de volta para onde entrou), 'shake' ~0,9 s e dog.setWet(1) com decaimento.
// Colisor 'companionOnly' do tamanho do disco enquanto liga: a IA da companheira contorna/espera.
const TAU = Math.PI * 2;
const wrap = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

export function createSprinkler({ id = 'sprinkler', cfg, world, emit, effects, prop = null, shakeTime = 0.9 }) {
  const zone = world.addDynamic({ id: `${id}-zona`, kind: 'zone', shape: 'circle', x: cfg.x, z: cfg.z, r: cfg.r + 0.05, companionOnly: true });
  const S = { angle: 0, on: 1, running: true, immune: {}, outside: {}, hits: 0 };

  function jetHits(c) {
    const dx = c.x - cfg.x;
    const dz = c.z - cfg.z;
    const d = Math.hypot(dx, dz);
    if (d > cfg.r + c.r * 0.5 || d < cfg.minR) return false;
    const a = Math.atan2(dz, dx);
    // largura angular do corpo da dog, limitada: perto da cabeça o jato passa por cima (arco).
    const half = cfg.halfWidth + Math.min(cfg.bodyMaxAngle ?? 0.32, Math.asin(Math.min(1, c.r / Math.max(d, 1e-3))));
    for (let k = 0; k < cfg.jets; k++) {
      const ja = S.angle + (k * TAU) / cfg.jets;
      if (Math.abs(wrap(a - ja)) < half) return true;
    }
    return false;
  }

  /** Ponto de saída: fora do disco, livre, alcançável em linha reta; o mais perto da direção radial. */
  function exitPoint(c) {
    const dx = c.x - cfg.x;
    const dz = c.z - cfg.z;
    const d = Math.hypot(dx, dz);
    let base = d > 1e-3 ? Math.atan2(dz, dx) : Math.atan2(-Math.cos(c.yaw), -Math.sin(c.yaw));
    // Radial, mas nunca "para a frente": se a dog já passou do centro (metade oposta à entrada),
    // sai pelo lado de onde entrou — molhar não pode ajudar a atravessar.
    const ent = S.outside[c.name];
    if (ent) {
      const ex = ent.x - cfg.x;
      const ez = ent.z - cfg.z;
      if (ex * dx + ez * dz < 0) base = Math.atan2(ez, ex);
    }
    const R = cfg.r + c.r + 0.3;
    const step = (10 * Math.PI) / 180;
    for (let k = 0; k <= 18; k++) {
      for (const s of k === 0 ? [0] : [1, -1]) {
        const a = base + s * k * step;
        const px = cfg.x + Math.cos(a) * R;
        const pz = cfg.z + Math.sin(a) * R;
        if (world.overlaps(px, pz, c.r, c.size)) continue;
        if (!world.segmentClear(c.x, c.z, px, pz, c.r * 0.85, c.size)) continue;
        return { x: px, z: pz };
      }
    }
    return S.outside[c.name] || { x: c.x, z: c.z };
  }

  function hit(c) {
    S.hits++;
    emit?.('sprinkler:hit', { name: c.name, x: c.x, z: c.z });
    const p = exitPoint(c);
    const dist = Math.hypot(p.x - c.x, p.z - c.z);
    const dur = Math.max(0.35, Math.min(0.9, dist / 5));
    effects.pushTo(c, p.x, p.z, { dur, action: 'startled', then: { action: 'shake', dur: shakeTime } });
    effects.setWet(c.name, 1, 1.8);
    S.immune[c.name] = dur + shakeTime + 0.35;
  }

  /** → nome da dog molhada neste quadro (ou null). */
  function update(dt, ctrls) {
    if (S.running) S.on = Math.min(1, S.on + dt * 2);
    else S.on = Math.max(0, S.on - dt / 1.2);
    S.angle = wrap(S.angle + cfg.omega * dt * (0.25 + 0.75 * S.on));
    prop?.setAngle?.(S.angle);
    prop?.setOn?.(S.on);
    let wetName = null;
    for (const n of Object.keys(ctrls)) {
      const c = ctrls[n];
      const d = Math.hypot(c.x - cfg.x, c.z - cfg.z);
      if (d > cfg.r + c.r + 0.2) S.outside[n] = { x: c.x, z: c.z };
      if (S.immune[n] > 0) { S.immune[n] -= dt; continue; }
      if (!S.running || S.on < 0.6 || effects.busy(n)) continue;
      if (jetHits(c)) {
        hit(c);
        wetName = n;
      }
    }
    return wetName;
  }

  function turnOff() {
    if (!S.running) return false;
    S.running = false;
    zone.enabled = false;
    emit?.('sprinkler:off', { x: cfg.x, z: cfg.z });
    return true;
  }

  function reset() {
    S.running = true;
    S.on = 1;
    S.angle = 0;
    S.immune = {};
    S.outside = {};
    S.hits = 0;
    zone.enabled = true;
    prop?.setAngle?.(0);
    prop?.setOn?.(1);
  }

  /** Força desligado (depuração / ?stage=). */
  function forceOff() {
    S.running = false;
    S.on = 0;
    zone.enabled = false;
    prop?.setOn?.(0);
  }

  const inside = (c, margin = 0) => Math.hypot(c.x - cfg.x, c.z - cfg.z) < cfg.r + margin;

  return {
    update, turnOff, reset, forceOff, jetHits, exitPoint, inside, zone,
    get running() { return S.running; },
    get on() { return S.on; },
    get angle() { return S.angle; },
    set angle(a) { S.angle = a; },
    get hits() { return S.hits; },
    info: () => ({ running: S.running, on: +S.on.toFixed(2), angle: +S.angle.toFixed(3), hits: S.hits }),
  };
}
