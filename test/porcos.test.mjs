// Porquinhos: o modelo (src/characters/pig.js), a mecânica (src/game/mechanics/pigHerd.js), o chiqueiro
// (pigPenLayout), os legumes (src/world/veggies.js) e a Arena dos Porquinhos (src/levels/_porcos/, ?level=porcos).
// O modelo é montado DE VERDADE no Node (SDF → malha com esqueleto); nada atravessa o chão em nenhuma pose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { installBrowserStubs, createHeadlessGame } from './helpers/headless.mjs';
import { createCollisionWorld, hingeTip } from '../src/game/collision.js';
import { createPigHerd, pigPenLayout, PIG_DEFAULTS } from '../src/game/mechanics/index.js';
import { LEVELS } from '../src/levels/index.js';
import porcos from '../src/levels/_porcos/index.js';
import { SOUND_NAMES } from '../src/fx/audio/sounds.js';

installBrowserStubs();
const { createPig } = await import('../src/characters/pig.js');
const { createVeggie } = await import('../src/world/veggies.js');

const L = porcos.layout;
const levels = [...LEVELS, porcos];
const arena = (query = '') => createHeadlessGame({ level: levels.length, levels, query });

/** Ponto mais baixo de TODAS as malhas do porquinho (pele com esqueleto e peças rígidas), no mundo. */
function lowestPoint(pig) {
  pig.object.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let low = Infinity;
  pig.object.traverse((o) => {
    const m = /** @type {THREE.Mesh} */ (o);
    if (!m.isMesh || !m.visible || m.userData.noShadow) return;
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      if (v.y < low) low = v.y;
    }
  });
  return low;
}

// ---------------------------------------------------------------------------------------------- modelo
test('porquinho: uma malha com esqueleto + peças rígidas, materiais e geometria compartilhados, enxuto', () => {
  const a = createPig({ variant: 0 });
  const b = createPig({ variant: 1 });
  const meshes = (p) => { const out = []; p.object.traverse((o) => { if (/** @type {any} */ (o).isMesh) out.push(o); }); return out; };
  const ma = meshes(a), mb = meshes(b);
  assert.equal(ma.filter((m) => m.isSkinnedMesh).length, 1, 'corpo inteiro (tronco, cabeça, patas) numa malha só');
  assert.ok(ma.length <= 9, `poucas malhas por porquinho (${ma.length})`);
  const mats = new Set(ma.filter((m) => !m.userData.noShadow).map((m) => m.material));
  assert.ok(mats.size <= 2, `pele e olhos: ${mats.size} materiais`);
  assert.equal(ma[0].material, mb[0].material, 'os porquinhos dividem os materiais');
  const ga = a.body.geometry, gb = b.body.geometry;
  assert.notEqual(ga, gb, 'cada variante tem as suas manchinhas…');
  assert.equal(ga.attributes.position, gb.attributes.position, '…mas a malha (posições, ossos) é a mesma');
  assert.notEqual(ga.attributes.color, gb.attributes.color);
  assert.equal(a.skeleton.bones.length, 10);
  assert.ok(a.stats.tris > 3000 && a.stats.tris < 16000, `triângulos: ${a.stats.tris}`);
  assert.ok(a.radius > 0.2 && a.radius < 0.26);
});

