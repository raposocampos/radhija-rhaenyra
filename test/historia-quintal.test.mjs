// Modo História: o QUINTAL MAIOR (4ª rodada) e os quatro puzzles dele (src/story/areas/recanto/quintalPuzzles.js, o
// cenário em world/quintal.js), no jogo de verdade (headless) e no layout puro:
//  - o contrato do terreno (LOT, HOUSE, YARD, HOUSE_EXIT) e o que fica de pé em cada lugar;
//  - o JABUTI na passagem da horta: só sai com a folha de alface, que as duas pegam juntas; anda devagar e para quando
//    alguém está na frente; se esconde com o latido; empurrar não adianta;
//  - a IRRIGAÇÃO: o programa (só tampando o aspersor do meio a Radhija atravessa), o banho, o tampão e o registro;
//  - a PIPA: o empurrão em pé na goiabeira de qualquer lado, a queda num lugar livre e a pista da rabiola;
//  - a MANGUEIRA e o BALDE: a torneira temporizada, o balde enchendo aos poucos e a bolinha de meia (a 4ª meia);
//  - o modelo do jabuti: cabe no colisor, sem NaN, nada atravessa o chão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import L from '../src/story/areas/recanto/layout.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createNavigator } from '../src/game/navigation.js';
import { createJabuti } from '../src/story/scene/jabuti.js';
import { CHAPTER1_BOARD } from '../src/story/deduction.js';
import { CLUES } from '../src/story/clues.js';
import { createStoryGame, storyInfo, skipScene, intrusions, become, holdWorld } from './helpers/historia.mjs';

const R = { radhija: L.DOGS.radhija.radius, rhaenyra: L.DOGS.rhaenyra.radius };
const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;
const SP = L.SPRINKLERS, JB = L.JABUTI, LT = L.LETTUCE;

/** O caminho do jabuti (a mesma curva do quintalPuzzles.js). */
function jabutiAt(t) {
  const a = { x: JB.x, z: JB.z }, b = { x: JB.path[0].x, z: JB.path[0].z + 0.14 }, c = JB.path[1];
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, z: u * u * a.z + 2 * u * t * b.z + t * t * c.z };
}

// ================================================================================================ o layout
test('quintal: o contrato do terreno não mudou (LOT, casa, quintal em L, porta dos fundos)', () => {
  assert.deepEqual({ ...L.LOT }, { x0: L.WALL.minX, x1: -4.93, z0: 2.04, z1: L.WALL.maxZ + 11 });
  assert.equal(L.HOUSE.z1, L.LOT.z1 - 5.5);
  assert.deepEqual({ x0: L.YARD.x0, x1: L.YARD.x1, z0: L.YARD.z0, z1: L.YARD.z1 }, { x0: L.HOUSE.x1, x1: L.LOT.x1, z0: L.HOUSE.z0, z1: L.LOT.z1 });
  assert.deepEqual({ ...L.HOUSE_EXIT }, { x: L.HOUSE.x1, z0: 18.3, z1: 19.3 });
  assert.equal(L.WORLD.bounds.maxZ, L.LOT.z1 - 0.2);
  const ids = new Set(L.STATIC_COLLIDERS.map((c) => c.id));
  for (const id of ['muro-sul', 'muro-oeste', 'muro-lote-sul', 'quintal-leste']) assert.ok(ids.has(id), `colisor ${id}`);
  const sul = L.STATIC_COLLIDERS.find((c) => c.id === 'muro-sul');
  assert.equal(sul.ax, L.LOT.x1, 'o muro sul do condomínio começa no canto do lote');
  // a saída dos fundos fica livre (a casa põe a porta e o puzzle dela ali)
  const w = createCollisionWorld(L);
  const ex = { x: L.HOUSE_EXIT.x + 0.8, z: (L.HOUSE_EXIT.z0 + L.HOUSE_EXIT.z1) / 2 };
  for (let dz = -1.2; dz <= 1.2; dz += 0.2) assert.equal(w.overlaps(ex.x, ex.z + dz, R.rhaenyra, 'large'), false, `a frente da porta dos fundos livre (z ${(ex.z + dz).toFixed(2)})`);
});

