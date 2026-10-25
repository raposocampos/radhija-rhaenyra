// Mapa das fases (Pandorópolis, src/levels/mapa/): o layout (uma bandeirinha por fase, lugares livres, caminhos da
// companheira, áreas nas nuvens), a colisão em grade (mesmo resultado que a lista inteira), a lógica (estados das
// bandeirinhas pelo progresso, atalho, entrar e voltar, nuvens e ponte) e a pré-carga da fase por baixo.
// Sem navegador: o jogo headless com o mapa (createHeadlessGame level 0). O cenário de verdade é conferido no E2E
// (suíte mapa) e nas capturas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import L, { FLAGS, ZONES, flagSpot, BENCHES, HOUSE } from '../src/levels/mapa/layout.js';
import { LEVELS } from '../src/levels/index.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createLevelPreload } from '../src/game/levelPreload.js';
import { forgetLastVisit } from '../src/levels/mapa/puzzle.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const R = 0.26; // um pouco mais que o raio da Rhaenyra (0,22)
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { done: true, best: 80, treats: 1, total: 3, clears: 1 }]));
const ids = (n) => LEVELS.slice(0, n).map((d) => d.id);
const zoneOf = (x, z) => Object.entries(ZONES).find(([, zz]) => x > zz.box.minX && x < zz.box.maxX && z > zz.box.minZ && z < zz.box.maxZ)?.[0] ?? null;
async function untilLoaded(h, timeout = 5000) {
  const t0 = Date.now();
  while (h.game.state === 'loading' && Date.now() - t0 < timeout) await new Promise((r) => setTimeout(r, 10));
  assert.notEqual(h.game.state, 'loading', 'a fase não terminou de carregar');
}

// ---------------------------------------------------------------------------------------------- layout
test('layout: uma bandeirinha por fase, na ordem do catálogo, e cada uma numa área já aberta na vez dela', () => {
  assert.deepEqual(FLAGS.map((f) => f.level), LEVELS.map((d) => d.id));
  assert.deepEqual(FLAGS.map((f) => f.n), LEVELS.map((_, i) => i + 1));
  for (const f of FLAGS) {
    const z = zoneOf(f.x, f.z);
    if (z) assert.ok(ZONES[z].unlock <= f.n, `a bandeirinha ${f.n} fica na área "${z}", que só abre na fase ${ZONES[z].unlock}`);
    const s = flagSpot(f, 'lead');
    const zs = zoneOf(s.x, s.z);
    if (zs) assert.ok(ZONES[zs].unlock <= f.n, `a frente da bandeirinha ${f.n} cai na área "${zs}"`);
  }
});

test('layout: a frente de cada bandeirinha, os nós e os caminhos da companheira ficam livres (nada atravessa nada)', () => {
  const w = createCollisionWorld(L);
  for (const f of FLAGS) {
    for (const who of ['lead', 'comp']) {
      const s = flagSpot(f, who);
      assert.deepEqual(w.contacts(s.x, s.z, R, 'large').map((c) => c.id), [], `F${f.n} ${who}`);
    }
  }
  for (const [id, n] of Object.entries(L.NAV_NODES)) assert.deepEqual(w.contacts(n.x, n.z, R, 'large').map((c) => c.id), [], `nó ${id}`);
  for (const [a, b] of L.NAV_EDGES) {
    const A = L.NAV_NODES[a], B = L.NAV_NODES[b];
    assert.ok(w.segmentClear(A.x, A.z, B.x, B.z, R, 'large'), `aresta ${a}–${b}`);
  }
});