test('porquinho: nada atravessa o chão em nenhuma ação nem gesto (e em pé os cascos ficam no chão)', () => {
  const poses = [
    ['parado', { action: 'idle' }],
    ['andando', { action: 'walk', speed: 0.55 }],
    ['trotando', { action: 'walk', speed: 1.55 }],
    ['fuçando', { action: 'sniff' }],
    ['comendo', { action: 'eat' }],
    ['alerta', { action: 'alert' }],
    ['deitado', { action: 'lie' }],
    ['dormindo', { action: 'sleep' }],
    ['girando parado', { action: 'idle', turn: 2.4 }],
  ];
  for (const [name, anim] of poses) {
    const pig = createPig({ variant: 2 });
    let worst = Infinity;
    for (let i = 0; i < 200; i++) {
      if (i === 60) pig.oink();
      if (i === 100) pig.bump();
      if (i === 130) pig.shake();
      pig.update(1 / 60, anim);
      if (i % 10 === 9) worst = Math.min(worst, lowestPoint(pig));
    }
    assert.ok(worst > -0.006, `${name}: ponto mais baixo ${worst.toFixed(4)} m`);
    if (name !== 'deitado' && name !== 'dormindo') {
      assert.ok(pig.lift < 0.01, `${name}: em pé, a trava não ergue o corpo (${pig.lift.toFixed(4)})`);
      assert.ok(worst < 0.012, `${name}: os cascos encostam no chão (${worst.toFixed(4)})`);
    }
  }
});

test('porquinho: deitado o corpo encosta no chão; dormindo tomba de lado e fecha os olhos', () => {
  const pig = createPig({ variant: 0 });
  for (let i = 0; i < 240; i++) pig.update(1 / 60, { action: 'lie' });
  const lie = lowestPoint(pig);
  assert.ok(lie > -0.006 && lie < 0.02, `deitado: barriga no chão (${lie.toFixed(4)})`);
  for (let i = 0; i < 360; i++) pig.update(1 / 60, { action: 'sleep' });
  const body = pig.skeleton.bones[0];
  const e = new THREE.Euler().setFromQuaternion(body.quaternion, 'YXZ');
  assert.ok(Math.abs(e.z) > 1.0, `de lado (rolagem ${e.z.toFixed(2)})`);
  assert.ok(lowestPoint(pig) > -0.006, 'dormindo, nada no chão');
  const eyes = [];
  pig.object.traverse((o) => { if (o.parent?.parent === pig.skeleton.bones[1] && /** @type {any} */ (o).isMesh && o.parent.scale.y < 0.5) eyes.push(o); });
  assert.equal(eyes.length, 2, 'olhinhos fechados');
});

test('porquinho: girando parado ele dá passinhos (nada de girar como pião) e anda mais rápido trota', () => {
  const pig = createPig({ variant: 1 });
  for (let i = 0; i < 90; i++) pig.update(1 / 60, { action: 'idle', turn: 2.2 });
  const g = pig.gait;
  assert.ok(g.move > 0.45, `as patas andam enquanto ele gira (${g.move.toFixed(2)})`);
  const p0 = g.phase;
  pig.update(1 / 60, { action: 'idle', turn: 2.2 });
  assert.notEqual(pig.gait.phase, p0);
  for (let i = 0; i < 90; i++) pig.update(1 / 60, { action: 'walk', speed: 1.6 });
  assert.ok(pig.gait.trot > 0.9, 'a 1,6 m/s é trote');
  for (let i = 0; i < 90; i++) pig.update(1 / 60, { action: 'walk', speed: 0.5 });
  assert.ok(pig.gait.trot < 0.05, 'a 0,5 m/s é passo');
});

// ---------------------------------------------------------------------------------------------- chiqueiro
test('chiqueiro: porteira fechada sobre o vão, abre para fora; as cercas não cobrem o vão', () => {
  for (const side of ['n', 's', 'e', 'w']) {
    const along = side === 'n' || side === 's';
    const PEN = { x0: 0, x1: 2, z0: 0, z1: 2, door: along ? { side, a: 0.6, b: 1.4 } : { side, a: 0.5, b: 1.3 } };
    const P = pigPenLayout(PEN, `t-${side}`);
    const shut = hingeTip(P.gate, 0);
    assert.ok(Math.hypot(shut.x - P.gate.latchPost.x, shut.z - P.gate.latchPost.z) < 1e-9, `${side}: fechada encosta no trinco`);
    const open = hingeTip(P.gate, 1);
    const inside = (p) => p.x > PEN.x0 && p.x < PEN.x1 && p.z > PEN.z0 && p.z < PEN.z1;
    assert.ok(!inside(open), `${side}: abre para fora`);
    assert.ok(inside(P.door.in) && !inside(P.door.out), `${side}: door.in dentro, door.out fora`);
    const world = createCollisionWorld({ WORLD: { bounds: { minX: -5, maxX: 7, minZ: -5, maxZ: 7 } }, STATIC_COLLIDERS: P.colliders });
    const mid = { x: (P.gate.hinge.x + P.gate.latchPost.x) / 2, z: (P.gate.hinge.z + P.gate.latchPost.z) / 2 };
    assert.ok(!world.overlaps(mid.x, mid.z, 0.2, 'large'), `${side}: o vão fica livre (a porteira é dinâmica)`);
    assert.ok(world.overlaps(along ? 0.2 : P.gate.hinge.x, along ? P.gate.hinge.z : 0.2, 0.1, 'large'), `${side}: cerca no resto do lado`);
  }
});

