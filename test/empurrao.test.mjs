// Empurrão em pé da Rhaenyra: escolha do ponto (pickShoveSpot), o roteiro do controlador (fica de pé, empurra em
// ciclos enquanto o botão está seguro, desce; nunca atravessa o que empurra), o empurrável (createShoveTarget: balança,
// solta o item no terceiro empurrão, a queda termina num ponto livre sem passar do chão), a irmã (não é empurrada), a
// Arena do Empurrão inteira com as teclas, o cenário real e a pose no modelo real (o empurrão sai dos ombros e das patas
// da frente; o quadril fica parado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollisionWorld } from '../src/game/collision.js';
import {
  createController, placeController, steer, integrate, pickShoveSpot, startShove, shoveStance, canJump, canDash,
  SHOVE_UP, SHOVE_CYCLE, SHOVE_HIT, SHOVE_DOWN, SHOVE_REACH, SHOVE_GAP,
} from '../src/game/dogController.js';
import { createShoveTarget, fallPath, SHOVE_SLIDE } from '../src/game/mechanics/shoveTarget.js';
import { withStart } from '../src/dogs/config.js';
import { LEVELS } from '../src/levels/index.js';
import empurra from '../src/levels/_empurra/index.js';
import { createHeadlessGame, installBrowserStubs } from './helpers/headless.mjs';
import { withSeed } from './helpers/seeded.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';

const DT = 1 / 60;
const levels = [...LEVELS, empurra];
const arena = (query = 'dog=rhaenyra') => createHeadlessGame({ level: levels.length, levels, query });
const L = empurra.layout;
const T = L.SHOVE_TARGETS;

const rhaenyra = (x, z, yaw) => createController('rhaenyra', withStart('rhaenyra', { x, z, yaw }));
const radhija = (x, z, yaw) => createController('radhija', withStart('radhija', { x, z, yaw }));
/** Tronco de teste: face em z = −2 (normal +Z), patas a 0,44 m. */
/** @type {import('../src/types').ShoveSpot} */
const SPOT = { id: 'teste', x: 0, z: -2, nx: 0, nz: 1, y: 0.44, w: 0, over: 0, kind: 'tree' };
const wallWorld = (extra = []) => createCollisionWorld({
  WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
  STATIC_COLLIDERS: [{ id: 'tronco', shape: 'box', x: 0, z: -2.3, hx: 0.3, hz: 0.3 }, ...extra], // face em z = −2
});

/** Roda o controlador com o botão seguro enquanto `held(i)`; devolve os quadros dos empurrões e onde estava. */
function runShove(c, world, { frames = 200, held = () => true, onFrame = null } = {}) {
  const hits = [];
  for (let i = 1; i <= frames; i++) {
    if (c.shove) c.shoveHeld = held(i);
    steer(c, DT, { dx: 0, dz: 0, speed: 0 });
    integrate(c, DT, world);
    onFrame?.(i);
    if (c.shoveHit) {
      hits.push({ i, t: i * DT, x: c.x, z: c.z, yaw: c.yaw });
      c.shoveHit = null;
    }
    if (!c.shove) return { hits, endedAt: i };
  }
  return { hits, endedAt: null };
}

test('empurrão: só a Rhaenyra, de frente, perto e do lado de cá; com algo no caminho, não', () => {
  const c = rhaenyra(0, -1.5, Math.PI); // olhando para o norte (−Z), para o tronco
  assert.equal(pickShoveSpot(c, [SPOT]), SPOT, 'de frente e perto');
  c.yaw = 0;
  assert.equal(pickShoveSpot(c, [SPOT]), null, 'de costas, parada');
  assert.equal(pickShoveSpot(c, [SPOT], 0, -1), SPOT, 'de costas, mas o analógico aponta para o tronco');
  assert.equal(pickShoveSpot(c, [SPOT], 1, 0), null, 'analógico de lado');
  c.yaw = Math.PI;
  const K = shoveStance(SPOT, c.r);
  c.z = K.z + SHOVE_REACH - 0.02;
  assert.equal(pickShoveSpot(c, [SPOT]), SPOT, 'no limite do alcance');
  c.z = K.z + SHOVE_REACH + 0.05;
  assert.equal(pickShoveSpot(c, [SPOT]), null, 'longe demais');
  c.z = -1.5;
  c.x = 0.3;
  assert.equal(pickShoveSpot(c, [SPOT]), null, 'de lado demais para um tronco redondo');
  const wide = { ...SPOT, w: 0.2 };
  assert.equal(pickShoveSpot(c, [wide]), wide, 'numa face larga, vale');
  const behind = rhaenyra(0, -2.6, 0);
  assert.equal(pickShoveSpot(behind, [SPOT]), null, 'do outro lado');
  assert.equal(pickShoveSpot(radhija(0, -1.5, Math.PI), [SPOT]), null, 'a Radhija não empurra em pé');
  const jumping = rhaenyra(0, -1.5, Math.PI);
  jumping.jumpT = 0.2;
  assert.equal(pickShoveSpot(jumping, [SPOT]), null, 'no ar, não');
  const world = wallWorld();
  const gate = world.addDynamic({ id: 'portao', shape: 'segment', ax: -1, az: -1.55, bx: 1, bz: -1.55, t: 0.03 });
  const g = rhaenyra(0, -1.4, Math.PI);
  assert.equal(pickShoveSpot(g, [SPOT], 0, 0, world), null, 'portão fechado no caminho');
  gate.enabled = false;
  assert.equal(pickShoveSpot(g, [SPOT], 0, 0, world), SPOT, 'portão aberto: vale');
  const other = { ...SPOT, id: 'outro', x: 0.5 };
  const near = rhaenyra(0.45, -1.6, Math.PI);
  assert.equal(pickShoveSpot(near, [SPOT, other]), other, 'com dois ao alcance, o mais perto');
});

