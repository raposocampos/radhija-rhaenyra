// Interações de verdade (retornos do usuário): a pata aperta o botão do ventilador, a boca morde as cordinhas (fase 1
// e fase 10) e puxa, a cabeça vai na frente na curva e o pulo amortece no pouso. Modelos novos, cenário real e a
// colisão da fase (com a cabeça que desvia ligada), como no jogo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { withSeed, withSeedAsync } from './helpers/seeded.mjs';
import { LEVELS } from '../src/levels/index.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { createController, placeController, steer } from '../src/game/dogController.js';
import { withStart } from '../src/dogs/config.js';
import { createMouthTug, planStep, driveStep } from '../src/game/mechanics/mouthTug.js';

installBrowserStubs();
const DT = 1 / 60;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const level = (id) => LEVELS.find((l) => l.id === id);
const cm = (x) => (x * 100).toFixed(1);

/** Uma dog do modelo novo com o controlador; frame(A) põe o desenho onde o controlador está e anima, como o jogo. */
async function rig(kind, start, world) {
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  const d = createDogV2(kind);
  if (world) d.setWorld(world);
  const c = createController(kind, withStart(kind, start));
  placeController(c, start.x, start.z, start.yaw);
  const frame = (A = {}) => {
    d.object.position.set(c.x, 0, c.z);
    d.object.rotation.y = c.yaw;
    const tt = c.wantYaw - c.yaw;
    d.update(DT, { speed: c.animSpeed, turn: c.yawRate || 0, turnTo: wrap(tt), action: 'none', ...A });
    d.object.updateMatrixWorld(true);
  };
  for (let i = 0; i < 40; i++) frame();
  const bone = (n) => d.bones.find((b) => b.name === n);
  return { d, c, frame, bone };
}

test('botão do ventilador (modelo novo): ela vai até a frente do botão e a pata aperta em cima dele', async () => {
  const L = level('fase9').layout;
  const fan = L.FAN.start;
  const btn = { x: fan.x, y: 0.08, z: fan.z + 0.12 };
  const bad = [];
  for (const [kind, start] of [['rhaenyra', { x: 7.0, z: 1.3, yaw: -Math.PI / 2 }], ['radhija', { x: 7.25, z: 0.95, yaw: -2.5 }], ['radhija', { x: 6.75, z: 1.2, yaw: Math.PI }]]) {
    await withSeedAsync(4, async () => {
      const world = createCollisionWorld(L);
      world.addDynamic({ id: 'ventilador', kind: 'crate', shape: 'box', x: fan.x, z: fan.z, hx: L.FAN.half, hz: L.FAN.half, height: L.FAN.height });
      const { c, frame, bone } = await rig(kind, start, world);
      // o passinho da fase 9 (pressFrom): na frente do botão, pelo sul, de frente para ele
      const step = planStep(c, btn, c.cfg.body.front + 0.17, world, { yaw: Math.PI });
      if (step) while (!driveStep(c, step, DT, world)) frame({ reach: true });
      const far = Math.hypot(c.x - btn.x, c.z - btn.z);
      if (Math.abs(c.x - btn.x) > 0.03 || c.z < btn.z || far > 0.46) bad.push(`${kind}: parou em (${c.x.toFixed(2)}, ${c.z.toFixed(2)}), a ${cm(far)} cm do botão`);
      let best = Infinity;
      const p = new THREE.Vector3();
      const N = Math.round(0.7 / DT);
      for (let i = 0; i <= N; i++) {
        steer(c, DT, { dx: 0, dz: 0, speed: 0, faceX: btn.x, faceZ: btn.z });
        const ox = btn.x - c.x, oz = btn.z - c.z, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
        frame({ action: 'press', reach: true, pressAt: { x: ox * cy - oz * sy, y: btn.y, z: ox * sy + oz * cy }, pressK: i / N });
        for (const n of ['FLp', 'FRp']) {
          bone(n).getWorldPosition(p);
          best = Math.min(best, Math.hypot(p.x - btn.x, p.y - (btn.y + 0.02), p.z - btn.z));
        }
      }
      if (best > 0.02) bad.push(`${kind}: a pata chegou só a ${cm(best)} cm do botão`);
      // depois do aperto, as quatro patas de volta no chão
      for (let i = 0; i < 40; i++) frame();
      const high = ['FLp', 'FRp', 'HLp', 'HRp'].map((n) => bone(n).getWorldPosition(p).y).filter((y) => y > 0.045);
      if (high.length) bad.push(`${kind}: patas no ar depois do aperto (${high.map(cm).join(', ')} cm)`);
    });
  }
  assert.deepEqual(bad, []);
});

