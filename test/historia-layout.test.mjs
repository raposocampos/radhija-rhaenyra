// Modo História: o mapa do Recanto das Patinhas (src/story/areas/recanto/layout.js) sem cenário.
//  - o tamanho para a 3ª pessoa: cômodos da casa com ~6 m (na casa pequena a câmera era empurrada para cima);
//  - o grafo da companheira: nós fora dos colisores e arestas livres (as que dependem de porta, ponte ou tamanho
//    abrem com a etapa);
//  - as dogs começam em lugar livre; petiscos e meias ficam onde a dog certa alcança, por um caminho do grafo;
//  - as peças dos puzzles: a portinha de gato e a passagem do muro (só a Radhija), o pedal, o saco de ração, o cesto
//    de roupa, os botões do interfone e a grelha da guarita ficam onde a dog certa alcança;
//  - as portas de dobradiça (a grade, cozinha, área de serviço, torre, depósito e o portãozinho) não varrem móvel nenhum;
//  - a câmera e as pistas ficam dentro do condomínio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import L from '../src/story/areas/recanto/layout.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createNavigator } from '../src/game/navigation.js';
import { scentRoute } from '../src/story/faro/scentCloud.js';

const world = createCollisionWorld(L);
/** As portas de dobradiça fechadas (ou abertas, pelo nome) e o que mais o puzzle põe no mundo. */
const DOORS = { petGateOpen: L.PET_GATE, kitchenOpen: L.KITCHEN_DOOR, serviceOpen: L.SERVICE_DOOR, towerOpen: L.TOWER_DOOR, storageOpen: L.STORAGE_DOOR, gateOpen: L.GATE_LEAF };
function makeWorld(open = {}) {
  const w = createCollisionWorld(L);
  for (const [flag, D] of Object.entries(DOORS)) {
    if (open[flag]) continue;
    w.addDynamic({ id: `porta-${flag}`, kind: 'gate', shape: 'segment', ax: D.hinge.x, az: D.hinge.z, bx: D.latchPost.x, bz: D.latchPost.z, t: 0.05 });
  }
  const CH = L.CHANNEL;
  w.addDynamic({ id: 'canal-boca', kind: 'water', shape: 'segment', ax: CH.x0 - 0.05, az: CH.z1, bx: CH.x1 + 0.05, bz: CH.z1, t: 0.1, enabled: !open.boatDocked });
  w.addDynamic({ id: 'barquinho-ponte', kind: 'static', shape: 'box', x: (CH.x0 + CH.x1) / 2, z: (CH.z0 + CH.z1) / 2, hx: (CH.x1 - CH.x0) / 2, hz: (CH.z1 - CH.z0) / 2, blocks: 'large', enabled: !!open.boatDocked });
  // o galho fica na frente da passagem baixa do muro do quintal até ser empurrado
  const YG = L.YARD_GAP;
  w.addDynamic({ id: 'galho-copa', kind: 'static', shape: 'box', x: (YG.x0 + YG.x1) / 2, z: YG.z + 0.2, hx: (YG.x1 - YG.x0) / 2 + 0.1, hz: 0.3, blocks: 'small', enabled: !open.gapOpen });
  return { w, n: createNavigator(L, w) };
}
/** Um lugar livre para a dog a até `r` m do ponto (meia ou petisco em cima de um móvel), ou null. */
function freeNear(w, p, r, who) {
  if (!w.overlaps(p.x, p.z, R[who] * 0.6, SIZE[who])) return { x: p.x, z: p.z };
  for (let d = 0.05; d <= r; d += 0.05) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (!w.overlaps(x, z, R[who], SIZE[who])) return { x, z };
    }
  }
  return null;
}
const R = { radhija: L.DOGS.radhija.radius, rhaenyra: L.DOGS.rhaenyra.radius };
const SIZE = { radhija: L.DOGS.radhija.size, rhaenyra: L.DOGS.rhaenyra.size };
/** Todas as etapas feitas: portas abertas, o galho fora da passagem, barquinho encaixado. */
const ALL_OPEN = { petGateOpen: true, kitchenOpen: true, gapOpen: true, serviceOpen: true, towerOpen: true, storageOpen: true, boatDocked: true };
const small = (flags) => ({ r: R.radhija, size: SIZE.radhija, flags: { ...flags, small: true } });
const big = (flags) => ({ r: R.rhaenyra, size: SIZE.rhaenyra, flags });

