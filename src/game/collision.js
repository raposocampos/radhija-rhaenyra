// Colisão 2D (plano XZ) — círculo da dog contra o mundo.
// Puro JS, sem dependência do Three (testável em Node: tools/scripts/test-collision.mjs).
//
// O corpo comprido da dog (peito e garupa além do círculo) entra com resolveBody: dois círculos menores no rumo dela.
// Formas suportadas:
//   box     { x, z, hx, hz }                 (alinhada aos eixos)
//   circle  { x, z, r }
//   segment { ax, az, bx, bz, t }            (segmento com espessura: t = meia-espessura)
// blocks: 'all' (padrão) | 'large' (só bloqueia dogs de tamanho 'large')
// blocks: 'small' também é aceito (só bloqueia a Radhija). except: { minX, maxX, minZ, maxZ } —
// colisor ignorado quando o centro da dog está dentro (água sob uma ponte, por exemplo).
// jumpable: true — obstáculo baixo (tronco, mureta baixa) ignorado por quem está no ar (opts.airborne). Descendo abaixo
// do alto dele (opts.lowY < height), só deixa passar quem já tem ele embaixo do corpo (opts.over, os ids): quem chega
// baixa demais bate na lateral, em vez de entrar nele (dogController).
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
  // Mapas grandes (layout.COLLISION_GRID = lado da célula, m): os estáticos ficam numa grade e cada consulta só olha os
  // das células em volta. Sem a grade (as fases), a lista inteira, como sempre.
  const G = layout.COLLISION_GRID || 0;
  /** @type {Map<number, number[]> | null} */
  const grid = G > 0 ? new Map() : null;
  const cellKey = (ix, iz) => (ix + 2048) * 4096 + (iz + 2048);
  const marks = new Uint32Array(statics.length);
  /** @type {any[]} */
  const scratch = [];
  let stamp = 0;
  if (grid) {
    statics.forEach((c, i) => {
      const t = c.shape === 'segment' ? (c.t ?? 0.05) : 0;
      const [x0, z0, x1, z1] = c.shape === 'box' ? [c.x - c.hx, c.z - c.hz, c.x + c.hx, c.z + c.hz]
        : c.shape === 'circle' ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r]
          : [Math.min(c.ax, c.bx) - t, Math.min(c.az, c.bz) - t, Math.max(c.ax, c.bx) + t, Math.max(c.az, c.bz) + t];
      for (let ix = Math.floor(x0 / G); ix <= Math.floor(x1 / G); ix++) {
        for (let iz = Math.floor(z0 / G); iz <= Math.floor(z1 / G); iz++) {
          const k = cellKey(ix, iz);
          const cell = grid.get(k);
          if (cell) cell.push(i);
          else grid.set(k, [i]);
        }
      }
    });
  }
  /**
   * Os estáticos que podem tocar um círculo de raio r em (x, z) (com folga). Com a grade, a lista é reaproveitada:
   * vale até a próxima consulta.
   */
  function staticsNear(x, z, r) {
    if (!grid) return statics;
    stamp = (stamp + 1) >>> 0 || 1;
    scratch.length = 0;
    const pad = r + 0.6;
    const ix1 = Math.floor((x + pad) / G);
    const iz0 = Math.floor((z - pad) / G);
    const iz1 = Math.floor((z + pad) / G);
    for (let ix = Math.floor((x - pad) / G); ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const cell = grid.get(cellKey(ix, iz));
        if (!cell) continue;
        for (const i of cell) {
          if (marks[i] === stamp) continue;
          marks[i] = stamp;
          scratch.push(statics[i]);
        }
      }
    }
    return scratch;
  }
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
  /** No ar, o que ela pula não bloqueia; descendo abaixo do alto dele, só o que ela já tem embaixo do corpo. */
  const passes = (c, opts) => !!opts.airborne && !!c.jumpable && !(opts.lowY != null && opts.lowY < (c.height || 0.01) && !opts.over?.has(c.id));
  // except: retângulo onde o colisor é ignorado (centro da dog dentro dele) — ex.: água sob a ponte.
  const excepted = (c, x, z) => !!c.except && x >= c.except.minX && x <= c.except.maxX && z >= c.except.minZ && z <= c.except.maxZ;

  /** Lista de penetrações (sem resolver). margin aumenta o raio de teste (para "encostar"). */
  function contacts(x, z, r, size, opts = {}) {
    const out = [];
    const rr = r + (opts.margin || 0);
    for (const list of [staticsNear(x, z, rr), dynamics]) {
      for (const c of list) {
        if (!applies(c, size) || excepted(c, x, z) || passes(c, opts)) continue;
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
      for (const list of [staticsNear(x, z, r), dynamics]) {
        for (const c of list) {
          if (!applies(c, size) || excepted(c, x, z) || passes(c, opts)) continue;
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

  /**
   * Corpo comprido: o peito e a garupa passam do círculo do meio (r), então vão em dois círculos menores presos ao rumo
   * `yaw` (body: { front, back, r } = até onde o peito vai à frente do centro, até onde a garupa vai atrás e o raio
   * dos dois). Empurra o centro para fora do que o peito ou a garupa invadem; o círculo do meio manda (o vão por onde
   * a dog passa continua o mesmo): onde os três não cabem (girando num corredor estreito), fica o do meio. Os centros
   * dos dois ficam dentro do círculo do meio (front − r e back − r menores que ele), então nunca estão do outro lado
   * de uma parede que o do meio não atravessou. `except` olha o centro da dog, como para o círculo do meio.
   */
  function resolveBody(x, z, yaw, body, r, size, opts = {}) {
    const sx = Math.sin(yaw);
    const sz = Math.cos(yaw);
    const offs = [body.front - body.r, body.r - body.back];
    const br = body.r;
    const hits = new Map();
    const keep = (h) => {
      const prev = hits.get(h.id);
      if (!prev || prev.depth < h.depth) hits.set(h.id, h);
    };
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (const o of offs) {
        for (const list of [staticsNear(x + sx * o, z + sz * o, br), dynamics]) {
          for (const c of list) {
            if (!applies(c, size) || excepted(c, x, z) || passes(c, opts)) continue;
            if (opts.ignore && opts.ignore.has(c.id)) continue;
            const p = penCollider(x + sx * o, z + sz * o, br, c);
            if (p && p.depth > 1e-6) {
              x += p.nx * p.depth;
              z += p.nz * p.depth;
              any = true;
              keep({ id: c.id, kind: c.kind, nx: p.nx, nz: p.nz, depth: p.depth });
            }
          }
        }
        const px = x + sx * o;
        const pz = z + sz * o;
        const b = clampBounds(px, pz, br);
        if (b.x !== px || b.z !== pz) {
          keep({ id: 'bounds', kind: 'static', nx: Math.sign(b.x - px), nz: Math.sign(b.z - pz), depth: Math.hypot(b.x - px, b.z - pz) });
          x += b.x - px;
          z += b.z - pz;
          any = true;
        }
      }
      if (!any) break;
      const res = resolve(x, z, r, size, opts);
      x = res.x;
      z = res.z;
      for (const h of res.hits) keep(h);
    }
    return { x, z, hits: [...hits.values()] };
  }

  /**
   * O alto do mais alto dos colisores jumpable (o que ela pula) em que o corpo em (x, z), olhando para `yaw`, entra mais
   * de `depth` m: o círculo do meio (raio r) ou o do peito ou o da garupa (body.r); 0 se nenhum (o colisor sem alto
   * conta como 0,01). O pulo não pousa dentro deles (dogController) e o desenho passa por cima (game.js). `out`: junta os
   * ids de todos eles.
   */
  function jumpableTop(x, z, yaw, body, r, size, depth = 0, out = null) {
    const sx = Math.sin(yaw);
    const sz = Math.cos(yaw);
    const parts = body ? [[0, r], [body.front - body.r, body.r], [body.r - body.back, body.r]] : [[0, r]];
    let top = 0;
    const reach = body ? Math.max(r, body.front, body.back) : r;
    for (const list of [staticsNear(x, z, reach), dynamics]) {
      for (const c of list) {
        const h = c.height || 0.01;
        if (!c.jumpable || (h <= top && !out) || !applies(c, size) || excepted(c, x, z)) continue;
        for (const [o, pr] of parts) {
          const p = penCollider(x + sx * o, z + sz * o, pr, c);
          if (p && p.depth > depth) {
            top = Math.max(top, h);
            out?.add(c.id);
            break;
          }
        }
      }
    }
    return top;
  }

  /** O círculo encosta (penetra) em algo? */
  function overlaps(x, z, r, size, opts = {}) {
    if (x < bounds.minX + r || x > bounds.maxX - r || z < bounds.minZ + r || z > bounds.maxZ - r) return true;
    for (const list of [staticsNear(x, z, r), dynamics]) {
      for (const c of list) {
        if (!applies(c, size) || excepted(c, x, z) || passes(c, opts)) continue;
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
    statics, dynamics, bounds, staticsNear,
    addDynamic, removeDynamic, getDynamic,
    setCompanionMode(on) { companionMode = !!on; },
    get companionMode() { return companionMode; },
    contacts, resolve, resolveBody, move, overlaps, segmentClear, clampBounds, jumpableTop,
  };
}