/**
 * A dog puxa uma corda de verdade com a boca: o passinho, a mordida (o ponto mordido segue a boca) e a soltura.
 * → { gap (folga máx boca → ponto mordido), first (boca → ponto parado, ao morder), moved (passinho, m), back (a corda
 *     depois de solta: distância do ponto mordido ao de repouso) }
 */
async function pull(fixture, world, kind, start, S) {
  const { d, c, frame } = await rig(kind, start, world);
  fixture.root.add(d.object);
  const tug = createMouthTug({ dogs: { [kind]: d }, ctrls: { [kind]: c }, world });
  S.prop.setGrip(tug.grip);
  tug.start(c, { bite: S.bite, anchor: S.anchor, len: S.len, dur: S.dur, face: S.face });
  const m = new THREE.Vector3();
  let gap = 0, first = -1, t = 0, inside = 0;
  const x0 = c.x, z0 = c.z;
  while (tug.busy() && t < 3) {
    tug.update(DT);
    t += DT;
    const L = tug.lockFor(kind);
    if (!L) break;
    if (!L.drive) steer(c, DT, { dx: 0, dz: 0, speed: 0, faceX: L.faceX, faceZ: L.faceZ });
    const pt = tug.pullT();
    if (pt >= 0) S.onPull(pt);
    frame({ action: L.action, carrying: !!L.bite, lookAt: L.drive ? S.bite : S.look, reach: !!L.reach });
    fixture.built.update(DT, t);
    const g = tug.grip();
    if (!g) continue;
    d.mouthSocket.getWorldPosition(m);
    if (first < 0) first = Math.hypot(m.x - S.bite.x, m.z - S.bite.z);
    if (g.k > 0.9) gap = Math.max(gap, m.distanceTo(g.pos));
    if (g.k > 0.5 && S.inside?.(S.held())) inside++;
  }
  // solta: a corda volta para o lugar dela
  S.onPull(9);
  for (let i = 0; i < 40; i++) {
    t += DT;
    frame();
    fixture.built.update(DT, t);
  }
  const h = S.held();
  return { gap, first, moved: Math.hypot(c.x - x0, c.z - z0), back: Math.hypot(h.x - S.rest.x, h.y - S.rest.y, h.z - S.rest.z), inside, biting: first >= 0 };
}

test('cordinha da fase 1 (modelo novo): ela chega na corda, morde, a corda vai junto com a boca e, no fim, volta', async (t) => {
  const def = level('fase1');
  const L = def.layout;
  const fixture = await buildLevelWorld(def);
  t.after(() => fixture.dispose());
  const { rope } = fixture.built.props;
  const world = createCollisionWorld(L);
  const bad = [];
  for (const [kind, start] of [['radhija', { x: 1.5, z: 0.9, yaw: 0 }], ['radhija', { x: 1.6, z: 0.6, yaw: -0.7 }], ['rhaenyra', { x: 1.5, z: 0.9, yaw: 0 }]]) {
    await withSeedAsync(7, async () => {
      const rest = rope.end.clone();
      const r = await pull(fixture, world, kind, start, {
        prop: rope, bite: rope.bitePoint(), anchor: L.ROPE.anchor, len: 0.52, dur: 0.7, face: L.ROPE.anchor,
        look: { x: L.ROPE.anchor.x, y: L.ROPE.anchor.y - 0.15, z: L.ROPE.anchor.z },
        onPull: (pt) => rope.setTug(pt < 0.6 ? Math.sin((Math.PI * pt) / 0.6) : 0),
        held: () => rope.end, rest,
      });
      if (!r.biting) bad.push(`${kind}: não mordeu`);
      if (r.first > 0.06) bad.push(`${kind}: a boca chegou a ${cm(r.first)} cm da corda`);
      if (r.gap > 0.01) bad.push(`${kind}: a corda ficou ${cm(r.gap)} cm longe da boca`);
      if (r.back > 0.04) bad.push(`${kind}: a corda não voltou (${cm(r.back)} cm do lugar)`);
    });
  }
  assert.deepEqual(bad, []);
});