test('recanto: o terreno tem tamanho de 3ª pessoa (cômodos de ~6 m, condomínio de ~48 × 30 m)', () => {
  for (const [id, Q] of Object.entries(L.ROOMS)) {
    assert.ok(Q.x1 - Q.x0 >= 5.8 && Q.z1 - Q.z0 >= 5.8, `${id}: ${(Q.x1 - Q.x0).toFixed(1)} × ${(Q.z1 - Q.z0).toFixed(1)} m`);
  }
  assert.ok(L.WALL.maxX - L.WALL.minX >= 46 && L.WALL.maxZ - L.WALL.minZ >= 29, 'o condomínio');
  // os objetos continuam do tamanho real
  assert.ok(Math.abs(L.CAR.x1 - L.CAR.x0 - 2.0) < 0.05 && Math.abs(L.CAR.z1 - L.CAR.z0 - 4.1) < 0.05, 'a caminhonete');
  assert.ok(L.KITCHEN_DOOR.length <= 1.05 && L.BED.r <= 0.85, 'porta e caminha');
  // a câmera em 3ª pessoa cabe nos cômodos: dentro de casa o braço dela é menor que meio cômodo
  const T = L.CAMERA.third;
  assert.equal(L.CAMERA.rig, 'third');
  assert.ok(T.indoor.distance < T.distance && T.indoor.distance <= 2.4, 'dentro de casa, mais perto');
  assert.ok(T.indoor.distance < (L.ROOMS.quarto.x1 - L.ROOMS.quarto.x0) / 2, 'o braço cabe no quarto');
  const H = L.HOUSE;
  assert.ok(T.ceilings.some((c) => c.minX === H.x0 && c.maxX === H.x1 && c.minZ === H.z0 && c.maxZ === H.z1 && c.y === L.WALLS.h), 'o teto da casa');
});

test('recanto: os nós do grafo ficam fora dos colisores e as arestas sem restrição estão livres', () => {
  const bad = [];
  for (const [id, p] of Object.entries(L.NAV_NODES)) {
    // a ilha só a Radhija alcança (pelo barquinho): o nó dela é para a pequena
    const who = id === 'I_mid' ? 'radhija' : 'rhaenyra';
    if (world.overlaps(p.x, p.z, R[who], SIZE[who])) bad.push(`nó ${id} dentro de colisor`);
  }
  for (const [a, b, o] of L.NAV_EDGES) {
    assert.ok(L.NAV_NODES[a] && L.NAV_NODES[b], `aresta ${a}-${b}: nós existem`);
    const A = L.NAV_NODES[a], B = L.NAV_NODES[b];
    const req = [].concat(o?.requires || []);
    // as que dependem de uma porta ou do barquinho abrem com a etapa; as só da pequena são conferidas com ela
    if (req.some((r) => r !== 'small')) continue;
    const who = req.includes('small') ? 'radhija' : 'rhaenyra';
    if (!world.segmentClear(A.x, A.z, B.x, B.z, R[who], SIZE[who])) bad.push(`aresta ${a}-${b} bloqueada`);
  }
  assert.deepEqual(bad, []);
});

