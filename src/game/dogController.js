// Controle de movimento de uma dog (usado tanto pela jogadora quanto pela IA da companheira).
// Modelo: a velocidade é um escalar ao longo da orientação do corpo (sem deslize lateral / moonwalk).
// O corpo gira suavemente (ganho proporcional limitado por turnSpeed); inversões > 120° fazem um pivô
// rápido com queda de velocidade; aceleração/desaceleração vêm do layout.
// Pulo (só quem tem cfg.jumpHeight, a Rhaenyra): arco de altura fixa e duração cfg.jumpTime, com pouco
// controle no ar; enquanto está no ar, os colisores marcados jumpable (troncos, muretas baixas) não bloqueiam.
// Impulso na parede (só quem tem cfg.wallJumpTime, a Rhaenyra): de frente para uma parede marcada (WallSpot que a
// fase oferece em puzzle.wallSpots), o pulo vira um movimento roteirizado de cfg.wallJumpTime s: avança até a
// parede, sobe apoiando as patas, alcança o alto (wallHit, uma vez, em WALL_TOUCH) e volta ao chão um pouco
// afastada. A pose é da animação (dogAnimation.js, wallK); aqui ficam posição, giro e tempo.
// Empurrão em pé (só dogs 'large', a Rhaenyra): segurando o empurrar de frente para algo empurrável no alto (ShoveSpot
// que a fase oferece em puzzle.shoveSpots, ou a irmã), ela chega ao ponto e fica de pé nas traseiras apoiando as patas
// da frente (SHOVE_UP s), empurra em ciclos de SHOVE_CYCLE s enquanto o botão estiver seguro (cada empurrão conta em
// SHOVE_HIT do ciclo: shoveHit, uma vez por ciclo) e volta às quatro patas (SHOVE_DOWN s). Soltar o botão termina o
// ciclo em curso (o primeiro empurrão sempre acontece). A pose é da animação (shoveK, shoveCycle).

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
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Impulso na parede (frações de cfg.wallJumpTime): chega à parede, alcança o alto e começa a voltar.
export const WALL_AT = 0.34;
export const WALL_TOUCH = 0.52;
export const WALL_OFF = 0.62;
/** Folga entre o círculo de colisão e a parede no ponto de impulso (m). */
export const WALL_GAP = 0.03;
/** De frente para a parede: cosseno mínimo entre a direção (analógico ou corpo) e a parede (~70°). */
const WALL_FACING = 0.34;
/** O toque no alto só vale com a dog a até isto do ponto de impulso (algo no caminho a segurou longe). */
const WALL_TOUCH_REACH = 0.12;

// Empurrão em pé (s): ficar de pé, cada ciclo de empurrão (o empurrão conta em SHOVE_HIT do ciclo) e descer.
export const SHOVE_UP = 0.46;
export const SHOVE_CYCLE = 0.66;
export const SHOVE_HIT = 0.42;
export const SHOVE_DOWN = 0.42;
/** Folga entre o círculo de colisão e a superfície empurrada (m). */
export const SHOVE_GAP = 0.04;
/** Começa com a dog a até isto do ponto de apoio (m). */
export const SHOVE_REACH = 0.4;
/** De frente: cosseno mínimo entre a direção (analógico ou corpo) e a superfície (60°). */
const SHOVE_FACING = 0.5;
/** Quanto ela pode estar além da largura da face (m) e ainda começar (ela se alinha no caminho). */
const SHOVE_LAT_SLACK = 0.16;
/** O empurrão só conta com a dog a até isto do ponto de apoio (algo no caminho, ou a irmã se afastou). */
const SHOVE_TOUCH_REACH = 0.1;

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
    wall: null, // impulso na parede: ponto em uso (null = fora do impulso)
    wallT: 0,
    wallDur: 0,
    wallFrom: { x: 0, z: 0 },
    wallGoalX: 0,
    wallGoalZ: 0,
    wallTouched: false,
    wallHit: null, // alcançou o alto neste quadro (o jogo emite wall:touch e zera)
    shove: null, // empurrão em pé: ponto em uso (null = fora dele)
    shoveStage: null, // 'up' | 'push' | 'down'
    shoveT: 0, // tempo na etapa (no 'push', no ciclo atual)
    shoveCycle: 0, // 0..1 do ciclo de empurrão atual
    shoveN: 0, // empurrões dados desde que ficou de pé
    shoveK: 0, // 0 nas quatro patas … 1 de pé (para a pose)
    shoveLat: 0, // deslocamento lateral na face, escolhido ao começar (m)
    shoveFrom: { x: 0, z: 0 },
    shoveGoalX: 0,
    shoveGoalZ: 0,
    shoveHeld: false, // o botão continua seguro (o jogo atualiza a cada quadro)
    shoveStop: false, // o jogo pede para descer ao fim do ciclo (a irmã se afastou…)
    shoveHit: null, // empurrou neste quadro (o jogo emite dog:shove e zera)
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
  c.wall = null;
  c.wallT = 0;
  c.wallDur = 0;
  c.wallTouched = false;
  c.wallHit = null;
  endShove(c);
}

