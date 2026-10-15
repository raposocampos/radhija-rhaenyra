// Controle de movimento de uma dog (usado tanto pela jogadora quanto pela IA da companheira).
// Modelo: a velocidade é um escalar ao longo da orientação do corpo (sem deslize lateral / moonwalk).
// O corpo gira suavemente (ganho proporcional limitado por turnSpeed); inversões > 120° fazem um pivô
// rápido com queda de velocidade; aceleração/desaceleração vêm do layout.
// Pulo (só quem tem cfg.jumpHeight, a Rhaenyra): arco de altura fixa e duração cfg.jumpTime, com pouco
// controle no ar; enquanto está no ar, os colisores marcados jumpable (troncos, muretas baixas) não bloqueiam.

export const TAU = Math.PI * 2;
export const wrapAngle = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
export const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

const PIVOT_ANGLE = (120 * Math.PI) / 180;
const TURN_GAIN = 12; // rad/s por rad de erro (suaviza o fim do giro)
const BUMP_SPEED = 2.2; // m/s contra a normal para contar como "batida"

/**
 * @param {import('../types').DogName} name
 * @param {import('../types').DogStats} cfg
 * @returns {import('../types').DogController}
 */
export function createController(name, cfg) {
  return {
    name,
    cfg,
    size: cfg.size,
    r: cfg.radius,
    x: cfg.start.x,
    z: cfg.start.z,
    yaw: cfg.start.yaw,
    v: 0, // velocidade escalar ao longo da orientação (ou da arrancada)
    vx: 0, // velocidade real medida (após colisão)
    vz: 0,
    yawRate: 0,
    animSpeed: 0,
    pivoting: false,
    dashT: 0,
    dashCd: 0,
    dashDx: 0,
    dashDz: 1,
    blockedFrames: 0,
    bumpCd: 0,
    prevHitIds: new Set(),
    hits: [],
    stillT: 0, // tempo parada (para a companheira sentar)
    y: 0, // altura do pulo (m); 0 = no chão
    jumpT: 0, // tempo restante no ar (0 = no chão)
    jumpDur: 0,
    jumpCd: 0,
    jumpDx: 0,
    jumpDz: 1,
    landed: false, // pousou neste quadro (o jogo emite dog:land e zera)
  };
}

export function placeController(c, x, z, yaw = c.yaw) {
  c.x = x;
  c.z = z;
  c.yaw = yaw;
  c.v = 0;
  c.vx = 0;
  c.vz = 0;
  c.yawRate = 0;
  c.animSpeed = 0;
  c.dashT = 0;
  c.dashCd = 0;
  c.pivoting = false;
  c.prevHitIds = new Set();
  c.hits = [];
  c.stillT = 0;
  c.y = 0;
  c.jumpT = 0;
  c.jumpCd = 0;
  c.landed = false;
}

export function canDash(c) {
  return c.cfg.dashSpeed && c.dashT <= 0 && c.dashCd <= 0 && !(c.jumpT > 0);
}

/** A dog pode pular agora? (só quem tem cfg.jumpHeight; no chão, fora da arrancada e sem recarga) */
export function canJump(c) {
  return !!c.cfg.jumpHeight && !(c.jumpT > 0) && c.jumpCd <= 0 && c.dashT <= 0;
}

/**
 * Pula na direção (dx, dz) da entrada (com impulso mínimo cfg.jumpSpeed) ou, sem entrada, para a frente
 * com a velocidade atual (parada = pulo no lugar).
 */
export function startJump(c, dx, dz) {
  const L = Math.hypot(dx, dz);
  if (L < 1e-4) {
    c.jumpDx = Math.sin(c.yaw);
    c.jumpDz = Math.cos(c.yaw);
  } else {
    c.jumpDx = dx / L;
    c.jumpDz = dz / L;
    c.v = Math.max(c.v, c.cfg.jumpSpeed ?? c.cfg.walkSpeed);
  }
  c.jumpT = c.jumpDur = c.cfg.jumpTime ?? 0.5;
  c.y = 0;
  c.landed = false;
  c.pivoting = false;
}