test('recanto: as dogs começam em lugar livre, no quarto, perto da caminha', () => {
  for (const n of ['radhija', 'rhaenyra']) {
    const s = L.DOGS[n].start;
    assert.equal(world.overlaps(s.x, s.z, R[n], SIZE[n]), false, `${n} começa livre`);
    const Q = L.ROOMS.quarto;
    assert.ok(s.x > Q.x0 && s.x < Q.x1 && s.z > Q.z0 && s.z < Q.z1, `${n} começa no quarto`);
    assert.ok(Math.hypot(s.x - L.BED.x, s.z - L.BED.z) < 3.2, `${n} começa perto da caminha`);
  }
  const a = L.DOGS.radhija.start, b = L.DOGS.rhaenyra.start;
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > R.radhija + R.rhaenyra, 'uma não começa dentro da outra');
});

test('recanto: petiscos e meias ficam onde a dog certa alcança, por um caminho do grafo', () => {
  const from = L.DOGS.radhija.start;
  const ctx = small(ALL_OPEN);
  const { w, n } = makeWorld({ ...ALL_OPEN, gateOpen: true });
  for (const c of L.COLLECTIBLES) {
    assert.equal(w.overlaps(c.x, c.z, R.radhija * 0.6, 'small'), false, `petisco ${c.id} fora de colisor`);
    const p = n.findPath(from, c, ctx);
    assert.ok(p.reachable, `petisco ${c.id}: a Radhija chega lá`);
  }
  // a do depósito fica em cima da caixa de brinquedos: um lugar livre ao alcance da pegada basta
  for (const s of L.SOCKS.filter((x) => x.id !== 'antena')) {
    const spot = freeNear(w, s, L.SOCK_PICKUP_R - 0.05, 'radhija');
    assert.ok(spot, `meia ${s.id}: um lugar livre a menos de ${L.SOCK_PICKUP_R} m`);
    assert.ok(n.findPath(from, spot, ctx).reachable, `meia ${s.id}: a Radhija chega lá`);
  }
  // a meia da antena fica no alto da guarita (a subida é pela lixeira, com a irmã segurando)
  const ant = L.SOCKS.find((x) => x.id === 'antena');
  assert.ok(ant.y > L.BOOTH.roof, 'meia da antena acima do telhado da guarita');
  // a da casinha: só a Radhija entra (a porta da casinha é estreita para a Rhaenyra)
  const dh = L.DOGHOUSE;
  const vao = dh.door - 2 * 0.05;
  assert.ok(vao > 2 * R.radhija && vao < 2 * R.rhaenyra, `porta da casinha (vão útil ${vao.toFixed(2)} m) só para a pequena`);
});

test('recanto: o grafo liga o quarto a cada etapa da missão quando as portas abrem (e não antes)', () => {
  const from = L.DOGS.rhaenyra.start;
  const N = L.NAV_NODES;
  // a grade do quarto: fechada, a Rhaenyra não sai; a Radhija passa pela portinha de gato
  const shut = makeWorld({});
  assert.equal(shut.n.findPath(from, N.K_mid, big({})).reachable, false, 'com a grade fechada, a Rhaenyra fica no quarto');
  assert.ok(shut.n.findPath(from, N.K_pedal, small({})).reachable, 'a Radhija passa pela portinha de gato e chega ao pedal');
  const gate = makeWorld({ petGateOpen: true });
  assert.ok(gate.n.findPath(from, N.K_mid, big({ petGateOpen: true })).reachable, 'aberta a grade, a cozinha sim');
  assert.equal(gate.n.findPath(from, N.Y_mid, big({ petGateOpen: true })).reachable, false, 'com a porta da cozinha fechada, o quintal não');
  const yard = { petGateOpen: true, kitchenOpen: true };
  assert.ok(makeWorld(yard).n.findPath(from, N.Y_mid, big(yard)).reachable, 'aberta a cozinha, o quintal sim');
  assert.equal(makeWorld(yard).n.findPath(from, N.P_west, big(yard)).reachable, false, 'com a área de serviço fechada, a piscina não');
  // o ferrolho fica do outro lado: com o galho no lugar, nem a Radhija passa; tirado o galho, só ela, pela passagem
  assert.equal(makeWorld(yard).n.findPath(from, N.C_bolt, small(yard)).reachable, false, 'o galho tapa a passagem do muro');
  const gap = { ...yard, gapOpen: true };
  assert.ok(makeWorld(gap).n.findPath(from, N.C_bolt, small(gap)).reachable, 'tirado o galho, a Radhija chega à argola do ferrolho');
  assert.equal(makeWorld(gap).n.findPath(from, N.C_bolt, big(gap)).reachable, false, 'a Rhaenyra não cabe na passagem');
  const all = makeWorld({ ...ALL_OPEN, gateOpen: true }).n;
  for (const id of ['P_north', 'V_mid', 'T_door', 'T_pad', 'E_booth', 'E_vent', 'E_gate', 'L_pier', 'L_south', 'G_door']) {
    assert.ok(all.findPath(from, N[id], big(ALL_OPEN)).reachable, `com tudo aberto, a Rhaenyra chega a ${id}`);
  }
});