/** No ar: pulo comum ou impulso na parede. */
export const airborne = (c) => c.jumpT > 0 || c.wallDur > 0;

/** No empurrão em pé (de pé, subindo ou descendo). */
export const shoving = (c) => !!c.shove;

export function canDash(c) {
  return c.cfg.dashSpeed && c.dashT <= 0 && c.dashCd <= 0 && !airborne(c) && !c.shove;
}

/** A dog pode pular agora? (só quem tem cfg.jumpHeight; no chão, fora da arrancada e sem recarga) */
export function canJump(c) {
  return !!c.cfg.jumpHeight && !airborne(c) && c.jumpCd <= 0 && c.dashT <= 0 && !c.shove;
}

/**
 * Ponto do chão de onde a dog de raio r dá o impulso: encostada na parede, em frente às patinhas e spot.lat m à
 * esquerda do botão (de frente para a parede), para a pata direita apertá-lo sem a cabeça ficar na frente.
 */
export function wallKick(spot, r) {
  const d = r + WALL_GAP;
  const lat = spot.lat ?? 0;
  // esquerda de quem olha para a parede (−n): (−nz, nx)
  return { x: spot.x + spot.nx * d - spot.nz * lat, z: spot.z + spot.nz * d + spot.nx * lat };
}

/**
 * A parede marcada que vale para um impulso agora (ou null): a dog tem impulso, está do lado de cá da parede,
 * a até cfg.wallReach m do ponto de impulso e de frente para ela — pela direção do analógico (dx, dz) ou, parada,
 * pela frente do corpo — e, com `world`, nada no caminho até o ponto de impulso (portão fechado, caixote).
 * Com duas ao alcance, a mais perto.
 * @param {import('../types').DogController} c @param {import('../types').WallSpot[] | null | undefined} spots
 * @param {number} [dx] @param {number} [dz] @param {import('../types').CollisionWorld | null} [world]
 */