/** Inicia a arrancada na direção (dx, dz) — normalmente a entrada atual ou a frente do corpo. */
export function startDash(c, dx, dz) {
  const L = Math.hypot(dx, dz);
  if (L < 1e-4) {
    dx = Math.sin(c.yaw);
    dz = Math.cos(c.yaw);
  } else {
    dx /= L;
    dz /= L;
  }
  c.dashDx = dx;
  c.dashDz = dz;
  c.dashT = c.cfg.dashTime;
  c.blockedFrames = 0;
  c.v = Math.max(c.v, c.cfg.dashSpeed * 0.65);
}

/**
 * Atualiza orientação e velocidade escalar a partir de uma intenção:
 *   { dx, dz } direção desejada (unitária ou zero), speed (m/s desejado), turnScale,
 *   faceX/faceZ: só girar para olhar um ponto (sem andar).
 */
export function steer(c, dt, intent) {
  const { cfg } = c;
  const prevYaw = c.yaw;
  c.dashCd = Math.max(0, c.dashCd - dt);
  c.bumpCd = Math.max(0, c.bumpCd - dt);
  if (c.jumpCd > 0) c.jumpCd = Math.max(0, c.jumpCd - dt);
  const turnScale = intent.turnScale ?? 1;

  if (c.jumpT > 0) {
    // No ar: velocidade horizontal constante, pouco controle de direção; o corpo acompanha o pulo.
    const has = intent.speed > 1e-3 && (intent.dx || intent.dz);
    if (has) {
      const cur = Math.atan2(c.jumpDx, c.jumpDz);
      const d = wrapAngle(Math.atan2(intent.dx, intent.dz) - cur);
      const step = Math.max(-2.6 * dt, Math.min(2.6 * dt, d));
      c.jumpDx = Math.sin(cur + step);
      c.jumpDz = Math.cos(cur + step);
    }
    const dy = wrapAngle(Math.atan2(c.jumpDx, c.jumpDz) - c.yaw);
    const maxTurn = cfg.turnSpeed * 3 * dt;
    c.yaw = wrapAngle(c.yaw + Math.max(-maxTurn, Math.min(maxTurn, dy)));
    c.jumpT -= dt;
    if (c.jumpT <= 0) {
      c.jumpT = 0;
      c.y = 0;
      c.jumpCd = cfg.jumpCooldown ?? 0.15;
      c.landed = true;
      c.v = Math.min(c.v, cfg.walkSpeed);
    } else {
      const p = 1 - c.jumpT / c.jumpDur;
      c.y = 4 * cfg.jumpHeight * p * (1 - p);
    }
    c.pivoting = false;
  } else if (c.dashT > 0) {
    // Arrancada: pouco controle (gira a direção devagar), corpo acompanha a direção da rajada.
    const has = intent.speed > 1e-3 && (intent.dx || intent.dz);
    if (has) {
      const cur = Math.atan2(c.dashDx, c.dashDz);
      const want = Math.atan2(intent.dx, intent.dz);
      const d = wrapAngle(want - cur);
      const step = Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
      c.dashDx = Math.sin(cur + step);
      c.dashDz = Math.cos(cur + step);
    }
    const dashYaw = Math.atan2(c.dashDx, c.dashDz);
    const dy = wrapAngle(dashYaw - c.yaw);
    const maxTurn = cfg.turnSpeed * 3 * dt;
    c.yaw = wrapAngle(c.yaw + Math.max(-maxTurn, Math.min(maxTurn, dy)));
    const phase = 1 - c.dashT / cfg.dashTime; // 0 → 1
    let k = 1;
    if (phase < 0.12) k = 0.75 + (0.25 * phase) / 0.12;
    else if (phase > 0.7) k = 1 - ((1 - cfg.walkSpeed / cfg.dashSpeed) * (phase - 0.7)) / 0.3;
    c.v = cfg.dashSpeed * k;
    c.dashT -= dt;
    if (c.dashT <= 0) {
      c.dashT = 0;
      c.dashCd = cfg.dashCooldown;
      c.v = Math.min(c.v, cfg.walkSpeed * 1.05);
    }
    c.pivoting = false;
  } else {
    const has = intent.speed > 1e-3 && (intent.dx || intent.dz);
    let target = 0;
    let decelScale = 1;
    c.pivoting = false;
    if (has) {
      const desiredYaw = Math.atan2(intent.dx, intent.dz);
      const delta = wrapAngle(desiredYaw - c.yaw);
      const ad = Math.abs(delta);
      let turnMax = cfg.turnSpeed * turnScale;
      if (ad > PIVOT_ANGLE && c.v > 0.35) {
        // Pivô: freia forte e gira mais rápido (sem patinar de ré).
        c.pivoting = true;
        turnMax *= 1.5;
        target = Math.min(c.v, intent.speed) * 0.2;
        decelScale = 1.6;
      } else {
        const align = Math.cos(Math.min(ad, Math.PI / 2)); // 1 alinhado … 0 a 90°
        target = intent.speed * (0.3 + 0.7 * align * align);
      }
      const rate = Math.max(-turnMax, Math.min(turnMax, delta * TURN_GAIN));
      const step = rate * dt;
      c.yaw = Math.abs(step) >= ad ? desiredYaw : wrapAngle(c.yaw + step);
    } else if (intent.faceX != null) {
      const desiredYaw = Math.atan2(intent.faceX - c.x, intent.faceZ - c.z);
      const delta = wrapAngle(desiredYaw - c.yaw);
      const turnMax = cfg.turnSpeed * 0.6;
      const rate = Math.max(-turnMax, Math.min(turnMax, delta * 8));
      c.yaw = wrapAngle(c.yaw + rate * dt);
    }
    const a = target > c.v ? cfg.accel * (intent.accelScale ?? 1) : cfg.decel * decelScale;
    c.v = approach(c.v, target, a * dt);
  }
  const yr = wrapAngle(c.yaw - prevYaw) / Math.max(dt, 1e-4);
  c.yawRate += (yr - c.yawRate) * (1 - Math.exp(-dt * 20));
}