test('recanto: a portinha de gato e a passagem do muro são só da Radhija', () => {
  const F = L.PET_FLAP, YG = L.YARD_GAP;
  const { w } = makeWorld({ gapOpen: true });
  const midF = (F.z0 + F.z1) / 2;
  assert.ok(w.segmentClear(F.x - 0.7, midF, F.x + 0.7, midF, R.radhija, 'small'), 'a Radhija atravessa a portinha de gato');
  assert.equal(w.segmentClear(F.x - 0.7, midF, F.x + 0.7, midF, R.rhaenyra, 'large'), false, 'a Rhaenyra não');
  const midG = (YG.x0 + YG.x1) / 2;
  assert.ok(w.segmentClear(midG, YG.z + 0.8, midG, YG.z - 0.8, R.radhija, 'small'), 'a Radhija atravessa a passagem do muro');
  assert.equal(w.segmentClear(midG, YG.z + 0.8, midG, YG.z - 0.8, R.rhaenyra, 'large'), false, 'a Rhaenyra não');
  // com o galho no lugar, ele tapa a passagem (a caixa do galho cobre o vão inteiro)
  assert.equal(makeWorld({}).w.segmentClear(midG, YG.z + 0.8, midG, YG.z - 0.8, R.radhija, 'small'), false, 'tapada pelo galho');
  const B = L.BRANCH;
  assert.ok(B.start.x - B.half <= YG.x0 + 0.02 && B.start.x + B.half >= YG.x1 - 0.02, 'no começo, o galho cobre a passagem');
  // empurrado para o oeste até freeX, sobra passagem com folga para a Radhija; até o fim, a passagem inteira
  assert.ok(YG.x1 - (B.freeX + B.half) >= 2 * R.radhija + 0.3, `em freeX, a Radhija passa com folga (${(YG.x1 - (B.freeX + B.half)).toFixed(2)} m)`);
  assert.ok(B.minX + B.half <= YG.x0 + 0.02, 'no fim do curso, a passagem inteira fica livre');
  assert.ok(B.minX <= B.freeX - 0.1, 'o galho tem para onde ir');
  // o galho fica sempre fora do arco da porta do quintal (a folha abre para o sul), e a argola, fora do vão
  const SD = L.SERVICE_DOOR;
  assert.ok(B.maxX + B.half < SD.hinge.x - SD.length * 0.2 - 0.3, 'o galho não entra no arco da porta');
  assert.ok(L.SERVICE_BOLT.ring.x > SD.latchPost.x + 0.2, 'a argola do ferrolho pende fora do vão da porta');
});