export function pickWallSpot(c, spots, dx = 0, dz = 0, world = null) {
  if (!c.cfg.wallJumpTime || !spots?.length) return null;
  const reach = c.cfg.wallReach ?? 0.8;
  const moving = Math.hypot(dx, dz) > 1e-4;
  const fx = moving ? dx : Math.sin(c.yaw);
  const fz = moving ? dz : Math.cos(c.yaw);
  const L = Math.hypot(fx, fz) || 1;
  let best = null;
  let bestD = Infinity;
  for (const s of spots) {
    const K = wallKick(s, c.r);
    const d = Math.hypot(c.x - K.x, c.z - K.z);
    const front = (c.x - s.x) * s.nx + (c.z - s.z) * s.nz;
    if (d > reach || front < c.r * 0.5) continue;
    if (-(fx * s.nx + fz * s.nz) / L < WALL_FACING) continue;
    if (world && !world.segmentClear(c.x, c.z, K.x, K.z, c.r * 0.9, c.size)) continue;
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Começa o impulso na parede no ponto `spot` (veja pickWallSpot). */
export function startWallJump(c, spot) {
  c.wall = spot;
  c.wallT = 0;
  c.wallDur = c.cfg.wallJumpTime ?? 1;
  c.wallFrom = { x: c.x, z: c.z };
  c.wallGoalX = c.x;
  c.wallGoalZ = c.z;
  c.wallTouched = false;
  c.wallHit = null;
  c.jumpT = 0;
  c.dashT = 0;
  c.v = 0;
  c.y = 0;
  c.landed = false;
  c.pivoting = false;
}

/** Altura do impulso (m) no progresso p: o quanto o quadril sobe (a mesma curva da animação, para info e testes). */
export function wallLift(p, top = 1.2) {
  const peak = Math.max(0.2, top - 0.84);
  if (p < WALL_TOUCH) return peak * sstep(0.14, WALL_TOUCH, p);
  return peak * (1 - sstep(WALL_OFF, 0.94, p));
}

/** Um quadro do impulso na parede: avança o tempo, a posição-alvo, o giro e o toque no alto. */
function stepWallJump(c, dt) {
  const { cfg } = c;
  const W = c.wall;
  c.wallT += dt;
  const p = Math.min(1, c.wallT / c.wallDur);
  const K = wallKick(W, c.r);
  if (p < WALL_OFF) {
    const e = sstep(0.02, WALL_AT, p);
    c.wallGoalX = c.wallFrom.x + (K.x - c.wallFrom.x) * e;
    c.wallGoalZ = c.wallFrom.z + (K.z - c.wallFrom.z) * e;
  } else {
    const e = sstep(WALL_OFF, 0.95, p) * (cfg.wallBack ?? 0.32);
    c.wallGoalX = K.x + W.nx * e;
    c.wallGoalZ = K.z + W.nz * e;
  }
  // de frente para a parede (gira rápido no começo, antes de subir)
  const want = Math.atan2(-W.nx, -W.nz);
  const maxTurn = cfg.turnSpeed * 1.6 * dt;
  c.yaw = wrapAngle(c.yaw + Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(want - c.yaw))));
  c.y = wallLift(p, W.top);
  c.v = 0;
  if (!c.wallTouched && p >= WALL_TOUCH) {
    c.wallTouched = true;
    // só alcança o alto quem chegou à parede (algo que apareceu no caminho a segurou longe: sem toque)
    if (Math.hypot(c.x - K.x, c.z - K.z) < WALL_TOUCH_REACH) c.wallHit = W;
  }
  if (p >= 1) {
    c.wall = null;
    c.wallT = 0;
    c.wallDur = 0;
    c.y = 0;
    c.jumpCd = cfg.jumpCooldown ?? 0.15;
    c.landed = true;
  }
}

/**
 * Onde a dog de raio r fica para o empurrão em pé: encostada na superfície do ponto `spot` (a SHOVE_GAP m), com o
 * deslocamento lateral `lat` na face (de quem olha para a superfície, + = esquerda; limitado a ±spot.w).
 * @param {import('../types').ShoveSpot} spot @param {number} r @param {number} [lat]
 */
export function shoveStance(spot, r, lat = 0) {
  const d = r + SHOVE_GAP;
  const w = spot.w ?? 0;
  const l = Math.max(-w, Math.min(w, lat));
  return { x: spot.x + spot.nx * d - spot.nz * l, z: spot.z + spot.nz * d + spot.nx * l };
}

/** Deslocamento lateral de (x, z) na face do ponto `spot` (de quem olha para a superfície, + = esquerda). */
const shoveLatOf = (spot, x, z) => (x - spot.x) * -spot.nz + (z - spot.z) * spot.nx;