test('quintal: espaço para a câmera (o fundo aberto, o gramadinho dos aspersores e a passagem da horta)', () => {
  const w = createCollisionWorld(L);
  // o fundo do quintal: um bom pedaço livre (a mesa e a casinha ficam encostadas no muro leste)
  let free = 0, total = 0;
  for (let x = L.YARD.x0 + 0.4; x <= L.YARD.x1 - 0.4; x += 0.25) {
    for (let z = L.HORTA_ROW.z1 + 0.4; z <= L.LOT.z1 - 0.5; z += 0.25) { total++; if (!w.overlaps(x, z, R.rhaenyra, 'large')) free++; }
  }
  assert.ok(free / total > 0.7, `o fundo do quintal é aberto (${Math.round((free / total) * 100)}% livre)`);
  // o gramadinho entre os canteiros de flores tem largura para a Rhaenyra sentar e a Radhija passar do lado
  assert.ok(SP.lane.x1 - SP.lane.x0 >= 1.5, 'o gramadinho tem 1,5 m ou mais');
  assert.ok((SP.lane.x1 - SP.lane.x0) / 2 - R.rhaenyra * 2 - R.radhija * 2 > 0, 'com a Rhaenyra sentada no meio, a Radhija passa do lado');
  // a passagem da horta: larga o bastante para as duas, estreita o bastante para o jabuti tapar
  const P = L.HORTA_ROW.pass;
  assert.ok(P.x1 - P.x0 > R.rhaenyra * 2 + 0.2, 'a Rhaenyra passa pela passagem');
  assert.ok((P.x1 - P.x0 - JB.r * 2) / 2 < R.radhija * 2, 'o jabuti tapa a passagem (nem a Radhija passa do lado dele)');
});

test('quintal: os nós da companheira dependem do jabuti e da irrigação', () => {
  // o mundo com o que o puzzle põe: o jabuti na passagem e os três jatos ligados (só barram a pequena)
  const w = createCollisionWorld(L);
  const jab = w.addDynamic({ id: 'jabuti', kind: 'static', shape: 'circle', x: JB.x, z: JB.z, r: JB.r });
  const jets = SP.heads.map((hd) => w.addDynamic({ id: `aspersor-${hd.id}`, kind: 'static', shape: 'circle', x: hd.x, z: hd.z, r: SP.r, blocks: 'small' }));
  const n = createNavigator(L, w);
  const N = L.NAV_NODES;
  const ctx = (size, flags) => ({ r: R[size === 'small' ? 'radhija' : 'rhaenyra'], size, flags: { ...flags, small: size === 'small' } });
  // da porta dos fundos, a horta do fundo e a torneira sempre
  for (const id of ['Y_alface', 'Y_horta_o', 'Y_horta_s', 'Y_torneira', 'Y_casinha']) assert.ok(n.findPath(N.Y_exit, N[id], ctx('large', {})).reachable, `a Rhaenyra chega a ${id}`);
  // a passagem só com o jabuti fora
  assert.equal(n.findPath(N.Y_exit, N.Y_south, ctx('large', {})).reachable, false, 'com o jabuti na passagem, não');
  jab.x = JB.eat.x;
  jab.z = JB.eat.z;
  assert.ok(n.findPath(N.Y_exit, N.Y_south, ctx('large', { jabutiMoved: true })).reachable, 'com ele fora, sim');
  // o jardim: a Rhaenyra passa molhada; a Radhija só com a irrigação desligada
  assert.ok(n.findPath(N.Y_exit, N.Y_irrN, ctx('large', { jabutiMoved: true })).reachable, 'a Rhaenyra atravessa o jardim ligado');
  assert.equal(n.findPath(N.Y_exit, N.Y_irrN, ctx('small', { jabutiMoved: true })).reachable, false, 'a Radhija não');
  for (const j of jets) j.enabled = false;
  assert.ok(n.findPath(N.Y_exit, N.Y_irrN, ctx('small', { jabutiMoved: true, irrigationOff: true })).reachable, 'desligada, a Radhija também');
  assert.ok(n.findPath(N.Y_exit, N.Y_gap, ctx('small', { jabutiMoved: true, irrigationOff: true })).reachable, 'e chega à passagem baixa do muro');
});

