// Grafo de navegação da companheira (NAV_NODES/NAV_EDGES) de todas as fases, contra o mundo de colisão.
// Vale para fases novas automaticamente: as fases vêm de src/levels/index.js e src/levels/dev.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollisionWorld } from '../src/game/collision.js';
import { createNavigator } from '../src/game/navigation.js';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const LAYOUTS = Object.fromEntries([...LEVELS, ...DEV_LEVELS].map((d) => [d.id, d.layout]));

// Arestas que cortam a quina de um obstáculo em linha reta (a companheira contorna sozinha).
// Fica documentado aqui para não crescer sem querer; uma aresta nova bloqueada falha o teste.
const KNOWN_TIGHT_EDGES = new Set([
  'fase1:E_mid-E_alcove:large', // bebedouro dos passarinhos
  'fase2:C_north-C_mid:small', // pilha de tijolos
  'fase2:C_north-C_mid:large',
  'fase3:A_door-A_nookOut:large', // quina sul do cantinho
]);

/** Restrições de uma aresta como lista (`requires` pode ser uma só ou várias). */
const reqs = (opt) => [].concat(opt?.requires ?? []);
const sizesFor = (opt) => (reqs(opt).includes('small') ? ['small'] : reqs(opt).includes('large') ? ['large'] : ['small', 'large']);
const radius = (L, size) => (size === 'small' ? L.DOGS.radhija.radius : L.DOGS.rhaenyra.radius);
const allFlags = (L) => Object.fromEntries(L.NAV_EDGES.flatMap((e) => reqs(e[2])).filter((r) => r !== 'small' && r !== 'large').map((f) => [f, true]));

for (const [id, L] of Object.entries(LAYOUTS)) {
  test(`${id}: nós de navegação dentro dos limites e livres de colisores`, () => {
    const world = createCollisionWorld(L);
    for (const [name, p] of Object.entries(L.NAV_NODES)) {
      for (const size of ['small', 'large']) {
        assert.ok(!world.overlaps(p.x, p.z, radius(L, size), size), `${name} encosta em algo para ${size}`);
      }
    }
  });

  test(`${id}: arestas citam nós que existem e estão livres em linha reta`, () => {
    const world = createCollisionWorld(L);
    for (const [a, b, opt] of L.NAV_EDGES) {
      assert.ok(L.NAV_NODES[a] && L.NAV_NODES[b], `aresta ${a}-${b} cita nó inexistente`);
      for (const size of sizesFor(opt)) {
        const key = `${id}:${a}-${b}:${size}`;
        const A = L.NAV_NODES[a];
        const B = L.NAV_NODES[b];
        // arestas de pulo cruzam obstáculos puláveis de propósito: confere como quem está no ar
        const clear = world.segmentClear(A.x, A.z, B.x, B.z, radius(L, size) * 0.9, size, { airborne: reqs(opt).includes('jump') });
        if (KNOWN_TIGHT_EDGES.has(key)) continue;
        assert.ok(clear, `aresta ${key} atravessa um colisor`);
      }
    }
  });

  test(`${id}: com todas as flags do puzzle ligadas, o grafo é conexo`, () => {
    const world = createCollisionWorld(L);
    const nav = createNavigator(L, world);
    const flags = allFlags(L);
    for (const size of ['small', 'large']) {
      const ctx = { size, r: radius(L, size), flags };
      const start = L.DOGS[size === 'small' ? 'radhija' : 'rhaenyra'].start;
      const near = nav.visibleNodes(start.x, start.z, ctx);
      assert.ok(near.length > 0, `nenhum nó visível do início (${size})`);
      const { dist } = nav.dijkstra([{ id: near[0].id, d: 0 }], ctx);
      // Nós que só se alcançam por arestas 'small' ficam fora para a Rhaenyra.
      const onlySmall = new Set(Object.keys(L.NAV_NODES).filter((n) => L.NAV_EDGES.filter((e) => e[0] === n || e[1] === n).every((e) => reqs(e[2]).includes('small'))));
      for (const n of Object.keys(L.NAV_NODES)) {
        if (size === 'large' && onlySmall.has(n)) continue;
        assert.ok(Number.isFinite(dist.get(n)), `${n} inalcançável para ${size} com todas as flags`);
      }
    }
  });

  test(`${id}: posições iniciais, objetivo e lugares da comemoração livres`, () => {
    const world = createCollisionWorld(L);
    for (const name of ['radhija', 'rhaenyra']) {
      const s = L.DOGS[name].start;
      const size = L.DOGS[name].size;
      assert.ok(!world.overlaps(s.x, s.z, L.DOGS[name].radius, size), `início da ${name}`);
      const c = L.GOAL.celebrate[name];
      assert.ok(!world.overlaps(c.x, c.z, L.DOGS[name].radius, size), `lugar da comemoração da ${name}`);
    }
  });
}