// ---------------------------------------------------------------------------------------------- mecânica pura
/** Rebanho num mundo de teste (sem modelos: rápido), com dogs falsas. */
function herd(cfgOver = {}, { effects = null, knockItem = null, carries = null } = {}) {
  const PEN = { x0: 2, x1: 4, z0: -3, z1: -1, door: { side: 's', a: 2.6, b: 3.4 } };
  const P = pigPenLayout(PEN);
  const world = createCollisionWorld({ WORLD: { bounds: { minX: -4, maxX: 4.5, minZ: -3.5, maxZ: 4 } }, STATIC_COLLIDERS: P.colliders });
  const log = [];
  const emit = (name, p) => log.push({ ...p, ev: name }); // (o payload tem `name` da dog: o evento vai em `ev`)
  const cfg = { pen: P.pen, door: P.door, gate: P.gate, area: { minX: -0.5, maxX: 4.5, minZ: -3.5, maxZ: 4 }, ...cfgOver };
  const pigs = createPigHerd({ id: 'p', cfg, world, emit, effects, knockItem });
  const dog = (name, x, z, r) => ({ name, x, z, r, size: name === 'rhaenyra' ? 'large' : 'small', vx: 0, vz: 0, yaw: 0, hits: [] });
  const ctrls = { radhija: dog('radhija', -3, 3, 0.17), rhaenyra: dog('rhaenyra', -3.5, 3.5, 0.22) };
  const run = (sec, active = ctrls.radhija) => {
    for (let i = 0; i < Math.round(sec * 60); i++) pigs.update(1 / 60, { active, ctrls, carries });
  };
  return { pigs, world, ctrls, run, log, P, events: (n) => log.filter((e) => e.ev === n) };
}

test('rebanho: presos no cercado até a porteira abrir; soltos, saem um atrás do outro', () => {
  const h = herd();
  h.run(4);
  assert.equal(h.pigs.info().inPen, 3, 'porteira fechada: todos no chiqueiro');
  assert.ok(h.pigs.pigs.every((P) => P.state === 'pen'));
  h.pigs.setOpen(true);
  assert.equal(h.events('pig:gate').length, 1);
  h.run(1.2);
  assert.equal(h.events('pig:release').length, 1, 'pig:release quando a porteira abriu');
  h.run(8);
  const inf = h.pigs.info();
  assert.equal(inf.inPen, 0, `todos saíram (${JSON.stringify(inf.pigs.map((p) => p.state))})`);
  assert.ok(inf.released);
  for (const P of h.pigs.pigs) {
    const a = h.pigs.cfg.area;
    assert.ok(P.x >= a.minX + P.r - 1e-6 && P.x <= a.maxX - P.r + 1e-6 && P.z >= a.minZ + P.r - 1e-6 && P.z <= a.maxZ - P.r + 1e-6, 'dentro da área');
  }
});