test('recanto: as peças de empurrar têm o caminho livre e param onde o puzzle precisa', () => {
  const lane = (C, id) => {
    const bad = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = C.start.x + ((C.minX === C.maxX ? C.start.x : (C.start.x > (C.minX + C.maxX) / 2 ? C.minX : C.maxX)) - C.start.x) * (i / steps);
      const z = C.start.z + ((C.minZ === C.maxZ ? C.start.z : (C.start.z > (C.minZ + C.maxZ) / 2 ? C.minZ : C.maxZ)) - C.start.z) * (i / steps);
      for (const c of world.contacts(x, z, C.half * 0.98, 'large')) if (c.depth > 0.03) bad.push(`${id} em (${x.toFixed(2)}, ${z.toFixed(2)}) entra em ${c.id}`);
    }
    return bad;
  };
  // o saco de ração corre para o norte ao longo da parede; livre, não fica mais na frente da porta nem da maçaneta
  const S = L.FOOD_SACK, KD = L.KITCHEN_DOOR, KH = L.KITCHEN_HANDLE;
  assert.deepEqual(lane(S, 'saco de ração'), []);
  assert.ok(S.start.z + S.half > KH.z - 0.2 && S.start.z - S.half < KH.z + 0.2, 'no começo, o saco está na frente da maçaneta');
  assert.ok(S.freeZ + S.half < Math.min(KD.hinge.z, KD.latchPost.z), 'livre, o saco sai da frente da porta');
  assert.ok(S.minZ <= S.freeZ - 0.3, 'e tem para onde ir');
  assert.equal(world.overlaps(KH.x - 0.45, KH.z, R.rhaenyra, 'large'), false, 'a Rhaenyra tem onde apoiar para alcançar a maçaneta');
  // o cesto de roupa corre embaixo do varal e para embaixo da cenoura
  const C = L.LAUNDRY, P = L.CARROT_PIN;
  assert.deepEqual(lane(C, 'cesto de roupa'), []);
  assert.ok(Math.abs(C.start.x - P.x) > C.under + 1, 'o cesto começa longe da cenoura');
  assert.ok(Math.abs(C.maxX - P.x) <= C.under, 'empurrado até o fim, fica embaixo dela');
  assert.equal(world.overlaps(C.start.x - C.half - R.rhaenyra - 0.05, C.start.z, R.rhaenyra, 'large'), false, 'a Rhaenyra tem onde empurrar');
  assert.ok(L.LINE.h > C.height + 0.5, 'o cesto passa por baixo do varal');
  // o galho, a lixeira e o barquinho
  assert.deepEqual(lane(L.BRANCH, 'galho'), []);
  assert.equal(world.overlaps(L.BIN.start.x, L.BIN.start.z, L.BIN.half, 'large'), false, 'a lixeira começa livre');
  const BS = L.BIN_SPOT;
  assert.ok(BS.x0 >= L.BIN.minX && BS.x1 <= L.BIN.maxX && BS.z0 >= L.BIN.minZ - 0.05 && BS.z1 <= L.BIN.maxZ, 'o lugar da lixeira embaixo do toldo fica ao alcance');
  assert.ok(Math.abs(L.BOAT.maxX - L.BOAT.dock.x) < 0.01, 'o barquinho para na frente do canal');
});

