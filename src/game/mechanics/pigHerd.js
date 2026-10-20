// Porcos soltos (personagem novo da fase 10): N porquinhos presos num cercado com porteira. Soltos (setOpen(true)),
// saem um atrás do outro, andam pela área, vão atrás das dogs e atrapalham: ficam no caminho, à frente de quem anda
// (um colisor dinâmico por porco, que bloqueia as duas dogs), e, encostados, dão um esbarrão de leve (empurrão curto
// pela createDogEffects). Comida no chão (addFood) distrai por um TEMPO (generoso, por legume): o porco livre mais
// perto trota até ela, come, deita e cochila ao lado; quando o tempo acaba, acorda se sacudindo e volta a atrapalhar
// (pig:done). recall() leva todos de volta ao cercado (a porteira fecha quando o último entra); reset() volta ao começo.
//
//   const pigs = createPigHerd({ id, cfg, world, root, emit, effects, createPig, gateProp });
//   pigs.update(dt, { active, ctrls, carries })   // por quadro em 'playing' (effects.update e lockFor ficam com a fase);
//                                        // carries(nome) → a dog leva algo na boca? (eles vão atrás dela e derrubam)
//   pigs.animate(dt)                     // só anima (comemoração)
//   pigs.setOpen(true | false)           // porteira (a fase decide: botão, alavanca…)
//   const f = pigs.addFood({ x, z, kind: 'corn' | 'carrot' | 'pumpkin' | …, time?, eat?, onProgress?(k), onDone?() })
//   pigs.removeFood(f | f.id)            // alguém pegou a comida de volta: o porco volta a atrapalhar
//   pigs.recall() · pigs.reset() · pigs.onBark(ctrl) · pigs.info() · pigs.pigs · pigs.gate (createHingedGate)
// Quem leva algo na boca é o alvo preferido: eles correm mais atrás dela, esbarram mais e o esbarrão DERRUBA o objeto:
// a fase passa knockItem(nome, { pig, dirX, dirZ, x, z }) → true se derrubou (ela faz o objeto voar e cair; ver a
// arena). Logo depois de pegar, cfg.knockGrace s sem derrubar. Evento pig:knock {pig, name, x, z}.
// Comida: time = segundos de distração (a partir da 1ª mordida; Infinity = de vez), eat = quanto disso é comendo
// (o resto ele cochila ao lado). Sem time/eat, vale cfg.foods[kind] e depois cfg.distractTime / cfg.eatTime.
// onProgress(k 0..1) acompanha quanto já foi comido (a fase encolhe o legume); onDone() quando acabou de comer.
//
// cfg (layout PIGS; os padrões estão em PIG_DEFAULTS):
//   pen { x0, x1, z0, z1 }   miolo do cercado (as paredes são colisores estáticos da fase)
//   door { in: {x,z}, out: {x,z} }   logo dentro e logo fora da porteira
//   gate                     cfg do createHingedGate (hinge, latchPost, length, closedYaw, openYaw, openTime, closeTime)
//   area { minX, maxX, minZ, maxZ }  onde os soltos andam (nunca saem dela; a horta, por exemplo)
//   homes? [{x,z,yaw}]       lugar de cada um no cercado · exits? [{x,z}] para onde cada um vai ao sair
// Eventos (todos com x, z): pig:gate {open} · pig:release {count} · pig:oink {pig, kind: 'idle'|'pester'|'grumpy'|
//   'alert'|'happy'} · pig:bump {pig, name} · pig:smell {pig, food} · pig:eat {pig, food, kind, time} · pig:munch {pig}
//   · pig:full {pig, food} · pig:sleep {pig} · pig:wake {pig} · pig:shake {pig} · pig:snort / pig:snore {pig} (só som)
//   · pig:knock {pig, name} (derrubou o que a dog levava) · pig:done {pig, food, reason:
//   'time'|'taken'|'recall'} (acabou a distração) · pig:home (todos no cercado).
import { createHingedGate } from './hingedGate.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const rand = (r) => (Array.isArray(r) ? r[0] + Math.random() * (r[1] - r[0]) : r);

export const PIG_DEFAULTS = {
  count: 3,
  radius: 0.23,
  walkSpeed: 0.5, // passeando
  trotSpeed: 1.2, // indo a algum lugar (sair do cercado, ir comer)
  chaseSpeed: 1.55, // atrás de uma dog (elas andam a 2,0–2,4 m/s: dá para despistar, mas eles alcançam)
  turnRate: 4.5, // rad/s
  noticeR: 4, // vê uma dog (perto da área) a esta distância
  loseR: 6.5, // desiste se ela ficar mais longe
  boredAfter: 16, // depois de tanto tempo atrapalhando, cansa… (atrás de quem leva algo na boca, não cansa)
  boredFor: [3.5, 5.5], // …e fuça o chão esse tanto antes de voltar
  lead: 0.14, // quanto à frente da dog ele quer ficar (além dos dois raios)
  spread: 0.5, // lado a lado na frente da dog que anda (mais que o diâmetro de um porco)
  ring: 0.95, // em volta da dog parada: rad entre um porco e o próximo (no arco da frente)
  bumpEvery: [1.4, 2.8], // encostado, esbarra a cada (s)
  bumpDist: 0.32, // empurrão (m)
  bumpCooldown: 1.2, // por dog
  // quem leva algo na boca: vão atrás dela primeiro (até noticeR · 1,4), mais rápido, e o esbarrão derruba o objeto
  chaseCarrier: 1.85,
  bumpEveryCarrying: [0.45, 0.95],
  knockChance: 0.85,
  knockGrace: 1.5, // s depois de pegar, sem derrubar
  smellR: 10, // até onde sente a comida no chão
  reach: 0.3, // do centro do porco ao focinho (onde a comida fica quando ele come)
  nose: 0.37, // do centro do porco à ponta do focinho (encostar focinho com focinho na dog)
  distractTime: 30, // padrão de um legume sem cfg.foods[kind]
  eatTime: 16,
  foods: { corn: { time: 32, eat: 18 }, carrot: { time: 26, eat: 14 }, pumpkin: { time: 40, eat: 24 } },
  exitStagger: 0.8,
  oinkEvery: [4, 9],
  autoClose: true, // recall: a porteira fecha quando o último entra
};

/**
 * Cercado retangular para o layout de uma fase (puro JS, sem Three): colisores das quatro cercas FORA do miolo (a
 * cerca da porteira com o vão), o cfg da porteira (createHingedGate, abre para fora) e os pontos logo dentro e logo
 * fora dela. src/world/pigPen.js desenha o mesmo cercado (buildPigPen(PEN, pigPenLayout(PEN))).
 * PEN: { x0, x1, z0, z1 (miolo), t? (espessura, 0,08), h? (altura, 0,72), door: { side: 'n'|'s'|'e'|'w', a, b }
 *        (o vão ao longo da cerca), swing? (rad, 1,6), trough?: { x, z, hx, hz } (cocho, com colisor) }
 * @param {any} PEN @param {string} [id]
 */
