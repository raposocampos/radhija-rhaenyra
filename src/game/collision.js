// Colisão 2D (plano XZ) — círculo da dog contra o mundo.
// Puro JS, sem dependência do Three (testável em Node: tools/scripts/test-collision.mjs).
//
// Formas suportadas:
//   box     { x, z, hx, hz }                 (alinhada aos eixos)
//   circle  { x, z, r }
//   segment { ax, az, bx, bz, t }            (segmento com espessura: t = meia-espessura)
// blocks: 'all' (padrão) | 'large' (só bloqueia dogs de tamanho 'large')
// blocks: 'small' também é aceito (só bloqueia a Radhija). except: { minX, maxX, minZ, maxZ } —
// colisor ignorado quando o centro da dog está dentro (água sob uma ponte, por exemplo).
// Dinâmicos: registrados por cada fase via world.addDynamic(colisor) — o objeto devolvido é
// mutável (mova x/z/ax/bz…, ligue/desligue com enabled). Ex.: portão, carrinho, caixotes, água.

const EPS = 1e-9;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Penetração círculo × caixa alinhada. Retorna { nx, nz, depth } (normal aponta da caixa para o círculo) ou null. */
export function penCircleBox(px, pz, r, cx, cz, hx, hz) {
  const minX = cx - hx;
  const maxX = cx + hx;
  const minZ = cz - hz;
  const maxZ = cz + hz;
  const qx = px < minX ? minX : px > maxX ? maxX : px;
  const qz = pz < minZ ? minZ : pz > maxZ ? maxZ : pz;
  const dx = px - qx;
  const dz = pz - qz;
  const d2 = dx * dx + dz * dz;
  if (d2 > EPS) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    return { nx: dx / d, nz: dz / d, depth: r - d };
  }
  // Centro dentro da caixa: sai pelo eixo de menor penetração.
  const left = px - minX;
  const right = maxX - px;
  const top = pz - minZ;
  const bottom = maxZ - pz;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, nz: 0, depth: left + r };
  if (m === right) return { nx: 1, nz: 0, depth: right + r };
  if (m === top) return { nx: 0, nz: -1, depth: top + r };
  return { nx: 0, nz: 1, depth: bottom + r };
}

/** Penetração círculo × círculo. */
export function penCircleCircle(px, pz, r, cx, cz, cr) {
  const dx = px - cx;
  const dz = pz - cz;
  const R = r + cr;
  const d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-6) return { nx: 1, nz: 0, depth: R };
  return { nx: dx / d, nz: dz / d, depth: R - d };
}

/** Ponto mais próximo no segmento AB. */
export function closestOnSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const L2 = abx * abx + abz * abz;
  let t = L2 > EPS ? ((px - ax) * abx + (pz - az) * abz) / L2 : 0;
  t = clamp(t, 0, 1);
  return { x: ax + abx * t, z: az + abz * t, t };
}

/** Penetração círculo × segmento com meia-espessura ht (cápsula). */
export function penCircleSegment(px, pz, r, ax, az, bx, bz, ht) {
  const q = closestOnSegment(px, pz, ax, az, bx, bz);
  const dx = px - q.x;
  const dz = pz - q.z;
  const R = r + ht;
  const d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    // Exatamente sobre o segmento: usa a normal do segmento.
    const abx = bx - ax;
    const abz = bz - az;
    const L = Math.hypot(abx, abz) || 1;
    return { nx: -abz / L, nz: abx / L, depth: R };
  }
  return { nx: dx / d, nz: dz / d, depth: R - d };
}

/** Penetração genérica para um colisor descrito por shape. */
export function penCollider(px, pz, r, c) {
  switch (c.shape) {
    case 'box': return penCircleBox(px, pz, r, c.x, c.z, c.hx, c.hz);
    case 'circle': return penCircleCircle(px, pz, r, c.x, c.z, c.r);
    case 'segment': return penCircleSegment(px, pz, r, c.ax, c.az, c.bx, c.bz, c.t ?? 0.05);
    default: return null;
  }
}

/** Ponta de um portão com dobradiça { hinge, length, closedYaw, openYaw } para a abertura t (folha ao longo de -Z local). */
export function hingeTip(g, t) {
  const yaw = (g.closedYaw ?? 0) + (g.openYaw - (g.closedYaw ?? 0)) * t;
  // Rotação de (0, -1) em torno de Y por yaw: x' = -sin(yaw), z' = -cos(yaw)
  return { x: g.hinge.x - Math.sin(yaw) * g.length, z: g.hinge.z - Math.cos(yaw) * g.length };
}

/** Ponta do portão para uma abertura t (mesma fórmula de props.gate.setOpen: yaw = openYaw * t; folha ao longo de -Z local). */
export function gateTip(FENCE, t) {
  return hingeTip(FENCE.gate, t);
}

/**
 * Mundo de colisão a partir do layout da fase (STATIC_COLLIDERS + WORLD.bounds).
 * Todas as consultas recebem (x, z, r, size) — size 'small'|'large'.
 */
/**
 * @param {import('../types').LevelLayout} layout
 * @returns {import('../types').CollisionWorld}
 */