test('cordinhas da fase 10 (modelo novo): o puxador do portãozinho e a alça do gerador vão na boca (a alça nunca entra no gerador)', async (t) => {
  const def = level('fase10');
  const L = def.layout;
  const fixture = await buildLevelWorld(def);
  t.after(() => fixture.dispose());
  const { cord, generator } = fixture.built.props;
  const world = createCollisionWorld(L);
  const G = L.GENERATOR;
  const handleAt = (o) => o.getWorldPosition(new THREE.Vector3());
  const bad = [];
  const cases = [
    ['radhija', { x: L.CORD.x - 0.33, z: L.CORD.z - 0.06, yaw: Math.PI / 2 }, 'cordinha'],
    ['rhaenyra', { x: L.CORD.x - 0.33, z: L.CORD.z - 0.06, yaw: Math.PI / 2 }, 'cordinha'],
    ['radhija', { x: L.CORD.x - 0.3, z: L.CORD.z - 0.5, yaw: 0.3 }, 'cordinha'],
    ['rhaenyra', { x: G.cord.x + 0.3, z: G.cord.z, yaw: -Math.PI / 2 }, 'gerador'],
    ['rhaenyra', { x: G.cord.x + 0.6, z: G.cord.z + 0.1, yaw: -Math.PI / 2 }, 'gerador'],
  ];
  for (const [kind, start, what] of cases) {
    await withSeedAsync(7, async () => {
      const gen = what === 'gerador';
      const prop = gen ? generator : cord;
      const b = prop.bitePoint(), a = prop.anchor;
      const rest = gen ? handleAt(generator.handle) : handleAt(cord.handle);
      const r = await pull(fixture, world, kind, start, {
        prop, bite: b, anchor: a, len: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) + (gen ? 0.3 : 0.2), dur: gen ? G.pull : 0.75,
        face: gen ? { x: G.x, z: G.z } : { x: L.CORD.x, z: L.CORD.z },
        look: gen ? { x: G.x, y: G.cord.y, z: G.z } : { x: L.CORD.x, y: 0.75, z: L.CORD.z },
        onPull: (pt) => (gen ? generator.setPull(pt < G.pull ? Math.sin((Math.PI * pt) / G.pull) : 0) : cord.setTug(pt < 0.7 ? Math.sin((Math.PI * pt) / 0.7) : 0)),
        held: () => handleAt(prop.handle), rest,
        // a alça dentro da caixa do gerador
        inside: gen ? (p) => p.x < G.x + G.hx - 0.005 && Math.abs(p.z - G.z) < G.hz && p.y < G.h : null,
      });
      const tag = `${kind} (${what})`;
      if (!r.biting) bad.push(`${tag}: não mordeu`);
      if (r.first > 0.06) bad.push(`${tag}: a boca chegou a ${cm(r.first)} cm da cordinha`);
      if (r.gap > 0.01) bad.push(`${tag}: a cordinha ficou ${cm(r.gap)} cm longe da boca`);
      if (r.inside) bad.push(`${tag}: a alça entrou no gerador (${r.inside} quadros)`);
      if (r.back > 0.04) bad.push(`${tag}: não voltou (${cm(r.back)} cm do lugar)`);
    });
  }
  assert.deepEqual(bad, []);
});