test('rebanho: vão atrás da dog ativa, ficam à frente dela, encostam e dão esbarrões de leve', () => {
  const knocks = [];
  const effects = { busy: () => false, knock: (c, nx, nz, dist) => { knocks.push({ name: c.name, dist }); c.x += (nx / Math.hypot(nx, nz)) * dist; c.z += (nz / Math.hypot(nx, nz)) * dist; } };
  const h = herd({}, { effects });
  h.pigs.releaseNow();
  const c = h.ctrls.radhija;
  c.x = 1.0; c.z = 1.0;
  h.run(6);
  const inf = h.pigs.info();
  assert.ok(inf.pestering >= 2, `atrapalhando: ${inf.pestering}`);
  assert.ok(inf.pigs.filter((p) => p.state === 'chase').every((p) => p.dog === 'radhija'), 'atrás da dog ativa');
  assert.ok(knocks.length >= 1 && h.events('pig:bump').length === knocks.length, `esbarrões: ${knocks.length}`);
  assert.ok(knocks.every((k) => k.dist === PIG_DEFAULTS.bumpDist), 'empurrão curto');
  // nunca atravessam a dog nem uns aos outros (sem o empurrão de teste, que teleporta a dog)
  effects.knock = () => {};
  for (let i = 0; i < 120; i++) {
    h.run(1 / 60);
    for (const P of h.pigs.pigs) {
      assert.ok(Math.hypot(P.x - c.x, P.z - c.z) >= P.r + c.r - 0.02, 'porco não entra na dog');
      for (const Q of h.pigs.pigs) if (Q !== P) assert.ok(Math.hypot(P.x - Q.x, P.z - Q.z) >= P.r * 2 - 0.03, 'porcos não se atravessam');
    }
  }
  // andando, a dog encontra um porco à frente
  c.vx = 1.8; c.vz = 0; c.yaw = Math.PI / 2;
  h.run(1.5);
  const ahead = h.pigs.pigs.filter((P) => P.state === 'chase' && (P.x - c.x) > 0.2);
  assert.ok(ahead.length >= 1, 'com a dog andando, eles se põem à frente');
});

test('rebanho: quem leva algo na boca é o alvo; o esbarrão derruba o objeto (depois do tempo de graça)', () => {
  const knocks = [];
  const effects = { busy: () => false, knock: () => {} };
  let holding = true;
  const h = herd({}, { effects, carries: (n) => n === 'rhaenyra' && holding, knockItem: (name, hit) => { knocks.push({ name, ...hit }); return true; } });
  h.pigs.releaseNow();
  Object.assign(h.ctrls.radhija, { x: 1.0, z: 1.0 }); // a ativa, mais perto…
  Object.assign(h.ctrls.rhaenyra, { x: 2.6, z: 2.4 }); // …mas quem leva algo na boca é a Rhaenyra
  h.run(1.4);
  assert.equal(knocks.length, 0, 'logo depois de pegar, não derrubam');
  assert.ok(h.pigs.info().pigs.filter((p) => p.state === 'chase').every((p) => p.dog === 'rhaenyra'), 'todos atrás de quem leva algo');
  h.run(6);
  assert.ok(knocks.length >= 1, `derrubaram: ${knocks.length}`);
  assert.ok(knocks.every((k) => k.name === 'rhaenyra' && Math.abs(Math.hypot(k.dirX, k.dirZ) - 1) < 1e-6));
  assert.equal(h.events('pig:knock').length, knocks.length);
  assert.equal(h.pigs.info().knocks, knocks.length);
  // de boca vazia, só esbarram
  holding = false;
  const n = knocks.length;
  h.run(5);
  assert.equal(knocks.length, n, 'sem nada na boca, nada a derrubar');
});