test('quintal: o caminho do jabuti, os lugares das peças e as pegadas ficam livres', () => {
  const w = createCollisionWorld(L);
  for (let i = 0; i <= 40; i++) {
    const p = jabutiAt(i / 40);
    assert.equal(w.overlaps(p.x, p.z, JB.r, 'large'), false, `o jabuti anda sem entrar em nada (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
  }
  // a folha fica no chão, ao alcance da cabeça dele no fim do caminho
  assert.ok(Math.hypot(JB.leaf.x - JB.eat.x, JB.leaf.z - JB.eat.z) < JB.r + 0.25, 'a folha na frente da boca dele');
  // a alface: a Radhija para na frente da folha de fora e puxa para trás (o norte) sem bater em nada
  assert.equal(w.overlaps(LT.bite.x, LT.bite.z - 0.38, R.radhija, 'small'), false, 'a Radhija tem onde morder a folha');
  assert.equal(w.overlaps(LT.bite.x, LT.bite.z - 0.38 - LT.pull - 0.1, R.radhija, 'small'), false, 'e para onde ir de ré');
  // a Rhaenyra tem onde ficar segurando o pé (no Fica, perto dele) sem encostar na irmã
  assert.equal(w.overlaps(LT.x + 0.62, 22.32, R.rhaenyra, 'large'), false, 'a Rhaenyra tem onde segurar o pé');
  assert.ok(Math.hypot(LT.x + 0.62 - LT.x, 22.32 - LT.z) <= LT.holdR, 'dali ela alcança');
  // a mangueira: o laço no chão, livre para morder e puxar
  const H = L.HOSE;
  assert.equal(w.overlaps(H.bite.x, H.bite.z, R.radhija * 0.5, 'small'), false, 'o laço da mangueira fica no chão livre');
  const ax = H.bite.x - L.TAP.x, az = H.bite.z - L.TAP.z, al = Math.hypot(ax, az);
  for (let s = 0.3; s <= 0.3 + H.pull + 0.2; s += 0.1) assert.equal(w.overlaps(H.bite.x + (ax / al) * s, H.bite.z + (az / al) * s, R.radhija, 'small'), false, 'a Radhija tem para onde puxar');
  // o registro e os lugares onde a pipa cai
  assert.equal(w.overlaps(L.VALVE.at.x, L.VALVE.at.z, R.radhija, 'small'), false, 'a Radhija alcança o registro');
  for (const p of L.KITE.land) assert.equal(w.overlaps(p.x, p.z, 0.3, 'small'), false, `a pipa cai num lugar livre (${p.x}, ${p.z})`);
  // a meia do baldão: a pegada de sempre (SOCK_PICKUP_R do centro) nunca alcança o meio do balde
  const sock = L.SOCKS.find((s) => s.id === 'balde');
  assert.ok(L.BUCKET.colR + R.radhija > L.SOCK_PICKUP_R, 'só a bolinha boiando na borda dá a meia (quintalPuzzles.js)');
  assert.ok(near(sock, L.BUCKET, 0.01));
  // os dois lados do tronco da goiabeira têm lugar para o empurrão em pé
  const G = L.GUAVA;
  const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([nx, nz]) => !w.overlaps(G.x + nx * (G.r + 0.45), G.z + nz * (G.r + 0.45), R.rhaenyra, 'large'));
  assert.ok(sides.length >= 3, `a Rhaenyra empurra a goiabeira de ${sides.length} lados`);
});

test('quintal: a irrigação cobre o gramadinho inteiro e o programa só deixa passar tampando o do meio', async () => {
  // a cobertura: andando pelo gramadinho, a Radhija sempre encosta em algum jato (sem fresta seca entre eles)
  const rr = R.radhija;
  const lim = (SP.lane.x1 - SP.lane.x0) / 2 - rr;
  const cx = (SP.lane.x0 + SP.lane.x1) / 2;
  const zA = SP.heads[SP.heads.length - 1].z, zC = SP.heads[0].z;
  for (let x = cx - lim; x <= cx + lim + 1e-6; x += 0.05) {
    for (let z = zC; z <= zA; z += 0.05) {
      assert.ok(SP.heads.some((hd) => Math.hypot(x - hd.x, z - hd.z) < SP.r + rr), `fresta seca em (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
  // os canteiros dos lados fecham o jardim: só pelo gramadinho
  const w = createCollisionWorld(L);
  for (const x of [L.YARD.x0 + 0.5, -10.2, -6.2, L.YARD.x1 - 0.5]) assert.equal(w.segmentClear(x, SP.lane.z1 + 0.5, x, SP.lane.z0 - 0.5, rr, 'small'), false, `pelos canteiros não (x ${x})`);
  // o programa: com cada tampão possível, existe um jeito de atravessar? (a onda vem do norte para o sul). A Radhija
  // anda pelo meio do gramadinho a 2,1 m/s ou para onde está; em nenhum instante pode estar num jato que jorra.
  const h = await createStoryGame({ query: 'stage=quintal' });
  const yard = h.puzzle.quintal;
  const P = SP.step * SP.heads.length;
  const dt = 0.02, dz = L.DOGS.radhija.walkSpeed * dt;
  const z0 = SP.lane.z1 + 0.35, z1 = SP.lane.z0 - 0.3;
  const nz = Math.ceil((z0 - z1) / dz);
  const canCross = (plug) => {
    const wet = (t, z) => SP.heads.some((hd, i) => hd.id !== plug && yard.headState(i, t).on && Math.abs(z - hd.z) < SP.r + rr);
    // quem já chegou a cada ponto do gramadinho em cada instante (começando do lado sul, seco, a qualquer hora)
    let reach = new Uint8Array(nz + 1);
    for (let k = 0; k < Math.round((3 * P) / dt); k++) {
      const t = k * dt;
      reach[0] = 1;
      const next = new Uint8Array(nz + 1);
      for (let j = 0; j <= nz; j++) {
        if (!reach[j]) continue;
        for (const jj of [j, j + 1]) if (jj <= nz && !wet(t + dt, z0 - jj * dz)) next[jj] = 1;
      }
      if (next[nz]) return true;
      reach = next;
    }
    return false;
  };
  assert.equal(canCross(null), false, 'sem tampão, não dá');
  assert.equal(canCross('sul'), false, 'tampando o do sul, não dá');
  assert.equal(canCross('norte'), false, 'tampando o do norte, não dá');
  assert.equal(canCross('meio'), true, 'tampando o do meio, dá (no tempo certo de cada um)');
  // as janelas secas do sul e do norte são folgadas para a Radhija andar 2,5 m (2,1 m/s)
  let win = 0, best = 0;
  for (let t = 0; t < P * 2; t += dt) { if (!yard.headState(2, t).on) { win += dt; best = Math.max(best, win); } else win = 0; }
  assert.ok(best > 2.5 / L.DOGS.radhija.walkSpeed + 1.5, `a janela do sul dá tempo (${best.toFixed(2)} s)`);
});

// ================================================================================================ o jabuti e a alface
test('jabuti: tapa a passagem, conversa, não sai com empurrão nem com latido; a alface só sai com as duas', async () => {
  const h = await createStoryGame({ query: 'stage=quintal' });
  const S = () => storyInfo(h).yard;
  skipScene(h, 'quintalChega');
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(m); };
  // a Rhaenyra empurra o Seu Bento com Shift: ele nem se mexe (e ela ganha a dica)
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', JB.x, JB.z + JB.r + R.rhaenyra + 0.3, Math.PI);
  h.run(0.2);
  h.clearLog();
  holdWorld(h, [0, -1], 1.5, () => false, ['ShiftLeft']);
  assert.ok(near(S().jabuti, JB, 0.01), 'o jabuti fica no lugar');
  assert.ok(h.ctrls.rhaenyra.z > JB.z + 0.3, 'e a Rhaenyra não passa');
  assert.ok(h.log('hint').some((p) => /pesado/.test(p.text)), 'a dica: empurrar não adianta');
  watch();
  // o latido grosso perto dele (um pouco mais longe que a conversa): ele se esconde no casco
  h.teleport('rhaenyra', JB.x, JB.z + 1.7, Math.PI);
  h.run(1.0);
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().jabuti.anim, 'esconde', 'o latido assusta o Seu Bento');
  h.run(5);
  // conversar (E) com a Radhija: o pedido da alface
  become(h, 'radhija');
  h.teleport('radhija', JB.x + 0.1, JB.z + 0.95, Math.PI);
  h.run(0.3);
  h.clearLog();
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().metJabuti, true);
  assert.ok(h.log('story:say').some((p) => p.who === 'bento' || p.who === 'radhija'), 'uma fala da conversa');
  // a Rhaenyra não morde a alface (só segura)
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', LT.bite.x, LT.bite.z - 0.5, 0);
  h.run(0.3);
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().leaf, 'pe');
  assert.equal(S().tugWhat, null, 'a Rhaenyra não morde');
  // a Radhija sozinha: a alface estica e escapa
  h.teleport('rhaenyra', -12.4, 21.4, 0);
  become(h, 'radhija');
  h.teleport('radhija', LT.bite.x, LT.bite.z - 0.42, 0);
  h.run(0.3);
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), 'a folha na boca');
  let lock = h.puzzle.lockFor('radhija');
  holdWorld(h, [lock.pull.ax, lock.pull.az], 4, () => !h.puzzle.lockFor('radhija')?.pull);
  h.run(0.8);
  assert.equal(S().leaf, 'pe', 'sozinha, não');
  watch();
  // com a irmã no Fica perto do pé: a folha solta e vai na boca
  h.teleport('rhaenyra', LT.x + 0.62, 22.32, Math.PI);
  h.game.setStay('rhaenyra', true);
  h.walkTo(LT.bite.x, LT.bite.z - 0.42, { timeout: 4, tol: 0.12 });
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), 'a folha na boca de novo');
  lock = h.puzzle.lockFor('radhija');
  holdWorld(h, [lock.pull.ax, lock.pull.az], 4, () => S().leaf === 'boca');
  assert.equal(S().leaf, 'boca');
  h.run(0.5);
  assert.equal(h.puzzle.lockFor('radhija'), null, 'sem trava depois de pegar a folha');
  assert.equal(h.dogs.radhija.carryKind ?? 'carrot', 'carrot', 'a pose de carregar da boca');
  watch();
  assert.deepEqual([...bad], []);
});

