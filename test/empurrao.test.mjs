// Empurrão em pé da Rhaenyra: escolha do ponto (pickShoveSpot), o roteiro do controlador (fica de pé, empurra em
// ciclos enquanto o botão está seguro, desce; nunca atravessa o que empurra), o empurrável (createShoveTarget: balança,
// solta o item no terceiro empurrão, a queda termina num ponto livre sem passar do chão), a irmã (passinhos para trás,
// "hmpf", no Fica não sai do lugar), a Arena do Empurrão inteira com as teclas e o cenário real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollisionWorld } from '../src/game/collision.js';
import {
  createController, placeController, steer, integrate, pickShoveSpot, startShove, shoveStance, canJump, canDash,
  SHOVE_UP, SHOVE_CYCLE, SHOVE_HIT, SHOVE_DOWN, SHOVE_REACH, SHOVE_GAP,
} from '../src/game/dogController.js';
import { createShoveTarget, fallPath, SHOVE_SLIDE } from '../src/game/mechanics/shoveTarget.js';
import { createShove, REACT_STEP, REACT_DUR, SISTER_SPOT } from '../src/game/shove.js';
import { withStart } from '../src/dogs/config.js';
import { LEVELS } from '../src/levels/index.js';
import empurra from '../src/levels/_empurra/index.js';
import { createHeadlessGame, installBrowserStubs } from './helpers/headless.mjs';
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
  assert.deepEqual(tgt.itemAt && { x: +tgt.itemAt.x.toFixed(3), z: +tgt.itemAt.z.toFixed(3) }, { x: -0.6, z: -0.5 }, 'o primeiro ponto tinha uma pedra; o segundo, a irmã: o terceiro');
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

test('irmã: o ponto acompanha a irmã até as patas chegarem; o empurrão faz ela dar passinhos para trás e bufar', () => {
  const log = [];
  const sh = createShove({ emit: (n, p) => log.push([n, p]) });
  const world = createCollisionWorld({ WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } }, STATIC_COLLIDERS: [] });
  const A = rhaenyra(0, 0.62, Math.PI); // olhando para a irmã (norte)
  const C = radhija(0, 0, Math.PI / 2); // de lado para a Rhaenyra
  assert.equal(sh.frame(A, C, { held: true, world, sisterFree: false }), false, 'sem a irmã liberada, nada');
  assert.equal(sh.frame(A, C, { held: true, world, sisterFree: true }), true, 'de pé na irmã');
  assert.equal(A.shove.id, SISTER_SPOT);
  assert.equal(A.shove.sister, 'radhija');
  assert.ok(Math.abs(A.shove.y - (C.cfg.visual.shoulder + 0.02)) < 1e-9, 'patas nas costas dela');
  const ctrls = { radhija: C, rhaenyra: A };
  let hit = false;
  for (let i = 0; i < 200 && A.shove; i++) {
    sh.frame(A, C, { held: true, world, sisterFree: true });
    steer(A, DT, { dx: 0, dz: 0, speed: 0 });
    integrate(A, DT, world);
    if (A.shoveHit) {
      hit = true;
      sh.hit(A, C, { stay: {}, ctrls });
    }
    sh.update(DT);
    const lock = sh.lockFor(C);
    const intent = lock ? { dx: lock.move?.dx ?? 0, dz: lock.move?.dz ?? 0, speed: lock.move?.speed ?? 0, faceX: lock.faceX, faceZ: lock.faceZ } : { dx: 0, dz: 0, speed: 0 };
    steer(C, DT, intent);
    integrate(C, DT, world);
    assert.ok(Math.hypot(A.x - C.x, A.z - C.z) > A.r + C.r - 0.06, `quadro ${i}: uma dentro da outra`);
  }
  assert.ok(hit, 'empurrou');
  assert.equal(log.filter(([n]) => n === 'dog:shoved').length, 1, 'um empurrão: ela saiu e a Rhaenyra desceu');
  assert.equal(A.shove, null, 'desceu sozinha (a irmã saiu do lugar)');
  assert.ok(C.z < -0.18, `a irmã se afastou uns passinhos (z = ${C.z.toFixed(2)})`);
  assert.ok(log.some(([n]) => n === 'dog:huff'), '"hmpf"');
  // no "hmpf" ela para sem girar o corpo (olha para trás só com a cabeça)
  while (sh.lockFor(C) && sh.lockFor(C).move) { sh.update(DT); const l = sh.lockFor(C); steer(C, DT, { dx: l.move?.dx ?? 0, dz: l.move?.dz ?? 0, speed: l.move?.speed ?? 0, faceX: l.faceX, faceZ: l.faceZ }); integrate(C, DT, world); }
  const yaw0 = C.yaw;
  for (let i = 0; i < Math.round(REACT_DUR / DT); i++) {
    sh.update(DT);
    const lock = sh.lockFor(C);
    steer(C, DT, lock ? { dx: 0, dz: 0, speed: 0, faceX: lock.faceX, faceZ: lock.faceZ } : { dx: 0, dz: 0, speed: 0 });
    integrate(C, DT, world);
    if (lock) assert.ok(sh.lookFor('radhija'), 'olha para a Rhaenyra');
  }
  assert.ok(Math.abs(C.yaw - yaw0) < 0.12, `não girou parada (${(C.yaw - yaw0).toFixed(2)} rad)`);
  assert.equal(sh.lockFor(C), null, 'a reação acabou');
});