test('layout: com tudo aberto, toda bandeirinha é alcançável a partir da primeira; fechado, só o oeste', () => {
  const reach = (flags) => {
    const adj = new Map();
    for (const [a, b, opt] of L.NAV_EDGES) {
      if (opt?.requires && !flags[opt.requires]) continue;
      for (const [p, q] of [[a, b], [b, a]]) { if (!adj.has(p)) adj.set(p, []); adj.get(p).push(q); }
    }
    const seen = new Set(['F1']);
    const queue = ['F1'];
    while (queue.length) for (const n of adj.get(queue.shift()) || []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    return seen;
  };
  const all = reach({ leste: true, chacara: true });
  for (const f of FLAGS) assert.ok(all.has(`F${f.n}`), `F${f.n}`);
  const west = reach({ leste: false, chacara: false });
  for (const f of FLAGS) assert.equal(west.has(`F${f.n}`), f.n < 6 || f.n === 8, `F${f.n} com o leste fechado`);
});

test('layout: os enfeites colidem (bancos, canteiros, cerca dos fundos da casa) e o jardim só se entra pelo portãozinho', () => {
  const w = createCollisionWorld(L);
  for (const b of BENCHES) assert.ok(w.overlaps(b.x, b.z, 0.1, 'small'), `banco em ${b.x}, ${b.z}`);
  for (const [x, z] of HOUSE.flowers) assert.ok(w.overlaps(x, z, 0.1, 'small'), `canteiro em ${x}, ${z}`);
  // dos fundos da casa (norte) para dentro do jardim, pelos lados: bloqueado
  const g = HOUSE.garden;
  assert.ok(!w.segmentClear(g.minX + 0.6, HOUSE.fence.back - 1, g.minX + 0.6, HOUSE.fence.back + 1.5, 0.17, 'small'), 'lado oeste, pelos fundos');
  assert.ok(!w.segmentClear(g.maxX - 0.3, HOUSE.fence.back - 1, g.maxX - 0.3, HOUSE.fence.back + 1.5, 0.17, 'small'), 'lado leste, pelos fundos');
  // pelo portãozinho, sim
  const gx = (HOUSE.fence.gate.x0 + HOUSE.fence.gate.x1) / 2;
  assert.ok(w.segmentClear(gx - 0.3, HOUSE.fence.z + 1.2, gx - 0.3, HOUSE.fence.z - 1.2, 0.22, 'large'), 'portãozinho');
});

test('colisão em grade: o mesmo resultado que olhar a lista inteira', () => {
  const grid = createCollisionWorld(L);
  const flat = createCollisionWorld({ ...L, COLLISION_GRID: 0 });
  assert.ok(L.COLLISION_GRID > 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const B = L.WORLD.bounds;
  let hits = 0;
  for (let i = 0; i < 3000; i++) {
    const x = B.minX + rnd() * (B.maxX - B.minX), z = B.minZ + rnd() * (B.maxZ - B.minZ), r = 0.15 + rnd() * 0.3;
    const a = grid.contacts(x, z, r, 'large').map((c) => c.id).sort();
    const b = flat.contacts(x, z, r, 'large').map((c) => c.id).sort();
    assert.deepEqual(a, b, `contatos em ${x.toFixed(2)}, ${z.toFixed(2)}`);
    const ra = grid.resolve(x, z, r, 'large'), rb = flat.resolve(x, z, r, 'large');
    assert.ok(Math.hypot(ra.x - rb.x, ra.z - rb.z) < 1e-6 || a.length > 1, `resolve em ${x.toFixed(2)}, ${z.toFixed(2)}`);
    if (a.length) hits++;
  }
  assert.ok(hits > 100, 'a amostra passa por bastante coisa');
});

// ---------------------------------------------------------------------------------------------- lógica
test('mapa: save novo — só a fase 1 liberada, leste e chácara nas nuvens, ponte levantada', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0 });
  const i = h.info();
  assert.equal(i.state, 'playing');
  assert.equal(i.hub, true);
  assert.equal(i.next, 1);
  assert.deepEqual(h.puzzle.flagStates().map((f) => f.state), ['next', ...Array(9).fill('locked')]);
  assert.equal(h.props.flags.stateOf(1).state, 'next');
  assert.equal(h.props.clouds.isOpen('leste'), false);
  assert.equal(h.props.bridge.down, false);
  // as dogs começam na frente da bandeirinha 1
  const s = flagSpot(FLAGS[0], 'lead');
  const c = h.ctrls[h.game.activeDog];
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 0.05);
  // nuvens: não dá para entrar no leste
  h.teleport(h.game.activeDog, ZONES.leste.box.minX + 2, 0);
  const p = h.ctrls[h.game.activeDog];
  assert.ok(p.x < ZONES.leste.box.minX, `fora das nuvens (x ${p.x.toFixed(2)})`);
});