test('jabuti: com a folha, ele anda devagar até o cantinho, espera quem está na frente e come', async () => {
  const h = await createStoryGame({ query: 'stage=quintal' });
  const S = () => storyInfo(h).yard;
  skipScene(h, 'quintalChega');
  // a folha direto na boca (a alface já testada acima): o mesmo caminho do jogo
  h.teleport('rhaenyra', LT.x + 0.62, 22.32, Math.PI);
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', LT.bite.x, LT.bite.z - 0.42, 0);
  h.run(0.3);
  h.tap('KeyE');
  h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull });
  const lock = h.puzzle.lockFor('radhija');
  holdWorld(h, [lock.pull.ax, lock.pull.az], 4, () => S().leaf === 'boca');
  h.game.setStay('rhaenyra', false);
  h.teleport('rhaenyra', -10.1, 19.2, Math.PI);
  h.teleport('radhija', JB.x, 17.45, Math.PI);
  h.run(0.3);
  h.tap('KeyE');
  skipScene(h, 'quintalJabuti');
  assert.equal(S().jabuti.phase, 'anda');
  // a Radhija estava no caminho dele: o corte do fim da cena a tirou da frente
  assert.ok(!near(h.ctrls.radhija, jabutiAt(0.5), R.radhija + JB.r + 0.1), 'ninguém no caminho do jabuti depois da cena');
  // ele anda devagar (bem menos que uma dog)
  const t0 = S().jabuti.t;
  h.run(1.0);
  const z1 = S().jabuti;
  assert.ok(z1.t > t0, 'ele anda');
  assert.ok(Math.hypot(z1.x - JB.x, z1.z - JB.z) < JB.speed * 1.3 + 0.02, `devagar (${Math.hypot(z1.x - JB.x, z1.z - JB.z).toFixed(2)} m em 1 s)`);
  // uma dog na frente: ele para e espera; ela sai, ele continua
  const ahead = jabutiAt(Math.min(1, S().jabuti.t + 0.4));
  h.teleport('rhaenyra', ahead.x, ahead.z + 0.12, 0);
  h.game.setStay('rhaenyra', true); // (no Fica: a companheira não sai do lugar para seguir a irmã)
  h.run(2.5); // ele chega perto dela e para
  const tWait = S().jabuti.t;
  h.run(1.5);
  assert.ok(S().jabuti.t - tWait < 0.005, `com a Rhaenyra na frente, ele espera (${tWait.toFixed(3)} → ${S().jabuti.t.toFixed(3)})`);
  assert.ok(S().jabuti.t < 0.97, 'antes de chegar ao cantinho');
  h.game.setStay('rhaenyra', false);
  h.teleport('rhaenyra', -10.1, 19.2, Math.PI);
  const bad = new Set();
  for (let i = 0; i < 60 * 14 && S().jabuti.phase === 'anda'; i++) { h.step(); for (const m of intrusions(h)) bad.add(m); }
  assert.equal(S().jabuti.phase, 'come', 'chegou ao cantinho e come');
  assert.equal(S().jabuti.moved, true, 'a passagem ficou livre');
  assert.deepEqual([...bad], [], 'nada atravessa o jabuti, nem ele as dogs');
  // as duas passam pela passagem da horta
  for (const n of ['radhija', 'rhaenyra']) {
    become(h, n);
    h.teleport(n, JB.x, 17.55, Math.PI);
    h.run(0.2);
    h.walkTo(JB.x, 15.45, { timeout: 4, tol: 0.15 });
    assert.ok(h.ctrls[n].z < L.HORTA_ROW.z0, `${n} passa pela passagem da horta`);
    h.teleport(n, n === 'radhija' ? -9.5 : -10.2, n === 'radhija' ? 18.3 : 19.2, 0);
  }
  // ele come a folha toda e volta a cochilar
  assert.ok(h.run(16, { until: () => storyInfo(h).yard.jabuti.phase === 'fim' }), 'acabou a folha');
});

