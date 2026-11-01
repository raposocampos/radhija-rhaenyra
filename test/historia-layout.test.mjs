// Modo História: o mapa do Recanto das Patinhas (src/story/areas/recanto/layout.js) sem cenário.
//  - o grafo da companheira: nós fora dos colisores e arestas livres (as que dependem de porta, ponte ou tamanho
//    abrem com a etapa);
//  - as dogs começam em lugar livre; petiscos e meias ficam onde a dog certa alcança, por um caminho do grafo;
//  - as portas de dobradiça (cozinha, área de serviço, torre, depósito e o portãozinho) não varrem móvel nenhum;
//  - a câmera e as pistas ficam dentro do condomínio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import L from '../src/story/areas/recanto/layout.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createNavigator } from '../src/game/navigation.js';

const world = createCollisionWorld(L);
const nav = createNavigator(L, world);
const R = { radhija: L.DOGS.radhija.radius, rhaenyra: L.DOGS.rhaenyra.radius };
const SIZE = { radhija: L.DOGS.radhija.size, rhaenyra: L.DOGS.rhaenyra.size };
/** Todas as etapas feitas: portas abertas, barquinho encaixado. */
const ALL_OPEN = { kitchenOpen: true, serviceOpen: true, towerOpen: true, storageOpen: true, boatDocked: true };

test('recanto: os nós do grafo ficam fora dos colisores e as arestas sem restrição estão livres', () => {
  const bad = [];
  for (const [id, p] of Object.entries(L.NAV_NODES)) {
    // a ilha só a Radhija alcança (pelo barquinho): o nó dela é para a pequena
    const who = id === 'I_mid' ? 'radhija' : 'rhaenyra';
    if (world.overlaps(p.x, p.z, R[who], SIZE[who])) bad.push(`nó ${id} dentro de colisor`);
  }
  for (const [a, b, o] of L.NAV_EDGES) {
    assert.ok(L.NAV_NODES[a] && L.NAV_NODES[b], `aresta ${a}-${b}: nós existem`);
    if (o?.requires) continue;
    const A = L.NAV_NODES[a], B = L.NAV_NODES[b];
    if (!world.segmentClear(A.x, A.z, B.x, B.z, R.rhaenyra, SIZE.rhaenyra)) bad.push(`aresta ${a}-${b} bloqueada`);
  }
  assert.deepEqual(bad, []);
});

test('recanto: as dogs começam em lugar livre, no quarto, perto da caminha', () => {
  for (const n of ['radhija', 'rhaenyra']) {
    const s = L.DOGS[n].start;
    assert.equal(world.overlaps(s.x, s.z, R[n], SIZE[n]), false, `${n} começa livre`);
    const Q = L.ROOMS.quarto;
    assert.ok(s.x > Q.x0 && s.x < Q.x1 && s.z > Q.z0 && s.z < Q.z1, `${n} começa no quarto`);
  }
  const a = L.DOGS.radhija.start, b = L.DOGS.rhaenyra.start;
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > R.radhija + R.rhaenyra, 'uma não começa dentro da outra');
});

test('recanto: petiscos e meias ficam onde a dog certa alcança, por um caminho do grafo', () => {
  const from = L.DOGS.radhija.start;
  const ctx = { r: R.radhija, size: SIZE.radhija, flags: { ...ALL_OPEN, small: true } };
  for (const c of L.COLLECTIBLES) {
    assert.equal(world.overlaps(c.x, c.z, R.radhija * 0.6, 'small'), false, `petisco ${c.id} fora de colisor`);
    const p = nav.findPath(from, c, ctx);
    assert.ok(p.reachable, `petisco ${c.id}: a Radhija chega lá`);
  }
  for (const s of L.SOCKS.filter((x) => x.id !== 'antena')) {
    assert.equal(world.overlaps(s.x, s.z, R.radhija * 0.6, 'small'), false, `meia ${s.id} fora de colisor`);
    assert.ok(nav.findPath(from, s, ctx).reachable, `meia ${s.id}: a Radhija chega lá`);
  }
  // a meia da antena fica no alto da guarita (a subida é pela lixeira, com a irmã segurando)
  const ant = L.SOCKS.find((x) => x.id === 'antena');
  assert.ok(ant.y > L.BOOTH.roof, 'meia da antena acima do telhado da guarita');
  // a da casinha: só a Radhija entra (a porta da casinha é estreita para a Rhaenyra)
  const dh = L.DOGHOUSE;
  assert.ok(dh.door > 2 * R.radhija && dh.door < 2 * R.rhaenyra, `porta da casinha (${dh.door} m) só para a pequena`);
});