export function createCollisionWorld(layout) {
  const { STATIC_COLLIDERS, WORLD } = layout;
  const bounds = WORLD.bounds;
  const statics = STATIC_COLLIDERS.map((c) => ({ ...c, blocks: c.blocks || 'all', kind: c.kind || 'static' }));
  const dynamics = [];
  // companionOnly: colisor que só vale para a companheira (ex.: área do irrigador ligado, que a IA
  // deve contornar). O jogo liga o modo durante a atualização da companheira (setCompanionMode).
  let companionMode = false;

  /** Registra um colisor dinâmico (shape box/circle/segment). Devolve o próprio objeto (mutável). */
  function addDynamic(c) {
    const d = Object.assign(c, { blocks: c.blocks || 'all', kind: c.kind || 'dynamic', enabled: c.enabled !== false });
    dynamics.push(d);
    return d;
  }
  function removeDynamic(d) {
    const i = dynamics.indexOf(d);
    if (i >= 0) dynamics.splice(i, 1);
  }
  const getDynamic = (id) => dynamics.find((d) => d.id === id) || null;

  const applies = (c, size) => c.enabled !== false && (c.blocks === 'all' || c.blocks === size) && (!c.companionOnly || companionMode);
  // except: retângulo onde o colisor é ignorado (centro da dog dentro dele) — ex.: água sob a ponte.
  const excepted = (c, x, z) => !!c.except && x >= c.except.minX && x <= c.except.maxX && z >= c.except.minZ && z <= c.except.maxZ;

  /** Lista de penetrações (sem resolver). margin aumenta o raio de teste (para "encostar"). */
  function contacts(x, z, r, size, opts = {}) {
    const out = [];
    const rr = r + (opts.margin || 0);
    for (const list of [statics, dynamics]) {
      for (const c of list) {
        if (!applies(c, size) || excepted(c, x, z)) continue;
        if (opts.ignore && opts.ignore.has(c.id)) continue;
        const p = penCollider(x, z, rr, c);
        if (p && p.depth > 1e-6) out.push({ id: c.id, kind: c.kind, nx: p.nx, nz: p.nz, depth: p.depth });
      }
    }
    return out;
  }

  function clampBounds(x, z, r) {
    return { x: clamp(x, bounds.minX + r, bounds.maxX - r), z: clamp(z, bounds.minZ + r, bounds.maxZ - r) };
  }

  /** Empurra o círculo para fora de tudo (várias iterações). */
  function resolve(x, z, r, size, opts = {}) {
    const hits = new Map();
    const iters = opts.iterations || 6;
    for (let it = 0; it < iters; it++) {
      let any = false;
      for (const list of [statics, dynamics]) {
        for (const c of list) {
          if (!applies(c, size) || excepted(c, x, z)) continue;
          if (opts.ignore && opts.ignore.has(c.id)) continue;
          const p = penCollider(x, z, r, c);
          if (p && p.depth > 1e-6) {
            x += p.nx * p.depth;
            z += p.nz * p.depth;
            any = true;
            const prev = hits.get(c.id);
            if (!prev || prev.depth < p.depth) hits.set(c.id, { id: c.id, kind: c.kind, nx: p.nx, nz: p.nz, depth: p.depth });
          }
        }
      }
      const b = clampBounds(x, z, r);
      if (b.x !== x || b.z !== z) {
        const nx = Math.sign(b.x - x);
        const nz = Math.sign(b.z - z);
        hits.set('bounds', { id: 'bounds', kind: 'static', nx, nz, depth: Math.hypot(b.x - x, b.z - z) });
        x = b.x;
        z = b.z;
      }
      if (!any) break;
    }
    return { x, z, hits: [...hits.values()] };
  }

  /** Move (dx, dz) com sub-passos (passo ≤ 0.45·r) para nunca atravessar paredes finas. */
  function move(x, z, dx, dz, r, size, opts = {}) {
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (r * 0.45)));
    const sx = dx / steps;
    const sz = dz / steps;
    const hits = new Map();
    for (let i = 0; i < steps; i++) {
      x += sx;
      z += sz;
      const res = resolve(x, z, r, size, opts);
      x = res.x;
      z = res.z;
      for (const h of res.hits) {
        const prev = hits.get(h.id);
        if (!prev || prev.depth < h.depth) hits.set(h.id, h);
      }
    }
    return { x, z, hits: [...hits.values()] };
  }

  /** O círculo encosta (penetra) em algo? */
  function overlaps(x, z, r, size, opts = {}) {
    if (x < bounds.minX + r || x > bounds.maxX - r || z < bounds.minZ + r || z > bounds.maxZ - r) return true;
    for (const list of [statics, dynamics]) {
      for (const c of list) {
        if (!applies(c, size) || excepted(c, x, z)) continue;
        if (opts.ignore && opts.ignore.has(c.id)) continue;
        const p = penCollider(x, z, r, c);
        if (p && p.depth > 1e-4) return true;
      }
    }
    return false;
  }

  /** Linha de visão "gorda": um círculo de raio r consegue ir de A a B em linha reta? */
  function segmentClear(ax, az, bx, bz, r, size, opts = {}) {
    const len = Math.hypot(bx - ax, bz - az);
    const step = Math.max(0.04, r * 0.5);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (overlaps(ax + (bx - ax) * t, az + (bz - az) * t, r, size, opts)) return false;
    }
    return true;
  }

  return {
    statics, dynamics, bounds,
    addDynamic, removeDynamic, getDynamic,
    setCompanionMode(on) { companionMode = !!on; },
    get companionMode() { return companionMode; },
    contacts, resolve, move, overlaps, segmentClear, clampBounds,
  };
}
