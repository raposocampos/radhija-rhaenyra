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

/** Roda fn guardando o que sair em console.error (a rede de segurança dos porcos registra lá). → as mensagens */
async function consoleErrors(fn) {
  const errs = [];
  const error = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(' ')); };
  try {
    await fn();
  } finally {
    console.error = error;
  }
  return errs;
}

/** Aleatório com semente (mulberry32): a mesma bagunça em toda execução. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/** Roda fn com Math.random trocado por um aleatório com semente. */
function withSeed(seed, fn) {
  const random = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = random;
  }
}

/** Foto curta dos porcos (para a mensagem de um teste que falhou): estado, posição, vez na porteira e rota. */
function snap(h) {
  const f = (v) => +v.toFixed(2);
  return h.pigs.pigs.map((P) => `${P.i}:${P.state}@${f(P.x)},${f(P.z)} t${f(P.t)} s${f(P.stuckT)} ${P.idleAct}`
    + ` r${P.route.map((q) => `${f(q.x)},${f(q.z)}${q.door ? 'D' : q.leaf ? 'L' : ''}`).join('>')}`).join(' | ');
}

/** Quantos porcos saindo ou voltando estão no vão da porteira (a menos de 0,45 m do meio dela) agora. */
function inDoorway(h) {
  const G = h.P.gate;
  const mx = (G.hinge.x + G.latchPost.x) / 2, mz = (G.hinge.z + G.latchPost.z) / 2;
  return h.pigs.pigs.filter((P) => (P.state === 'exit' || P.state === 'return') && Math.hypot(P.x - mx, P.z - mz) < 0.45).length;
}

test('rebanho: presos no cercado até a porteira abrir; soltos, saem um atrás do outro', () => withSeed(191, () => {
  // semente 191: antes, dois porcos entravam juntos no vão, entalavam lado a lado e ninguém saía
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
}));

test('rebanho: a porteira é um de cada vez: em 200 sorteios os três sempre saem, sem dois no vão ao mesmo tempo', () => {
  const bad = [];
  for (let seed = 1; seed <= 200; seed++) {
    withSeed(seed, () => {
      const h = herd();
      h.run(4);
      h.pigs.setOpen(true);
      let most = 0;
      const trace = [];
      for (let k = 0; k < 9.2 * 60; k++) {
        h.run(1 / 60);
        most = Math.max(most, inDoorway(h));
        if (k % 45 === 0) trace.push(`${(k / 60).toFixed(1)}s ${snap(h)}`);
      }
      const inf = h.pigs.info();
      if (inf.inPen > 0 || most > 1 || inf.pigs.some((p) => p.state === 'exit')) bad.push({ seed, inPen: inf.inPen, most, states: inf.pigs.map((p) => p.state), trace: bad.length ? undefined : trace });
    });
  }
  assert.deepEqual(bad, []);
});

