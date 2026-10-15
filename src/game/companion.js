// IA da companheira (a dog não ativa) + navegação genérica até um ponto (usada também na comemoração).
// - Segue a líder a 0,9–1,3 m (histerese), senta quando a líder fica parada, olha para ela.
// - Cede passagem: se a líder vem na direção dela, sai de lado. Nunca empurra a líder.
// - Linha de visão livre → vai direto; senão grafo de navegação (restrições small/gateOpen/cartMoved).
// - Sem caminho → espera sentada no nó alcançável mais próximo da líder.
// - Detecta quando fica presa, recalcula; presa > 3 s fora da tela → pede reposicionamento.

const FOLLOW_START = 1.3;
const FOLLOW_STOP = 0.95;

export function createBrain() {
  return {
    path: [], reachable: true, direct: true, waitNode: null, goal: null,
    pathT: 0, forceGraphT: 0, moving: false, reactT: 0, idleT: 0,
    progressT: 0, refX: 0, refZ: 0, stuckAccum: 0, stuckVisibleT: 0,
    mode: 'idle',
    holdT: 0, // atraso antes de começar a seguir (logo depois de uma troca: dá tempo de apertar F)
    stayT: 0, stayTurning: false, // comando Fica
  };
}

export function resetBrain(b) {
  Object.assign(b, createBrain());
}

/**
 * Planeja/segue o caminho até `goal`. Retorna o alvo imediato.
 * → { tx, tz, final, reachable, pathLen }
 */
export function navigate(b, c, goal, ctx, dt) {
  const { nav, world } = ctx;
  b.pathT -= dt;
  b.forceGraphT -= dt;
  const goalMoved = !b.goal || Math.hypot(goal.x - b.goal.x, goal.z - b.goal.z) > 0.6;
  if (b.pathT <= 0 || goalMoved) {
    const res = nav.findPath({ x: c.x, z: c.z }, goal, {
      r: c.r, size: c.size, flags: ctx.flags, allowDirect: b.forceGraphT <= 0,
    });
    b.path = res.waypoints.slice();
    b.reachable = res.reachable;
    b.direct = res.direct;
    b.waitNode = res.waitNode;
    b.goal = { x: goal.x, z: goal.z };
    b.pathT = 0.45;
  }
  const losR = c.r * 0.9;
  // Avança waypoints (chegou perto ou já enxerga o próximo alvo — "string pulling").
  while (b.path.length) {
    const w = b.path[0];
    const isLast = b.path.length === 1;
    const holdHere = !b.reachable && isLast; // nó de espera: não descarta
    if (holdHere) break;
    if (Math.hypot(w.x - c.x, w.z - c.z) < 0.3) { b.path.shift(); continue; }
    const next = isLast ? goal : b.path[1];
    if (b.forceGraphT <= 0.8 && world.segmentClear(c.x, c.z, next.x, next.z, losR, c.size)) { b.path.shift(); continue; }
    break;
  }
  let tx = goal.x;
  let tz = goal.z;
  let final = true;
  if (b.path.length) {
    tx = b.path[0].x;
    tz = b.path[0].z;
    final = !b.reachable && b.path.length === 1;
  } else if (!b.reachable) {
    // Sem nenhum nó alcançável (raro): fica onde está.
    tx = c.x;
    tz = c.z;
  }
  // Comprimento restante aproximado
  let pathLen = 0;
  let px = c.x;
  let pz = c.z;
  for (const w of b.path) { pathLen += Math.hypot(w.x - px, w.z - pz); px = w.x; pz = w.z; }
  if (b.reachable) pathLen += Math.hypot(goal.x - px, goal.z - pz);
  return { tx, tz, final, reachable: b.reachable, pathLen };
}

/** Atualiza detecção de "presa". Retorna true se deve reposicionar. */
function trackStuck(b, c, wantSpeed, dt, visible) {
  if (wantSpeed > 0.4) {
    b.progressT += dt;
    if (b.progressT > 0.6) {
      const moved = Math.hypot(c.x - b.refX, c.z - b.refZ);
      if (moved < 0.12) {
        b.stuckAccum += b.progressT;
        b.forceGraphT = 2.0; // ignora a linha reta por um tempo e recalcula pelo grafo
        b.pathT = 0;
      } else {
        b.stuckAccum = 0;
      }
      b.refX = c.x;
      b.refZ = c.z;
      b.progressT = 0;
    }
  } else {
    b.progressT = 0;
    b.refX = c.x;
    b.refZ = c.z;
    b.stuckAccum = Math.max(0, b.stuckAccum - dt);
  }
  if (b.stuckAccum > 3 && !visible) return true;
  if (b.stuckAccum > 8) return true; // último recurso mesmo na tela
  return false;
}

/**
 * Intenção da companheira para este quadro.
 * leader: controller da dog ativa; ctx: { nav, world, flags, isVisible(x,z) }
 * → { dx, dz, speed, action, lookAt: {x,y,z}|null, teleport: {x,z}|null, mode }
 */