// Com o mundo do jogo de verdade (os colisores que cada puzzle registra: caixotes, portões, água, zonas da companheira),
// os nós e as arestas sem restrição do puzzle continuam livres. Uma aresta por dentro de um colisor deixa a companheira
// indo e voltando entre o nó e o obstáculo. Bichos (porcos, gansa, galinhas, gato) andam: não contam.
const ALL_DEFS = [...LEVELS, ...DEV_LEVELS];
for (const [idx, def] of ALL_DEFS.entries()) {
  test(`${def.id}: nós e arestas livres também com os colisores do puzzle (etapa inicial)`, async () => {
    const h = await createHeadlessGame({ level: idx + 1, levels: ALL_DEFS });
    const L = h.layout;
    const world = h.world;
    const ignore = new Set(world.dynamics.filter((d) => d.kind === 'npc').map((d) => d.id));
    const bad = [];
    world.setCompanionMode(true);
    try {
      for (const [name, p] of Object.entries(L.NAV_NODES)) {
        // nós que só servem a arestas com restrição do puzzle podem estar atrás do que a restrição libera
        const edges = L.NAV_EDGES.filter((e) => e[0] === name || e[1] === name);
        if (edges.length && edges.every((e) => reqs(e[2]).some((r) => r !== 'small' && r !== 'large'))) continue;
        for (const size of ['small', 'large']) {
          if (size === 'large' && edges.length && edges.every((e) => reqs(e[2]).includes('small'))) continue;
          if (world.overlaps(p.x, p.z, radius(L, size), size, { ignore })) bad.push(`nó ${name} (${size})`);
        }
      }
      for (const [a, b, opt] of L.NAV_EDGES) {
        if (reqs(opt).some((r) => r !== 'small' && r !== 'large')) continue; // portão, ponte, irrigador: o puzzle libera
        for (const size of sizesFor(opt)) {
          const key = `${def.id}:${a}-${b}:${size}`;
          if (KNOWN_TIGHT_EDGES.has(key)) continue;
          const A = L.NAV_NODES[a];
          const B = L.NAV_NODES[b];
          if (!world.segmentClear(A.x, A.z, B.x, B.z, radius(L, size) * 0.9, size, { ignore })) bad.push(`aresta ${key}`);
        }
      }
    } finally {
      world.setCompanionMode(false);
    }
    assert.deepEqual(bad, [], `atravessam colisores do puzzle: ${bad.join(', ')}`);
  });
}

// Os casos abaixo usam o mundo do jogo de verdade (headless): inclui os colisores dinâmicos que o puzzle
// registra (portão fechado, caixote, água, irrigador) e as flags reais de puzzle.navFlags() em cada etapa.
async function navAt(level, stage) {
  const h = await createHeadlessGame({ level, query: stage ? `stage=${stage}` : '' });
  const L = h.layout;
  const ctx = (size) => ({ size, r: radius(L, size), flags: h.puzzle.navFlags() });
  // Como no jogo: colisores companionOnly (ex.: o disco do irrigador ligado) valem para a companheira.
  const find = (a, b, size) => {
    h.world.setCompanionMode(true);
    try { return h.nav.findPath(a, b, ctx(size)); } finally { h.world.setCompanionMode(false); }
  };
  return { N: L.NAV_NODES, find };
}

test('fase 2: portão, irrigador e ponte controlam o caminho da Rhaenyra', async () => {
  let { N, find } = await navAt(2);
  let p = find(N.A_mid, N.B_gate, 'large');
  assert.ok(!p.reachable, 'portão fechado: lado B inalcançável');
  assert.equal(p.waitNode, 'A_gate', 'espera junto ao portão');
  ({ N, find } = await navAt(2, 'gateLocked'));
  assert.ok(find(N.A_mid, N.B_gate, 'large').reachable, 'portão travado aberto: passa');
  assert.ok(!find(N.B_gate, N.C_mid, 'large').reachable, 'irrigador ligado: a companheira não atravessa o gramado');
  ({ N, find } = await navAt(2, 'sprinklersOff'));
  assert.ok(find(N.B_gate, N.C_mid, 'large').reachable, 'irrigador desligado: atravessa');
  assert.ok(!find(N.C_slot, N.E_ball, 'large').reachable, 'sem ponte: o canal bloqueia');
  ({ N, find } = await navAt(2, 'bridge'));
  assert.ok(find(N.C_slot, N.E_ball, 'large').reachable, 'com ponte: atravessa');
});

test('fase 3: portão e cantinho controlam os caminhos', async () => {
  let { N, find } = await navAt(3);
  assert.ok(find(N.A_mid, N.A_nookIn, 'small').reachable, 'Radhija entra no cantinho');
  let p = find(N.A_mid, N.A_nookIn, 'large');
  assert.ok(!p.reachable, 'Rhaenyra não entra no cantinho');
  assert.equal(p.waitNode, 'A_nookOut');
  p = find(N.A_south, N.B_south, 'large');
  assert.ok(!p.reachable, 'portão fechado: lado B inalcançável');
  assert.equal(p.waitNode, 'A_gate');
  ({ N, find } = await navAt(3, 'gateOpen'));
  assert.ok(find(N.A_south, N.I_nest, 'large').reachable, 'portão aberto: chega à ilha pela ponte');
});