test('recanto: o grafo liga o quarto a cada etapa da missão quando as portas abrem (e não antes)', () => {
  const from = L.DOGS.rhaenyra.start;
  const big = (flags) => ({ r: R.rhaenyra, size: SIZE.rhaenyra, flags });
  const yard = L.NAV_NODES.Y_mid;
  assert.equal(nav.findPath(from, yard, big({})).reachable, false, 'com a cozinha fechada, o quintal não');
  assert.ok(nav.findPath(from, yard, big({ kitchenOpen: true })).reachable, 'aberta a cozinha, o quintal sim');
  const pool = L.NAV_NODES.P_west;
  assert.equal(nav.findPath(from, pool, big({ kitchenOpen: true })).reachable, false, 'com a área de serviço fechada, a piscina não');
  for (const id of ['P_north', 'V_mid', 'T_door', 'E_booth', 'E_gate', 'L_pier', 'L_south', 'G_door']) {
    assert.ok(nav.findPath(from, L.NAV_NODES[id], big(ALL_OPEN)).reachable, `com tudo aberto, a Rhaenyra chega a ${id}`);
  }
});

test('recanto: a ilha só com o barquinho encaixado, e só para a Radhija', () => {
  // como no puzzle: a boca do canal fechada até o barquinho encaixar; depois, a ponte que só a pequena atravessa
  const CH = L.CHANNEL;
  const make = (docked) => {
    const w = createCollisionWorld(L);
    w.addDynamic({ id: 'canal-boca', kind: 'water', shape: 'segment', ax: CH.x0 - 0.05, az: CH.z1, bx: CH.x1 + 0.05, bz: CH.z1, t: 0.1, enabled: !docked });
    w.addDynamic({ id: 'barquinho-ponte', kind: 'static', shape: 'box', x: (CH.x0 + CH.x1) / 2, z: (CH.z0 + CH.z1) / 2, hx: (CH.x1 - CH.x0) / 2, hz: (CH.z1 - CH.z0) / 2, blocks: 'large', enabled: docked });
    return { w, n: createNavigator(L, w) };
  };
  const island = L.NAV_NODES.I_mid;
  const from = L.NAV_NODES.L_slot;
  const small = (flags) => ({ r: R.radhija, size: SIZE.radhija, flags: { ...flags, small: true } });
  const big = (flags) => ({ r: R.rhaenyra, size: SIZE.rhaenyra, flags });
  const shut = make(false);
  assert.equal(shut.n.findPath(from, island, small({ ...ALL_OPEN, boatDocked: false })).reachable, false, 'sem o barquinho, a ilha não');
  const open = make(true);
  assert.ok(open.n.findPath(from, island, small(ALL_OPEN)).reachable, 'com o barquinho, a Radhija chega à ilha');
  assert.equal(open.n.findPath(from, island, big(ALL_OPEN)).reachable, false, 'a Rhaenyra não cabe no barquinho');
  assert.equal(open.w.segmentClear(from.x, from.z, island.x, island.z, R.rhaenyra, SIZE.rhaenyra), false, 'nem em linha reta');
});

/** A ponta da folha de uma dobradiça no ângulo yaw (createHingedGate: ponta = dobradiça + (−sen, −cos) · comprimento). */
const tipAt = (D, yaw, f = 1) => ({ x: D.hinge.x - Math.sin(yaw) * D.length * f, z: D.hinge.z - Math.cos(yaw) * D.length * f });