test('empurrão: fica de pé, empurra a cada ciclo com o botão seguro e desce ao soltar, sem atravessar o tronco', () => {
  const world = wallWorld();
  const c = rhaenyra(0.06, -1.42, Math.PI - 0.4); // um pouco de lado e longe: ela se alinha
  startShove(c, SPOT);
  assert.equal(canJump(c), false, 'sem pulo de pé');
  assert.equal(!!canDash(c), false, 'sem arrancada de pé');
  const K = shoveStance(SPOT, c.r);
  const release = Math.round((SHOVE_UP + SHOVE_CYCLE * 2.2) / DT); // solta no meio do terceiro ciclo (antes do empurrão)
  let maxK = 0;
  const { hits, endedAt } = runShove(c, world, {
    held: (i) => i < release,
    onFrame: (i) => {
      maxK = Math.max(maxK, c.shoveK);
      assert.ok(!world.overlaps(c.x, c.z, c.r * 0.99, c.size), `quadro ${i}: dentro do tronco`);
    },
  });
  assert.equal(hits.length, 2, `dois empurrões antes de soltar (${hits.map((h) => h.t.toFixed(2))})`);
  for (const [k, h] of hits.entries()) {
    const want = SHOVE_UP + SHOVE_CYCLE * (k + SHOVE_HIT);
    assert.ok(Math.abs(h.t - want) < 2 * DT, `empurrão ${k + 1} em ${h.t.toFixed(3)} s (esperado ${want.toFixed(3)})`);
    assert.ok(Math.hypot(h.x - K.x, h.z - K.z) < 0.02, 'encostada no ponto de apoio');
    assert.ok(Math.abs(Math.abs(h.yaw) - Math.PI) < 0.05, 'de frente para o tronco');
  }
  assert.equal(maxK, 1, 'ficou de pé');
  const want = release * DT + SHOVE_DOWN;
  assert.ok(endedAt && Math.abs(endedAt * DT - want) < 3 * DT, `soltou antes do empurrão: desce na hora (${endedAt * DT} s)`);
  assert.equal(c.shove, null);
  assert.equal(c.shoveK, 0);
  assert.ok(c.z > K.z - 0.01, 'termina do lado de cá');
});

test('empurrão: um toque rápido dá um empurrão; soltar depois dele termina o ciclo e desce', () => {
  const world = wallWorld();
  const c = rhaenyra(0, -1.6, Math.PI);
  startShove(c, SPOT);
  const tap = runShove(c, world, { held: (i) => i < 4 });
  assert.equal(tap.hits.length, 1, 'o primeiro empurrão sempre acontece');
  assert.ok(Math.abs(tap.endedAt * DT - (SHOVE_UP + SHOVE_CYCLE + SHOVE_DOWN)) < 3 * DT, 'termina o ciclo e desce');
  placeController(c, 0, -1.6, Math.PI);
  startShove(c, SPOT);
  const releaseAfterHit = Math.round((SHOVE_UP + SHOVE_CYCLE * (1 + SHOVE_HIT + 0.1)) / DT);
  const two = runShove(c, world, { held: (i) => i < releaseAfterHit });
  assert.equal(two.hits.length, 2, 'soltou logo depois do segundo empurrão: ele vale');
  assert.ok(Math.abs(two.endedAt * DT - (SHOVE_UP + SHOVE_CYCLE * 2 + SHOVE_DOWN)) < 3 * DT, 'termina o segundo ciclo e desce');
  startShove(c, SPOT);
  placeController(c, 0, -1.6, Math.PI);
  assert.equal(c.shove, null, 'reiniciar tira do empurrão');
});

test('empurrão: se algo segurar a dog longe da superfície, o empurrão não conta', () => {
  const world = wallWorld();
  const c = rhaenyra(0, -1.32, Math.PI);
  startShove(c, SPOT);
  world.addDynamic({ id: 'caixa', shape: 'box', x: 0, z: -1.62, hx: 0.5, hz: 0.04 }); // apareceu no caminho
  const { hits } = runShove(c, world, { held: (i) => i < 80 });
  assert.equal(hits.length, 0, 'sem alcançar, sem empurrão');
  assert.ok(c.z > -1.62, 'ficou do lado de cá');
});

test('queda: a trajetória termina no ponto do chão, nunca abaixo dele, e quica cada vez menos', () => {
  const out = new THREE.Vector3();
  for (const [P0, roll] of [[{ x: 0, y: 1.1, z: 0 }, true], [{ x: 0, y: 0.5, z: 0 }, false]]) {
    const Lp = { x: 0.6, z: -0.3 };
    const P = fallPath(P0, Lp, { restY: 0.07, bounce: roll ? 0.45 : 0.28, roll });
    let minY = Infinity;
    for (let t = 0; t <= P.dur; t += 0.005) minY = Math.min(minY, P.at(t, out).y);
    assert.ok(minY >= 0.07 - 1e-9, `nunca abaixo do chão (${minY})`);
    P.at(P.dur, out);
    assert.ok(Math.hypot(out.x - Lp.x, out.z - Lp.z) < 1e-6 && Math.abs(out.y - 0.07) < 1e-9, 'para no ponto');
    assert.ok(P.impacts.length >= 1);
    for (let i = 1; i < P.impacts.length; i++) assert.ok(P.impacts[i].k < P.impacts[i - 1].k, 'quiques cada vez menores');
  }
});