test('rebanho: comida no chão distrai o porco mais perto por um tempo; depois ele volta a atrapalhar (pig:done)', () => {
  const h = herd({ foods: { corn: { time: 6, eat: 3.5 } } });
  h.pigs.releaseNow();
  const c = h.ctrls.radhija;
  c.x = 1.2; c.z = 0.8;
  h.run(3);
  const food = h.pigs.addFood({ x: 1.0, z: 2.6, kind: 'corn', onProgress: (k) => { food.k = k; }, onDone: () => { food.gone = true; } });
  const near = [...h.pigs.pigs].sort((a, b) => Math.hypot(a.x - 1, a.z - 2.6) - Math.hypot(b.x - 1, b.z - 2.6))[0];
  h.run(0.05);
  assert.equal(h.events('pig:smell').length, 1);
  assert.equal(h.events('pig:smell')[0].pig, near.i, 'o porco livre mais perto vai comer');
  h.run(5);
  const eat = h.events('pig:eat');
  assert.equal(eat.length, 1, 'pig:eat na primeira mordida');
  assert.equal(eat[0].time, 6);
  let inf = h.pigs.info();
  const me = inf.pigs[near.i];
  assert.ok(me.distracted && me.left > 0 && me.left < 6, `distraído, faltam ${me.left} s`);
  assert.equal(inf.distracted, 1);
  assert.ok(inf.nextBack > 0 && inf.nextBack <= 6);
  h.run(4);
  assert.ok(food.gone && food.k === 1, 'comeu tudo (onProgress até 1, onDone)');
  assert.equal(h.events('pig:full').length, 1);
  h.run(6);
  const done = h.events('pig:done');
  assert.equal(done.length, 1);
  assert.equal(done[0].reason, 'time');
  assert.ok(h.events('pig:shake').length === 1, 'acordou se sacudindo');
  h.run(1.5);
  inf = h.pigs.info();
  assert.equal(inf.pigs[near.i].distracted, false);
  assert.ok(['chase', 'roam'].includes(inf.pigs[near.i].state), 'voltou a atrapalhar');
  assert.equal(inf.foods.length, 0);
});

test('rebanho: tempos padrão generosos por legume, comida tirada de volta e comida fora da área', () => {
  assert.ok(PIG_DEFAULTS.distractTime >= 25 && PIG_DEFAULTS.distractTime <= 40);
  for (const k of ['corn', 'carrot', 'pumpkin']) {
    const f = PIG_DEFAULTS.foods[k];
    assert.ok(f.time >= 25 && f.time <= 40 && f.eat < f.time, `${k}: ${f.time} s (${f.eat} comendo)`);
  }
  const h = herd();
  h.pigs.releaseNow();
  h.run(1);
  const f = h.pigs.addFood({ x: 1.5, z: 1.5, kind: 'pumpkin' });
  h.run(6);
  assert.equal(f.state, 'eating');
  assert.equal(h.pigs.removeFood(f), true);
  const done = h.events('pig:done');
  assert.equal(done.length, 1);
  assert.equal(done[0].reason, 'taken', 'a dog pegou de volta');
  assert.ok(h.events('pig:oink').some((e) => e.kind === 'grumpy'), 'reclamou');
  const out = h.pigs.addFood({ x: -3.5, z: 3, kind: 'carrot' }); // fora da área
  h.run(3);
  assert.equal(out.state, 'free', 'fora da área, ninguém vai comer');
  const forever = h.pigs.addFood({ x: 2, z: 2.5, kind: 'corn', time: Infinity, eat: 1 });
  h.run(8);
  assert.equal(forever.state, 'done');
  assert.ok(h.pigs.info().pigs.some((p) => p.state === 'nap'), 'com time Infinity ele cochila de vez');
});

test('rebanho: recall leva todos de volta e a porteira fecha; reset volta ao começo', () => {
  const h = herd();
  h.pigs.setOpen(true);
  h.run(10);
  assert.equal(h.pigs.info().inPen, 0);
  h.pigs.recall();
  h.run(14);
  const inf = h.pigs.info();
  assert.equal(inf.inPen, 3, JSON.stringify(inf.pigs));
  assert.equal(h.events('pig:home').length, 1);
  h.run(2);
  assert.ok(h.pigs.gate.t < 0.02, 'porteira fechada');
  assert.equal(h.pigs.open, false);
  h.pigs.setOpen(true);
  h.run(10);
  assert.equal(h.pigs.info().inPen, 0, 'abriu de novo: saem de novo');
  h.pigs.reset();
  assert.equal(h.pigs.info().inPen, 3);
  assert.equal(h.pigs.gate.t, 0);
  assert.equal(h.pigs.info().foods.length, 0);
});

