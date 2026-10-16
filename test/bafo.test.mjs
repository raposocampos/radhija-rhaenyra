// Superbafo da Radhija: sistema de cheiro (nuvens, vento, dutos, narizes) e a integração no jogo
// (R / L2: segurar mira, soltar sopra; reações das dogs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScentField } from '../src/game/mechanics/scent.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { PAD } from '../src/game/input.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const openWorld = (colliders = []) => createCollisionWorld({ WORLD: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } }, STATIC_COLLIDERS: colliders });
const run = (f, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) f.update(dt); };

test('cheiro: nuvem parada desacelera, se espalha e some no fim da vida', () => {
  const events = [];
  const f = createScentField({ world: openWorld(), emit: (n) => events.push(n) });
  const c = f.spawn({ x: 0, z: 0, dirX: 1, dirZ: 0, speed: 2.6, life: 5 });
  run(f, 2);
  assert.ok(c.x > 0.8 && c.x < 2.2, `andou um pouco para a frente (x=${c.x.toFixed(2)})`);
  assert.ok(Math.hypot(c.vx, c.vz) < 0.2, 'quase parada');
  assert.ok(c.r > 0.6, `espalhou (r=${c.r.toFixed(2)})`);
  run(f, 3.2);
  assert.equal(f.clouds.length, 0, 'sumiu');
  assert.deepEqual(events, ['scent:spawn', 'scent:fade']);
});

test('cheiro: não atravessa paredes', () => {
  const f = createScentField({ world: openWorld([{ id: 'muro', shape: 'box', x: 1, z: 0, hx: 0.1, hz: 3 }]) });
  const c = f.spawn({ x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4 });
  run(f, 2);
  assert.ok(c.x < 0.9, `parou no muro (x=${c.x.toFixed(2)})`);
});

test('cheiro: o vento leva a nuvem compacta; desligado, ela fica', () => {
  const f = createScentField({ world: openWorld() });
  const wind = f.addWind({ x: -1, z: 0, dirX: 1, dirZ: 0, length: 6, halfWidth: 0.5, strength: 2.4 });
  const c = f.spawn({ x: 0, z: 0, dirX: 0, dirZ: 1, speed: 0.2 });
  run(f, 1.5);
  assert.ok(c.x > 2, `levada pelo vento (x=${c.x.toFixed(2)})`);
  assert.ok(c.r < 0.5, `compacta no vento (r=${c.r.toFixed(2)})`);
  wind.enabled = false;
  const c2 = f.spawn({ x: 0, z: 0, dirX: 0, dirZ: 1, speed: 0.2 });
  run(f, 1.5);
  assert.ok(Math.abs(c2.x) < 0.05, 'sem vento, não vai para o lado');
});

test('cheiro: o duto só engole com o ventilador ligado e solta na saída; o nariz reage uma vez', () => {
  const events = [];
  const f = createScentField({ world: openWorld(), emit: (n, p) => events.push([n, p]) });
  let on = false;
  f.addWind({ x: -2, z: 0, dirX: 1, dirZ: 0, length: 3, halfWidth: 0.4, strength: 2.4 });
  f.addDuct({ id: 'duto', inlet: { x: 0.8, z: 0, r: 0.35 }, outlet: { x: 5, z: 5, dirX: 0, dirZ: -1 }, travel: 1, active: () => on });
  let smelled = 0;
  f.addNose({ id: 'pombo', x: 5, z: 4, r: 0.5, onSmell: () => { smelled++; } });
  f.spawn({ x: -1.5, z: 0, dirX: 1, dirZ: 0, speed: 1 });
  run(f, 3);
  assert.equal(events.filter(([n]) => n === 'scent:duct').length, 0, 'duto desligado: não engole');
  assert.equal(smelled, 0);
  on = true;
  f.spawn({ x: -1.5, z: 0, dirX: 1, dirZ: 0, speed: 1 });
  run(f, 4);
  assert.equal(events.filter(([n]) => n === 'scent:duct').length, 1, 'engoliu');
  assert.equal(events.filter(([n]) => n === 'scent:exit').length, 1, 'saiu do outro lado');
  assert.equal(smelled, 1, 'o nariz sentiu uma vez só');
});