// ================================================================================================ a irrigação
test('irrigação: o banho, o tampão errado, o certo e o registro', async () => {
  const h = await createStoryGame({ query: 'stage=quintal' });
  const yard = h.puzzle.quintal;
  const S = () => storyInfo(h).yard;
  skipScene(h, 'quintalChega');
  // o jabuti fora da passagem (testado acima); a irrigação ligada
  yard.state.jabutiMoved = true;
  yard.state.jabuti = 'fim';
  h.run(0.1);
  assert.equal(S().irrigation.off, false);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(m); };
  // a Radhija entra no jato do sul logo antes de ele ligar: o banho a joga de volta para o lado seco
  h.teleport('rhaenyra', -10.1, 19.2, 0);
  become(h, 'radhija');
  assert.ok(h.run(8, { until: () => { const s = yard.headState(2); return !s.on && s.u > 6.3 - 1.0 && s.u < 6.3 - 0.8; } }), 'pouco antes do sul ligar');
  h.teleport('radhija', SP.heads[2].x, SP.heads[2].z + 0.6, Math.PI);
  h.clearLog();
  assert.ok(h.run(2.5, { until: () => storyInfo(h).yard.irrigation.wet >= 1 }), 'ligou com ela dentro: banho');
  h.run(1.6);
  const rad = h.ctrls.radhija;
  assert.ok(!SP.heads.some((hd, i) => yard.spraying(hd.id) && Math.hypot(rad.x - hd.x, rad.z - hd.z) < SP.r + rad.r - 0.02), 'ela pulou para fora do jato');
  assert.ok(rad.z > SP.heads[2].z, `para o lado de onde veio (z ${rad.z.toFixed(2)})`);
  assert.ok(h.log('story:sfx').some((p) => p.name === 'yuck'), 'o "eca" do banho');
  assert.ok(h.log('story:wet').length >= 1);
  watch();
  // a Rhaenyra passa molhada (sem ser empurrada) e senta no do SUL: não adianta
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', SP.heads[2].x, SP.heads[2].z + 0.25, Math.PI);
  h.run(0.2);
  h.walkTo(SP.heads[2].x, SP.heads[2].z, { timeout: 3, tol: 0.1 });
  become(h, 'radhija');
  assert.ok(h.run(1, { until: () => storyInfo(h).yard.irrigation.plugged === 'sul' }), 'tampou o do sul');
  assert.ok(h.dogs.rhaenyra.wet > 0, 'a Rhaenyra ficou molhada');
  h.teleport('radhija', SP.heads[2].x - 0.45, SP.heads[2].z + 0.3, Math.PI);
  h.run(0.2);
  holdWorld(h, [0, -1], 7, () => h.ctrls.radhija.z < SP.lane.z0);
  assert.ok(h.ctrls.radhija.z > SP.heads[0].z, `tampando o do sul, a Radhija não passa (z ${h.ctrls.radhija.z.toFixed(2)})`);
  watch();
  h.run(2);
  // trocando para o do meio
  become(h, 'rhaenyra');
  h.walkTo(SP.heads[1].x, SP.heads[1].z, { timeout: 4, tol: 0.1 });
  become(h, 'radhija');
  assert.ok(h.run(1, { until: () => storyInfo(h).yard.irrigation.plugged === 'meio' }), 'tampou o do meio');
  assert.equal(h.game.stay.rhaenyra, true, 'trocando com ela em cima do aspersor, ela fica (Fica)');
  // no tampado, o jato não sai (só o vazamento baixo em volta dela) e o colisor dele não barra
  assert.ok(!yard.spraying('meio'));
  const col = h.world.getDynamic('aspersor-meio');
  assert.equal(col.enabled, false, 'o tampado não barra a Radhija');
  // a Rhaenyra no registro não alcança (só o focinho da Radhija)
  // (a Radhija atravessa no teste da missão; aqui, o registro)
  h.teleport('radhija', L.VALVE.at.x, L.VALVE.at.z, -Math.PI / 2);
  // (seguindo a irmã, a Radhija pode ter levado um banho: espera ela se sacudir)
  h.run(3, { until: () => !h.puzzle.lockFor('radhija') });
  h.run(0.2);
  assert.equal(yard.prompt, 'Fechar o registro', 'o aviso do E no registro');
  h.tap('KeyE');
  h.run(1.2);
  assert.equal(S().irrigation.off, true, 'a Radhija fecha o registro');
  assert.equal(h.game.stay.rhaenyra, false, 'a irmã levanta');
  assert.ok(SP.heads.every((hd) => !h.world.getDynamic(`aspersor-${hd.id}`).enabled), 'nenhum jato barra mais');
  assert.ok(h.props.quintal.sprinklers.state.every((s) => s.spray === 0), 'as cabeças pararam');
  assert.deepEqual([...bad], []);
});