export function pigPenLayout(PEN, id = 'chiqueiro') {
  const { x0, x1, z0, z1, door: D } = PEN;
  const t = PEN.t ?? 0.08;
  const swing = PEN.swing ?? 1.6;
  /** @returns {import('../../types').BoxCollider} */
  const box = (name, cx, cz, hx, hz) => ({ id: `${id}-${name}`, shape: 'box', x: cx, z: cz, hx, hz, height: PEN.h ?? 0.72 });
  /** Cerca ao longo de X (z fixo, do lado de fora: z0 − t/2 ou z1 + t/2), sem o vão [a, b] se for a da porteira. */
  const alongX = (name, z, gap) => {
    const xa = x0 - t, xb = x1 + t;
    if (!gap) return [box(name, (xa + xb) / 2, z, (xb - xa) / 2, t / 2)];
    return [box(`${name}-1`, (xa + gap[0]) / 2, z, (gap[0] - xa) / 2, t / 2), box(`${name}-2`, (gap[1] + xb) / 2, z, (xb - gap[1]) / 2, t / 2)];
  };
  const alongZ = (name, x, gap) => {
    if (!gap) return [box(name, x, (z0 + z1) / 2, t / 2, (z1 - z0) / 2)];
    return [box(`${name}-1`, x, (z0 + gap[0]) / 2, t / 2, (gap[0] - z0) / 2), box(`${name}-2`, x, (gap[1] + z1) / 2, t / 2, (z1 - gap[1]) / 2)];
  };
  const gap = [D.a, D.b];
  const colliders = [
    ...alongX('norte', z0 - t / 2, D.side === 'n' ? gap : null),
    ...alongX('sul', z1 + t / 2, D.side === 's' ? gap : null),
    ...alongZ('oeste', x0 - t / 2, D.side === 'w' ? gap : null),
    ...alongZ('leste', x1 + t / 2, D.side === 'e' ? gap : null),
  ];
  if (PEN.trough) colliders.push({ id: `${id}-cocho`, shape: 'box', x: PEN.trough.x, z: PEN.trough.z, hx: PEN.trough.hx, hz: PEN.trough.hz, height: 0.2 });
  const mid = (D.a + D.b) / 2;
  const L = D.b - D.a;
  // folha ao longo de −Z local girada por yaw (hingeTip): fechada sobre o vão, abre para fora do cercado
  const G = {
    s: { hinge: { x: D.a, z: z1 + t / 2 }, latchPost: { x: D.b, z: z1 + t / 2 }, closedYaw: -Math.PI / 2, openYaw: -Math.PI / 2 - swing, in: { x: mid, z: z1 - 0.45 }, out: { x: mid, z: z1 + t + 0.5 } },
    n: { hinge: { x: D.a, z: z0 - t / 2 }, latchPost: { x: D.b, z: z0 - t / 2 }, closedYaw: -Math.PI / 2, openYaw: -Math.PI / 2 + swing, in: { x: mid, z: z0 + 0.45 }, out: { x: mid, z: z0 - t - 0.5 } },
    w: { hinge: { x: x0 - t / 2, z: D.a }, latchPost: { x: x0 - t / 2, z: D.b }, closedYaw: Math.PI, openYaw: Math.PI - swing, in: { x: x0 + 0.45, z: mid }, out: { x: x0 - t - 0.5, z: mid } },
    e: { hinge: { x: x1 + t / 2, z: D.a }, latchPost: { x: x1 + t / 2, z: D.b }, closedYaw: Math.PI, openYaw: Math.PI + swing, in: { x: x1 - 0.45, z: mid }, out: { x: x1 + t + 0.5, z: mid } },
  }[D.side];
  return {
    pen: { x0, x1, z0, z1 },
    door: { in: G.in, out: G.out },
    gate: { hinge: G.hinge, latchPost: G.latchPost, length: L, closedYaw: G.closedYaw, openYaw: G.openYaw, openTime: 1.0, closeTime: 1.1 },
    colliders,
  };
}

/**
 * @param {{
 *   id?: string, cfg: any, world: import('../../types').CollisionWorld, root?: import('three').Object3D | null,
 *   emit?: import('../../types').GameEmit, effects?: any, createPig?: ((opts: { variant: number }) => import('../../types').PigModel) | null,
 *   gateProp?: import('../../types').GateProp | null,
 *   knockItem?: ((name: string, hit: { pig: number, dirX: number, dirZ: number, x: number, z: number }) => boolean) | null,
 * }} args
 */