test('rebanho: a dog fora da área não é seguida; eles esperam na beirada', () => {
  const h = herd();
  h.pigs.releaseNow();
  const c = h.ctrls.radhija;
  c.x = 0.2; c.z = 1;
  h.run(4);
  c.x = -1.6; c.z = 1; // passou a cerca
  h.run(5);
  const a = h.pigs.cfg.area;
  for (const P of h.pigs.pigs) assert.ok(P.x >= a.minX + P.r - 1e-6, `fica na área (x=${P.x.toFixed(2)})`);
  assert.ok(h.pigs.pigs.some((P) => P.action === 'alert' && P.x < a.minX + 0.6), 'esperando na beirada, olhando');
});

// ---------------------------------------------------------------------------------------------- legumes
test('legumes: comidos aos poucos (a ponta some), somem no fim e voltam inteiros no reset', () => {
  for (const kind of /** @type {const} */ (['corn', 'carrot', 'pumpkin'])) {
    const v = createVeggie(kind);
    assert.equal(v.object.userData.carryKind, kind === 'pumpkin' ? 'ball' : 'carrot', `${kind}: pose da boca`);
    // triângulos desenhados das partes que vão sendo comidas (grãos, cenoura, casca da abóbora)
    const counts = (k) => {
      v.setEaten(k);
      let sum = 0;
      v.object.traverse((o) => { if (/** @type {any} */ (o).isMesh && o.userData.count != null) sum += o.visible ? o.userData.count : 0; });
      return sum;
    };
    const c0 = counts(0), c5 = counts(0.5), c9 = counts(0.9);
    assert.ok(c0 > c5 && c5 > c9, `${kind}: cada vez menos (${c0} > ${c5} > ${c9})`);
    v.setEaten(1);
    assert.equal(v.object.visible, false, `${kind}: comido até o fim`);
    v.reset();
    assert.equal(v.object.visible, true);
    assert.equal(v.eaten, 0);
    assert.ok(v.groundY > 0.015 && v.groundY < 0.08);
  }
});

// ---------------------------------------------------------------------------------------------- arena
test('arena: os porquinhos começam no chiqueiro; o botão abre a porteira e eles saem', async () => {
  const h = await arena();
  assert.equal(h.info().levelId, 'porcos');
  assert.equal(h.info().stage, 'start');
  assert.equal(h.info().porcos.inPen, 3);
  const r = h.ctrls.radhija.r;
  h.teleport('radhija', L.PEN.x0 + 0.5, L.PEN.z1 + 0.3 + r, Math.PI);
  h.hold([0, -1]);
  h.run(1);
  h.hold(null);
  assert.ok(h.ctrls.radhija.z > L.PEN.z1 + 0.08 - 0.01, 'a cerca do chiqueiro segura a dog do lado de fora');
  h.teleport('radhija', L.BUTTON.x, L.BUTTON.z);
  h.run(0.3);
  assert.equal(h.info().stage, 'pigsOut');
  h.run(8);
  const inf = h.info();
  assert.equal(inf.porcos.inPen, 0, JSON.stringify(inf.porcos.pigs));
  assert.equal(h.log('pig:release').length, 1);
  assert.ok(h.log('plate:press').length >= 1);
});