test('cheiro: a prévia segue o mesmo caminho da nuvem de verdade (inclusive pelo duto)', () => {
  const f = createScentField({ world: openWorld([{ id: 'muro', shape: 'box', x: 2.5, z: 0, hx: 0.1, hz: 3 }]) });
  f.addWind({ x: -2, z: 0, dirX: 1, dirZ: 0, length: 3, halfWidth: 0.4, strength: 2.4 });
  f.addDuct({ inlet: { x: 0.8, z: 0, r: 0.35 }, outlet: { x: 4, z: 3, dirX: 0, dirZ: -1 }, travel: 0.5 });
  const shot = { x: -1.5, z: 0, dirX: 1, dirZ: 0, speed: 1 };
  const p = f.preview(shot, { secs: 2.5, dt: 1 / 20 });
  assert.equal(p.exits.length, 1, 'a prévia mostra a saída do duto');
  const c = f.spawn(shot);
  for (let k = 0; k < 50; k++) f.update(1 / 20);
  const end = p.points.at(-1);
  assert.ok(Math.hypot(end.x - c.x, end.z - c.z) < 1e-9, 'fim da prévia = posição real');
});

test('superbafo: segurar R mira (parada, prévia), soltar sopra uma nuvem na frente da Radhija', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.teleport('radhija', -2.0, -1.0, Math.PI / 2);
  h.run(0.3);
  h.clearLog();
  h.keyDown('KeyR');
  h.hold([1, 0]); // segurando o analógico: só gira, não anda
  h.run(0.6);
  let i = h.info();
  assert.ok(i.bafo.aiming);
  assert.equal(i.dogs.radhija.action, 'bafoAim');
  assert.ok(i.dogs.radhija.speed < 0.05, 'parada enquanto mira');
  assert.equal(h.log('bafo:aim').length, 1);
  h.hold(null);
  h.keyUp('KeyR');
  h.run(0.1);
  i = h.info();
  assert.ok(!i.bafo.aiming);
  assert.equal(i.dogs.radhija.action, 'bafo');
  assert.equal(h.log('dog:bafo').length, 1);
  assert.equal(i.scent.clouds.length, 1);
  const c = i.scent.clouds[0];
  assert.ok(c.x > i.dogs.radhija.x, 'a nuvem nasce na frente (leste)');
  h.run(1.2);
  assert.equal(h.info().dogs.radhija.action, 'proud', 'toda orgulhosa depois do bafo');
  // recarga: segurar e soltar de novo logo em seguida
  h.tap('KeyR');
  h.run(0.2);
  assert.ok(h.log('dog:bafo').length >= 1);
});

test('superbafo: L2 do controle mira e sopra; L2 segurado no menu não vaza', async () => {
  const h = await createHeadlessGame({ level: 1 });
  const l2 = (on) => h.setPad(h.pad({ down: on ? [PAD.LT] : [] }));
  l2(false);
  h.run(0.2);
  l2(true);
  h.run(0.4);
  assert.ok(h.info().bafo.aiming, 'L2 mira');
  l2(false);
  h.run(0.2);
  assert.equal(h.log('dog:bafo').length, 1, 'soltar L2 sopra');
  h.tap('Escape');
  l2(true);
  h.events.emit('ui:resume', {});
  h.run(0.5);
  assert.ok(!h.info().bafo.aiming, 'L2 do menu travado até soltar');
  h.setPad(null);
});

test('superbafo: a Rhaenyra não tem bafo (dica) e faz "eca" perto da nuvem', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  h.tap('KeyR');
  h.run(0.3);
  assert.equal(h.log('dog:bafo').length, 0);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Só a Radhija tem o superbafo')));
  // Radhija sopra na direção da Rhaenyra parada
  h.tap('KeyQ');
  h.teleport('radhija', -2.0, -1.0, Math.PI / 2);
  h.teleport('rhaenyra', -0.9, -1.0, -Math.PI / 2);
  h.tap('KeyF'); // Rhaenyra fica
  h.run(0.3);
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyUp('KeyR');
  assert.ok(h.run(2.5, { until: (s) => s.dogs.rhaenyra.action === 'yuck' }), 'Rhaenyra faz "eca"');
  assert.equal(h.log('dog:yuck').length, 1);
});

test('superbafo: pausar ou trocar de dog cancela a mira (sem nuvem, sem prévia)', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.keyDown('KeyR');
  h.run(0.3);
  h.tap('KeyQ');
  h.keyUp('KeyR');
  h.run(0.3);
  assert.equal(h.log('dog:bafo').length, 0, 'trocar no meio da mira não sopra');
  assert.ok(!h.info().bafo.aiming);
  h.tap('KeyQ');
  h.keyDown('KeyR');
  h.run(0.3);
  h.tap('Escape');
  assert.equal(h.info().state, 'paused');
  assert.ok(!h.info().bafo.aiming, 'pausa cancela a mira');
  h.keyUp('KeyR');
});