test('rebanho: o sininho em 100 sorteios: todos voltam pela porteira, um de cada vez, e ela fecha', () => {
  const bad = [];
  for (let seed = 1; seed <= 100; seed++) {
    withSeed(seed, () => {
      const h = herd();
      h.pigs.setOpen(true);
      h.run(10);
      h.pigs.recall();
      let most = 0;
      const trace = [];
      for (let k = 0; k < 18 * 60; k++) {
        h.run(1 / 60);
        most = Math.max(most, inDoorway(h));
        if (k % 60 === 0) trace.push(`${(k / 60).toFixed(0)}s ${snap(h)}`);
      }
      const inf = h.pigs.info();
      if (inf.inPen < 3 || most > 1 || h.events('pig:home').length !== 1) bad.push({ seed, inPen: inf.inPen, most, home: h.events('pig:home').length, states: inf.pigs.map((p) => p.state), trace: bad.length > 1 ? undefined : trace });
    });
  }
  assert.deepEqual(bad, []);
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

test('rebanho: acabou a distração sem dog por perto: o porco volta a passear (o caso que travava a prévia)', async () => {
  // determinístico: semente fixa e os três porcos em lugares conhecidos, longe uns dos outros
  const random = Math.random;
  Math.random = seeded(36);
  try {
    const h = herd({ foods: { corn: { time: 5, eat: 2 } } });
    h.pigs.releaseNow();
    const spots = [[1.0, 1.0], [3.6, 2.8], [-0.1, 3.2]];
    spots.forEach(([x, z], i) => h.pigs.place(i, x, z, 0, 'roam'));
    // todos no meio de um passeio quando o legume cai (antes, ao voltar, o passeio ficava sem destino e o jogo parava);
    // as dogs estão fora da área: ninguém para correr atrás
    for (const P of h.pigs.pigs) Object.assign(P, { idleAct: 'go', goal: { x: P.x + 0.4, z: P.z - 0.4 }, idleT: 7 });
    h.pigs.addFood({ x: 1.0, z: 1.8, kind: 'corn' }); // 0,8 m do porco 0; os outros, bem mais longe
    const P = h.pigs.pigs[0];
    let x0 = 0, z0 = 0;
    const errs = await consoleErrors(() => {
      h.run(0.05);
      assert.equal(h.events('pig:smell')[0].pig, 0, 'o porco mais perto vai comer');
      assert.equal(P.state, 'toFood');
      assert.equal(P.idleAct, 'go', 'o passeio de antes continua marcado (o caso que travava)');
      h.run(11);
      assert.equal(h.events('pig:done').length, 1, 'comeu, cochilou e acordou');
      assert.equal(h.events('pig:done')[0].reason, 'time');
      x0 = P.x;
      z0 = P.z;
      h.run(6);
    });
    assert.deepEqual(errs, []);
    assert.equal(h.pigs.info().errors, 0);
    assert.equal(P.state, 'roam');
    assert.ok(Math.hypot(P.x - x0, P.z - z0) > 0.1, 'voltou a passear');
  } finally {
    Math.random = random;
  }
});

test('rebanho: um erro num porco não trava o jogo: sai no console uma vez por porco e os outros seguem', async () => {
  const effects = { busy: () => false, knock: () => {} };
  const h = herd({}, { effects, carries: (n) => n === 'rhaenyra', knockItem: () => { throw new Error('falha de teste'); } });
  h.pigs.releaseNow();
  Object.assign(h.ctrls.rhaenyra, { x: 2.6, z: 2.4 });
  const errs = await consoleErrors(() => h.run(12));
  const inf = h.pigs.info();
  assert.ok(inf.errors >= 1, 'o erro aconteceu (e foi pego)');
  assert.ok(errs.length >= 1 && errs.length <= h.pigs.pigs.length, `uma mensagem por porco: ${errs.length}`);
  assert.ok(errs.every((m) => m.includes('[porcos]') && m.includes('falha de teste')));
  for (const P of h.pigs.pigs) {
    assert.ok(Number.isFinite(P.x) && Number.isFinite(P.z));
    assert.ok(['roam', 'chase', 'pen'].includes(P.state), P.state);
  }
  assert.ok(inf.bumps >= 1, 'continuaram esbarrando');
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

test('rebanho: o sininho não prende a dog no chiqueiro: com ela lá dentro, a porteira espera ela sair', () => {
  const h = herd();
  h.pigs.releaseNow();
  h.run(2);
  const c = h.ctrls.radhija;
  Object.assign(c, { x: h.P.pen.x1 - 0.3, z: h.P.pen.z1 - 0.3 }); // num canto do chiqueiro
  h.pigs.recall();
  h.run(16);
  assert.equal(h.events('pig:home').length, 0, 'não fecha com a dog lá dentro');
  assert.ok(h.pigs.gate.t > 0.9, `porteira aberta (${h.pigs.gate.t})`);
  Object.assign(c, { x: 3, z: 0.6 }); // saiu
  h.run(5);
  assert.equal(h.events('pig:home').length, 1, JSON.stringify(h.pigs.info().pigs));
  assert.ok(h.pigs.gate.t < 0.05, 'agora fecha');
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

/**
 * Onde a Radhija (a menor) consegue chegar a partir de (x, z), numa grade, com a porteira aberta (os colisores
 * dinâmicos, porcos e porteira, não contam). near(x, z, d): há um lugar alcançável a menos de d de (x, z)?
 */
function reachableMap(world, from, step = 0.06) {
  const b = world.bounds;
  const ignore = new Set(world.dynamics.map((d) => d.id));
  const nx = Math.ceil((b.maxX - b.minX) / step), nz = Math.ceil((b.maxZ - b.minZ) / step);
  const cx = (i) => b.minX + (i + 0.5) * step, cz = (j) => b.minZ + (j + 0.5) * step;
  const free = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = world.overlaps(cx(i), cz(j), 0.17, 'small', { ignore }) ? 0 : 1;
  const i0 = Math.floor((from.x - b.minX) / step), j0 = Math.floor((from.z - b.minZ) / step);
  const queue = [j0 * nx + i0];
  seen[queue[0]] = 1;
  while (queue.length) {
    const k = queue.pop();
    const i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
      const q = c * nx + a;
      if (free[q] && !seen[q]) { seen[q] = 1; queue.push(q); }
    }
  }
  return {
    count: seen.reduce((s, v) => s + v, 0),
    near(x, z, d) {
      const n = Math.ceil(d / step);
      const ci = Math.floor((x - b.minX) / step), cj = Math.floor((z - b.minZ) / step);
      for (let j = cj - n; j <= cj + n; j++) {
        for (let i = ci - n; i <= ci + n; i++) {
          if (i < 0 || j < 0 || i >= nx || j >= nz || !seen[j * nx + i]) continue;
          if (Math.hypot(cx(i) - x, cz(j) - z) < d) return true;
        }
      }
      return false;
    },
  };
}

test('arena: bagunça longa e aleatória (com semente): nada trava, nada vai para um limbo, tudo segue ao alcance', async () => {
  const random = Math.random;
  const rnd = seeded(20261019);
  Math.random = rnd;
  const problems = [];
  let h = null, map = null, acts = 0;
  const seen = new Set();
  try {
    const errs = await consoleErrors(async () => {
      h = await arena();
      map = reachableMap(h.world, { x: h.ctrls.radhija.x, z: h.ctrls.radhija.z });
      const A = L.PIGS.area, Bn = L.WORLD.bounds;
      const TAU = Math.PI * 2;
      const name = () => h.info().activeDog;
      /** A dog ativa a d de (x, z), virada para lá. */
      const near = (x, z, d = 0.32) => {
        const a = rnd() * TAU;
        h.teleport(name(), x + Math.sin(a) * d, z + Math.cos(a) * d, a + Math.PI);
      };
      const pick = (list) => list[Math.floor(rnd() * list.length)];
      // encostada numa cerca, parede ou caixote, virada para ele (o que ela larga ou derrubam não pode atravessar)
      const walls = () => [
        { x: L.HORTA.x - 0.3, z: Bn.minZ + 0.4 + rnd() * (Bn.maxZ - Bn.minZ - 0.8), yaw: Math.PI / 2 },
        { x: L.HORTA.x + 0.3, z: Bn.minZ + 0.4 + rnd() * (Bn.maxZ - Bn.minZ - 0.8), yaw: -Math.PI / 2 },
        { x: L.PEN.x0 + 0.1 + rnd() * (L.PEN.x1 - L.PEN.x0 - 0.2), z: L.PEN.z1 + 0.33, yaw: Math.PI },
        { x: L.PEN.x0 - 0.33, z: L.PEN.z0 + 0.2 + rnd() * (L.PEN.z1 - L.PEN.z0 - 0.4), yaw: Math.PI / 2 },
        { x: L.PEN.x0 + 0.3 + rnd() * (L.PEN.x1 - L.PEN.x0 - 0.6), z: L.PEN.z0 + 0.3 + rnd() * (L.PEN.z1 - L.PEN.z0 - 0.6), yaw: rnd() * TAU },
        { x: L.CRATE.x - 0.3 + rnd() * 0.6, z: L.CRATE.z + L.CRATE.hz + 0.25, yaw: Math.PI },
        { x: L.CRATE.x + L.CRATE.hx + 0.25, z: L.CRATE.z, yaw: -Math.PI / 2 },
        ...L.BEDS.map((b) => ({ x: b.x - b.hx - 0.25, z: b.z, yaw: Math.PI / 2 })),
        { x: Bn.maxX - 0.25, z: rnd() * 3, yaw: Math.PI / 2 },
        { x: L.BELL.x + 0.3, z: L.BELL.z, yaw: -Math.PI / 2 },
      ];
      const actions = {
        andar() { h.hold([rnd() * 2 - 1, rnd() * 2 - 1], rnd() < 0.3 ? ['ShiftLeft'] : []); run(0.3 + rnd() * 1.4); h.hold(null); },
        trocar() { h.tap('KeyQ'); },
        legume() {
          const v = h.info().veggies.filter((x) => x.state === 'home' || x.state === 'ground');
          if (!v.length) return;
          const t = pick(v);
          near(t.x, t.z);
          run(0.1);
          h.tap('KeyE');
        },
        largar() { h.tap('KeyE'); },
        dar() {
          const other = name() === 'radhija' ? 'rhaenyra' : 'radhija';
          h.puzzle.give(pick(['corn', 'carrot', 'pumpkin']), rnd() < 0.5 ? other : name());
        },
        horta() {
          h.teleport(name(), A.minX + 0.3 + rnd() * (A.maxX - A.minX - 0.6), A.minZ + 0.3 + rnd() * (A.maxZ - A.minZ - 0.6), rnd() * TAU);
          run(0.5 + rnd() * 3);
        },
        parede() {
          const w = pick(walls());
          h.teleport(name(), w.x, w.z, w.yaw);
          run(0.1 + rnd() * 1.5);
          if (rnd() < 0.6) h.tap('KeyE');
        },
        botao() { h.teleport(name(), L.BUTTON.x, L.BUTTON.z); run(0.4); },
        sininho() { near(L.BELL.x, L.BELL.z, 0.45); run(0.1); h.tap('KeyE'); },
        bolinha() {
          const b = h.info().ball;
          if (b.holder || b.air) return;
          near(b.x, b.z, 0.35);
          run(0.1);
          h.tap('KeyE');
        },
        esperar() { run(1 + rnd() * 4); },
      };
      const weights = { andar: 5, trocar: 1, legume: 4, largar: 3, dar: 1, horta: 4, parede: 4, botao: 1, sininho: 1, bolinha: 2, esperar: 3 };
      const bag = Object.entries(weights).flatMap(([k, n]) => Array(n).fill(k));
      const air = {}, eaten = {};
      let frame = 0;
      /** Um quadro e as conferências (a cada quadro: porcos; a cada 0,25 s: legumes e bolinha ao alcance). */
      function step() {
        h.step();
        frame++;
        for (const P of h.puzzle.pigs.pigs) {
          if (!Number.isFinite(P.x) || !Number.isFinite(P.z) || P.x < Bn.minX || P.x > Bn.maxX || P.z < Bn.minZ || P.z > Bn.maxZ) problems.push(`porco ${P.i} fora do mundo (${P.x}, ${P.z})`);
          if (P.state === 'toFood' && P.t > 20) problems.push(`porco ${P.i} preso indo comer (${P.t.toFixed(1)} s)`);
        }
        if (frame % 15) return;
        const inf = h.info();
        const t = h.time.toFixed(1);
        for (const v of inf.veggies) {
          air[v.kind] = v.state === 'air' ? (air[v.kind] || 0) + 0.25 : 0;
          eaten[v.kind] = v.state === 'eaten' ? (eaten[v.kind] || 0) + 0.25 : 0;
          if (air[v.kind] > 1.5) problems.push(`${t} s: ${v.kind} preso no ar`);
          if (eaten[v.kind] > L.VEGGIES.respawn + 1.5) problems.push(`${t} s: ${v.kind} não voltou depois de comido`);
          if (v.state === 'held' && !v.holder) problems.push(`${t} s: ${v.kind} na boca de ninguém`);
          if (v.state === 'ground' && !map.near(v.x, v.z, 0.45)) problems.push(`${t} s: ${v.kind} num limbo em (${v.x}, ${v.z})`);
          seen.add(`legume:${v.state}`);
        }
        const b = inf.ball;
        air.ball = b.air ? (air.ball || 0) + 0.25 : 0;
        if (air.ball > 1.5) problems.push(`${t} s: bolinha presa no ar`);
        if (!b.holder && !b.air && !map.near(b.x, b.z, 0.45)) problems.push(`${t} s: bolinha num limbo em (${b.x}, ${b.z})`);
        if (inf.porcos.errors) problems.push(`${t} s: ${inf.porcos.errors} erro(s) nos porcos`);
        for (const p of inf.porcos.pigs) seen.add(`porco:${p.state}`);
      }
      function run(sec) {
        for (let i = 0, n = Math.round(sec * 60); i < n; i++) step();
      }
      while (h.time < 200 && problems.length < 8) {
        // a bolinha não chega à caminha (isso terminaria a arena no meio da bagunça)
        const holder = h.info().ball.holder;
        if (holder && Math.hypot(h.ctrls[holder].x - L.DOG_BED.x, h.ctrls[holder].z - L.DOG_BED.z) < 2.4) h.teleport(holder, 3.0, 0.5);
        actions[pick(bag)]();
        acts++;
        run(0.1 + rnd() * 0.6);
      }
    });
    assert.ok(map.count > 1000, 'o mapa de alcance tem a arena toda');
    assert.deepEqual(problems, []);
    assert.deepEqual(errs, []);
    assert.equal(h.info().state, 'playing', 'a arena seguiu jogável');
    const inf = h.info().porcos;
    assert.ok(acts > 150, `${acts} ações`);
    assert.ok(inf.bumps > 5 && h.log('item:land').length > 5, `bagunça de verdade: ${inf.bumps} esbarrões, ${h.log('item:land').length} quedas, ${inf.knocks} derrubadas`);
    for (const s of ['porco:chase', 'porco:eat', 'legume:ground', 'legume:held']) assert.ok(seen.has(s), `passou por ${s} (${[...seen].join(', ')})`);
  } finally {
    Math.random = random;
    h?.releaseAll();
  }
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