/**
 * O ponto que vale para um empurrão em pé agora (ou null): só dogs 'large', no chão e fora de outro empurrão; do lado
 * de cá da superfície, a até SHOVE_REACH m de onde ficaria, sem passar muito da largura da face, de frente para ela —
 * pela direção do analógico (dx, dz) ou, parada, pela frente do corpo — e, com `world`, nada no caminho até lá.
 * Com dois ao alcance, o mais perto.
 * @param {import('../types').DogController} c @param {import('../types').ShoveSpot[] | null | undefined} spots
 * @param {number} [dx] @param {number} [dz] @param {import('../types').CollisionWorld | null} [world]
 */
export function pickShoveSpot(c, spots, dx = 0, dz = 0, world = null) {
  if (c.size !== 'large' || airborne(c) || c.shove || c.dashT > 0 || !spots?.length) return null;
  const moving = Math.hypot(dx, dz) > 1e-4;
  const fx = moving ? dx : Math.sin(c.yaw);
  const fz = moving ? dz : Math.cos(c.yaw);
  const L = Math.hypot(fx, fz) || 1;
  let best = null;
  let bestD = Infinity;
  for (const s of spots) {
    const front = (c.x - s.x) * s.nx + (c.z - s.z) * s.nz;
    if (front < c.r * 0.5) continue;
    const lat = shoveLatOf(s, c.x, c.z);
    if (Math.abs(lat) > (s.w ?? 0) + SHOVE_LAT_SLACK) continue;
    const K = shoveStance(s, c.r, lat);
    const d = Math.hypot(c.x - K.x, c.z - K.z);
    if (d > SHOVE_REACH) continue;
    if (-(fx * s.nx + fz * s.nz) / L < SHOVE_FACING) continue;
    if (world && d > 0.02 && !world.segmentClear(c.x, c.z, K.x, K.z, c.r * 0.9, c.size)) continue;
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Começa o empurrão em pé no ponto `spot` (veja pickShoveSpot). */
export function startShove(c, spot) {
  c.shove = spot;
  c.shoveStage = 'up';
  c.shoveT = 0;
  c.shoveCycle = 0;
  c.shoveN = 0;
  c.shoveK = 0;
  c.shoveLat = Math.max(-(spot.w ?? 0), Math.min(spot.w ?? 0, shoveLatOf(spot, c.x, c.z)));
  c.shoveFrom = { x: c.x, z: c.z };
  c.shoveGoalX = c.x;
  c.shoveGoalZ = c.z;
  c.shoveHeld = true;
  c.shoveStop = false;
  c.shoveHit = null;
  c.jumpT = 0;
  c.dashT = 0;
  c.v = 0;
  c.y = 0;
  c.pivoting = false;
}

/** Sai do empurrão em pé na hora (reiniciar, trocar de fase); a pose volta pela animação. */
export function endShove(c) {
  c.shove = null;
  c.shoveStage = null;
  c.shoveT = 0;
  c.shoveCycle = 0;
  c.shoveN = 0;
  c.shoveK = 0;
  c.shoveHeld = false;
  c.shoveStop = false;
  c.shoveHit = null;
}

/** Um quadro do empurrão em pé: etapa, posição-alvo, giro e o empurrão de cada ciclo. */
function stepShove(c, dt) {
  const S = c.shove;
  const K = shoveStance(S, c.r, c.shoveLat);
  // de frente para a superfície
  const want = Math.atan2(-S.nx, -S.nz);
  const maxTurn = c.cfg.turnSpeed * 1.6 * dt;
  c.yaw = wrapAngle(c.yaw + Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(want - c.yaw))));
  c.v = 0;
  c.y = 0;
  c.shoveT += dt;
  const release = !c.shoveHeld || c.shoveStop;
  if (c.shoveStage === 'up') {
    const p = Math.min(1, c.shoveT / SHOVE_UP);
    const e = sstep(0, 0.72, p);
    c.shoveGoalX = c.shoveFrom.x + (K.x - c.shoveFrom.x) * e;
    c.shoveGoalZ = c.shoveFrom.z + (K.z - c.shoveFrom.z) * e;
    c.shoveK = sstep(0.1, 1, p);
    if (p >= 1) {
      c.shoveStage = 'push';
      c.shoveT = 0;
      c.shoveCycle = 0;
    }
  } else if (c.shoveStage === 'push') {
    c.shoveGoalX = K.x;
    c.shoveGoalZ = K.z;
    c.shoveK = 1;
    const prev = c.shoveCycle;
    c.shoveCycle = Math.min(1, c.shoveT / SHOVE_CYCLE);
    if (prev < SHOVE_HIT && c.shoveCycle >= SHOVE_HIT) {
      c.shoveN++;
      // só empurra quem está encostada (algo no caminho a segurou longe, ou a irmã já saiu: sem empurrão)
      if (Math.hypot(c.x - K.x, c.z - K.z) < SHOVE_TOUCH_REACH) c.shoveHit = S;
    }
    // soltou antes do empurrão (depois do primeiro): desce já; senão termina o ciclo e desce
    const down = release && ((c.shoveN >= 1 && c.shoveCycle < SHOVE_HIT) || c.shoveCycle >= 1);
    if (down) {
      c.shoveStage = 'down';
      c.shoveT = 0;
      c.shoveFrom = { x: c.x, z: c.z };
    } else if (c.shoveCycle >= 1) {
      c.shoveT -= SHOVE_CYCLE;
      c.shoveCycle = c.shoveT / SHOVE_CYCLE;
    }
  } else {
    const p = Math.min(1, c.shoveT / SHOVE_DOWN);
    c.shoveK = 1 - sstep(0, 1, p);
    // as patas da frente voltam ao chão um pouquinho atrás de onde estavam
    const back = 0.05 * sstep(0.15, 0.9, p);
    c.shoveGoalX = c.shoveFrom.x + S.nx * back;
    c.shoveGoalZ = c.shoveFrom.z + S.nz * back;
    if (p >= 1) endShove(c);
  }
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

  if (c.wallDur > 0) {
    // Impulso na parede: roteirizado (a entrada não muda nada até voltar ao chão).
    stepWallJump(c, dt);
    c.pivoting = false;
  } else if (c.shove) {
    // Empurrão em pé: roteirizado (o analógico não move; o botão seguro decide quantos empurrões).
    stepShove(c, dt);
    c.pivoting = false;
  } else if (c.jumpT > 0) {
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
  if (c.wallDur > 0) return integrateScripted(c, dt, world, c.wallGoalX, c.wallGoalZ);
  if (c.shove) return integrateScripted(c, dt, world, c.shoveGoalX, c.shoveGoalZ, true);
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

/**
 * Movimento roteirizado (impulso na parede, empurrão em pé): leva a dog até a posição-alvo do quadro, com colisão
 * (nunca atravessa a parede nem o que ela empurra). steps: a velocidade da animação acompanha o deslocamento (os
 * passinhos das traseiras no empurrão em pé); sem isso ela some aos poucos (o impulso é um salto).
 */
function integrateScripted(c, dt, world, goalX, goalZ, steps = false) {
  const px = c.x;
  const pz = c.z;
  const res = world.move(c.x, c.z, goalX - c.x, goalZ - c.z, c.r, c.size);
  if (Number.isFinite(res.x) && Number.isFinite(res.z)) {
    c.x = res.x;
    c.z = res.z;
  }
  const idt = 1 / Math.max(dt, 1e-4);
  c.vx = (c.x - px) * idt;
  c.vz = (c.z - pz) * idt;
  if (steps) c.animSpeed += (Math.hypot(c.vx, c.vz) - c.animSpeed) * (1 - Math.exp(-dt * 18));
  else c.animSpeed *= Math.exp(-dt * 12);
  if (c.animSpeed < 0.01) c.animSpeed = 0;
  c.stillT = 0;
  c.prevHitIds = new Set(res.hits.map((h) => h.id));
  c.hits = res.hits;
  return { hits: res.hits, bump: null };
}