test('empurrável: balança mais a cada empurrão; no terceiro o item cai, quica e para num ponto livre', () => {
  const log = [];
  const emit = (name, p) => log.push([name, p]);
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const ball = new THREE.Group();
  ball.position.set(0.2, 1.0, -0.2);
  pivot.add(ball);
  const sways = [];
  const prop = { object: pivot, setSway(a) { sways.push(a); } };
  const world = createCollisionWorld({ WORLD: { bounds: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 } }, STATIC_COLLIDERS: [{ id: 'pedra', shape: 'circle', x: 0.7, z: 0, r: 0.1 }] });
  const cfg = { x: 0, z: 0.07, nx: 0, nz: 1, y: 0.44, kind: 'tree', item: { from: { x: 0.2, y: 1.0, z: -0.2 }, r: 0.072, roll: true, land: [{ x: 0.7, z: 0 }, { x: 0.6, z: -0.5 }, { x: -0.6, z: -0.5 }] } };
  const tgt = createShoveTarget({ id: 'arvore', cfg, emit, world, root, prop, item: ball });
  const dog = { name: 'radhija', x: 0.6, z: -0.5, r: 0.17 };
  const peak = () => {
    let m = 0;
    for (let i = 0; i < 40; i++) { tgt.update(DT); m = Math.max(m, Math.abs(tgt.sway)); }
    return m;
  };
  tgt.shove(null, { radhija: dog });
  const a1 = peak();
  tgt.shove(null, { radhija: dog });
  const a2 = peak();
  assert.ok(a1 > 0.02 && a2 > a1, `balança mais a cada empurrão (${a1.toFixed(3)} → ${a2.toFixed(3)})`);
  assert.equal(ball.parent, pivot, 'ainda preso');
  tgt.shove(null, { radhija: dog });
  assert.equal(tgt.dropped, true);
  let minY = Infinity;
  for (let i = 0; i < 180 && !tgt.landed; i++) {
    tgt.update(DT);
    if (ball.parent === root) minY = Math.min(minY, ball.position.y);
  }
  assert.equal(tgt.landed, true, 'parou no chão');
  assert.equal(ball.parent, root, 'mora na raiz da cena');
  assert.ok(minY >= 0.072 - 1e-6, `nunca passou do chão (${minY})`);
  assert.deepEqual(tgt.itemAt && { x: +tgt.itemAt.x.toFixed(3), z: +tgt.itemAt.z.toFixed(3) }, { x: -0.6, z: -0.5 }, 'o primeiro ponto tinha uma pedra; o segundo, a Radhija: o terceiro');
  const names = log.map(([n]) => n);
  assert.equal(names.filter((n) => n === 'shove:hit').length, 3);
  assert.equal(names.filter((n) => n === 'shove:drop').length, 1);
  assert.ok(names.filter((n) => n === 'shove:bounce').length >= 2, 'quicou');
  assert.equal(names.filter((n) => n === 'shove:land').length, 1);
  tgt.shove(null, {});
  assert.equal(names.filter((n) => n === 'shove:drop').length, 1, 'depois de cair, empurrar só balança');
  tgt.reset();
  assert.equal(ball.parent, pivot, 'reset: de volta ao galho');
  assert.deepEqual(ball.position.toArray(), [0.2, 1.0, -0.2]);
  assert.equal(tgt.dropped, false);
  assert.equal(tgt.pushes, 0);
});

test('empurrável: a mesa só tomba para longe e o item escorrega até a beirada antes de cair', () => {
  const root = new THREE.Group();
  const top = new THREE.Group();
  root.add(top);
  const duck = new THREE.Group();
  duck.position.set(0, 0.5, -0.14);
  top.add(duck);
  const sways = [];
  const cfg = {
    x: 0, z: 0.23, nx: 0, nz: 1, y: 0.5, over: 0.05, w: 0.2, kind: 'table',
    item: { from: { x: 0, y: 0.5, z: -0.14 }, edge: { x: 0, y: 0.5, z: -0.26 }, r: 0.07, restY: 0.065, center: 0.065, rB: 0.095, land: [{ x: 0, z: -0.6 }] },
  };
  const tgt = createShoveTarget({ id: 'mesa', cfg, emit: () => {}, root, prop: { object: top, setSway(a) { sways.push(a); } }, item: duck });
  tgt.shove();
  for (let i = 0; i < 60; i++) tgt.update(DT);
  tgt.shove();
  for (let i = 0; i < 60; i++) tgt.update(DT);
  assert.ok(Math.min(...sways) >= 0, 'nunca inclina para o lado da dog (os pés não afundam)');
  assert.ok(Math.max(...sways) > 0.01, 'tomba um pouco');
  assert.ok(duck.position.z < -0.17 && duck.position.z > -0.26, `escorregou um pouco rumo à beirada (${duck.position.z.toFixed(3)})`);
  tgt.shove();
  for (let i = 0; i < Math.round(SHOVE_SLIDE / DT) - 2; i++) tgt.update(DT);
  assert.equal(duck.parent, top, 'escorregando, ainda na mesa');
  for (let i = 0; i < 240 && !tgt.landed; i++) {
    tgt.update(DT);
    if (duck.parent === root) {
      // o meio do patinho nunca fica abaixo do raio que o contém (nada passa do chão em nenhum giro)
      const mid = new THREE.Vector3(0, 0.065, 0).applyQuaternion(duck.quaternion).add(duck.position);
      assert.ok(mid.y > 0.065 - 1e-6, `meio a ${mid.y.toFixed(3)} m`);
    }
  }
  assert.equal(tgt.landed, true);
  assert.ok(Math.abs(duck.position.y) < 1e-6, 'de pé no chão');
  assert.ok(Math.abs(duck.position.x) < 1e-6 && Math.abs(duck.position.z + 0.6) < 1e-6, 'no ponto');
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(duck.quaternion);
  assert.ok(up.y > 0.999, 'assentou de pé');
});

