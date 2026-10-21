// Navegação da companheira sobre NAV_NODES/NAV_EDGES (Dijkstra multi-origem).
// Puro JS; usa o mundo de colisão para linha de visão. Testável em Node.
// No modo da companheira (ctx.approach), onde o grafo não resolve — a irmã num cantinho sem nó à vista, ou ela mesma
// num —, uma busca local em grade acha o caminho ou o lugar alcançável mais perto da irmã.

/** Quanto a posição da líder pode mudar ao assentar o círculo da companheira nela (encostada numa parede). */
const GOAL_SETTLE = 0.15;
// Busca local em grade (o grafo não cobre cada cantinho: atrás dos caixotes, entre os móveis): células de CELL m, até
// GRID_SPAN m da companheira, no máximo GRID_MAX células por busca.
const CELL = 0.15;
const GRID_SPAN = 7;
const GRID_MAX = 2600;
/** O lugar de espera fica pelo menos a isso da irmã (fora do espaço dela). */
const WAIT_MIN = 0.5;
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cellKey = (ix, iz) => (ix + 8192) * 16384 + (iz + 8192);
const cellIx = (k) => Math.floor(k / 16384) - 8192;
const cellIz = (k) => (k % 16384) - 8192;

export function createNavigator(layout, world) {
  const { NAV_NODES, NAV_EDGES } = layout;
  const ids = Object.keys(NAV_NODES);
  const nodes = new Map(ids.map((id) => [id, { id, x: NAV_NODES[id].x, z: NAV_NODES[id].z }]));
  const adj = new Map(ids.map((id) => [id, []]));
  for (const [a, b, opt] of NAV_EDGES) {
    const na = nodes.get(a);
    const nb = nodes.get(b);
    if (!na || !nb) continue;
    const w = Math.hypot(na.x - nb.x, na.z - nb.z);
    const req = opt?.requires || null;
    adj.get(a).push({ to: b, w, req });
    adj.get(b).push({ to: a, w, req });
  }

  function edgeOk(req, ctx) {
    if (!req) return true;
    // Várias restrições ao mesmo tempo (ex.: ['small', 'tunnel']): todas precisam valer.
    if (Array.isArray(req)) return req.every((r) => edgeOk(r, ctx));
    if (req === 'small') return ctx.size === 'small';
    if (req === 'large') return ctx.size === 'large';
    // Demais restrições são flags definidas pelo puzzle da fase (puzzle.navFlags()).
    return !!(ctx.flags && ctx.flags[req]);
  }

  const losR = (ctx) => (ctx.losR != null ? ctx.losR : ctx.r * 0.9);

  /** Nós com linha de visão livre a partir de (x, z), ordenados por distância. */
  function visibleNodes(x, z, ctx) {
    const out = [];
    for (const n of nodes.values()) {
      const d = Math.hypot(n.x - x, n.z - z);
      if (world.segmentClear(x, z, n.x, n.z, losR(ctx), ctx.size)) out.push({ id: n.id, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  function nearestNodes(x, z, k = 2) {
    return [...nodes.values()]
      .map((n) => ({ id: n.id, d: Math.hypot(n.x - x, n.z - z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
  }

  /** Dijkstra a partir de várias origens {id, d}. */
  function dijkstra(sources, ctx) {
    const dist = new Map(ids.map((id) => [id, Infinity]));
    const prev = new Map();
    const done = new Set();
    for (const s of sources) {
      if (s.d < dist.get(s.id)) {
        dist.set(s.id, s.d);
        prev.set(s.id, null);
      }
    }
    for (;;) {
      let u = null;
      let best = Infinity;
      for (const id of ids) {
        if (!done.has(id) && dist.get(id) < best) {
          best = dist.get(id);
          u = id;
        }
      }
      if (u === null) break;
      done.add(u);
      for (const e of adj.get(u)) {
        if (!edgeOk(e.req, ctx)) continue;
        const nd = best + e.w;
        if (nd < dist.get(e.to)) {
          dist.set(e.to, nd);
          prev.set(e.to, u);
        }
      }
    }
    return { dist, prev };
  }

  function reconstruct(prev, id) {
    const out = [];
    let cur = id;
    let guard = 0;
    while (cur != null && guard++ < 64) {
      const n = nodes.get(cur);
      out.unshift({ id: cur, x: n.x, z: n.z });
      cur = prev.get(cur);
    }
    return out;
  }

  /** O nó de chegada mais barato entre os que enxergam o alvo. → { id, cost } | null */
  function bestGoal(goals, dist) {
    let best = null;
    for (const g of goals) {
      const dd = dist.get(g.id);
      if (dd < Infinity && (!best || dd + g.d < best.cost)) best = { id: g.id, cost: dd + g.d };
    }
    return best;
  }

  /** O nó alcançável mais perto de (to). → { near, nd } */
  function nearestReached(dist, to) {
    let near = null;
    let nd = Infinity;
    for (const n of nodes.values()) {
      if (dist.get(n.id) === Infinity) continue;
      const d = Math.hypot(n.x - to.x, n.z - to.z);
      if (d < nd) {
        nd = d;
        near = n.id;
      }
    }
    return { near, nd };
  }

  /**
   * Onde o círculo da dog fica no alvo: encostada numa parede, a líder menor fica a poucos centímetros do lugar em
   * que a companheira maior cabe. → { x, z, ok } (ok=false: no alvo ela não cabe — em cima de um caixote, num vão
   * estreito, do outro lado de uma cerca baixa —, então ninguém chega até ali andando).
   */
  function settleGoal(to, ctx) {
    if (!world.overlaps(to.x, to.z, ctx.r, ctx.size)) return { x: to.x, z: to.z, ok: true };
    const res = world.resolve(to.x, to.z, ctx.r, ctx.size);
    const ok = Math.hypot(res.x - to.x, res.z - to.z) <= GOAL_SETTLE && !world.overlaps(res.x, res.z, ctx.r, ctx.size);
    return { x: res.x, z: res.z, ok };
  }

  /** Assinatura do que muda a navegação: restrições do puzzle e colisores dinâmicos (dos NPCs, só ligado/desligado). */
  function worldKey(flags) {
    let s = world.companionMode ? 'c' : '';
    if (flags) for (const k of Object.keys(flags)) if (flags[k]) s += `${k},`;
    let h = 7;
    for (const d of world.dynamics || []) {
      const on = d.enabled !== false;
      h = (h * 31 + (on ? 1 : 2)) | 0;
      if (!on || d.kind === 'npc') continue;
      h = (h * 31 + Math.round((d.x ?? d.ax ?? 0) * 20)) | 0;
      h = (h * 31 + Math.round((d.z ?? d.az ?? 0) * 20)) | 0;
      if (d.bx != null) h = (h * 31 + Math.round(d.bx * 20) * 7 + Math.round(d.bz * 20)) | 0;
    }
    return `${s}|${h}`;
  }

  // ---------- busca local em grade ----------
  let gridKey = '';
  const freeMemo = new Map(); // célula livre? (por tamanho; vale enquanto o mundo não muda)
  const searchMemo = new Map(); // buscas já feitas (de onde, para onde)
  let nodeNear = null; // célula → nós perto dela

  function cellFree(ix, iz, ctx) {
    const k = cellKey(ix, iz) * 2 + (ctx.size === 'small' ? 0 : 1);
    let f = freeMemo.get(k);
    if (f === undefined) {
      f = !world.overlaps(ix * CELL, iz * CELL, ctx.r + 0.01, ctx.size);
      freeMemo.set(k, f);
    }
    return f;
  }

  function nodesNearCells() {
    if (nodeNear) return nodeNear;
    nodeNear = new Map();
    for (const n of nodes.values()) {
      const ix = Math.round(n.x / CELL);
      const iz = Math.round(n.z / CELL);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const k = cellKey(ix + dx, iz + dz);
          if (!nodeNear.has(k)) nodeNear.set(k, []);
          nodeNear.get(k).push(n.id);
        }
      }
    }
    return nodeNear;
  }

  /** Reta livre o mais longe possível ao longo dos pontos: o caminho da grade vira poucos waypoints. */
  function simplify(from, pts, ctx, id) {
    const out = [];
    let cur = from;
    let i = 0;
    const clear = (j) => world.segmentClear(cur.x, cur.z, pts[j].x, pts[j].z, losR(ctx), ctx.size);
    while (i < pts.length) {
      // passos dobrando até falhar, depois busca binária entre o último que deu e o que falhou
      let ok = i;
      let step = 1;
      while (ok + step < pts.length && clear(ok + step)) {
        ok += step;
        step *= 2;
      }
      let bad = Math.min(ok + step, pts.length);
      while (bad - ok > 1) {
        const mid = (ok + bad) >> 1;
        if (clear(mid)) ok = mid;
        else bad = mid;
      }
      out.push({ id, x: pts[ok].x, z: pts[ok].z });
      cur = pts[ok];
      i = ok + 1;
    }
    return out;
  }

  /**
   * Busca em largura numa grade em volta da companheira. → null (nenhuma célula livre perto dela) ou
   * { reached, wait, waitD, exits, route(from, k) }: reached = célula de onde ela enxerga o alvo `goal` (−1: não
   * chega); wait = a célula alcançada mais perto da irmã `to` (a WAIT_MIN dela ou mais), a waitD dela; exits = nós que
   * ela alcança pela grade ({ id, k, cost }); route = waypoints até a célula k.
   */
  function gridSearch(from, goal, to, ctx) {
    const wk = worldKey(ctx.flags);
    if (wk !== gridKey || freeMemo.size > 300000) {
      gridKey = wk;
      freeMemo.clear();
      searchMemo.clear();
    }
    let sx = Math.round(from.x / CELL);
    let sz = Math.round(from.z / CELL);
    if (!cellFree(sx, sz, ctx)) {
      // encostada num móvel, o centro da célula pode não caber: a vizinha livre mais perto
      let best = null;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (!cellFree(sx + dx, sz + dz, ctx)) continue;
          const d = Math.hypot((sx + dx) * CELL - from.x, (sz + dz) * CELL - from.z);
          if (!best || d < best.d) best = { dx, dz, d };
        }
      }
      if (!best) return null;
      sx += best.dx;
      sz += best.dz;
    }
    const q = (v) => Math.round(v / CELL);
    const mk = `${ctx.size}|${sx},${sz}|${goal.ok ? `${q(goal.x)},${q(goal.z)}` : '-'}|${q(to.x)},${q(to.z)}`;
    const hit = searchMemo.get(mk);
    if (hit) return hit;
    const span = Math.round(GRID_SPAN / CELL);
    const lr = losR(ctx);
    const near = nodesNearCells();
    const start = cellKey(sx, sz);
    const parent = new Map([[start, -1]]);
    const queue = [start];
    let reached = -1;
    let wait = -1;
    let waitD = Infinity;
    const exits = [];
    const seenExit = new Set();
    for (let qi = 0; qi < queue.length && qi < GRID_MAX; qi++) {
      const k = queue[qi];
      const ix = cellIx(k);
      const iz = cellIz(k);
      const x = ix * CELL;
      const z = iz * CELL;
      const dTo = Math.hypot(x - to.x, z - to.z);
      if (dTo >= WAIT_MIN && dTo < waitD) {
        waitD = dTo;
        wait = k;
      }
      for (const id of near.get(k) || []) {
        if (seenExit.has(id)) continue;
        const n = nodes.get(id);
        if (Math.hypot(n.x - x, n.z - z) <= 0.3 && world.segmentClear(x, z, n.x, n.z, lr, ctx.size)) {
          seenExit.add(id);
          exits.push({ id, k, cost: 0 });
        }
      }
      if (goal.ok && Math.hypot(goal.x - x, goal.z - z) <= 0.3 && world.segmentClear(x, z, goal.x, goal.z, lr, ctx.size)) {
        reached = k;
        break;
      }
      for (const [dx, dz] of DIRS8) {
        const nx = ix + dx;
        const nz = iz + dz;
        if (Math.abs(nx - sx) > span || Math.abs(nz - sz) > span) continue;
        const nk = cellKey(nx, nz);
        if (parent.has(nk) || !cellFree(nx, nz, ctx)) continue;
        // na diagonal, sem cortar a quina
        if (dx && dz && (!cellFree(ix + dx, iz, ctx) || !cellFree(ix, iz + dz, ctx))) continue;
        parent.set(nk, k);
        queue.push(nk);
      }
    }
    const cells = (k) => {
      const out = [];
      for (let c = k; c !== -1; c = parent.get(c)) out.push({ x: cellIx(c) * CELL, z: cellIz(c) * CELL });
      return out.reverse();
    };
    for (const e of exits) {
      const pts = cells(e.k);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const n = nodes.get(e.id);
      e.cost = len + Math.hypot(n.x - pts[pts.length - 1].x, n.z - pts[pts.length - 1].z);
    }
    const routes = new Map();
    const res = {
      reached, wait, waitD, exits,
      /** Waypoints de `fromPt` até a célula k (id 'grade'). */
      route(fromPt, k) {
        if (!routes.has(k)) routes.set(k, simplify(fromPt, cells(k), ctx, 'grade'));
        return routes.get(k).map((w) => ({ ...w }));
      },
    };
    if (searchMemo.size > 16) searchMemo.delete(searchMemo.keys().next().value);
    searchMemo.set(mk, res);
    return res;
  }

  /**
   * Caminho de `from` até `to` para uma dog (ctx: { r, size, flags, allowDirect, approach }).
   * → { direct, reachable, waypoints: [{id,x,z}], waitNode, waitPoint }
   *   direct: linha reta livre até o alvo; reachable=false: alvo inalcançável (waypoints levam ao
   *   nó alcançável mais próximo do alvo, onde a companheira espera).
   *   approach (a companheira seguindo a irmã): só conta como alcançável o que ela enxerga de verdade. Onde o grafo não
   *   resolve, procura pela grade em volta dela; sem caminho, os waypoints levam ao lugar alcançável mais perto da irmã
   *   (waitPoint: o nó do grafo ou a célula da grade, o que ficar mais perto), e ela espera ali.
   */
  function findPath(from, to, ctx) {
    const strict = !!ctx.approach;
    const goal = strict ? settleGoal(to, ctx) : { x: to.x, z: to.z, ok: true };
    if (goal.ok && ctx.allowDirect !== false && world.segmentClear(from.x, from.z, goal.x, goal.z, losR(ctx), ctx.size)) {
      return { direct: true, reachable: true, waypoints: [], waitNode: null, waitPoint: null };
    }
    let srcs = visibleNodes(from.x, from.z, ctx);
    const isolated = !srcs.length;
    if (isolated) srcs = nearestNodes(from.x, from.z, 2);
    let graph = dijkstra(srcs, ctx);
    const goals = goal.ok ? visibleNodes(goal.x, goal.z, ctx) : [];
    // Sem nenhum nó à vista do alvo, o modo antigo tenta pelos mais próximos (e a última reta pode nem existir).
    if (!goals.length && !strict) goals.push(...nearestNodes(to.x, to.z, 2));
    // Isolada num cantinho, os nós "mais próximos" podem estar atrás do caixote: no modo da companheira, não valem.
    if (!strict || !isolated) {
      const g = bestGoal(goals, graph.dist);
      if (g) return { direct: false, reachable: true, waypoints: reconstruct(graph.prev, g.id), waitNode: null, waitPoint: null, cost: g.cost };
    }
    let G = null;
    let lead = null; // isolada: pela grade até o nó onde a cadeia do grafo começa
    if (strict) {
      G = gridSearch(from, goal, to, ctx);
      if (G && G.reached >= 0) {
        return { direct: false, reachable: true, waypoints: G.route(from, G.reached), waitNode: null, waitPoint: null };
      }
      if (G && isolated) {
        const exitOf = new Map(G.exits.map((e) => [e.id, e]));
        graph = dijkstra(G.exits.map((e) => ({ id: e.id, d: e.cost })), ctx);
        lead = (chain) => (chain.length ? [...G.route(from, exitOf.get(chain[0].id).k), ...chain] : chain);
        const g = bestGoal(goals, graph.dist);
        if (g) return { direct: false, reachable: true, waypoints: lead(reconstruct(graph.prev, g.id)), waitNode: null, waitPoint: null, cost: g.cost };
      }
    }
    // Inalcançável: vai até o lugar alcançável mais próximo do alvo e espera.
    const { near, nd } = nearestReached(graph.dist, to);
    let wps = near ? reconstruct(graph.prev, near) : [];
    if (lead) wps = lead(wps);
    if (G && G.wait >= 0 && (G.waitD < nd || !wps.length)) wps = G.route(from, G.wait);
    const last = wps[wps.length - 1];
    return { direct: false, reachable: false, waypoints: wps, waitNode: near, waitPoint: last ? { x: last.x, z: last.z } : null };
  }

  /** Nó alcançável (a partir de `from`) mais próximo de `to` — usado para reposicionar uma dog presa. */
  function nearestReachableNode(from, to, ctx) {
    let srcs = visibleNodes(from.x, from.z, ctx);
    if (!srcs.length) srcs = nearestNodes(from.x, from.z, 2);
    const { dist } = dijkstra(srcs, ctx);
    let near = null;
    let nd = Infinity;
    for (const n of nodes.values()) {
      if (dist.get(n.id) === Infinity) continue;
      const d = Math.hypot(n.x - to.x, n.z - to.z);
      if (d < nd && !world.overlaps(n.x, n.z, ctx.r, ctx.size)) {
        nd = d;
        near = n;
      }
    }
    return near;
  }

  return { nodes, adj, edgeOk, visibleNodes, findPath, nearestReachableNode, dijkstra, worldKey };
}