test('curva (modelo novo): a cabeça vira primeiro, o tronco vem atrás e, depois da curva, tudo alinha', async () => {
  const q = new THREE.Quaternion(), f = new THREE.Vector3();
  for (const kind of ['radhija', 'rhaenyra']) {
    await withSeedAsync(3, async () => {
      const { c, frame, bone } = await rig(kind, { x: 0, z: 0, yaw: 0 }, null);
      const headYaw = () => { bone('head').getWorldQuaternion(q); f.set(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };
      let lead = 0, settled = 0;
      for (let i = 0; i < 150; i++) {
        const dir = i < 70 ? [0, 1] : [1, 0]; // norte e, de repente, leste: 90° para a esquerda
        steer(c, DT, { dx: dir[0], dz: dir[1], speed: c.cfg.walkSpeed * 0.7 });
        c.x += Math.sin(c.yaw) * c.v * DT;
        c.z += Math.cos(c.yaw) * c.v * DT;
        c.animSpeed = c.v;
        frame();
        const ahead = wrap(headYaw() - c.yaw);
        if (i >= 70 && i < 80) lead = Math.max(lead, ahead);
        if (i >= 110) settled = Math.max(settled, Math.abs(ahead));
      }
      assert.ok(lead > 0.12, `${kind}: a cabeça foi na frente só ${(lead * 57.3).toFixed(0)}°`);
      assert.ok(settled < 0.06, `${kind}: depois da curva a cabeça ficou ${(settled * 57.3).toFixed(0)}° fora do corpo`);
    });
  }
});

test('pulo (modelo novo): as traseiras empurram, as dianteiras pousam primeiro e o pouso afunda e volta, sem pata no chão', async () => {
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  for (const speed of [0, 2]) {
    withSeed(11, () => {
      const d = createDogV2('rhaenyra');
      const bone = (n) => d.bones.find((b) => b.name === n);
      const p = new THREE.Vector3();
      const y = (n) => bone(n).getWorldPosition(p).y;
      for (let i = 0; i < 60; i++) {
        d.object.position.z += speed * DT;
        d.update(DT, { speed, action: 'none' });
      }
      d.object.updateMatrixWorld(true);
      const chest0 = y('chest');
      const H = 0.5, N = Math.round(0.42 / DT);
      let minPaw = Infinity, frontFirst = false, dip = 0, back = Infinity;
      for (let f = 0; f < N + 30; f++) {
        const air = f < N, k = f / N;
        d.object.position.z += (air ? 3 : speed) * DT;
        d.update(DT, { speed: air ? 3 : speed, action: air ? 'jump' : 'none', jump: air ? 4 * H * k * (1 - k) : 0, airK: air ? k : -1 });
        d.object.updateMatrixWorld(true);
        const paws = ['FLp', 'FRp', 'HLp', 'HRp'].map(y);
        minPaw = Math.min(minPaw, ...paws);
        if (air && k > 0.88 && k < 0.98) frontFirst ||= Math.max(paws[0], paws[1]) < Math.min(paws[2], paws[3]) - 0.02;
        if (!air) {
          const t = (f - N) * DT;
          if (t < 0.12) dip = Math.max(dip, chest0 - y('chest'));
          if (t > 0.3) back = Math.min(back, Math.abs(chest0 - y('chest')));
        }
      }
      const tag = speed ? 'andando' : 'parada';
      assert.ok(minPaw > 0.012, `${tag}: pata a ${cm(minPaw)} cm (no chão)`);
      assert.ok(frontFirst, `${tag}: as dianteiras pousam primeiro`);
      assert.ok(dip > 0.02, `${tag}: o pouso afunda o peito (${cm(dip)} cm)`);
      assert.ok(back < 0.015, `${tag}: depois do pouso o peito volta (${cm(back)} cm fora)`);
    });
  }
});

test('corda na boca: arrancando, a arrancada acaba e ela vai até a corda; no ar, nada de passinho (o pulo segue) e sem morder', () => {
  // desenho mínimo: a boca 36 cm à frente e 34 cm acima do meio
  const fake = () => {
    const object = new THREE.Group();
    const mouthSocket = new THREE.Object3D();
    mouthSocket.position.set(0, 0.34, 0.36);
    object.add(mouthSocket);
    return { object, mouthSocket, setCarryPose() {} };
  };
  const d = fake();
  const c = createController('radhija', withStart('radhija', { x: 0, z: 0, yaw: 0 }));
  placeController(c, 0, 0, 0);
  const sync = () => { d.object.position.set(c.x, 0, c.z); d.object.rotation.y = c.yaw; d.object.updateMatrixWorld(true); };
  sync();
  const tug = createMouthTug({ dogs: { radhija: d }, ctrls: { radhija: c }, world: null });
  const bite = { x: 0, y: 0.4, z: 0.8 };
  // arrancando: a arrancada acaba, ela dá o passinho e morde
  c.dashT = 0.2;
  assert.ok(tug.start(c, { bite, anchor: { x: 0, y: 0.8, z: 0.8 }, len: 0.5, dur: 0.7 }) > 0, 'passinho até a corda');
  assert.equal(c.dashT, 0, 'a arrancada acabou');
  for (let i = 0; i < 60 && tug.stepping(); i++) { tug.update(DT); sync(); }
  for (let i = 0; i < 12; i++) { tug.update(DT); sync(); }
  assert.ok(tug.biting(), 'chegou na corda e mordeu');
  assert.ok(Math.abs(c.z + 0.36 - bite.z) < 0.03, `a boca na corda (meio em z ${c.z.toFixed(3)})`);
  tug.reset();
  // no ar: sem passinho (a fase não a move; o pulo segue) e sem morder
  placeController(c, 0, 0, 0);
  sync();
  c.jumpT = 0.2;
  assert.equal(tug.start(c, { bite, anchor: { x: 0, y: 0.8, z: 0.8 }, len: 0.5, dur: 0.7 }), 0, 'no ar, nada de passinho');
  assert.equal(tug.lockFor('radhija').drive, undefined, 'a trava não move a dog');
  for (let i = 0; i < 12; i++) tug.update(DT);
  assert.equal(tug.biting(), false, 'no ar, não morde');
});