test('Arena do Empurrão: segurando Shift de frente para a arvorezinha, três empurrões derrubam a bolinha; ela leva para casa', async () => {
  const h = await arena();
  const tree = T.arvorezinha;
  const K = shoveStance(tree, h.ctrls.rhaenyra.r);
  h.teleport('radhija', -2.5, 1.5);
  h.game.setStay('radhija', true);
  h.teleport('rhaenyra', K.x - 0.25, K.z, Math.PI / 2); // a oeste do tronco, olhando para o leste
  h.run(0.2);
  h.clearLog();
  h.hold([1, 0], ['ShiftLeft']);
  const up = h.run(1.5, { until: (i) => !!i.dogs.rhaenyra.shove });
  assert.ok(up, 'ficou de pé ao chegar perto segurando Shift');
  h.hold(null, ['ShiftLeft']);
  h.run(SHOVE_UP + SHOVE_CYCLE * 3 + 0.1);
  h.hold(null);
  h.run(SHOVE_CYCLE + SHOVE_DOWN + 0.1);
  const shoves = h.log('dog:shove');
  assert.ok(shoves.length >= 3, `empurrou ${shoves.length} vezes`);
  assert.ok(shoves.every((s) => s.id === 'arvorezinha'));
  assert.equal(h.log('shove:drop').length, 1, 'a bolinha caiu');
  h.run(1.5, { until: (i) => i.empurra.tree.landed });
  const inf = h.info();
  assert.equal(inf.empurra.tree.landed, true);
  assert.equal(inf.stage, 'ball');
  assert.equal(inf.dogs.rhaenyra.shove, null, 'soltou o botão e desceu');
  const c = h.ctrls.rhaenyra;
  assert.ok(!h.world.overlaps(c.x, c.z, c.r * 0.99, c.size), 'nunca dentro da árvore');
  // pega a bolinha e leva para a caminha
  const ball = inf.empurra.tree.item;
  h.walkPath([[0.0, -1.15], [ball.x - 0.3, ball.z, { tol: 0.12 }]]);
  h.tap('KeyE');
  assert.equal(h.info().stage, 'carrying');
  h.walkPath([[-0.6, -0.5], [-2.6, -1.6], [L.GOAL.x + 0.3, L.GOAL.z + 0.3]]);
  h.run(0.5, { until: (i) => i.state !== 'playing' });
  assert.notEqual(h.info().state, 'playing', 'entregou');
});

test('Arena do Empurrão: a Radhija não fica de pé (Shift é a arrancada) e ganha a dica; na mesinha e na estante o brinquedo cai do outro lado', async () => {
  const h = await arena('dog=radhija');
  const tree = T.arvorezinha;
  h.teleport('rhaenyra', -2.5, 1.5);
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', tree.x - 0.6, tree.z, Math.PI / 2);
  h.run(0.2);
  h.clearLog();
  h.hold([1, 0], ['ShiftLeft']);
  h.run(1.2);
  h.hold(null);
  assert.equal(h.info().dogs.radhija.shove, null);
  assert.equal(h.log('dog:shove').length, 0);
  assert.ok(h.log('hint').some((p) => /Só a Rhaenyra fica de pé/.test(p.text)), 'dica');

  const g = await arena();
  for (const [key, id] of [['mesinha', 'table'], ['estante', 'shelf']]) {
    const S = T[key];
    const K = shoveStance(S, g.ctrls.rhaenyra.r);
    g.teleport('radhija', -3.5, 2.5);
    g.game.setStay('radhija', true);
    g.teleport('rhaenyra', K.x + S.nx * 0.2, K.z + S.nz * 0.2, Math.atan2(-S.nx, -S.nz));
    g.run(0.1);
    g.hold(null, ['ShiftLeft']);
    g.run(SHOVE_UP + SHOVE_CYCLE * 3 + 0.2);
    g.hold(null);
    g.run(2.5, { until: (i) => i.empurra[id].landed });
    const inf = g.info().empurra[id];
    assert.equal(inf.landed, true, `${key}: o brinquedo caiu`);
    const side = (inf.item.x - S.x) * S.nx + (inf.item.z - S.z) * S.nz;
    assert.ok(side < -0.2, `${key}: caiu do outro lado (${side.toFixed(2)})`);
    assert.ok(!g.world.overlaps(inf.item.x, inf.item.z, S.item.r, 'small'), `${key}: fora dos móveis`);
    g.run(1.0);
  }
});

test('Arena do Empurrão: de frente para a irmã, segurar Shift não faz a Rhaenyra ficar de pé', async () => {
  const h = await arena();
  h.teleport('radhija', -1.0, -0.4, Math.PI / 2);
  h.game.setStay('radhija', true);
  h.teleport('rhaenyra', -1.0, 0.25, Math.PI);
  h.run(0.05);
  h.clearLog();
  h.hold(null, ['ShiftLeft']);
  h.run(SHOVE_UP + SHOVE_CYCLE * 2);
  h.hold(null);
  assert.equal(h.log('dog:rear').length, 0, 'não ficou de pé');
  assert.equal(h.log('dog:shove').length, 0, 'não empurrou');
  assert.equal(h.info().dogs.rhaenyra.shove, null);
});
test('Arena do Empurrão: reiniciar devolve tudo para cima; ?stage=carrying começa com a bolinha na boca', async () => {
  const h = await arena();
  h.puzzle.jumpToStage('carrying');
  assert.equal(h.puzzle.carrier, 'rhaenyra');
  assert.equal(h.props.ball.object.parent, h.dogs.rhaenyra.mouthSocket);
  h.puzzle.reset();
  assert.equal(h.puzzle.carrier, null);
  assert.equal(h.props.ball.object.parent, h.props.tree.object, 'de volta ao galho');
  assert.equal(h.info().stage, 'start');
});