/** Move a dog pelo mundo (com sub-passos) e mede a velocidade real. → { hits, bump } */
export function integrate(c, dt, world, opts = {}) {
  let dirX;
  let dirZ;
  const airborne = c.jumpT > 0;
  if (airborne) {
    dirX = c.jumpDx;
    dirZ = c.jumpDz;
    opts = { ...opts, airborne: true };
  } else if (c.dashT > 0) {
    dirX = c.dashDx;
    dirZ = c.dashDz;
  } else {
    dirX = Math.sin(c.yaw);
    dirZ = Math.cos(c.yaw);
  }
  const px = c.x;
  const pz = c.z;
  if (!Number.isFinite(c.v)) c.v = 0;
  const res = world.move(c.x, c.z, dirX * c.v * dt, dirZ * c.v * dt, c.r, c.size, opts);
  // Proteção: nunca aceitar NaN (atravessaria tudo).
  if (Number.isFinite(res.x) && Number.isFinite(res.z)) {
    c.x = res.x;
    c.z = res.z;
  }
  const idt = 1 / Math.max(dt, 1e-4);
  c.vx = (c.x - px) * idt;
  c.vz = (c.z - pz) * idt;

  // Batida: contato novo com velocidade alta contra a normal.
  let bump = null;
  const ivx = dirX * c.v;
  const ivz = dirZ * c.v;
  for (const h of res.hits) {
    if (h.id === 'bounds') continue;
    const into = -(ivx * h.nx + ivz * h.nz);
    if (into > BUMP_SPEED && !c.prevHitIds.has(h.id) && c.bumpCd <= 0) {
      const strength = Math.max(0.15, Math.min(1, (into - 1.5) / 4.5));
      if (!bump || strength > bump.strength) bump = { id: h.id, strength, nx: h.nx, nz: h.nz };
    }
  }
  if (bump) c.bumpCd = 0.5;
  c.prevHitIds = new Set(res.hits.map((h) => h.id));

  // Arrancada termina cedo se bater de frente.
  if (c.dashT > 0) {
    const along = c.vx * dirX + c.vz * dirZ;
    if (along < c.v * 0.35) {
      c.blockedFrames++;
      if (c.blockedFrames >= 2) {
        c.dashT = 0;
        c.dashCd = c.cfg.dashCooldown;
        c.v = Math.max(0, Math.min(along, c.cfg.walkSpeed));
      }
    } else c.blockedFrames = 0;
  }

  const actual = Math.hypot(c.vx, c.vz);
  c.animSpeed += (actual - c.animSpeed) * (1 - Math.exp(-dt * 18));
  if (c.animSpeed < 0.01) c.animSpeed = 0;
  c.stillT = actual < 0.15 ? c.stillT + dt : 0;
  c.hits = res.hits;
  return { hits: res.hits, bump };
}