test('mapa: fases 1 a 5 concluídas — a 6 é a próxima, o leste abre; a chácara continua fechada', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0, progress: { levels: done(...ids(5)) } });
  const st = h.puzzle.flagStates();
  assert.deepEqual(st.map((f) => f.state), ['done', 'done', 'done', 'done', 'done', 'next', 'locked', 'locked', 'locked', 'locked']);
  assert.equal(h.info().zones.leste, true);
  assert.equal(h.info().zones.chacara, false);
  assert.equal(h.props.clouds.isOpen('leste'), true);
  assert.equal(h.props.bridge.down, false);
  assert.equal(h.world.getDynamic('nuvens-leste').enabled, false);
  assert.equal(h.world.getDynamic('ponte-levantada').enabled, true);
  // abrindo pelo menu, elas aparecem na frente da próxima (a 6)
  const s = flagSpot(FLAGS[5], 'lead');
  const c = h.ctrls[h.game.activeDog];
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 0.05);
});

test('mapa: tudo concluído (três biscoitos na fase 2) — ponte abaixada, bandeirinhas com os biscoitos', async () => {
  forgetLastVisit();
  const levels = done(...ids(10));
  levels.fase2 = { ...levels.fase2, treats: 3 };
  const h = await createHeadlessGame({ level: 0, progress: { levels } });
  assert.ok(h.puzzle.flagStates().every((f) => f.state === 'done'));
  assert.equal(h.props.flags.stateOf(2).treats, 3);
  assert.equal(h.props.bridge.down, true);
  assert.equal(h.world.getDynamic('ponte-levantada').enabled, false);
  assert.equal(h.info().next, null);
  assert.match(h.puzzle.objective().text, /Todas as fases/);
});

test('mapa: atalho — só para bandeirinhas liberadas (número, ±1 e R/L)', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0, progress: { levels: done(...ids(3)) } });
  h.run(0.1);
  h.clearLog();
  assert.equal(h.game.debug.travel({ n: 7 }), false, 'a 7 está trancada');
  assert.match(h.log('hint').at(-1)?.text ?? '', /trancada/);
  assert.equal(h.game.debug.travel({ n: 2 }), true);
  let c = h.ctrls[h.game.activeDog];
  let s = flagSpot(FLAGS[1], 'lead');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 0.05, 'na frente da 2');
  assert.equal(h.log('map:travel').at(-1)?.to, 2);
  // R (próxima liberada) e o número 4 no teclado; um R tocado e solto entre dois quadros também vale
  h.keyDown('KeyR');
  h.keyUp('KeyR');
  h.step();
  assert.equal(h.log('map:travel').at(-1)?.to, 3);
  h.tap('Digit4');
  c = h.ctrls[h.game.activeDog];
  s = flagSpot(FLAGS[3], 'lead');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 0.05, 'na frente da 4');
  // L volta uma (a 3)
  h.tap('KeyL');
  assert.equal(h.log('map:travel').at(-1)?.to, 3);
  // no mapa, R e L não sopram nem lambem
  assert.equal(h.log('bafo:aim').length, 0);
});

test('mapa: E na frente da bandeirinha entra na fase (cartão de abertura); o mapa volta na frente dela', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0, progress: { levels: done(...ids(2)) } });
  h.game.debug.travel({ n: 3 });
  h.run(0.2);
  assert.equal(h.info().near, 3);
  assert.equal(h.info().prompt, 'Entrar');
  assert.equal(h.log('map:sign').at(-1)?.n, 3);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(h.log('map:enter').at(-1)?.id, 'fase3');
  await untilLoaded(h);
  assert.equal(h.game.state, 'intro');
  assert.equal(h.game.levelDef.id, 'fase3');
  // da fase, de volta ao mapa: na frente da bandeirinha 3
  h.events.emit('ui:openMap', {});
  await untilLoaded(h);
  assert.equal(h.game.isHub, true);
  assert.equal(h.game.state, 'playing');
  const c = h.ctrls[h.game.activeDog];
  const s = flagSpot(FLAGS[2], 'lead');
  assert.ok(Math.hypot(c.x - s.x, c.z - s.z) < 0.05);
  // bandeirinha trancada: dica e nada de carregar
  forgetLastVisit();
  h.teleport(h.game.activeDog, FLAGS[4].x, FLAGS[4].z + 2);
  h.run(0.2);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(h.game.state, 'playing');
  assert.equal(h.log('map:denied').at(-1)?.n, 5);
});