test('Arena do Empurrão (cenário real): os itens estão onde o layout diz e o tronco onde as patas apoiam', async (t) => {
  const fx = await buildLevelWorld(empurra);
  t.after(() => fx.dispose());
  const P = fx.built.props;
  fx.root.updateMatrixWorld(true);
  const at = (o) => o.getWorldPosition(new THREE.Vector3());
  for (const [k, key] of [['ball', 'arvorezinha'], ['duck', 'mesinha'], ['bear', 'estante']]) {
    const p = at(P[k].object);
    const f = T[key].item.from;
    assert.ok(p.distanceTo(new THREE.Vector3(f.x, f.y, f.z)) < 0.005, `${k} em ${p.toArray().map((v) => v.toFixed(3))}`);
  }
  // as patas encostam: o tronco passa pelo ponto de apoio na altura das patas (raio ± 1 cm)
  const tree = T.arvorezinha;
  const trunk = P.tree.object.getObjectByName('tronco');
  const box = new THREE.Box3().setFromObject(trunk);
  assert.ok(box.max.y > tree.y, 'o tronco chega à altura das patas');
  const ray = new THREE.Raycaster(new THREE.Vector3(tree.x + tree.nx * 0.5, tree.y, tree.z + tree.nz * 0.5), new THREE.Vector3(-tree.nx, 0, -tree.nz));
  const hitT = ray.intersectObject(trunk)[0];
  assert.ok(hitT, 'o raio acha o tronco');
  const d = hitT.point.distanceTo(new THREE.Vector3(tree.x, tree.y, tree.z));
  assert.ok(d < 0.012, `superfície do tronco a ${(d * 100).toFixed(1)} cm do ponto de apoio`);
  // a mesinha e a estante: o tampo na altura das patas, a face onde o layout diz
  for (const [k, key] of [['table', 'mesinha'], ['shelf', 'estante']]) {
    const S = T[key];
    const b = new THREE.Box3().setFromObject(P[k].object.getObjectByName('tampo'));
    assert.ok(Math.abs(b.max.y - S.y) < 0.012, `${k}: tampo a ${b.max.y.toFixed(3)} m`);
    const face = Math.max((b.max.x - S.x) * S.nx, (b.min.x - S.x) * S.nx) + Math.max((b.max.z - S.z) * S.nz, (b.min.z - S.z) * S.nz);
    assert.ok(Math.abs(face) < 0.02, `${k}: face da frente a ${(face * 100).toFixed(1)} cm do ponto de apoio`);
  }
  // os pontos de pouso ficam fora dos móveis e longe do tronco
  const world = createCollisionWorld(L);
  for (const S of Object.values(T)) {
    for (const p of S.item.land) assert.ok(!world.overlaps(p.x, p.z, S.item.r + 0.02, 'small'), `pouso livre em ${p.x}, ${p.z}`);
  }
});