// ================================================================================================ a pipa
test('pipa: a Rhaenyra empurra a goiabeira (de outro lado), a pipa cai num lugar livre e a rabiola vira pista', async () => {
  const h = await createStoryGame({ query: 'stage=piscina' });
  const S = () => storyInfo(h).yard;
  const G = L.GUAVA;
  become(h, 'rhaenyra');
  // do sul do tronco, olhando para o norte
  h.teleport('rhaenyra', G.x, G.z + G.r + 0.5, Math.PI);
  h.run(0.3);
  holdWorld(h, [0, -1], 1.2, () => false, ['ShiftLeft']);
  assert.ok(S().kite.shoves >= 1, `o empurrão em pé balança a goiabeira (${S().kite.shoves})`);
  assert.equal(S().kite.phase, 'arvore', 'um empurrão só não derruba');
  holdWorld(h, [0, -1], 8, () => storyInfo(h).yard.kite.phase !== 'arvore', ['ShiftLeft']);
  h.hold(null);
  assert.equal(S().kite.shoves, G.pushes, `no ${G.pushes}º empurrão, a pipa solta`);
  assert.ok(h.run(4, { until: () => storyInfo(h).yard.kite.phase === 'chao' }), 'e cai bailando até o chão');
  const at = S().kite.at;
  assert.ok(L.KITE.land.some((p) => near(p, at, 0.01)), 'num dos lugares livres');
  // no chão, a pipa fica deitada (nada atravessa o chão)
  const kite = h.props.quintal.kite.object;
  const box = new THREE.Box3().setFromObject(kite);
  assert.ok(box.min.y > -0.005 && box.max.y < 0.12, `deitada na grama (${box.min.y.toFixed(3)}..${box.max.y.toFixed(3)})`);
  // examinar: a cena e a pista da rabiola (escondida, extra da pergunta da borracha)
  h.teleport('rhaenyra', at.x - 0.6, at.z + 0.3, Math.PI / 2);
  h.run(0.3);
  h.tap('KeyE');
  skipScene(h, 'quintalPipa');
  assert.ok(storyInfo(h).clues.includes('rabiola'), 'a pista da rabiola');
  assert.equal(CLUES.rabiola.type, 'escondida');
  assert.ok(CHAPTER1_BOARD.questions.find((q) => q.id === 'borracha').extra.includes('rabiola'), 'ela serve à pergunta da borracha');
  assert.deepEqual(intrusions(h), []);
});