test('arena: E pega o legume, E de novo joga no chão; na horta um porquinho come; pegar de volta tira dele', async () => {
  const h = await arena();
  h.puzzle.jumpToStage('pigsOut');
  h.run(1);
  // pega o milho no lugar dele, do outro lado
  const V = L.VEGGIES.corn;
  h.teleport('radhija', V.x - 0.3, V.z, Math.PI / 2);
  h.run(0.2);
  h.tap('KeyE');
  let veg = h.info().veggies.find((v) => v.kind === 'corn');
  assert.equal(veg.holder, 'radhija');
  assert.equal(h.dogs.radhija.carryKind, 'carrot', 'milho atravessado na boca, como a cenoura');
  // larga na horta, perto dos porcos
  h.teleport('radhija', 2.6, 0.4, Math.PI / 2);
  h.run(0.2);
  h.clearLog();
  h.tap('KeyE');
  h.run(0.6);
  veg = h.info().veggies.find((v) => v.kind === 'corn');
  assert.equal(veg.state, 'ground');
  assert.ok(veg.food, 'virou comida dos porcos');
  assert.equal(h.log('item:land').length, 1);
  h.run(6);
  assert.equal(h.log('pig:eat').length, 1, 'um porquinho foi comer');
  assert.ok(h.info().porcos.distracted >= 1);
  assert.ok(h.info().veggies.find((v) => v.kind === 'corn').eaten > 0, 'o milho vai sumindo');
  // a Radhija pega o milho de volta (chegando pelo lado oposto ao do porquinho): ele reclama e volta a atrapalhar
  const eater = h.puzzle.pigs.pigs.find((P) => P.state === 'eat');
  assert.ok(eater, 'um porquinho comendo');
  const ux = veg.x - eater.x, uz = veg.z - eater.z, ul = Math.hypot(ux, uz) || 1;
  h.teleport('radhija', veg.x + (ux / ul) * 0.42, veg.z + (uz / ul) * 0.42, Math.atan2(-ux, -uz));
  h.run(0.05);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(h.info().veggies.find((v) => v.kind === 'corn').holder, 'radhija');
  assert.ok(h.log('pig:done').some((e) => e.reason === 'taken'));
});

test('arena: o legume comido até o fim volta para o lugar; o sininho chama os porquinhos de volta', async () => {
  const h = await arena();
  h.puzzle.jumpToStage('pigsOut');
  h.run(0.5);
  assert.equal(h.puzzle.give('carrot', 'rhaenyra'), true);
  h.tap('KeyQ');
  assert.equal(h.info().activeDog, 'rhaenyra');
  h.teleport('rhaenyra', 2.8, 0.2, Math.PI / 2);
  h.run(0.1);
  h.tap('KeyE');
  h.run(1);
  const food = h.info().veggies.find((v) => v.kind === 'carrot');
  assert.equal(food.state, 'ground');
  for (let i = 0; i < 60 * (PIG_DEFAULTS.foods.carrot.eat + 10) && !h.log('pig:full').length; i++) h.step();
  assert.equal(h.log('pig:full').length, 1, 'comeu a cenoura toda');
  assert.equal(h.info().veggies.find((v) => v.kind === 'carrot').state, 'eaten');
  h.run(L.VEGGIES.respawn + 0.2);
  const back = h.info().veggies.find((v) => v.kind === 'carrot');
  assert.equal(back.state, 'home', 'a horta dá outra');
  assert.equal(h.props.veggies.carrot.eaten, 0);
  // sininho
  h.teleport('rhaenyra', L.BELL.x + 0.1, L.BELL.z + 0.55, Math.PI);
  h.run(0.1);
  assert.equal(h.info().prompt, 'Tocar o sininho');
  h.tap('KeyE');
  assert.equal(h.log('bell:ring').length, 1);
  h.teleport('rhaenyra', -2, 1, 0); // sai do caminho
  h.run(20);
  assert.equal(h.info().porcos.inPen, 3, JSON.stringify(h.info().porcos.pigs));
  assert.equal(h.log('pig:home').length, 1);
});