test('pose de pé no modelo real: patas da frente no apoio, traseiras no chão, nada atravessa o chão nem o que ela empurra', async () => {
  installBrowserStubs();
  const { createDog } = await import('../src/dogs/dog.js');
  const { SHOVE_PROP_SIZE, treeTrunkRadius } = await import('../src/world/shoveProps.js');
  const v = new THREE.Vector3();
  const cases = [
    { name: 'tronco', spot: { ...SPOT, y: SHOVE_PROP_SIZE.tree.paws, over: 0, w: 0, kind: 'tree' }, trunkR: treeTrunkRadius(SHOVE_PROP_SIZE.tree.paws) },
    { name: 'mesinha', spot: { ...SPOT, y: SHOVE_PROP_SIZE.table.h, over: 0.05, w: 0.22, kind: 'table' } },
    { name: 'estante', spot: { ...SPOT, y: SHOVE_PROP_SIZE.shelf.h, over: 0.04, w: 0.28, kind: 'shelf' } },
  ];
  for (const K of cases) {
    const d = createDog('rhaenyra');
    const world = createCollisionWorld({ WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } }, STATIC_COLLIDERS: [] });
    const c = rhaenyra(0, -1.5, Math.PI);
    const S = K.spot;
    const sync = () => {
      const on = !!c.shove;
      d.object.position.set(c.x, 0, c.z);
      d.object.rotation.y = c.yaw;
      // o mesmo que o núcleo manda (game.js → applyDogs)
      d.update(DT, {
        speed: c.animSpeed, action: on ? 'shove' : 'none', shoveK: on ? c.shoveK : 0,
        shoveCycle: on && c.shoveStage === 'push' ? c.shoveCycle : -1, shoveN: c.shoveN,
        shoveGap: c.r + SHOVE_GAP, shoveY: S.y, shoveOver: S.over,
      });
      d.object.updateMatrixWorld(true);
    };
    for (let i = 0; i < 30; i++) sync();
    startShove(c, S);
    const into = (p) => (S.z - p.z) * S.nz + (S.x - p.x) * S.nx; // + = além da face (dentro da coisa)
    let minY = Infinity;
    let worst = '';
    const paws = [];
    const beat = []; // quadril e ombro ao longo dos ciclos de empurrão
    for (let i = 0; i < 220 && c.shove; i++) {
      c.shoveHeld = i < 150;
      steer(c, DT, { dx: 0, dz: 0, speed: 0 });
      integrate(c, DT, world);
      c.shoveHit = null;
      sync();
      for (const b of d.bones) {
        b.getWorldPosition(v);
        if (v.y < minY) { minY = v.y; worst = `${b.name} (${c.shoveStage}, k ${c.shoveK.toFixed(2)})`; }
        const pen = into(v);
        if (b.name === 'FLp' || b.name === 'FRp') continue;
        // a cabeça tem focinho e pelo além dos ossos: pede mais folga
        const gap = /^(head|jaw|ear)/.test(b.name) ? 0.04 : 0.01;
        if (K.trunkR) {
          // o tronco: nenhum osso dentro dele (até 1 m de altura)
          const dAx = Math.hypot(v.x - S.x + S.nx * K.trunkR, v.z - S.z + S.nz * K.trunkR);
          assert.ok(v.y > 1 || dAx > K.trunkR + gap, `${K.name}: ${b.name} dentro do tronco (${dAx.toFixed(3)} m do eixo, ${c.shoveStage})`);
        } else {
          // mesinha e estante: além da face, só acima do tampo
          assert.ok(pen < 0.005 - gap || v.y > S.y + 0.01, `${K.name}: ${b.name} atravessou a frente (${pen.toFixed(3)} m, y ${v.y.toFixed(3)}, ${c.shoveStage})`);
        }
      }
      if (c.shoveStage === 'push' && c.shoveN >= 1) {
        const hip = d.bones.find((b) => b.name === 'HLu').getWorldPosition(new THREE.Vector3());
        const sh = d.bones.find((b) => b.name === 'FLu').getWorldPosition(new THREE.Vector3());
        beat.push({ hip, fwd: -into(sh) });
      }
      if (c.shoveStage === 'push' && c.shoveCycle > 0.45 && c.shoveCycle < 0.6) {
        const p = (n) => d.bones.find((b) => b.name === n).getWorldPosition(new THREE.Vector3());
        paws.push({ FL: p('FLp'), FR: p('FRp'), HL: p('HLp'), HR: p('HRp'), hip: p('HLu') });
      }
    }
    assert.ok(minY > -0.006, `${K.name}: ${worst} abaixo do chão (${minY.toFixed(3)})`);
    assert.ok(paws.length > 3, `${K.name}: empurrou`);
    // o empurrão não vem da pelve: o quadril fica parado; os ombros dão o tranco para a frente
    const range = (vals) => Math.max(...vals) - Math.min(...vals);
    const hipMove = Math.max(range(beat.map((b) => b.hip.y)), range(beat.map((b) => b.hip.z)), range(beat.map((b) => b.hip.x)));
    assert.ok(hipMove < 0.006, `${K.name}: o quadril vai e volta ${(hipMove * 100).toFixed(1)} cm no empurrão`);
    const jolt = range(beat.map((b) => b.fwd));
    assert.ok(jolt > 0.012, `${K.name}: os ombros dão o tranco (${(jolt * 100).toFixed(1)} cm)`);
    for (const P of paws) {
      for (const f of [P.FL, P.FR]) {
        const pen = into(f);
        if (S.over > 0) {
          assert.ok(f.y > S.y + 0.015 && f.y < S.y + 0.1, `${K.name}: pata da frente em cima (${f.y.toFixed(3)} m; apoio ${S.y})`);
          assert.ok(pen > -0.02 && pen < S.over + 0.06, `${K.name}: pata sobre a beirada (${pen.toFixed(3)} m além da face)`);
        } else {
          assert.ok(Math.abs(f.y - S.y) < 0.07, `${K.name}: pata na altura do apoio (${f.y.toFixed(3)} m; apoio ${S.y})`);
          assert.ok(pen < -0.005 && pen > -0.075, `${K.name}: pata encostada na face sem atravessar (${pen.toFixed(3)} m)`);
        }
      }
      for (const f of [P.HL, P.HR]) assert.ok(f.y > -0.005 && f.y < 0.07, `${K.name}: traseira no chão (${f.y.toFixed(3)})`);
      assert.ok(P.hip.y > 0.17 && P.hip.y < 0.33, `${K.name}: quadril a ${P.hip.y.toFixed(3)} m`);
    }
    for (const b of d.bones) assert.ok(Number.isFinite(b.quaternion.x + b.position.y), `${K.name}: osso ${b.name} inválido`);
  }
});