export function createPigHerd({ id = 'porcos', cfg: userCfg, world, root = null, emit = null, effects = null, createPig = null, gateProp = null, knockItem = null }) {
  const cfg = { ...PIG_DEFAULTS, ...userCfg, foods: { ...PIG_DEFAULTS.foods, ...(userCfg.foods || {}) } };
  const { pen, door, area } = cfg;
  const r = cfg.radius;
  const fire = (name, payload) => emit?.(name, payload);
  const inPen = (x, z, m = 0) => x > pen.x0 - m && x < pen.x1 + m && z > pen.z0 - m && z < pen.z1 + m;
  const clampArea = (x, z, m = r) => ({ x: clamp(x, area.minX + m, area.maxX - m), z: clamp(z, area.minZ + m, area.maxZ - m) });

  // porteira: o colisor gira com a folha; ao fechar, espera quem estiver no caminho (dogs e porcos)
  const gate = createHingedGate({ id: `${id}-porteira`, cfg: cfg.gate, world, prop: gateProp });
  /** @type {Record<string, any>} */
  const blockers = {};
  const gateMid = { x: (cfg.gate.hinge.x + cfg.gate.latchPost.x) / 2, z: (cfg.gate.hinge.z + cfg.gate.latchPost.z) / 2 };

  const homes = cfg.homes || Array.from({ length: cfg.count }, (_, i) => {
    const u = (i + 0.5) / cfg.count;
    return { x: lerp(pen.x0 + r + 0.08, pen.x1 - r - 0.08, u), z: lerp(pen.z0, pen.z1, 0.35 + 0.3 * (i % 2)), yaw: Math.PI * (i % 2 ? 0.7 : -0.6) };
  });
  const exits = (cfg.exits || Array.from({ length: cfg.count }, (_, i) => {
    const ox = door.out.x - door.in.x, oz = door.out.z - door.in.z;
    const L = Math.hypot(ox, oz) || 1;
    const fx = ox / L, fz = oz / L;
    const side = (i - (cfg.count - 1) / 2) * 0.55;
    return { x: door.out.x + fx * (0.7 + 0.25 * (i % 2)) - fz * side, z: door.out.z + fz * (0.7 + 0.25 * (i % 2)) + fx * side };
  })).map((e) => clampArea(e.x, e.z, r + 0.1));

  /** @type {any[]} */
  const pigs = Array.from({ length: cfg.count }, (_, i) => {
    const model = createPig?.({ variant: i }) || null;
    if (model?.object) root?.add(model.object);
    const pid = `${id}-${i}`;
    const col = world.addDynamic({ id: pid, kind: 'npc', shape: 'circle', x: homes[i].x, z: homes[i].z, r });
    return {
      i, id: pid, model, col, r, ignore: new Set([pid]),
      x: homes[i].x, z: homes[i].z, yaw: homes[i].yaw ?? 0, speed: 0, yawRate: 0,
      state: 'pen', t: 0, route: [], goal: null, food: null, dog: null, slot: 0,
      stuckT: 0, bumpT: 0, bumpWait: rand(cfg.bumpEvery), bumpPending: -1, bumpDog: null,
      oinkT: rand(cfg.oinkEvery) * (0.5 + i * 0.3), grumpyCd: 0, alertT: 0,
      idleT: 0.5 + i, idleAct: 'idle', pesterT: 0, boredT: 0, exitAt: 0, left: 0, phase: '', munchT: 0,
      action: 'idle', lookAt: null, barkFrom: null, fxT: 1 + i, side: 0,
    };
  });
  const byCol = new Map(pigs.map((P) => [P.id, P]));
  const pigIds = new Set(pigs.map((P) => P.id));

  const S = {
    t: 0, wantOpen: false, released: false, recall: false, bumps: 0, knocks: 0, nextFood: 1, eaten: 0, done: 0, errors: 0,
    /** quem tem a vez na porteira (índice do porco) e desde quando @type {number | null} */ doorPig: null, doorT: 0,
    /** @type {Record<string, number>} */ dogCd: {},
    /** há quanto tempo cada dog leva algo na boca (s; 0 = boca vazia) @type {Record<string, number>} */ carryT: {},
  };
  /** @type {any[]} */
  const foods = [];

  /** Distância até a área (0 dentro). */
  const offArea = (x, z) => Math.hypot(Math.max(area.minX - x, 0, x - area.maxX), Math.max(area.minZ - z, 0, z - area.maxZ));
  const released = (P) => P.state !== 'pen' && P.state !== 'exit' && P.state !== 'return';
  const distracted = (P) => P.state === 'toFood' || P.state === 'eat' || P.state === 'nap' || P.state === 'wake';
  const free = (P) => released(P) && !distracted(P);

  function setState(P, s, extra = {}) {
    P.state = s;
    P.t = 0;
    P.stuckT = 0;
    Object.assign(P, extra);
  }

  function faceDir(P, dx, dz, dt, rate = cfg.turnRate) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return 0;
    const d = wrap(Math.atan2(dx, dz) - P.yaw);
    const stp = clamp(d * 8 * dt, -rate * dt, rate * dt);
    P.yaw = wrap(P.yaw + stp);
    P.yawRate = stp / Math.max(dt, 1e-4);
    return Math.abs(d);
  }

  // O corpo do porco é comprido: além do círculo de colisão, uma cápsula da garupa ao peito (para não encavalar
  // nos outros porcos nem enfiar o focinho ou a garupa numa dog).
  const SPINE = { back: 0.2, front: 0.22, r: 0.14 };
  function spine(P) {
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    return { ax: P.x - fx * SPINE.back, az: P.z - fz * SPINE.back, bx: P.x + fx * SPINE.front, bz: P.z + fz * SPINE.front };
  }
  function closestOn(px, pz, s) {
    const abx = s.bx - s.ax, abz = s.bz - s.az;
    const t = clamp(((px - s.ax) * abx + (pz - s.az) * abz) / (abx * abx + abz * abz || 1), 0, 1);
    return [s.ax + abx * t, s.az + abz * t];
  }
  /** Distância entre duas cápsulas (pelas pontas: bom o bastante para corpos lado a lado). → { d, nx, nz } (de s2 para s1) */
  function spineDist(s1, s2) {
    let d = Infinity, nx = 0, nz = 0;
    const test = (px, pz, s, sign) => {
      const [qx, qz] = closestOn(px, pz, s);
      const dd = Math.hypot(px - qx, pz - qz);
      if (dd < d) { d = dd; nx = ((px - qx) / (dd || 1)) * sign; nz = ((pz - qz) / (dd || 1)) * sign; }
    };
    test(s1.ax, s1.az, s2, 1); test(s1.bx, s1.bz, s2, 1); test(s2.ax, s2.az, s1, -1); test(s2.bx, s2.bz, s1, -1);
    return { d, nx, nz };
  }
  /** Quanto a dog ocupa na direção (px, pz) a partir do centro dela: a cabeça na frente, o corpo dos lados. */
  function dogExtent(c, px, pz) {
    const L = (c.cfg?.visual?.length ?? 0.6) * 0.42 + 0.06;
    const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz) || 1;
    const front = Math.max(0, (dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw)) / d);
    return lerp(c.r * 0.75, L, front);
  }

  /** Empurra o porco para fora das dogs (ele nunca as atravessa; quem empurra dog é só o esbarrão). */
  function avoidDogs(P, ctrls) {
    for (const n of Object.keys(ctrls || {})) {
      const c = ctrls[n];
      const dx = P.x - c.x, dz = P.z - c.z;
      const d = Math.hypot(dx, dz);
      const minD = r + c.r + 0.01;
      if (d < minD) {
        const nx = d > 1e-4 ? dx / d : Math.sin(P.yaw + Math.PI), nz = d > 1e-4 ? dz / d : Math.cos(P.yaw + Math.PI);
        P.x += nx * (minD - d);
        P.z += nz * (minD - d);
      }
      // a cápsula do corpo (focinho e garupa) também não entra na dog
      const [qx, qz] = closestOn(c.x, c.z, spine(P));
      const ds = Math.hypot(qx - c.x, qz - c.z);
      const minS = SPINE.r + c.r + 0.01;
      if (ds < minS && ds > 1e-4) {
        P.x += ((qx - c.x) / ds) * (minS - ds);
        P.z += ((qz - c.z) / ds) * (minS - ds);
      }
    }
    const res = world.resolve(P.x, P.z, r, 'large', { ignore: P.ignore });
    P.x = res.x;
    P.z = res.z;
  }

  /** Corpos compridos lado a lado: separa as cápsulas dos porcos (quem come ou dorme quase não sai do lugar). */
  function separatePigs() {
    for (let i = 0; i < pigs.length; i++) {
      for (let j = i + 1; j < pigs.length; j++) {
        const P = pigs[i], Q = pigs[j];
        if (Math.hypot(P.x - Q.x, P.z - Q.z) > 1.0) continue;
        const s = spineDist(spine(P), spine(Q));
        const min = SPINE.r * 2;
        if (s.d >= min) continue;
        const heavy = (X) => X.state === 'eat' || X.state === 'nap' ? 0.15 : 1;
        const wP = heavy(P), wQ = heavy(Q), k = (min - s.d) * 0.7 / (wP + wQ);
        for (const [X, w, sg] of [[P, wP, 1], [Q, wQ, -1]]) {
          const res = world.resolve(X.x + s.nx * k * w * sg, X.z + s.nz * k * w * sg, r, 'large', { ignore: X.ignore });
          X.x = res.x;
          X.z = res.z;
          if (inPen(X.x, X.z)) { X.x = clamp(X.x, pen.x0 + r, pen.x1 - r); X.z = clamp(X.z, pen.z0 + r, pen.z1 - r); }
          else if (released(X)) Object.assign(X, clampArea(X.x, X.z));
          X.col.x = X.x;
          X.col.z = X.z;
        }
      }
    }
  }

  /**
   * Anda até (tx, tz) na direção em que olha (faz a curva andando: nada de girar parado e sair de lado).
   * → true ao chegar (a `arrive` m).
   */
  function walkTo(P, tx, tz, speed, dt, ctrls, { arrive = 0.08, limit = 'area' } = {}) {
    const dx = tx - P.x, dz = tz - P.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) {
      P.speed = Math.max(0, P.speed - 4 * dt);
      return true;
    }
    const ang = faceDir(P, dx, dz, dt);
    const k = clamp(Math.cos(ang), 0.18, 1);
    const want = Math.min(speed * k, d * 3);
    P.speed += clamp(want - P.speed, -5 * dt, 3.2 * dt);
    // perto do alvo, vai direto (sem orbitar em volta dele)
    const b = clamp((0.45 - d) / 0.35, 0, 1);
    let mx = lerp(Math.sin(P.yaw), dx / d, b), mz = lerp(Math.cos(P.yaw), dz / d, b);
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const step = P.speed * dt;
    const px = P.x, pz = P.z;
    const res = world.move(P.x, P.z, mx * step, mz * step, r, 'large', { ignore: P.ignore });
    P.x = res.x;
    P.z = res.z;
    avoidDogs(P, ctrls);
    if (limit === 'area') Object.assign(P, clampArea(P.x, P.z));
    else if (limit === 'pen') {
      P.x = clamp(P.x, pen.x0 + r, pen.x1 - r);
      P.z = clamp(P.z, pen.z0 + r, pen.z1 - r);
    }
    const moved = Math.hypot(P.x - px, P.z - pz);
    P.speed = Math.min(P.speed, moved / Math.max(dt, 1e-4) + 0.05);
    P.stuckT = moved < step * 0.3 && step > 1e-4 ? P.stuckT + dt : 0;
    return false;
  }

  /**
   * A folha aberta da porteira (com a ponta "engordada" pelo raio do porco) fica entre o porco e o ponto p? → dois
   * pontos para contornar a ponta dela, um do lado do porco e um do lado de p (ou null). Quem chega pelo lado da
   * dobradiça daria de cara na folha.
   */
  function aroundLeaf(P, p) {
    if (gate.t < 0.25) return null;
    const h = cfg.gate.hinge, tip = gate.tip();
    const L = Math.hypot(tip.x - h.x, tip.z - h.z) || 1;
    const ux = (tip.x - h.x) / L, uz = (tip.z - h.z) / L;
    const ex = tip.x + ux * (r + 0.05), ez = tip.z + uz * (r + 0.05);
    const o = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const crosses = (bx, bz) => o(h.x, h.z, ex, ez, P.x, P.z) * o(h.x, h.z, ex, ez, bx, bz) < 0
      && o(P.x, P.z, bx, bz, h.x, h.z) * o(P.x, P.z, bx, bz, ex, ez) < 0;
    if (!crosses(p.x, p.z)) return null;
    const sP = o(h.x, h.z, ex, ez, P.x, P.z), sp = o(h.x, h.z, ex, ez, p.x, p.z);
    // os dois pontos bem separados (0,64 m): parado entre dois pontos próximos, o porco "chegava" nos dois sem andar e
    // ficava trocando de um para o outro sem sair do lugar
    const far = r + 0.22;
    const at = (side) => ({ x: tip.x + ux * far - uz * side * 0.32, z: tip.z + uz * far + ux * side * 0.32, leaf: true });
    const near = at(Math.sign(sP)), other = at(Math.sign(sp));
    // indo a um ponto do desvio, mas do lado de trás da folha (no cantinho entre ela e a cerca): sai pelo seu lado
    if (p.leaf) return [near];
    // já atrás da ponta (dá para ir direto ao ponto do outro lado sem cruzar a folha): não volta ao do seu lado
    return crosses(other.x, other.z) ? [near, other] : [other];
  }

  // A porteira é estreita: um porco de cada vez (dois lado a lado entalavam no vão e ficavam se empurrando sem sair).
  // Entre os que querem passar e estão perto dela (DOOR_ZONE m do corredor door.in–door.out), a vez é do mais perto do
  // vão; outro só toma a vez se estiver bem mais perto, ou se quem a tem empacou (DOOR_HOLD s). Os outros esperam.
  const DOOR_ZONE = 0.8, DOOR_HOLD = 6;
  const doorSeg = { ax: door.in.x, az: door.in.z, bx: door.out.x, bz: door.out.z };
  const toDoor = (P) => {
    const [qx, qz] = closestOn(P.x, P.z, doorSeg);
    return Math.hypot(P.x - qx, P.z - qz);
  };
  const toMid = (P) => Math.hypot(P.x - gateMid.x, P.z - gateMid.z);
  const wantsDoor = (P) => (P.state === 'exit' || P.state === 'return') && P.route.some((q) => q.door) && toDoor(P) < DOOR_ZONE;
  function assignDoor() {
    const cur = S.doorPig != null ? pigs[S.doorPig] : null;
    const held = !!cur && wantsDoor(cur);
    const expired = held && S.t - S.doorT > DOOR_HOLD;
    let best = null;
    for (const P of pigs) if (wantsDoor(P) && !(expired && P === cur) && (!best || toMid(P) < toMid(best))) best = P;
    if (held && !expired && (!best || best === cur || toMid(best) > toMid(cur) - 0.15)) return;
    const next = best || (held ? cur : null);
    if ((next?.i ?? null) !== S.doorPig) {
      S.doorPig = next ? next.i : null;
      S.doorT = S.t;
    }
  }
  /**
   * Espera a vez: parado, olhando para a porteira. Abre caminho para quem tem a vez quando ele vem passando (o corpo de
   * quem espera não pode ficar no caminho dele); colado no vão, recua devagar (para longe do meio dela).
   */
  function waitDoor(P, dt, ctrls) {
    faceDir(P, gateMid.x - P.x, gateMid.z - P.z, dt, 2);
    const o = S.doorPig != null ? pigs[S.doorPig] : null;
    let bx = 0, bz = 0;
    if (o && o !== P && Math.hypot(o.x - P.x, o.z - P.z) < r * 2 + 0.2) {
      bx = P.x - o.x;
      bz = P.z - o.z;
    } else if (toDoor(P) < 0.4) {
      bx = P.x - gateMid.x;
      bz = P.z - gateMid.z;
      if (Math.hypot(bx, bz) < 1e-3) {
        const s = inPen(P.x, P.z) ? door.in : door.out;
        bx = s.x - gateMid.x;
        bz = s.z - gateMid.z;
      }
    }
    if (bx || bz) {
      const l = Math.hypot(bx, bz) || 1, step = 0.3 * dt;
      const res = world.move(P.x, P.z, (bx / l) * step, (bz / l) * step, r, 'large', { ignore: P.ignore });
      P.x = res.x;
      P.z = res.z;
      avoidDogs(P, ctrls);
      P.speed = 0.2;
      P.action = 'walk';
    } else {
      stand(P, dt);
      P.action = 'idle';
    }
    P.stuckT = 0;
  }

  /** Segue P.route; → true ao chegar no último ponto. Contorna a folha aberta da porteira; empacado, dá um passo de lado. */
  function follow(P, speed, dt, ctrls, limit) {
    while (P.route.length > 1 && Math.hypot(P.route[0].x - P.x, P.route[0].z - P.z) < 0.22) P.route.shift();
    let p = P.route[0];
    if (!p) return true;
    const w = aroundLeaf(P, p);
    if (w) {
      P.route.unshift(...w);
      p = w[0];
    }
    if (S.doorPig !== P.i && wantsDoor(P)) {
      waitDoor(P, dt, ctrls);
      return false;
    }
    // 2,5 s sem chegar mais perto do ponto (dois porcos se empurrando focinho com focinho, por exemplo: cada um anda
    // um pouco e o outro devolve) também é estar empacado
    if (P.wp !== p) {
      P.wp = p;
      P.wpD = Infinity;
      P.wpT = 0;
    }
    const dp = Math.hypot(p.x - P.x, p.z - P.z);
    if (dp < P.wpD - 0.05) {
      P.wpD = dp;
      P.wpT = 0;
    } else if ((P.wpT += dt) > 2.5) {
      P.stuckT = 2;
      P.wpT = 0;
      P.wpD = Infinity;
    }
    if (P.stuckT > 1.5) {
      P.stuckT = 0;
      const step = sidestep(P, p);
      if (step) P.route.unshift(step);
      return false;
    }
    const last = P.route.length === 1;
    const ok = walkTo(P, p.x, p.z, speed, dt, ctrls, { arrive: last ? 0.1 : 0.2, limit });
    if (ok && !last) P.route.shift();
    return ok && last;
  }

  /**
   * Empacado a caminho de p: um passo de lado (cada vez para um lado, para não ir se arrastando ao longo da cerca), só
   * para onde há lugar e caminho livre (nada de se enfiar no cantinho atrás da folha da porteira); senão, um passo atrás.
   */
  function sidestep(P, p) {
    const dx = p.x - P.x, dz = p.z - P.z;
    const L = Math.hypot(dx, dz) || 1;
    const ux = dx / L, uz = dz / L;
    P.side = -(P.side || (P.i % 2 ? -1 : 1));
    const opts = [P.side, -P.side].map((s) => ({ x: P.x - uz * 0.6 * s + ux * 0.1, z: P.z + ux * 0.6 * s + uz * 0.1 }));
    opts.push({ x: P.x - ux * 0.45, z: P.z - uz * 0.45 });
    // os outros porcos não contam (eles saem da frente): só cercas, paredes e a folha da porteira
    for (const q of opts) {
      if (world.overlaps(q.x, q.z, r, 'large', { ignore: pigIds })) continue;
      if (!world.segmentClear(P.x, P.z, q.x, q.z, r * 0.8, 'large', { ignore: pigIds })) continue;
      if (released(P) && offArea(q.x, q.z) > 0) continue;
      return q;
    }
    return null;
  }

  function stand(P, dt) {
    P.speed = Math.max(0, P.speed - 4 * dt);
    if (P.speed > 0.01) {
      const res = world.move(P.x, P.z, Math.sin(P.yaw) * P.speed * dt, Math.cos(P.yaw) * P.speed * dt, r, 'large', { ignore: P.ignore });
      P.x = res.x;
      P.z = res.z;
    }
    P.yawRate *= Math.exp(-dt * 10);
  }

  function oink(P, kind) {
    P.model?.oink?.();
    P.oinkT = rand(cfg.oinkEvery) * (kind === 'pester' ? 0.45 : 1);
    fire('pig:oink', { pig: P.i, kind, x: P.x, z: P.z });
  }

  // ---------------------------------------------------------------------------- comida
  /**
   * Comida no chão em (x, z). → { id, kind, x, z, time, eat, state, eaten, pig, … }
   * @param {{ x: number, z: number, kind?: string, time?: number, eat?: number, obj?: any, onProgress?: (k: number) => void, onDone?: () => void, id?: string }} f
   */
  function addFood({ x, z, kind = 'corn', time, eat, obj = null, onProgress = null, onDone = null, id: fid }) {
    const def = cfg.foods[kind] || {};
    const T = time ?? def.time ?? cfg.distractTime;
    const E = Math.min(eat ?? def.eat ?? cfg.eatTime, T);
    const food = {
      id: fid || `comida-${S.nextFood++}`, kind, x, z, time: T, eat: E, left: E, eaten: 0,
      state: 'free', pig: null, obj, onProgress, onDone,
    };
    foods.push(food);
    return food;
  }

  /** Tira a comida do chão (pegaram de volta). O porco que ia comer ou comia volta a atrapalhar. */
  function removeFood(f) {
    const food = typeof f === 'string' ? foods.find((x) => x.id === f) : f;
    const i = foods.indexOf(food);
    if (i < 0) return false;
    foods.splice(i, 1);
    const P = food.pig != null ? pigs[food.pig] : null;
    if (P && P.food === food && (P.state === 'toFood' || P.state === 'eat')) {
      oink(P, 'grumpy');
      finishDistraction(P, 'taken');
    }
    return true;
  }

  /** Ponto onde o porco fica para comer (o focinho na comida), chegando de onde ele está. */
  function eatSpot(P, food) {
    let dx = food.x - P.x, dz = food.z - P.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    return clampArea(food.x - dx * cfg.reach, food.z - dz * cfg.reach);
  }
  const reachable = (food) => offArea(food.x, food.z) < cfg.reach + 0.25;

  function assignFoods() {
    for (const food of foods) {
      if (food.state !== 'free' || !reachable(food)) continue;
      let best = null, bd = cfg.smellR;
      for (const P of pigs) {
        if (!free(P)) continue;
        const d = Math.hypot(food.x - P.x, food.z - P.z);
        if (d < bd) { bd = d; best = P; }
      }
      if (!best) continue;
      food.state = 'claimed';
      food.pig = best.i;
      best.food = food;
      best.dog = null;
      best.route = [];
      setState(best, 'toFood');
      oink(best, 'happy');
      fire('pig:smell', { pig: best.i, food: food.id, kind: food.kind, x: best.x, z: best.z, fx: food.x, fz: food.z });
    }
  }

  function finishDistraction(P, reason) {
    const food = P.food;
    P.food = null;
    P.left = 0;
    if (food && food.pig === P.i && food.state !== 'done') {
      food.state = 'free';
      food.pig = null;
    }
    fire('pig:done', { pig: P.i, food: food?.id ?? null, reason, x: P.x, z: P.z });
    S.done++;
    // volta a passear do zero: o passeio de antes do legume (idleAct 'go') não tem mais destino
    setState(P, 'roam', { goal: null, pesterT: 0, boredT: 0, idleAct: 'sniff', idleT: 0.5 + Math.random() * 0.6 });
  }

  // ---------------------------------------------------------------------------- dogs
  const carrying = (n) => (S.carryT[n] || 0) > 0;
  function pickDog(P, active, ctrls) {
    // quem leva algo na boca chama atenção de longe (e mesmo cansados eles vão)
    for (const n of Object.keys(ctrls || {})) {
      const c = ctrls[n];
      if (carrying(n) && Math.hypot(c.x - P.x, c.z - P.z) < cfg.noticeR * 1.4 && offArea(c.x, c.z) < 0.9) return n;
    }
    if (P.boredT > 0) return null;
    const names = Object.keys(ctrls || {});
    names.sort((a, b) => (a === active?.name ? -1 : b === active?.name ? 1 : 0));
    for (const n of names) {
      const c = ctrls[n];
      if (Math.hypot(c.x - P.x, c.z - P.z) < cfg.noticeR && offArea(c.x, c.z) < 0.9) return n;
    }
    return null;
  }

  /** Cada dog com os seus porcos: P.slot = −1, 0, 1… (lado a lado na frente dela, ou num arco em volta). */
  function assignSlots() {
    /** @type {Record<string, any[]>} */
    const groups = {};
    for (const P of pigs) if (P.state === 'chase' && P.dog) (groups[P.dog] ||= []).push(P);
    for (const list of Object.values(groups)) {
      list.forEach((P, k) => { P.slot = k - (list.length - 1) / 2; });
    }
  }

  function chase(P, dt, active, ctrls) {
    // a dog ativa chegou perto: passa a atrapalhar ela (quem joga sente); quem leva algo na boca vem antes de tudo
    if (active && P.dog !== active.name && Math.hypot(active.x - P.x, active.z - P.z) < cfg.noticeR * 0.8 && offArea(active.x, active.z) < 0.9) {
      P.dog = active.name;
    }
    if (!carrying(P.dog)) {
      const k = Object.keys(ctrls || {}).find((n) => carrying(n) && Math.hypot(ctrls[n].x - P.x, ctrls[n].z - P.z) < cfg.noticeR * 1.4 && offArea(ctrls[n].x, ctrls[n].z) < 0.9);
      if (k) P.dog = k;
    }
    const target = carrying(P.dog);
    if (!target) P.pesterT += dt;
    const c = ctrls?.[P.dog];
    const far = !c || Math.hypot(c.x - P.x, c.z - P.z) > cfg.loseR;
    if (far || P.pesterT > cfg.boredAfter) {
      setState(P, 'roam', { dog: null, goal: null, pesterT: 0, boredT: far ? 0.5 : rand(cfg.boredFor), idleAct: 'sniff', idleT: 0 });
      return;
    }
    // ponto desejado: andando, à frente da dog (na direção em que ela anda), lado a lado com os outros porcos;
    // parada, encostado nela, num arco em volta da frente (cheiram e dão o esbarrão)
    const sp = Math.hypot(c.vx || 0, c.vz || 0);
    let fx = sp > 0.3 ? c.vx / sp : Math.sin(c.yaw), fz = sp > 0.3 ? c.vz / sp : Math.cos(c.yaw);
    let g;
    if (sp > 0.3) {
      const lead = r + c.r + cfg.lead + Math.min(sp, 2) * 0.12;
      g = clampArea(c.x + fx * lead + fz * P.slot * cfg.spread, c.z + fz * lead - fx * P.slot * cfg.spread);
    } else {
      // focinho com focinho na frente dela; dos lados, o focinho encosta no corpo
      const a = P.slot * cfg.ring;
      const ca = Math.cos(a), sa = Math.sin(a);
      [fx, fz] = [fx * ca + fz * sa, fz * ca - fx * sa];
      const lead = Math.max(r + c.r + 0.02, cfg.nose + dogExtent(c, c.x + fx, c.z + fz));
      g = clampArea(c.x + fx * lead, c.z + fz * lead);
    }
    const dDog = Math.hypot(c.x - P.x, c.z - P.z);
    const dGoal = Math.hypot(g.x - P.x, g.z - P.z);
    const outside = offArea(c.x, c.z) > 0.25;
    P.lookAt = { x: c.x, y: 0.3, z: c.z };
    if (dGoal > 0.14) {
      const top = target ? cfg.chaseCarrier : cfg.chaseSpeed;
      const speed = dGoal > 1 ? top : lerp(cfg.walkSpeed, top, dGoal);
      walkTo(P, g.x, g.z, speed, dt, ctrls, { arrive: 0.1 });
      P.action = 'walk';
    } else {
      stand(P, dt);
      faceDir(P, c.x - P.x, c.z - P.z, dt, 3);
      P.action = outside ? 'alert' : 'idle';
    }
    // encostado e de frente: esbarrão de leve de tempos em tempos
    const touching = dDog < Math.max(r + c.r, cfg.nose + dogExtent(c, P.x, P.z)) + 0.08;
    const facing = Math.abs(wrap(Math.atan2(c.x - P.x, c.z - P.z) - P.yaw)) < 1.1;
    if (touching && !outside) {
      if (P.speed < 0.3) P.action = 'sniff'; // cheirando a dog
      P.bumpT += dt;
      const canPush = !(c.jumpT > 0) && !(c.wallDur > 0) && !effects?.busy?.(c.name); // no ar ou num impulso, não
      // (atrás de quem leva algo na boca, vale até de lado ou de garupa: o que importa é derrubar)
      const wait = target ? Math.min(P.bumpWait, cfg.bumpEveryCarrying[1]) : P.bumpWait;
      if ((facing || target) && canPush && P.bumpT > wait && P.bumpPending < 0 && !(S.dogCd[c.name] > (target ? cfg.bumpCooldown * 0.5 : 0))) {
        P.model?.bump?.();
        P.bumpPending = 0.2; // o tranco sai no meio do gesto
        P.bumpDog = c.name;
        S.dogCd[c.name] = cfg.bumpCooldown;
        P.bumpT = 0;
        P.bumpWait = rand(target ? cfg.bumpEveryCarrying : cfg.bumpEvery);
      }
    } else P.bumpT = Math.max(0, P.bumpT - dt * 0.5);
    if (P.oinkT <= 0) oink(P, outside ? 'alert' : 'pester');
  }

  function doBump(P, ctrls) {
    const c = ctrls?.[P.bumpDog];
    P.bumpPending = -1;
    if (!c) return;
    const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz) || 1;
    if (d > Math.max(r + c.r, cfg.nose + dogExtent(c, P.x, P.z)) + 0.2) return; // a dog saiu a tempo
    effects?.knock?.(c, dx, dz, cfg.bumpDist, { dur: 0.3, action: 'startled', face: { x: P.x, z: P.z } });
    S.bumps++;
    fire('pig:bump', { pig: P.i, name: c.name, x: c.x, z: c.z });
    // levava algo na boca (há mais de knockGrace s): o tranco derruba
    if ((S.carryT[c.name] || 0) > cfg.knockGrace && Math.random() < cfg.knockChance
      && knockItem?.(c.name, { pig: P.i, dirX: dx / d, dirZ: dz / d, x: c.x, z: c.z })) {
      S.knocks++;
      S.carryT[c.name] = 0;
      oink(P, 'happy');
      fire('pig:knock', { pig: P.i, name: c.name, x: c.x, z: c.z });
    }
  }

  /** Uma dog trombou num porco (contato do integrate): ele reclama e, se estava à toa, vai atrás dela. */
  function dogHits(ctrls) {
    for (const n of Object.keys(ctrls || {})) {
      const c = ctrls[n];
      for (const h of c.hits || []) {
        const P = byCol.get(h.id);
        if (!P || P.grumpyCd > 0 || Math.hypot(c.vx || 0, c.vz || 0) < 0.6) continue;
        P.grumpyCd = 2.2;
        if (P.state === 'nap') continue; // dormindo pesado
        oink(P, 'grumpy');
        if (P.state === 'roam' && P.boredT <= 0) setState(P, 'chase', { dog: n, pesterT: 0 });
      }
    }
  }

  // ---------------------------------------------------------------------------- estados
  function penIdle(P, dt, ctrls) {
    // uma dog encostada no cercado: vai até a cerca do lado dela, olha e chama
    let near = null, nd = 1.7;
    for (const n of Object.keys(ctrls || {})) {
      const c = ctrls[n];
      const qx = clamp(c.x, pen.x0, pen.x1), qz = clamp(c.z, pen.z0, pen.z1);
      const d = Math.hypot(c.x - qx, c.z - qz);
      if (d < nd && !inPen(c.x, c.z)) { nd = d; near = c; }
    }
    if (near && P.idleAct !== 'sleep') {
      const tx = clamp(near.x, pen.x0 + r + 0.05, pen.x1 - r - 0.05) + (P.i - 1) * 0.22, tz = clamp(near.z, pen.z0 + r + 0.05, pen.z1 - r - 0.05);
      P.lookAt = { x: near.x, y: 0.3, z: near.z };
      if (walkTo(P, clamp(tx, pen.x0 + r, pen.x1 - r), tz, cfg.walkSpeed * 1.4, dt, ctrls, { arrive: 0.25, limit: 'pen' })) {
        faceDir(P, near.x - P.x, near.z - P.z, dt, 3);
        P.action = 'alert';
      } else P.action = 'walk';
      if (P.oinkT <= 0) oink(P, 'alert');
      return;
    }
    P.idleT -= dt;
    if (P.idleAct === 'go' && P.goal) {
      P.action = 'walk';
      if (walkTo(P, P.goal.x, P.goal.z, cfg.walkSpeed, dt, ctrls, { arrive: 0.12, limit: 'pen' }) || P.stuckT > 1) P.idleT = 0;
    } else {
      stand(P, dt);
      P.action = P.idleAct;
    }
    if (P.idleT <= 0) {
      const roll = Math.random();
      if (P.idleAct !== 'go' && roll < 0.55) {
        P.idleAct = 'go';
        for (let k = 0; k < 6; k++) {
          P.goal = { x: lerp(pen.x0 + r + 0.05, pen.x1 - r - 0.05, Math.random()), z: lerp(pen.z0 + r + 0.05, pen.z1 - r - 0.05, Math.random()) };
          if (Math.hypot(P.goal.x - door.in.x, P.goal.z - door.in.z) > 0.6) break; // longe da porta
        }
        P.idleT = 6;
      } else {
        P.idleAct = roll < 0.8 ? 'sniff' : roll < 0.93 ? 'idle' : 'sleep';
        P.idleT = P.idleAct === 'sleep' ? 9 + Math.random() * 6 : 2 + Math.random() * 3;
      }
    }
    if (P.oinkT <= 0 && P.action !== 'sleep') oink(P, 'idle');
  }

  function roam(P, dt, active, ctrls) {
    P.boredT = Math.max(0, P.boredT - dt);
    const dog = pickDog(P, active, ctrls);
    if (dog) {
      setState(P, 'chase', { dog, pesterT: 0 });
      if (P.oinkT > 1) oink(P, 'pester');
      return;
    }
    P.idleT -= dt;
    if (P.idleAct === 'go' && P.goal) {
      P.action = 'walk';
      if (walkTo(P, P.goal.x, P.goal.z, cfg.walkSpeed, dt, ctrls, { arrive: 0.15 }) || P.stuckT > 1.2) P.idleT = 0;
    } else {
      stand(P, dt);
      P.action = P.idleAct;
    }
    if (P.idleT <= 0) {
      if (P.idleAct !== 'go') {
        for (let k = 0; k < 5; k++) {
          const a = Math.random() * TAU, d = 1 + Math.random() * 2.2;
          P.goal = clampArea(P.x + Math.sin(a) * d, P.z + Math.cos(a) * d, r + 0.15);
          if (!inPen(P.goal.x, P.goal.z, r + 0.3)) break; // passeia fora do cercado
        }
        P.idleAct = 'go';
        P.idleT = 7;
      } else {
        P.idleAct = Math.random() < 0.7 ? 'sniff' : 'idle';
        P.idleT = 1.8 + Math.random() * 2.5;
      }
    }
    if (P.oinkT <= 0) oink(P, 'idle');
  }

  function toFood(P, dt, ctrls) {
    const food = P.food;
    if (!food || !foods.includes(food)) { finishDistraction(P, 'taken'); return; }
    const g = eatSpot(P, food);
    P.lookAt = { x: food.x, y: 0.05, z: food.z };
    P.action = 'walk';
    const near = Math.hypot(food.x - P.x, food.z - P.z) < cfg.reach + 0.12;
    if (walkTo(P, g.x, g.z, cfg.trotSpeed, dt, ctrls, { arrive: 0.06 }) || (near && P.stuckT > 0.4) || P.stuckT > 2.5) {
      food.state = 'eating';
      P.left = food.time;
      P.munchT = 0.6;
      setState(P, 'eat');
      fire('pig:eat', { pig: P.i, food: food.id, kind: food.kind, time: food.time, x: P.x, z: P.z });
    }
  }

  function eat(P, dt) {
    const food = P.food;
    stand(P, dt);
    faceDir(P, food.x - P.x, food.z - P.z, dt, 2.5);
    P.action = 'eat';
    P.lookAt = null;
    P.left -= dt;
    food.left = Math.max(0, food.left - dt);
    food.eaten = food.eat > 0 ? 1 - food.left / food.eat : 1;
    food.onProgress?.(food.eaten);
    P.munchT -= dt;
    if (P.munchT <= 0) {
      P.munchT = 1.1 + Math.random() * 0.5;
      fire('pig:munch', { pig: P.i, x: food.x, z: food.z });
    }
    if (food.left <= 0) {
      food.state = 'done';
      food.onDone?.();
      const i = foods.indexOf(food);
      if (i >= 0) foods.splice(i, 1);
      S.eaten++;
      fire('pig:full', { pig: P.i, food: food.id, x: P.x, z: P.z });
      setState(P, 'nap', { phase: 'lie' });
    }
  }

  function nap(P, dt) {
    stand(P, dt);
    P.lookAt = null;
    P.left -= dt;
    if (P.phase === 'lie' && P.t > 1.6) {
      P.phase = 'sleep';
      fire('pig:sleep', { pig: P.i, x: P.x, z: P.z });
    }
    P.action = P.phase === 'sleep' ? 'sleep' : 'lie';
    if (P.left <= 0) {
      setState(P, 'wake');
      fire('pig:wake', { pig: P.i, x: P.x, z: P.z });
    }
  }

  function wake(P, dt) {
    stand(P, dt);
    P.action = 'idle';
    if (P.t > 1.1 && P.phase !== 'shook') {
      P.phase = 'shook';
      P.model?.shake?.();
      fire('pig:shake', { pig: P.i, x: P.x, z: P.z });
    }
    if (P.t > 2.3) finishDistraction(P, 'time');
  }

  /**
   * Entrar ou sair do cercado só pela porteira: se o próximo ponto está do outro lado da cerca e o porco não está no
   * corredor da porta (entre door.in e door.out), ele passa antes pelo ponto da porta do lado dele.
   */
  function viaDoor(P) {
    const p = P.route[0];
    if (!p) return;
    const inside = inPen(P.x, P.z);
    if (inside === inPen(p.x, p.z)) return;
    const [qx, qz] = closestOn(P.x, P.z, { ax: door.in.x, az: door.in.z, bx: door.out.x, bz: door.out.z });
    if (Math.hypot(P.x - qx, P.z - qz) < 0.45) return; // no corredor da porteira: segue direto
    const d = inside ? door.in : door.out;
    if (p.x !== d.x || p.z !== d.z) P.route.unshift({ ...d, door: true });
  }

  function exit(P, dt, ctrls) {
    viaDoor(P);
    P.action = 'walk';
    if (follow(P, cfg.trotSpeed, dt, ctrls, 'none')) {
      setState(P, 'roam', { idleAct: 'sniff', idleT: 0.6 + Math.random(), boredT: 0 });
    } else if (P.t > 12) {
      // não conseguiu sair: ainda no cercado, tenta de novo daqui a pouco (fora dele, passeia de onde está)
      if (inPen(P.x, P.z)) {
        setState(P, 'pen', { route: [], idleAct: 'idle', idleT: 1 });
        P.exitAt = S.t + 0.5;
      } else setState(P, 'roam', { idleAct: 'sniff', idleT: 0.6 + Math.random(), boredT: 0 });
    }
  }

  function goHome(P, dt, ctrls) {
    viaDoor(P);
    P.action = 'walk';
    const arrived = follow(P, cfg.trotSpeed, dt, ctrls, inPen(P.x, P.z) ? 'pen' : 'none');
    // já dentro, longe da porta e sem porta pela frente: está em casa (o cantinho pode estar com alguém cochilando)
    const inside = inPen(P.x, P.z, -r * 0.5) && !P.route.some((q) => q.door) && Math.hypot(P.x - door.in.x, P.z - door.in.z) > 0.6;
    P.homeT = inside ? (P.homeT || 0) + dt : 0;
    const home = homes[P.i];
    if (arrived || (inside && (Math.hypot(P.x - home.x, P.z - home.z) < 0.5 || P.homeT > 3)) || (P.t > 20 && inPen(P.x, P.z))) {
      setState(P, 'pen', { idleAct: 'idle', idleT: 1 + Math.random() * 2 });
    } else if (P.t > 20) {
      // ainda fora depois de 20 s: refaz a rota do zero
      setState(P, 'return', { route: [{ ...door.out, door: true }, { ...door.in, door: true }, { x: home.x, z: home.z }] });
    }
  }

  // ---------------------------------------------------------------------------- API
  function setOpen(on) {
    on = !!on;
    if (on !== S.wantOpen) fire('pig:gate', { open: on, ...gateMid });
    S.wantOpen = on;
    if (on) S.recall = false;
    gate.setTarget(on ? 1 : 0);
    if (!on) {
      S.released = false;
      for (const P of pigs) if (P.state === 'exit' && inPen(P.x, P.z)) setState(P, 'pen', { idleAct: 'idle', idleT: 1 });
    }
  }

  function recall() {
    S.recall = true;
    S.released = false;
    gate.setTarget(1);
    for (const P of pigs) {
      if (distracted(P)) finishDistraction(P, 'recall');
      if (P.state === 'pen') continue;
      const home = homes[P.i];
      P.route = inPen(P.x, P.z) ? [{ x: home.x, z: home.z }] : [{ ...door.out, door: true }, { ...door.in, door: true }, { x: home.x, z: home.z }];
      setState(P, 'return', { dog: null });
    }
  }

  function place(P, x, z, yaw) {
    P.x = x;
    P.z = z;
    P.yaw = yaw;
    P.col.x = x;
    P.col.z = z;
    if (P.model?.object) {
      P.model.object.position.set(x, 0, z);
      P.model.object.rotation.y = yaw;
    }
  }

  function reset() {
    foods.length = 0;
    Object.assign(S, { t: 0, wantOpen: false, released: false, recall: false, bumps: 0, knocks: 0, dogCd: {}, carryT: {}, eaten: 0, done: 0, doorPig: null, doorT: 0 });
    gate.reset();
    for (const P of pigs) {
      const h = homes[P.i];
      Object.assign(P, {
        state: 'pen', t: 0, route: [], goal: null, food: null, dog: null, slot: 0, speed: 0, yawRate: 0, stuckT: 0,
        bumpT: 0, bumpWait: rand(cfg.bumpEvery), bumpPending: -1, bumpDog: null, oinkT: rand(cfg.oinkEvery), grumpyCd: 0,
        alertT: 0, idleT: 0.5 + P.i, idleAct: 'idle', pesterT: 0, boredT: 0, exitAt: 0, left: 0, phase: '', action: 'idle', lookAt: null,
        fxT: 1 + P.i, failed: false,
      });
      place(P, h.x, h.z, h.yaw ?? 0);
    }
  }

  /** Latido: os soltos e à toa perto param um instante, olham e respondem com um "oinc" (a comida é o que distrai). */
  function onBark(c) {
    let any = false;
    for (const P of pigs) {
      if (P.state === 'nap' || Math.hypot(c.x - P.x, c.z - P.z) > 3) continue;
      P.alertT = 0.9;
      P.barkFrom = { x: c.x, z: c.z };
      if (P.oinkT > 0.4) P.oinkT = 0.25 + P.i * 0.15;
      any = true;
    }
    return any;
  }

  function syncModel(P, dt) {
    P.col.x = P.x;
    P.col.z = P.z;
    if (!P.model) return;
    P.model.object.position.set(P.x, 0, P.z);
    P.model.object.rotation.y = P.yaw;
    P.model.update(dt, { speed: P.speed, turn: P.yawRate, action: P.action, lookAt: P.lookAt });
  }

  /** @param {number} dt @param {{ active?: import('../../types').DogController | null, ctrls?: Record<string, import('../../types').DogController>, carries?: ((name: string) => boolean) | null }} [ctx] */
  function update(dt, { active = null, ctrls = {}, carries = null } = {}) {
    S.t += dt;
    for (const n of Object.keys(ctrls)) S.carryT[n] = carries?.(n) ? (S.carryT[n] || 0) + dt : 0;
    for (const n of Object.keys(S.dogCd)) S.dogCd[n] = Math.max(0, S.dogCd[n] - dt);
    // porteira (quem está no vão segura a folha aberta: dogs e porcos)
    for (const n of Object.keys(ctrls)) blockers[n] = ctrls[n];
    for (const P of pigs) blockers[P.id] = P;
    gate.update(dt, { ctrls: blockers });
    // soltar: a porteira abriu (a fase pediu) e ninguém está chamando de volta
    if (S.wantOpen && !S.released && !S.recall && gate.isOpen(0.6)) {
      S.released = true;
      const inside = pigs.filter((P) => P.state === 'pen');
      inside.sort((a, b) => Math.hypot(a.x - door.in.x, a.z - door.in.z) - Math.hypot(b.x - door.in.x, b.z - door.in.z));
      inside.forEach((P, k) => { P.exitAt = S.t + k * cfg.exitStagger; });
      if (inside.length) fire('pig:release', { count: inside.length, ...gateMid });
    }
    if (S.released) {
      for (const P of pigs) {
        if (P.state !== 'pen' || S.t < P.exitAt) continue;
        P.route = [{ ...door.in, door: true }, { ...door.out, door: true }, { ...exits[P.i] }];
        setState(P, 'exit');
        oink(P, 'happy');
      }
    }
    guarded(null, () => {
      assignFoods();
      dogHits(ctrls);
      assignSlots();
      assignDoor();
    });
    // cada porco num passo protegido: um erro num deles não pode congelar o jogo (sai no console e ele volta a passear)
    for (const P of pigs) guarded(P, () => stepPig(P, dt, active, ctrls));
    guarded(null, separatePigs);
    // todos em casa: a porteira fecha (com uma dog lá dentro, espera ela sair: nunca prende ninguém no chiqueiro)
    if (S.recall && pigs.every((P) => P.state === 'pen' && inPen(P.x, P.z, -r * 0.5))
      && !Object.values(ctrls).some((c) => inPen(c.x, c.z, c.r))) {
      S.recall = false;
      S.wantOpen = false;
      if (cfg.autoClose) gate.setTarget(0);
      fire('pig:home', { ...gateMid });
      fire('pig:gate', { open: false, ...gateMid });
    }
  }

  /**
   * Roda fn; se der erro, registra no console (uma vez por porco: o E2E reprova com console.error) e põe o porco
   * de volta num estado simples, sem travar o laço do jogo.
   */
  function guarded(P, fn) {
    try {
      fn();
    } catch (err) {
      if (!S.errors++ || (P && !P.failed)) console.error(`[porcos] erro${P ? ` no porco ${P.i} (${P.state})` : ''}:`, err);
      if (!P) return;
      P.failed = true;
      if (P.food && P.food.pig === P.i && P.food.state !== 'done') { P.food.state = 'free'; P.food.pig = null; }
      Object.assign(P, { food: null, route: [], goal: null, dog: null, speed: 0, yawRate: 0, bumpPending: -1, alertT: 0, action: 'idle', lookAt: null });
      setState(P, inPen(P.x, P.z) ? 'pen' : 'roam', { idleAct: 'idle', idleT: 1 });
    }
  }

  function stepPig(P, dt, active, ctrls) {
    P.t += dt;
    P.oinkT -= dt;
    P.grumpyCd = Math.max(0, P.grumpyCd - dt);
    P.lookAt = null;
    P.yawRate *= 0.5;
    if (P.bumpPending >= 0) {
      P.bumpPending -= dt;
      if (P.bumpPending < 0) doBump(P, ctrls);
    }
    if (P.alertT > 0 && (P.state === 'roam' || P.state === 'chase' || P.state === 'pen')) {
      // ouviu um latido: para, olha e responde
      P.alertT -= dt;
      stand(P, dt);
      faceDir(P, P.barkFrom.x - P.x, P.barkFrom.z - P.z, dt, 3.5);
      P.lookAt = { x: P.barkFrom.x, y: 0.3, z: P.barkFrom.z };
      P.action = 'alert';
      if (P.oinkT <= 0) oink(P, 'alert');
    } else {
      switch (P.state) {
        case 'pen': penIdle(P, dt, ctrls); break;
        case 'exit': exit(P, dt, ctrls); break;
        case 'roam': roam(P, dt, active, ctrls); break;
        case 'chase': chase(P, dt, active, ctrls); break;
        case 'toFood': toFood(P, dt, ctrls); break;
        case 'eat': eat(P, dt); break;
        case 'nap': nap(P, dt); break;
        case 'wake': wake(P, dt); break;
        case 'return': goHome(P, dt, ctrls); break;
        default: setState(P, 'roam');
      }
    }
    // fuçadas e roncos (só som: o feedback toca pig:snort / pig:snore)
    P.fxT -= dt;
    if (P.fxT <= 0) {
      if (P.action === 'sniff') { fire('pig:snort', { pig: P.i, x: P.x, z: P.z }); P.fxT = 2.6 + Math.random() * 1.6; }
      else if (P.action === 'sleep') { fire('pig:snore', { pig: P.i, x: P.x, z: P.z }); P.fxT = 2.4 + Math.random(); }
      else P.fxT = 0.5;
    }
    syncModel(P, dt);
  }

  /** Só anima, sem andar (comemoração / fora do jogo). */
  function animate(dt) {
    for (const P of pigs) {
      P.speed = 0;
      P.yawRate = 0;
      if (P.action === 'walk') P.action = 'idle';
      syncModel(P, dt);
    }
  }

  const round = (v) => +v.toFixed(2);
  function info() {
    return {
      open: gate.target > 0.5, gateT: round(gate.t), released: S.released, recall: S.recall, bumps: S.bumps, knocks: S.knocks, eaten: S.eaten,
      /** Erros pegos pela rede de segurança do update (devem ser 0; cada um sai no console). */ errors: S.errors,
      pigs: pigs.map((P) => ({
        state: P.state, action: P.action, x: round(P.x), z: round(P.z), dog: P.dog, food: P.food?.id ?? null,
        distracted: distracted(P), left: P.state === 'toFood' ? round(P.food?.time ?? 0) : round(Math.max(0, P.left)),
      })),
      distracted: pigs.filter(distracted).length,
      pestering: pigs.filter((P) => P.state === 'chase').length,
      free: pigs.filter(free).length,
      inPen: pigs.filter((P) => inPen(P.x, P.z)).length,
      /** O menor tempo até um porco distraído voltar a atrapalhar (s; null se nenhum está distraído). */
      nextBack: pigs.some(distracted) ? round(Math.min(...pigs.filter(distracted).map((P) => (P.state === 'toFood' ? P.food?.time ?? 0 : Math.max(0, P.left))))) : null,
      foods: foods.map((f) => ({ id: f.id, kind: f.kind, x: round(f.x), z: round(f.z), state: f.state, eaten: round(f.eaten), pig: f.pig })),
    };
  }

  reset();
  return {
    update, animate, setOpen, recall, reset, onBark, addFood, removeFood, info, gate, pigs, foods,
    cfg,
    /** Coloca um porco num ponto e num estado (testes, ?stage=, capturas). state: 'roam' | 'pen' | 'chase'… */
    place(i, x, z, yaw = 0, state = null) {
      const P = pigs[i];
      place(P, x, z, yaw);
      if (state) setState(P, state, { route: [], goal: null, dog: null, idleAct: 'idle', idleT: 1 });
    },
    /** Solta todos já fora do cercado, à toa (testes, ?stage=). */
    releaseNow() {
      S.wantOpen = true;
      S.released = true;
      S.recall = false;
      gate.set(1);
      gate.setTarget(1);
      for (const P of pigs) {
        const e = exits[P.i];
        place(P, e.x, e.z, Math.atan2(e.x - door.out.x, e.z - door.out.z));
        setState(P, 'roam', { route: [], idleAct: 'sniff', idleT: 0.5 + P.i * 0.4, boredT: 0 });
      }
    },
    get released() { return S.released; },
    get open() { return S.wantOpen; },
    get distractedCount() { return pigs.filter(distracted).length; },
  };
}