test('recanto: as portas de dobradiça abrem sem varrer móvel nenhum', () => {
  const DOORS = { cozinha: L.KITCHEN_DOOR, servico: L.SERVICE_DOOR, torre: L.TOWER_DOOR, deposito: L.STORAGE_DOOR, portaozinho: L.GATE_LEAF };
  const bad = [];
  for (const [id, D] of Object.entries(DOORS)) {
    // fechada, a ponta da folha está no batente
    const shut = tipAt(D, D.closedYaw);
    assert.ok(Math.hypot(shut.x - D.latchPost.x, shut.z - D.latchPost.z) < 0.02, `${id}: fechada, encosta no batente`);
    for (let k = 0.5; k <= 1.0001; k += 0.1) {
      const yaw = D.closedYaw + (D.openYaw - D.closedYaw) * k;
      for (let f = 0.35; f <= 1.0001; f += 0.13) {
        const p = tipAt(D, yaw, f);
        if (world.overlaps(p.x, p.z, 0.04, 'large')) bad.push(`${id} aberta ${Math.round(k * 100)}%: a folha (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) entra num colisor`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('recanto: as portas abrem para dentro do lugar onde as dogs chegam depois', () => {
  const open = (D) => tipAt(D, D.openYaw);
  // a da cozinha abre para o quintal (leste), a da área de serviço para o quintal (sul)
  assert.ok(open(L.KITCHEN_DOOR).x > L.KITCHEN_DOOR.hinge.x + 0.5, 'cozinha: para o leste');
  assert.ok(open(L.SERVICE_DOOR).z > L.SERVICE_DOOR.hinge.z + 0.5, 'área de serviço: para o sul');
  // a de mola da torre e a do depósito: para dentro (leste); o portãozinho: para dentro do condomínio (sul)
  assert.ok(open(L.TOWER_DOOR).x > L.TOWER_DOOR.hinge.x + 0.5, 'torre: para dentro');
  assert.ok(open(L.STORAGE_DOOR).x > L.STORAGE_DOOR.hinge.x + 0.5, 'depósito: para dentro');
  assert.ok(open(L.GATE_LEAF).z > L.GATE_LEAF.hinge.z + 0.5, 'portãozinho: para o sul');
  // a bola entalada fica dentro do arco da folha do depósito; o balde caído, fora dele
  const S = L.STORAGE_DOOR;
  const inArc = (p) => Math.hypot(p.x - S.hinge.x, p.z - S.hinge.z) < S.length && p.x > S.hinge.x;
  assert.ok(inArc(L.BALL), 'a bola segura a porta');
  assert.ok(!inArc(L.BALL.rollTo), 'rolada, a bola sai do caminho');
});

test('recanto: câmera, pistas e meias dentro do condomínio', () => {
  const B = L.WORLD.bounds;
  const inside = (p) => p.x >= B.minX && p.x <= B.maxX && p.z >= B.minZ && p.z <= B.maxZ;
  const C = L.CAMERA.limits;
  assert.ok(C.minX >= B.minX && C.maxX <= B.maxX && C.minZ >= B.minZ && C.maxZ <= B.maxZ, 'limites da câmera');
  for (const [id, p] of Object.entries(L.CLUE_SPOTS)) assert.ok(inside(p), `pista ${id}`);
  for (const s of L.SOCKS) assert.ok(inside(s), `meia ${s.id}`);
  for (const c of L.COLLECTIBLES) assert.ok(inside(c), `petisco ${c.id}`);
  assert.deepEqual(L.CAMERA.zones.map((z) => z.id).sort(), ['casa', 'telhado', 'varal']);
  assert.equal(L.COLLECTIBLES.length, 4, 'quatro petiscos');
  assert.equal(L.SOCKS.length, 3, 'três meias');
});