test('modelo novo (?dogs=novo): subir, empurrar e descer não afundam mais que o passo comum', async () => {
  installBrowserStubs();
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  const { SHOVE_PROP_SIZE } = await import('../src/world/shoveProps.js');
  const world = createCollisionWorld({ WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } }, STATIC_COLLIDERS: [] });
  // a fase da passada e o relógio começam sorteados: várias sementes, cada uma sempre igual
  const seeds = [11, 23, 37, 41, 59, 73];
  const report = [];
  for (const seed of seeds) withSeed(seed, () => {
    const d = createDogV2('rhaenyra');
    // `lowest` é o ponto mais baixo ANTES da correção do chão do modelo novo (que levanta o corpo além de 4 mm): quanto
    // mais fundo, maior o pulinho do corpo. Referência: andar e parar (o passo comum).
    let walk = 0;
    for (const v of [0.6, 1.2, 1.8]) {
      for (let i = 0; i < 45; i++) { d.update(DT, { speed: v, action: 'none' }); walk = Math.min(walk, d.lowest); }
      for (let i = 0; i < 15; i++) { d.update(DT, { speed: 0, action: 'none' }); walk = Math.min(walk, d.lowest); }
    }
    const worst = {};
    for (const [name, y, over] of [['tronco', SHOVE_PROP_SIZE.tree.paws, 0], ['mesinha', SHOVE_PROP_SIZE.table.h, 0.05]]) {
      // fases diferentes da passada quando ela começa e quando desce (o pior caso depende delas)
      for (const warm of [0, 7, 14, 21]) {
        const c = rhaenyra(0, -1.2 - warm * 0.004, Math.PI);
        const S = { ...SPOT, y, over, kind: name };
        const sync = () => {
          const on = !!c.shove;
          d.object.position.set(c.x, 0, c.z);
          d.object.rotation.y = c.yaw;
          d.update(DT, {
            speed: c.animSpeed, action: on ? 'shove' : 'none', shoveK: on ? c.shoveK : 0,
            shoveCycle: on && c.shoveStage === 'push' ? c.shoveCycle : -1, shoveN: c.shoveN,
            shoveGap: c.r + SHOVE_GAP, shoveY: S.y, shoveOver: S.over,
          });
        };
        for (let i = 0; i < warm + 5; i++) sync();
        startShove(c, S);
        for (let i = 0; i < 200 && c.shove; i++) {
          c.shoveHeld = i < 70 + warm;
          steer(c, DT, { dx: 0, dz: 0, speed: 0 });
          integrate(c, DT, world);
          c.shoveHit = null;
          sync();
          const k = c.shoveStage;
          if (!(k in worst) || d.lowest < worst[k].low) worst[k] = { low: d.lowest, bone: d.lowestBone, name };
        }
      }
    }
    const fmt = (w) => `${(w.low * 1000).toFixed(1)} mm (${w.bone}, ${w.name}, semente ${seed})`;
    report.push(`semente ${seed}: passo ${(walk * 1000).toFixed(1)} mm, ${['push', 'up', 'down'].map((k) => `${k} ${fmt(worst[k])}`).join(', ')}`);
    assert.ok(worst.push.low > -0.0045, `de pé, empurrando: só as almofadinhas no chão (${fmt(worst.push)})`);
    for (const k of ['up', 'down']) {
      // no main antes da correção a descida chegava a −12 mm (a pata de trás dobrava como num passo sem levantar o pé).
      // Referência: o passo comum com as patas do guia (−7,1 mm, medido no #41); com a locomoção própria do modelo novo
      // (gait.js, etapa 2) o passo afunda menos, e a subida e a descida (ainda do guia) continuam valendo pelo do guia
      const ref = Math.min(walk, -0.0071);
      assert.ok(worst[k].low > ref - 0.003, `${k}: ${fmt(worst[k])}; o passo comum chega a ${(walk * 1000).toFixed(1)} mm (guia: −7,1 mm)`);
      assert.ok(worst[k].low > -0.0095, `${k}: ${fmt(worst[k])}`);
    }
  });
  console.log(`[empurrão, modelo novo] ponto mais baixo antes da correção do chão:\n  ${report.join('\n  ')}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Empurrando caixote ou carrinho de pé (retorno do usuário, 2026-10-20: "essa mecânica de empurrar poderia usar uma
// animação parecida com aquela de empurrar em pé... ela empurraria com as patas, andando apenas em duas patas
// traseiras"): a pose do empurrão em pé, as patas da frente na face (ou em cima, se é baixo) e as traseiras andando.
// ---------------------------------------------------------------------------------------------------------------
test('empurrando caixote de pé: patas da frente nele, traseiras andando (sempre uma no chão), a cabeça fora dele', async () => {
  installBrowserStubs();
  const { createDog } = await import('../src/dogs/dog.js');
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  const pos = (d, n) => d.bones.find((b) => b.name === n).getWorldPosition(new THREE.Vector3());
  const report = [];
  const bad = [];
  for (const [model, make] of [['atual', createDog], ['novo', createDogV2]]) {
    // empurrando um caixote alto, um baixo (patas em cima da beirada) e a Radhija fazendo força (ele não anda)
    for (const [kind, action, speed, top] of [['rhaenyra', 'push', 0.8, 0.55], ['rhaenyra', 'push', 0.7, 0.42], ['radhija', 'strain', 0, 0.5]]) {
      withSeed(4242, () => {
        const d = make(kind);
        const cfg = withStart(kind, { x: 0, z: 0, yaw: 0 });
        const s = kind === 'rhaenyra' ? 1.133 : 1;
        const gap = cfg.body.front; // o peito encosta na face (collision.js resolveBody)
        const tag = `${model} ${kind} ${action} (caixote de ${top} m)`;
        let steps = 0;
        d.onFootstep = () => { steps++; };
        const m = { up: 0, below: 0, belowAt: '', into: -1, intoAt: '', pawZ: [Infinity, -Infinity], pawY: [Infinity, -Infinity], hindMin: 0, hindLift: [0, 0], slide: 0 };
        let prevHind = null;
        for (let f = 0; f < 110; f++) {
          const pushing = f >= 10;
          d.object.position.z += speed * DT;
          d.object.rotation.y = 0;
          d.update(DT, pushing ? { speed, action, pushGap: gap, pushTop: top } : { speed, action: 'none' });
          d.object.updateMatrixWorld(true);
          if (f < 50) continue; // já de pé
          const face = d.object.position.z + gap;
          const sh = pos(d, 'FLu'), hip = pos(d, 'HLu');
          m.up = Math.max(m.up, sh.y - hip.y);
          for (const b of d.bones) {
            const p = b.getWorldPosition(new THREE.Vector3());
            if (p.y < m.below) { m.below = p.y; m.belowAt = b.name; }
            if (/^F[LR][pc]$/.test(b.name)) continue;
            // além da face, só acima do tampo (a cabeça tem focinho e pelo além dos ossos: pede mais folga)
            const pad = /^(head|jaw|ear)/.test(b.name) ? 0.04 : 0.01;
            const pen = p.z - face + pad;
            if (p.y < top + 0.01 && pen > m.into) { m.into = pen; m.intoAt = `${b.name} (y ${p.y.toFixed(2)})`; }
          }
          for (const n of ['FLp', 'FRp']) {
            const p = pos(d, n);
            m.pawZ = [Math.min(m.pawZ[0], p.z - face), Math.max(m.pawZ[1], p.z - face)];
            m.pawY = [Math.min(m.pawY[0], p.y), Math.max(m.pawY[1], p.y)];
          }
          const hind = [pos(d, 'HLp'), pos(d, 'HRp')];
          m.hindMin = Math.max(m.hindMin, Math.min(hind[0].y, hind[1].y)); // a mais baixa das duas, no pior quadro
          hind.forEach((p, i) => { m.hindLift[i] = Math.max(m.hindLift[i], p.y); });
          // a traseira apoiada (a articulação da pata na altura de repouso, 2,4 cm na escala) não escorrega
          const flat = 0.024 * s + 0.0015;
          if (prevHind) hind.forEach((p, i) => { if (p.y < flat && prevHind[i].y < flat) m.slide = Math.max(m.slide, Math.hypot(p.x - prevHind[i].x, p.z - prevHind[i].z)); });
          prevHind = hind;
        }
        const onTop = top < 0.36 * s + 0.03 * s;
        report.push(`${tag}: ombro ${(m.up * 100).toFixed(1)} cm acima do quadril; patas da frente a ${(m.pawZ[0] * 100).toFixed(1)}…${(m.pawZ[1] * 100).toFixed(1)} cm da face, ${(m.pawY[0] * 100).toFixed(0)}…${(m.pawY[1] * 100).toFixed(0)} cm de altura${onTop ? ' (em cima)' : ''}; o que mais chega na face: ${(m.into * 100).toFixed(1)} cm (${m.intoAt}); traseiras sobem até ${m.hindLift.map((x) => (x * 100).toFixed(1)).join('/')} cm, a mais baixa até ${(m.hindMin * 100).toFixed(1)} cm, apoiada escorrega ${(m.slide * 1000).toFixed(1)} mm/quadro; abaixo do chão ${(m.below * 1000).toFixed(1)} mm (${m.belowAt}); ${steps} pisadas`);
        if (m.up < 0.1 * s) bad.push(`${tag}: não ficou de pé (ombro ${(m.up * 100).toFixed(1)} cm acima do quadril)`);
        if (m.into > 0.005) bad.push(`${tag}: ${m.intoAt} entrou ${(m.into * 100).toFixed(1)} cm no caixote`);
        if (onTop) {
          if (m.pawY[0] < top + 0.005) bad.push(`${tag}: patas da frente abaixo da beirada (${(m.pawY[0] * 100).toFixed(1)} cm)`);
          if (m.pawZ[0] < -0.03 || m.pawZ[1] > 0.1) bad.push(`${tag}: patas da frente fora da beirada (${(m.pawZ[0] * 100).toFixed(1)}…${(m.pawZ[1] * 100).toFixed(1)} cm)`);
        } else {
          if (Math.abs((m.pawY[0] + m.pawY[1]) / 2 - 0.36 * s) > 0.08) bad.push(`${tag}: patas da frente a ${(m.pawY[0] * 100).toFixed(0)}…${(m.pawY[1] * 100).toFixed(0)} cm de altura`);
          if (m.pawZ[1] > 0.008 || m.pawZ[0] < -0.08) bad.push(`${tag}: patas da frente fora da face (${(m.pawZ[0] * 100).toFixed(1)}…${(m.pawZ[1] * 100).toFixed(1)} cm)`);
        }
        if (m.hindMin > 0.024 * s + 0.012) bad.push(`${tag}: as duas traseiras no ar ao mesmo tempo (${(m.hindMin * 100).toFixed(1)} cm)`);
        if (m.below < -0.008) bad.push(`${tag}: ${m.belowAt} abaixo do chão (${(m.below * 1000).toFixed(1)} mm)`);
        if (speed > 0) {
          if (Math.min(...m.hindLift) < 0.024 * s + 0.012) bad.push(`${tag}: as traseiras não andam (sobem ${m.hindLift.map((x) => (x * 100).toFixed(1)).join('/')} cm)`);
          if (steps < 4) bad.push(`${tag}: poucas pisadas (${steps})`);
          if (m.slide > 0.005) bad.push(`${tag}: a traseira apoiada escorregou ${(m.slide * 1000).toFixed(1)} mm num quadro`);
        }
        for (const b of d.bones) if (!Number.isFinite(b.quaternion.x + b.position.y)) bad.push(`${tag}: osso ${b.name} inválido`);
      });
    }
  }
  console.log(`[empurrando de pé]\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('empurrando de pé só com caixote ou carrinho na frente; sem ele (puxando a corda, no escorregador), a pose de sempre', async () => {
  installBrowserStubs();
  const { createDog } = await import('../src/dogs/dog.js');
  for (const [action, speed] of [['push', 0.6], ['strain', 0]]) {
    const d = createDog('rhaenyra');
    let up = 0;
    for (let f = 0; f < 80; f++) {
      d.update(DT, { speed, action, pushGap: 0 });
      d.object.updateMatrixWorld(true);
      const sh = d.bones.find((b) => b.name === 'FLu').getWorldPosition(new THREE.Vector3());
      const hip = d.bones.find((b) => b.name === 'HLu').getWorldPosition(new THREE.Vector3());
      if (f > 40) up = Math.max(up, sh.y - hip.y);
    }
    assert.ok(up < 0.04, `${action}: nas quatro patas (ombro ${(up * 100).toFixed(1)} cm acima do quadril)`);
  }
});

test('a Radhija fazendo força numa coisa pesada: o aviso diz que só a irmã empurra e fica na tela enquanto ela insiste', async () => {
  // retorno do usuário: "poderia ter um aviso dizendo que é pesado para ela, e só a irmã consegue empurrar" (a dica de
  // cada fase só saía no primeiro toque, por 3,4 s)
  const h = await createHeadlessGame({ level: 1, query: 'dog=radhija' });
  h.game.setStay('rhaenyra', true);
  h.teleport('radhija', 3.2, -2.25, Math.PI / 2);
  h.run(0.3);
  h.clearLog();
  const heavy = () => h.log('hint').filter((x) => /^Pesado demais para a Radhija: só a Rhaenyra consegue empurrar/.test(x.text));
  // segurando o direcional contra o carrinho por 4,5 s
  h.hold([1, 0]);
  h.run(4.5);
  const action = h.info().dogs.radhija.action;
  h.hold(null);
  assert.equal(action, 'strain', 'fazendo força no carrinho');
  assert.ok(heavy().length >= 2, `o aviso aparece e volta enquanto ela insiste (${heavy().length} vez(es))`);
  // parou de fazer força: o aviso não volta
  h.clearLog();
  h.run(4);
  assert.equal(heavy().length, 0, 'parada, sem aviso');
});