test('recanto: o pedal, os botões do interfone, a argola e a grelha ficam ao alcance da dog certa', () => {
  const { w, n } = makeWorld({ gapOpen: true });
  // o pedal: fora do arco da grade, do lado da cozinha, livre
  const G = L.PET_GATE, Pd = L.PET_PEDAL;
  assert.ok(Pd.x > G.hinge.x + 0.2, 'o pedal fica do lado da cozinha');
  assert.ok(Math.hypot(Pd.x - G.hinge.x, Pd.z - G.hinge.z) > 0.5 && Pd.z > G.hinge.z + Pd.r, 'fora do arco da folha');
  assert.equal(w.overlaps(Pd.x, Pd.z, R.radhija, 'small'), false, 'livre para a Radhija pisar');
  // o interfone: quatro botões na parede oeste da torre, cada um com apoio livre para a Rhaenyra; a senha usa três
  const IC = L.INTERCOM;
  assert.equal(IC.buttons.length, 4, 'quatro botões: a senha usa três (o espirro esconde o terceiro na Reconstrução)');
  assert.equal(IC.code.length, 3, 'a senha tem três botões');
  assert.equal(new Set(IC.code).size, 3, 'sem botão repetido na senha');
  for (const id of IC.code) assert.ok(IC.buttons.some((b) => b.id === id), `${id}: botão da senha existe`);
  assert.notDeepEqual(IC.code, IC.buttons.map((b) => b.id), 'a ordem da senha não é a ordem dos botões na parede');
  for (const b of IC.buttons) {
    assert.ok(Math.abs(b.x - (L.TOWER.x0 - L.WALLS.t / 2)) < 0.01 && b.nx === -1, `${b.id}: na face oeste da torre`);
    assert.equal(w.overlaps(b.x - 0.45, b.z, R.rhaenyra, 'large'), false, `${b.id}: a Rhaenyra tem onde apoiar`);
    assert.ok(b.z > L.TOWER_DOOR.latchPost.z + 0.3 && b.z < L.TOWER.z1 - 0.15, `${b.id}: entre a porta e a quina da torre`);
  }
  const zs = IC.buttons.map((b) => b.z).sort((a, b) => a - b);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= 0.45, 'os botões ficam afastados (o impulso escolhe o da frente)');
  assert.ok(n.findPath(L.NAV_NODES.T_pad, { x: IC.recon.x, z: IC.recon.z }, big(ALL_OPEN)).reachable, 'o lugar da Reconstrução da senha');
  // a argola do ferrolho: do lado de fora do quintal, ao alcance da Radhija
  const SB = L.SERVICE_BOLT;
  assert.ok(SB.ring.z < L.YARD.z0 && SB.anchor.z < L.YARD.z0, 'a argola fica do lado de fora');
  assert.equal(w.overlaps(SB.ring.x, SB.ring.z - 0.3, R.radhija, 'small'), false, 'a Radhija tem onde ficar para puxar');
  assert.equal(w.overlaps(SB.ring.x, SB.ring.z - 0.3 - SB.pull, R.radhija, 'small'), false, 'e para onde ir de ré');
  // a grelha da guarita: na face oeste, com a Radhija na frente e a saída lá dentro
  const V = L.BOOTH_VENT;
  assert.ok(Math.abs(V.x - L.BOOTH.x0) < 0.01 && V.z > L.BOOTH.z0 && V.z < L.BOOTH.z1, 'a grelha na face oeste da guarita');
  assert.ok(V.inside.x > L.BOOTH.x0 && V.inside.x < L.BOOTH.x1, 'a saída fica dentro da guarita');
  assert.equal(w.overlaps(V.x - 0.6, V.z, R.radhija, 'small'), false, 'a Radhija tem onde ficar para soprar');
});

test('recanto: a nuvem de cheiro acha o caminho do quarto até a piscina por dentro da casa (sem olhar as portas)', () => {
  const { w } = makeWorld({});
  const from = L.DOGS.radhija.start;
  const route = scentRoute(L, w, from, { x: L.RECON.x, z: L.RECON.z });
  assert.ok(route.length >= 5, `o caminho passa por vários pontos (${route.length})`);
  assert.deepEqual(route[0], { x: from.x, z: from.z });
  assert.deepEqual(route[route.length - 1], { x: L.RECON.x, z: L.RECON.z });
  // passa pela porta da cozinha e pela da área de serviço (ou pela passagem do muro), nunca por cima de parede
  const H = L.HOUSE;
  let crossedEast = false;
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i], b = route[i + 1];
    if (a.x < H.x1 && b.x >= H.x1) {
      crossedEast = true;
      const z = a.z + ((H.x1 - a.x) / (b.x - a.x)) * (b.z - a.z);
      assert.ok(z > L.KITCHEN_DOOR.hinge.z - 0.1 && z < L.KITCHEN_DOOR.latchPost.z + 0.1, `sai da casa pela porta da cozinha (z ${z.toFixed(2)})`);
    }
  }
  assert.ok(crossedEast, 'o caminho sai da casa');
  let len = 0;
  for (let i = 0; i + 1 < route.length; i++) len += Math.hypot(route[i + 1].x - route[i].x, route[i + 1].z - route[i].z);
  assert.ok(len < 45, `sem voltas à toa (${len.toFixed(1)} m)`);
  // de perto e com caminho livre, vai direto
  assert.equal(scentRoute(L, w, from, { x: from.x + 0.8, z: from.z + 0.4 }).length, 2);
});