test('mapa: a área aberta desde a última visita abre animada (map:unlock) e mostra a novidade', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0, progress: { levels: done(...ids(4)) } });
  assert.equal(h.info().zones.leste, false);
  // concluiu a 5 (a UI grava): ao voltar ao mapa, o leste abre
  Object.assign(h.save.levels, done('fase5'));
  h.clearLog();
  h.events.emit('ui:menu', {});
  h.events.emit('ui:selectLevel', { index: 4 });
  await untilLoaded(h);
  h.events.emit('ui:openMap', {});
  await untilLoaded(h);
  assert.equal(h.log('map:unlock').at(-1)?.zone, 'leste');
  assert.equal(h.log('map:newFlag').at(-1)?.n, 6);
  assert.equal(h.props.clouds.isOpen('leste'), true);
});

// ---------------------------------------------------------------------------------------------- pré-carga
test('pré-carga: importa perto, monta parada na frente, prepara a GPU e entrega a montagem ao entrar', async () => {
  const events = [];
  let builds = 0;
  let precompiled = 0;
  let disposed = 0;
  const def = {
    id: 'teste', layout: { WORLD: { bounds: {} } },
    load: async () => ({
      build: ({ root }) => {
        builds++;
        return { props: {}, dispose() { disposed++; }, marker: root };
      },
    }),
  };
  const engine = { precompile: async () => { precompiled++; } };
  const pre = createLevelPreload({ engine, params: new URLSearchParams(), emit: (name, p) => events.push([name, p]) });
  pre.want(3, def, { build: false });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(pre.info().status, 'imported');
  pre.update(1, { moving: false });
  assert.equal(builds, 0, 'sem estar na frente, não monta');
  pre.want(3, def, { build: true });
  pre.update(0.2, { moving: true });
  pre.update(0.2, { moving: false });
  assert.equal(builds, 0, 'ainda andando há pouco');
  pre.update(0.4, { moving: false });
  assert.equal(builds, 1, 'parada na frente: monta');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(precompiled, 1);
  assert.equal(pre.info().status, 'ready');
  assert.ok(events.some(([n, p]) => n === 'map:preload' && p.status === 'ready' && p.progress === 1));
  const got = pre.take(3);
  assert.ok(got.root && got.built, 'entrega o cenário montado');
  assert.equal(pre.info(), null);
  // outra fase, e depois nenhuma: a montagem adiantada é descartada
  pre.want(4, def, { build: true });
  await new Promise((r) => setTimeout(r, 0));
  pre.update(1, { moving: false });
  assert.equal(builds, 2);
  pre.want(null, null);
  assert.equal(disposed, 1, 'afastou: descarta');
  assert.equal(pre.take(4), null);
});

test('pré-carga no jogo: perto da bandeirinha o mapa pede a fase; parada na frente, a montagem', async () => {
  forgetLastVisit();
  const h = await createHeadlessGame({ level: 0 });
  h.run(0.1);
  await new Promise((r) => setTimeout(r, 0));
  h.run(0.6);
  const p = h.info().preload;
  assert.equal(p?.index, 0, 'a fase 1');
  assert.ok(['build', 'gpu', 'ready'].includes(p.status), `montada parada na frente (${p.status})`);
  // entra: usa a montagem adiantada
  const staged = h.game.debug.preload.info();
  assert.ok(staged);
  h.tap('KeyE');
  await untilLoaded(h);
  assert.equal(h.game.levelDef.id, 'fase1');
  assert.equal(h.info().preload, null);
});
