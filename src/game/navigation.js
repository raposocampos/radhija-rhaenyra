// Navegação da companheira sobre NAV_NODES/NAV_EDGES (Dijkstra multi-origem).
// Puro JS; usa o mundo de colisão para linha de visão. Testável em Node.

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

  /**
   * Caminho de `from` até `to` para uma dog (ctx: { r, size, flags, allowDirect }).
   * → { direct, reachable, waypoints: [{id,x,z}], waitNode }
   *   direct: linha reta livre até o alvo; reachable=false: alvo inalcançável (waypoints levam ao
   *   nó alcançável mais próximo do alvo, onde a companheira espera).
   */
  function findPath(from, to, ctx) {
    if (ctx.allowDirect !== false && world.segmentClear(from.x, from.z, to.x, to.z, losR(ctx), ctx.size)) {
      return { direct: true, reachable: true, waypoints: [], waitNode: null };
    }
    let srcs = visibleNodes(from.x, from.z, ctx);
    if (!srcs.length) srcs = nearestNodes(from.x, from.z, 2);
    const { dist, prev } = dijkstra(srcs, ctx);
    let goals = visibleNodes(to.x, to.z, ctx);
    if (!goals.length) goals = nearestNodes(to.x, to.z, 2);
    let best = null;
    let bestCost = Infinity;
    for (const g of goals) {
      const dd = dist.get(g.id);
      if (dd < Infinity && dd + g.d < bestCost) {
        best = g.id;
        bestCost = dd + g.d;
      }
    }
    if (best) return { direct: false, reachable: true, waypoints: reconstruct(prev, best), waitNode: null, cost: bestCost };
    // Inalcançável: vai até o nó alcançável mais próximo do alvo e espera.
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
    return { direct: false, reachable: false, waypoints: near ? reconstruct(prev, near) : [], waitNode: near };
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

  return { nodes, adj, edgeOk, visibleNodes, findPath, nearestReachableNode, dijkstra };
}