test('irmã no Fica: o empurrão não tira ela do lugar, só o tranco e o "hmpf"', () => {
  const sh = createShove({ emit: () => {} });
  const A = rhaenyra(0, 0.62, Math.PI);
  const C = radhija(0, 0, Math.PI / 2);
  sh.frame(A, C, { held: true, sisterFree: true });
  A.shoveHit = A.shove;
  sh.hit(A, C, { stay: { radhija: true } });
  assert.equal(sh.lockFor(C), null, 'sem trava: continua sentada');
  sh.update(0.05);
  assert.ok(sh.shovedFor('radhija')?.k > 0, 'tranco');
  sh.update(REACT_STEP);
  assert.ok(sh.huffFor('radhija') > 0.5, '"hmpf"');
  assert.ok(sh.lookFor('radhija'), 'olha para a Rhaenyra');
  sh.update(REACT_DUR);
  assert.equal(sh.huffFor('radhija'), 0);
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

test('Arena do Empurrão: segurando Shift de frente para a irmã, ela é empurrada e se afasta (sem ninguém dentro de ninguém)', async () => {
  const h = await arena();
  h.teleport('radhija', -1.0, -0.4, Math.PI / 2);
  h.game.setStay('radhija', false);
  h.teleport('rhaenyra', -1.0, 0.25, Math.PI);
  h.run(0.05);
  h.clearLog();
  h.hold(null, ['ShiftLeft']);
  const R = h.ctrls.radhija;
  const A = h.ctrls.rhaenyra;
  let minZ = R.z;
  const z0 = R.z;
  for (let i = 0; i < Math.round((SHOVE_UP + SHOVE_CYCLE + 0.3) / DT); i++) {
    h.step();
    minZ = Math.min(minZ, R.z);
    assert.ok(Math.hypot(A.x - R.x, A.z - R.z) > A.r + R.r - 0.06, `quadro ${i}: uma dentro da outra`);
  }
  h.hold(null);
  h.run(REACT_DUR, { until: () => { minZ = Math.min(minZ, R.z); return false; } });
  assert.equal(h.log('dog:shoved').length, 1, 'empurrou a irmã');
  assert.ok(minZ < z0 - 0.15, `a irmã se afastou (de ${z0.toFixed(2)} até ${minZ.toFixed(2)})`);
  assert.equal(h.info().dogs.rhaenyra.shove, null, 'a Rhaenyra desceu');
  assert.ok(h.log('dog:huff').length === 1, '"hmpf"');
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
    { name: 'irmã', spot: { ...SPOT, y: 0.32, over: 0.1, w: 0, kind: 'sister' } },
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
        if (K.trunkR) {
          // o tronco: nenhum osso dentro dele (até 1 m de altura)
          const dAx = Math.hypot(v.x - S.x + S.nx * K.trunkR, v.z - S.z + S.nz * K.trunkR);
          assert.ok(v.y > 1 || dAx > K.trunkR + 0.01, `${K.name}: ${b.name} dentro do tronco (${dAx.toFixed(3)} m do eixo)`);
        } else if (S.kind === 'sister') {
          // a irmã: nada abaixo das costas dela no lado de lá da face (as patas da frente apoiam em cima)
          assert.ok(pen < 0.02 || v.y > S.y - 0.02, `${K.name}: ${b.name} entrou na irmã (${pen.toFixed(3)} m, y ${v.y.toFixed(3)})`);
        } else {
          // mesinha e estante: além da face, só acima do tampo
          assert.ok(pen < 0.005 || v.y > S.y + 0.01, `${K.name}: ${b.name} atravessou a frente (${pen.toFixed(3)} m, y ${v.y.toFixed(3)})`);
        }
      }
      if (c.shoveStage === 'push' && c.shoveCycle > 0.45 && c.shoveCycle < 0.6) {
        const p = (n) => d.bones.find((b) => b.name === n).getWorldPosition(new THREE.Vector3());
        paws.push({ FL: p('FLp'), FR: p('FRp'), HL: p('HLp'), HR: p('HRp'), hip: p('HLu') });
      }
    }
    assert.ok(minY > -0.006, `${K.name}: ${worst} abaixo do chão (${minY.toFixed(3)})`);
    assert.ok(paws.length > 3, `${K.name}: empurrou`);
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

test('irmã empurrada no modelo real: tranco e "hmpf" sem NaN e sem atravessar o chão', async () => {
  installBrowserStubs();
  const { createDog } = await import('../src/dogs/dog.js');
  const d = createDog('radhija');
  const v = new THREE.Vector3();
  for (let i = 0; i < 120; i++) {
    const t = i * DT;
    const k = t < 0.3 ? Math.sin((t / 0.3) * Math.PI) : 0;
    d.update(DT, { speed: 0, action: 'none', shoved: k > 0 ? { k, side: 1, fwd: -0.3 } : null, huff: t > 0.6 ? Math.min(1, (t - 0.6) / 0.2) : 0, lookAt: { x: 0.6, y: 0.45, z: 0.4 } });
    d.object.updateMatrixWorld(true);
    for (const b of d.bones) {
      assert.ok(Number.isFinite(b.quaternion.x + b.position.y), `osso ${b.name} inválido`);
      assert.ok(b.getWorldPosition(v).y > -0.006, `${b.name} abaixo do chão`);
    }
  }
});