// ================================================================================================ a mangueira e o balde
test('mangueira e balde: a torneira temporizada enche aos poucos; a bolinha de meia só sai com o balde cheio', async () => {
  const h = await createStoryGame({ query: 'stage=piscina' });
  const S = () => storyInfo(h).yard;
  const HS = L.HOSE, BK = L.BUCKET;
  // a Rhaenyra não morde a mangueira
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', HS.bite.x + 0.3, HS.bite.z - 0.3, -Math.PI * 0.75);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().tugWhat, null, 'a Rhaenyra não morde a mangueira');
  h.teleport('rhaenyra', -7.4, 22.2, 0);
  // com o balde vazio, nenhuma dog alcança a meia (nem rodeando o balde)
  become(h, 'radhija');
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    h.teleport('radhija', BK.x + Math.cos(a) * 0.55, BK.z + Math.sin(a) * 0.55, 0);
    h.run(0.15);
  }
  assert.ok(!storyInfo(h).socks.includes('balde'), 'a meia fica no fundo do balde vazio');
  // a Radhija puxa o laço: a torneira abre por um tempo e fecha sozinha
  h.teleport('radhija', HS.bite.x + 0.25, HS.bite.z - 0.25, -Math.PI * 0.75);
  h.run(0.3);
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), 'o laço na boca');
  const lock = h.puzzle.lockFor('radhija');
  holdWorld(h, [lock.pull.ax, lock.pull.az], 5, () => storyInfo(h).yard.bucket.open);
  assert.equal(S().bucket.open, true, 'a torneira abre');
  h.run(1.0);
  assert.ok(S().bucket.level > 0.2 && S().bucket.level < 1, `o balde enchendo (${S().bucket.level})`);
  assert.ok(h.run(6, { until: () => storyInfo(h).yard.bucket.full }), 'cheio');
  assert.ok(h.run(4, { until: () => !storyInfo(h).yard.bucket.open }), 'e a torneira temporizada fecha sozinha');
  // a bolinha de meia boia até a borda: pega (E) → a cena e a 4ª meia
  h.teleport('radhija', BK.x - 0.7, BK.z - 0.45, Math.PI * 0.7);
  h.run(0.3);
  h.clearLog();
  h.tap('KeyE');
  skipScene(h, 'quintalBolinha');
  assert.ok(storyInfo(h).socks.includes('balde'), 'a meia do baldão');
  const sock = h.log('story:sock').at(-1);
  assert.deepEqual({ id: sock.id, total: sock.total }, { id: 'balde', total: 4 });
  assert.equal(h.props.quintal.bucket.ball.visible, false, 'a bolinha foi junto');
  assert.deepEqual(intrusions(h), []);
});