test('recanto: a ilha só com o barquinho encaixado, e só para a Radhija', () => {
  const island = L.NAV_NODES.I_mid;
  const from = L.NAV_NODES.L_slot;
  const shut = makeWorld({ ...ALL_OPEN, boatDocked: false });
  assert.equal(shut.n.findPath(from, island, small({ ...ALL_OPEN, boatDocked: false })).reachable, false, 'sem o barquinho, a ilha não');
  const open = makeWorld(ALL_OPEN);
  assert.ok(open.n.findPath(from, island, small(ALL_OPEN)).reachable, 'com o barquinho, a Radhija chega à ilha');
  assert.equal(open.n.findPath(from, island, big(ALL_OPEN)).reachable, false, 'a Rhaenyra não cabe no barquinho');
  assert.equal(open.w.segmentClear(from.x, from.z, island.x, island.z, R.rhaenyra, SIZE.rhaenyra), false, 'nem em linha reta');
  // o canal fica entre a margem e a ilha, e o barquinho cabe nele
  const CH = L.CHANNEL, I = L.LAKE.island;
  assert.ok(CH.x1 - CH.x0 > 2 * L.BOAT.half && Math.abs((CH.x0 + CH.x1) / 2 - I.x) < 0.01, 'o canal na frente da ilha');
  assert.ok(Math.abs(CH.z0 - (I.z + I.r)) < 0.2, 'o canal chega à ilha');
});

/** A ponta da folha de uma dobradiça no ângulo yaw (createHingedGate: ponta = dobradiça + (−sen, −cos) · comprimento). */
const tipAt = (D, yaw, f = 1) => ({ x: D.hinge.x - Math.sin(yaw) * D.length * f, z: D.hinge.z - Math.cos(yaw) * D.length * f });

test('recanto: as portas de dobradiça abrem sem varrer móvel nenhum', () => {
  const HINGED = { grade: L.PET_GATE, cozinha: L.KITCHEN_DOOR, servico: L.SERVICE_DOOR, torre: L.TOWER_DOOR, deposito: L.STORAGE_DOOR, portaozinho: L.GATE_LEAF };
  const bad = [];
  for (const [id, D] of Object.entries(HINGED)) {
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
  // a grade do quarto abre para a cozinha (leste); a da cozinha, para o quintal (leste); a da área de serviço, para o
  // quintal (sul)
  assert.ok(open(L.PET_GATE).x > L.PET_GATE.hinge.x + 0.5, 'grade: para a cozinha');
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
  for (const [id, p] of Object.entries(L.CLUE_SPOTS)) {
    assert.ok(inside(p), `pista ${id}`);
    // quem examina para num lugar livre
    const at = p.at ?? p;
    if (id !== 'boia' && id !== 'senha') assert.ok(freeNear(world, at, 0.5, 'rhaenyra'), `pista ${id}: lugar livre para examinar`);
  }
  for (const s of L.SOCKS) assert.ok(inside(s), `meia ${s.id}`);
  for (const c of L.COLLECTIBLES) assert.ok(inside(c), `petisco ${c.id}`);
  assert.equal(L.COLLECTIBLES.length, 5, 'cinco petiscos');
  assert.equal(L.SOCKS.length, 3, 'três meias');
});