test('arena: os porquinhos derrubam a bolinha da boca; ela fica no chão e a dog pega de novo', async () => {
  const h = await arena();
  h.puzzle.jumpToStage('carrying');
  assert.equal(h.info().ball.holder, 'radhija');
  h.teleport('radhija', 3.0, -0.6, 0); // na horta, perto dos porquinhos
  for (let i = 0; i < 60 * 15 && !h.log('pig:knock').length; i++) h.step();
  assert.equal(h.log('pig:knock').length, 1, 'derrubaram a bolinha');
  h.run(0.6);
  const b = h.info().ball;
  assert.equal(b.holder, null);
  assert.equal(b.air, false);
  assert.equal(h.info().stage, 'pigsOut', 'sem a bolinha, volta a etapa de pegar');
  assert.equal(h.log('item:land').filter((e) => e.kind === 'ball').length, 1);
  assert.ok(h.info().objective.startsWith('Pegue a bolinha de volta'));
  // a dog pega de novo onde caiu (chegando pelo lado oposto ao porquinho mais perto)
  const P = [...h.puzzle.pigs.pigs].sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))[0];
  const ux = b.x - P.x, uz = b.z - P.z, ul = Math.hypot(ux, uz) || 1;
  h.teleport('radhija', b.x + (ux / ul) * 0.3, b.z + (uz / ul) * 0.3, Math.atan2(-ux, -uz));
  h.run(0.05);
  h.tap('KeyE');
  assert.equal(h.info().ball.holder, 'radhija');
  assert.equal(h.info().stage, 'carrying');
});

test('arena: a bolinha do chiqueiro na caminha termina a fase', async () => {
  const h = await arena();
  h.puzzle.jumpToStage('carrying');
  assert.equal(h.info().ball.holder, 'radhija');
  h.teleport('radhija', L.GOAL.x + 0.3, L.GOAL.z, 0);
  h.run(1.2);
  assert.notEqual(h.info().state, 'playing', 'entregue: comemoração');
  h.run(3);
});

test('arena: a Rhaenyra não passa no vão da cerca (pula a cerca baixa); a Radhija passa', async () => {
  const h = await arena('dog=rhaenyra');
  const G = L.HORTA.gap;
  const zg = (G.z0 + G.z1) / 2;
  h.teleport('rhaenyra', L.HORTA.x - 0.6, zg, Math.PI / 2);
  h.hold([1, 0]);
  h.run(1.2);
  h.hold(null);
  assert.ok(h.ctrls.rhaenyra.x < L.HORTA.x, 'vão estreito demais para a Rhaenyra');
  h.tap('KeyQ');
  h.teleport('radhija', L.HORTA.x - 0.6, zg, Math.PI / 2);
  h.hold([1, 0]);
  h.run(1.2);
  h.hold(null);
  assert.ok(h.ctrls.radhija.x > L.HORTA.x + 0.2, 'a Radhija passa pelo vão');
});

test('sons e efeitos: todo evento dos porquinhos tem som ou efeito no feedback, e os sons existem', () => {
  const fb = readFileSync(new URL('../src/fx/feedback.js', import.meta.url), 'utf8');
  for (const ev of ['pig:gate', 'pig:release', 'pig:oink', 'pig:bump', 'pig:smell', 'pig:eat', 'pig:munch', 'pig:full', 'pig:snort', 'pig:snore', 'pig:shake', 'pig:done', 'pig:knock', 'pig:home', 'item:land', 'bell:ring']) {
    assert.ok(fb.includes(`events.on('${ev}'`), `feedback ouve ${ev}`);
  }
  for (const s of ['pigOink', 'pigSnort', 'pigMunch', 'pigBump', 'pigFull', 'pigSnore', 'pigShake', 'pigGate', 'pigKnock', 'veggieDrop', 'bellRing']) {
    assert.ok(SOUND_NAMES.includes(s), `som ${s}`);
  }
  const src = readFileSync(new URL('../src/game/mechanics/pigHerd.js', import.meta.url), 'utf8');
  const emitted = new Set([...src.matchAll(/fire\('(pig:[a-z]+)'/g)].map((m) => m[1]));
  for (const ev of emitted) assert.ok(fb.includes(`events.on('${ev}'`) || ev === 'pig:sleep' || ev === 'pig:wake', `${ev} tem resposta no feedback`);
});