// ================================================================================================ o modelo do jabuti
test('jabuti: o modelo cabe no colisor, não atravessa o chão e não tem NaN em nenhum estado', () => {
  const j = createJabuti();
  const v = new THREE.Vector3();
  let tris = 0;
  j.object.traverse((o) => { const m = /** @type {any} */ (o); if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
  assert.ok(tris < 6000, `leve (${tris} triângulos)`);
  for (const st of ['cochila', 'acordado', 'anda', 'come', 'esconde']) {
    j.reset();
    j.setState(st);
    j.lookAt({ x: 0.6, y: 0.4, z: 1.2 });
    let maxR = 0, minY = 9;
    for (let i = 0; i < 240; i++) {
      if (st === 'anda') j.object.position.z += JB.speed / 60;
      j.update(1 / 60, i / 60);
      j.object.updateMatrixWorld(true);
      j.object.traverse((o) => {
        const m = /** @type {any} */ (o);
        if (!m.isMesh) return;
        const p = m.geometry.attributes.position;
        for (let k = 0; k < p.count; k += 2) {
          v.fromBufferAttribute(p, k).applyMatrix4(m.matrixWorld);
          assert.ok(Number.isFinite(v.x + v.y + v.z), `${st}: sem NaN`);
          maxR = Math.max(maxR, Math.hypot(v.x - j.object.position.x, v.z - j.object.position.z));
          minY = Math.min(minY, v.y);
        }
      });
    }
    assert.ok(maxR <= JB.r, `${st}: cabe no colisor (${maxR.toFixed(3)} m)`);
    assert.ok(minY >= -0.001, `${st}: nada abaixo do chão (${minY.toFixed(4)})`);
  }
  j.dispose();
});