export function companionIntent(b, c, leader, ctx, dt) {
  const out = { dx: 0, dz: 0, speed: 0, action: 'none', lookAt: null, teleport: null, mode: 'idle' };
  const lx = leader.x;
  const lz = leader.z;
  const toLx = lx - c.x;
  const toLz = lz - c.z;
  const distL = Math.hypot(toLx, toLz);
  const leaderSpeed = Math.hypot(leader.vx, leader.vz);
  const maxSpeed = c.cfg.walkSpeed;

  // 1) Ceder passagem: a líder vem na minha direção e estou no caminho.
  if (leaderSpeed > 0.4 && distL < 1.4) {
    const ux = leader.vx / leaderSpeed;
    const uz = leader.vz / leaderSpeed;
    const rx = c.x - lx;
    const rz = c.z - lz;
    const ahead = rx * ux + rz * uz;
    const lateral = rx * uz - rz * ux; // >0: à direita da líder
    const clear = leader.r + c.r + 0.3;
    if (ahead > -0.05 && ahead < 1.25 && Math.abs(lateral) < clear) {
      const side = lateral >= 0 ? 1 : -1;
      // perpendicular para o lado onde já estou (+ um pouco à frente)
      let dx = uz * side + ux * 0.3;
      let dz = -ux * side + uz * 0.3;
      // Se o lado escolhido está bloqueado, tenta o outro.
      if (ctx.world.overlaps(c.x + dx * 0.35, c.z + dz * 0.35, c.r, c.size)) {
        dx = -uz * side + ux * 0.3;
        dz = ux * side + uz * 0.3;
      }
      const L = Math.hypot(dx, dz) || 1;
      out.dx = dx / L;
      out.dz = dz / L;
      out.speed = Math.min(maxSpeed, leaderSpeed + 0.8);
      out.mode = 'yield';
      b.mode = 'yield';
      b.moving = true;
      b.idleT = 0;
      return out;
    }
  }

  // 1b) Acabou de virar companheira: olha para a líder um instante antes de sair andando.
  if (b.holdT > 0) {
    b.holdT -= dt;
    out.lookAt = { x: lx, y: 0.32, z: lz };
    out.faceX = lx;
    out.faceZ = lz;
    out.mode = 'hold';
    b.mode = 'hold';
    return out;
  }

  // 2) Navegação até a líder
  const navr = navigate(b, c, { x: lx, z: lz }, ctx, dt);
  const dT = Math.hypot(navr.tx - c.x, navr.tz - c.z);
  let speed = 0;
  if (!navr.reachable && navr.final) {
    // Esperando no nó alcançável mais próximo da líder
    out.mode = 'wait';
    speed = dT > 0.12 ? Math.min(maxSpeed, Math.max(0.5, dT * 2.5)) : 0;
    b.moving = speed > 0;
  } else if (b.path.length) {
    out.mode = 'path';
    speed = maxSpeed * (navr.pathLen > 3.5 ? 1.1 : 1);
    b.moving = true;
  } else {
    out.mode = 'follow';
    if (b.moving) {
      if (distL < FOLLOW_STOP) b.moving = false;
    } else if (distL > FOLLOW_START) {
      b.reactT += dt;
      if (b.reactT > 0.12) b.moving = true;
    } else b.reactT = 0;
    if (b.moving) {
      b.reactT = 0;
      speed = Math.min(maxSpeed * (distL > 3.5 ? 1.1 : 1), Math.max(0.45, (distL - 0.85) * 2.2));
    }
  }

  if (speed > 0 && dT > 1e-3) {
    out.dx = (navr.tx - c.x) / dT;
    out.dz = (navr.tz - c.z) / dT;
    out.speed = speed;
    b.idleT = 0;
  } else {
    b.idleT += dt;
  }

  // 3) Parada: olha para a líder; senta se a líder também está parada há um tempo.
  if (out.speed === 0) {
    out.lookAt = { x: lx, y: 0.32, z: lz };
    const sitDelay = out.mode === 'wait' ? 0.8 : 0.6;
    if (b.idleT > sitDelay && (leader.stillT > 1.2 || out.mode === 'wait')) out.action = 'sit';
    out.faceX = lx;
    out.faceZ = lz;
  }

  // 4) Presa?
  const visible = ctx.isVisible ? ctx.isVisible(c.x, c.z) : true;
  if (trackStuck(b, c, out.speed, dt, visible)) {
    const n = ctx.nav.nearestReachableNode({ x: c.x, z: c.z }, { x: lx, z: lz }, {
      r: c.r, size: c.size, flags: ctx.flags,
    });
    if (n) out.teleport = { x: n.x, z: n.z };
    b.stuckAccum = 0;
    b.pathT = 0;
  }
  b.mode = out.mode;
  return out;
}

/**
 * Comando Fica: parada onde está, senta e olha para a líder (gira o corpo só quando a líder
 * passa muito para o lado). → intenção
 */
export function stayIntent(b, c, leader, dt) {
  b.stayT += dt;
  const want = Math.atan2(leader.x - c.x, leader.z - c.z);
  let d = want - c.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (!b.stayTurning && Math.abs(d) > 1.5) b.stayTurning = true;
  else if (b.stayTurning && Math.abs(d) < 0.3) b.stayTurning = false;
  const out = { dx: 0, dz: 0, speed: 0, action: b.stayT > 0.3 ? 'sit' : 'none', lookAt: { x: leader.x, y: 0.32, z: leader.z }, teleport: null, mode: 'stay' };
  if (b.stayTurning || b.stayT < 0.3) {
    out.faceX = leader.x;
    out.faceZ = leader.z;
  }
  b.mode = 'stay';
  return out;
}

/** Vai até um ponto (comemoração). → intenção + arrived */
export function gotoIntent(b, c, target, ctx, dt, stop = 0.08) {
  const navr = navigate(b, c, target, ctx, dt);
  const dT = Math.hypot(navr.tx - c.x, navr.tz - c.z);
  const distFinal = Math.hypot(target.x - c.x, target.z - c.z);
  const out = { dx: 0, dz: 0, speed: 0, arrived: false };
  if (b.path.length === 0 && distFinal < stop) {
    out.arrived = true;
    return out;
  }
  if (dT > 1e-3) {
    out.dx = (navr.tx - c.x) / dT;
    out.dz = (navr.tz - c.z) / dT;
    out.speed = Math.min(c.cfg.walkSpeed, Math.max(0.35, (b.path.length ? 9 : distFinal) * 2.2));
  }
  return out;
}
